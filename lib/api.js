// 记忆核心 · 知识库 JSON API（与宿主无关的纯 HTTP 层）。
//
// 从 index.js 抽出的 handleApi/json：逻辑原封不动，仅把对 DSH 闭包
// （vaultDir/vaultRoots/settings）的依赖改为通过 createApi(deps) 注入，
// 使 DSH 插件（经 webServer 前缀路由）与独立 Web server（lib/web.js）
// 共用同一份 API 实现。
//
// deps:
// - vaultDir()  → 当前激活 vault 根目录（string）
// - vaultRoots() → [{ name, root }] 全部 profile 根（跨库聚合用）
// - getSettings() → 插件设置对象（/budget /compress 读取；可选，缺省 {}）

import { listCards, readCard, search, searchAll, graph, graphAll, overview, exportCards, deleteCard, writeCard, parseCard, stats, optimizeCandidates, optimizeApply, addFeedback, dailyBrief, dailyCounts, mergeCards, ensureVault, auditQueue, recycleList, purgeExpired, setCardStatus, restoreCard } from './vault.js'
import { compressExcerpt } from './capture.js'
import { getSetupStatus, runSetup, mcpAgentAction } from './setup.js'

export const API_PREFIX = '/memory-eternal/api'

export function createApi(deps = {}) {
  const vaultDir = deps.vaultDir ?? (() => '')
  const vaultRoots = deps.vaultRoots ?? (() => [{ name: '', root: vaultDir() }])
  const getSettings = deps.getSettings ?? (() => ({}))
  // DSH 宿主信息（独立 web server 无 DSH 环境时为 null）。head DSH 状态行用。
  const getDshInfo = deps.getDshInfo ?? (() => null)

  return async function handleApi(req, res) {
    const vaultRoot = vaultDir()
    const url = new URL(req.url, 'http://localhost')
    const route = url.pathname.slice(API_PREFIX.length).replace(/\/+$/, '') || '/overview'
    const query = url.searchParams

    switch (route) {
      case '/overview': {
        await ensureVault(vaultRoot)
        json(res, 200, { ok: true, vaultDir: vaultRoot, ...(await overview(vaultRoot)) })
        return
      }
      case '/cards': {
        const kind = query.get('kind') || ''
        const q = query.get('q') || ''
        const status = (query.get('status') || 'approved').toLowerCase()
        const limit = Math.min(Number(query.get('limit')) || 200, 500)
        // all = 全部（含 pending/rejected，排除回收站）；默认/approved = 已审核。
        const want = status === 'all' ? ['approved', 'pending', 'rejected'] : status === 'pending' || status === 'rejected' ? [status] : ['approved']
        let cards = await listCards(vaultRoot, { status: want })
        if (kind) cards = cards.filter((c) => c.kind === kind)
        if (q.trim()) {
          const hits = await search(vaultRoot, q, { limit: 200 })
          const hitPaths = new Set(hits.map((h) => h.path))
          cards = cards.filter((c) => hitPaths.has(c.path))
        }
        json(res, 200, { ok: true, cards: cards.slice(0, limit) })
        return
      }
      case '/card': {
        const rel = query.get('path') || ''
        if (!rel) return json(res, 400, { ok: false, error: '缺少 path' })
        const text = await readCard(vaultRoot, rel)
        json(res, 200, { ok: true, path: rel, text })
        return
      }
      case '/search': {
        const q = query.get('q') || ''
        if (!q.trim()) return json(res, 200, { ok: true, hits: [] })
        const all = query.get('all') === '1'
        const semantic = query.get('semantic') === '1'
        let hits
        try { hits = all ? await searchAll(vaultRoots(), q, { limit: 30, semantic }) : await search(vaultRoot, q, { limit: 30, semantic }) }
        catch (e) { hits = await search(vaultRoot, q, { limit: 30, semantic }) }
        json(res, 200, { ok: true, hits })
        return
      }
      case '/graph': {
        await ensureVault(vaultRoot)
        const all = query.get('all') === '1'
        let g
        try { g = all ? await graphAll(vaultRoots()) : await graph(vaultRoot) }
        catch (e) { g = await graph(vaultRoot) }
        json(res, 200, { ok: true, ...g })
        return
      }
      case '/todayBrief': {
        await ensureVault(vaultRoot)
        const s = await stats(vaultRoot)
        json(res, 200, { ok: true, today: s.today, brief: dailyBrief(s.todayCards) })
        return
      }
      case '/export': {
        await ensureVault(vaultRoot)
        json(res, 200, { ok: true, cards: await exportCards(vaultRoot) })
        return
      }
      case '/delete': {
        const rel = query.get('path') || ''
        if (!rel) return json(res, 400, { ok: false, error: '缺少 path' })
        // 软删（进回收站）；?permanent=1 直接永久删除
        const permanent = query.get('permanent') === '1'
        await deleteCard(vaultRoot, rel, { permanent })
        json(res, 200, { ok: true, soft: !permanent })
        return
      }
      case '/audit/list': {
        const { pending, rejected } = await auditQueue(vaultRoot)
        json(res, 200, { ok: true, pending, rejected })
        return
      }
      case '/audit/approve': {
        // POST {path} 或 GET ?path= → status=approved
        const rel = query.get('path') || (await readBody(req))?.path || ''
        if (!rel) return json(res, 400, { ok: false, error: '缺少 path' })
        await setCardStatus(vaultRoot, rel, 'approved')
        json(res, 200, { ok: true, path: rel, status: 'approved' })
        return
      }
      case '/audit/reject': {
        // POST {path} 或 GET ?path= → status=rejected（标记驳回，不删除）
        const rel = query.get('path') || (await readBody(req))?.path || ''
        if (!rel) return json(res, 400, { ok: false, error: '缺少 path' })
        await setCardStatus(vaultRoot, rel, 'rejected')
        json(res, 200, { ok: true, path: rel, status: 'rejected' })
        return
      }
      case '/recycle/list': {
        const items = await recycleList(vaultRoot)
        json(res, 200, { ok: true, items })
        return
      }
      case '/recycle/restore': {
        const rel = query.get('path') || ''
        if (!rel) return json(res, 400, { ok: false, error: '缺少 path' })
        await restoreCard(vaultRoot, rel)
        json(res, 200, { ok: true, path: rel })
        return
      }
      case '/recycle/purge': {
        const rel = query.get('path') || ''
        if (!rel) return json(res, 400, { ok: false, error: '缺少 path' })
        await deleteCard(vaultRoot, rel, { permanent: true })
        json(res, 200, { ok: true, path: rel, purged: true })
        return
      }
      case '/recycle/purge-expired': {
        const days = Number(query.get('days')) || 30
        const r = await purgeExpired(vaultRoot, days)
        json(res, 200, r)
        return
      }
      case '/write': {
        let raw = ''
        for await (const chunk of req) raw += chunk
        let body
        try { body = JSON.parse(raw || '{}') } catch { return json(res, 400, { ok: false, error: 'JSON 解析失败' }) }
        if (!body.body) return json(res, 400, { ok: false, error: '缺少正文' })
        await ensureVault(vaultRoot)
        const r = await writeCard(vaultRoot, { kind: body.kind || 'knowledge', title: body.title || '无标题', tags: body.tags || [], body: body.body, source: body.source || 'manual', status: 'pending', submittedBy: body.source || 'manual', severity: body.severity || 'info', reason: body.reason || '手动创建' }, { dedup: false })
        json(res, 200, r)
        return
      }
      case '/import': {
        let raw = ''
        for await (const chunk of req) raw += chunk
        if (raw.length > 20 * 1024 * 1024) return json(res, 413, { ok: false, error: '文件过大' })
        let payload
        try { payload = JSON.parse(raw || '{}') } catch { return json(res, 400, { ok: false, error: 'JSON 解析失败' }) }
        const list = payload.cards || []
        if (!Array.isArray(list)) return json(res, 400, { ok: false, error: '缺少 cards 数组' })
        let imported = 0, skipped = 0
        for (const c of list) {
          const text = c.text || ''
          let kind = c.kind || 'knowledge', title = c.title || '导入记忆', tags = [], body = text, source = ''
          try { const p = parseCard(text); kind = p.meta.kind || kind; title = p.meta.title || title; tags = p.meta.tags || tags; body = p.body; source = p.meta.source } catch {}
          const r = await writeCard(vaultRoot, { kind, title, tags, body, source, status: 'pending' })
          if (r.ok) imported++; else skipped++
        }
        json(res, 200, { ok: true, imported, skipped })
        return
      }
      case '/merge': {
        const paths = (query.get('paths') || '').split(',').map((p) => p.trim()).filter(Boolean)
        const r = await mergeCards(vaultRoot, paths)
        if (!r.ok) return json(res, 400, r)
        json(res, 200, r)
        return
      }
      case '/stats': {
        await ensureVault(vaultRoot)
        const days = Math.min(Number(query.get('days')) || 30, 90)
        json(res, 200, { ok: true, ...(await stats(vaultRoot)), trend: await dailyCounts(vaultRoot, days) })
        return
      }
      case '/optimize': {
        // 非破坏性：只返回「整理建议」（相似卡对 + 陈旧卡），不自动删改。
        json(res, 200, { ok: true, ...(await optimizeCandidates(vaultRoot)) })
        return
      }
      case '/optimize-execute': {
        // 一键优化执行：合并相似卡 + 可选清理陈旧卡。POST body: {cleanupStale?, simThreshold?, staleDays?, dryRun?}
        if (req.method !== 'POST') { json(res, 405, { ok: false, error: '需 POST' }); return }
        let raw = ''
        for await (const chunk of req) raw += chunk
        let opts = {}
        try { opts = JSON.parse(raw || '{}') } catch { opts = {} }
        const result = await optimizeApply(vaultRoot, opts)
        json(res, 200, result)
        return
      }
      case '/setup-run': {
        // 「补全 MCP」：真正执行 runSetup（写外部 agent 配置）。共享层（独立 web 也可用）
        if (req.method !== 'POST') return json(res, 405, { ok: false, error: '需 POST' })
        try {
          const out = await runSetup({ log: () => {}, enabled: true })
          json(res, 200, { ok: true, results: out.results })
        } catch (e) { json(res, 500, { ok: false, error: String(e?.message || e) }) }
        return
      }
      case '/mcp/action': {
        // 单智能体安装/卸载 MCP：POST {agent, action}。共享层（独立 web 可用）
        if (req.method !== 'POST') return json(res, 405, { ok: false, error: '需 POST' })
        try {
          let raw = ''
          for await (const chunk of req) raw += chunk
          const body = JSON.parse(raw || '{}')
          const out = await mcpAgentAction(String(body.agent || ''), String(body.action || ''), { log: () => {} })
          json(res, 200, out)
        } catch (e) { json(res, 500, { ok: false, error: String(e?.message || e) }) }
        return
      }
      case '/setup-status': {
        // 只读查询各 agent MCP 配置状态，不写任何文件
        const status = await getSetupStatus()
        // prepend DSH 宿主行（独立 web server 无 DSH 环境时只有外部 agent）
        const dsh = getDshInfo ? getDshInfo() : null
        if (dsh) {
          status.agents = [{ name: 'dsh', label: dsh.label || 'DSH (当前宿主)', installed: true, mcpConfigured: true, isDsh: true, recallTool: dsh.memoryRecallTool, autoCapture: dsh.autoCapture, autoRecall: dsh.autoRecall, vaultDir: dsh.vaultDir }, ...(status.agents || [])]
        }
        json(res, 200, status)
        return
      }
      case '/feedback': {
        let raw = ''
        for await (const chunk of req) raw += chunk
        let rec
        try { rec = JSON.parse(raw || '{}') } catch { return json(res, 400, { ok: false, error: 'JSON 解析失败' }) }
        if (!rec || !rec.path) return json(res, 400, { ok: false, error: '缺少 path' })
        await addFeedback(vaultRoot, { query: String(rec.query || ''), path: String(rec.path || ''), useful: rec.useful === true })
        json(res, 200, { ok: true })
        return
      }
      case '/budget': {
        try {
          const cfg = getSettings() ?? {}
          const env = typeof process !== 'undefined' ? process.env : {}
          json(res, 200, {
            ok: true,
            budgetChars: cfg.sessionBudgetChars ?? 80000,
            recallLimit: cfg.recallLimit ?? 5,
            embedding: cfg.recallEmbedding || '',
            // 服务自管理配置（DSH host 从 settings 读；独立 web server 从 env 兜底）
            autoWeb: cfg.autoWeb ?? env.MEMORY_AUTO_WEB !== '0',
            autoWebMode: cfg.autoWebMode || 'init',
            webPort: Number(cfg.webPort) || Number(env.MEMORY_WEB_PORT) || 7999,
            webCheckIntervalMs: Number(cfg.webCheckIntervalMs) || 5000,
            webMaxRestart: Number(cfg.webMaxRestart) || 10,
            watchdogAutoSpawn: cfg.watchdogAutoSpawn ?? env.MEMORY_WATCHDOG === '1',
            autoMcpSetup: cfg.autoMcpSetup ?? false,
          })
        } catch (e) {
          // 配置读取异常时降级返回默认值，避免面板整块红屏
          json(res, 200, { ok: true, budgetChars: 80000, recallLimit: 5, embedding: '', autoWeb: true, autoWebMode: 'init', webPort: 7999, webCheckIntervalMs: 5000, webMaxRestart: 10, watchdogAutoSpawn: true, autoMcpSetup: false })
        }
        return
      }
      case '/config': {
        // 独立 web server（无 DSH settings）的配置读取兜底：env + 默认值。DSH host 的 /config 在其 webServer handler 拦截实现（可写），此处只读。
        const cfg = getSettings() ?? {}
        const env = typeof process !== 'undefined' ? process.env : {}
        const safe = {
          autoCapture: cfg.autoCapture ?? true, autoRecall: cfg.autoRecall ?? true, recallLimit: cfg.recallLimit ?? 5, recallSummaryLen: cfg.recallSummaryLen ?? 130, recallIncludeBody: cfg.recallIncludeBody ?? false,
          captureMinChars: cfg.captureMinChars ?? 200, captureCooldownMs: cfg.captureCooldownMs ?? 300000, dedupThreshold: cfg.dedupThreshold ?? 0.62, maxCardsPerDay: cfg.maxCardsPerDay ?? 60,
          distillEnabled: cfg.distillEnabled ?? true, dedupByLLM: cfg.dedupByLLM ?? true, captureMaxTokens: cfg.captureMaxTokens ?? 900, recallMinScore: cfg.recallMinScore ?? 2,
          autoWeb: cfg.autoWeb ?? env.MEMORY_AUTO_WEB !== '0', autoWebMode: cfg.autoWebMode || 'init', webPort: Number(cfg.webPort) || Number(env.MEMORY_WEB_PORT) || 7999, webCheckIntervalMs: Number(cfg.webCheckIntervalMs) || 5000, webMaxRestart: Number(cfg.webMaxRestart) || 10, watchdogAutoSpawn: cfg.watchdogAutoSpawn ?? env.MEMORY_WATCHDOG === '1', autoMcpSetup: cfg.autoMcpSetup ?? false,
          auditMode: cfg.auditMode ?? 'all', auditExemptAgents: cfg.auditExemptAgents ?? [], auditExemptKinds: cfg.auditExemptKinds ?? [], recycleRetentionDays: cfg.recycleRetentionDays ?? 30,
        }
        json(res, 200, { ok: true, config: safe, revision: 0, writable: false, readonly: true, version: env.MEMORY_ETERNAL_VERSION || '' })
        return
      }
      case '/compress': {
        // 记忆侧「压缩产物」接口：供 harness 在会话内压缩旧轮次时调用，返回一段可注入的摘要。
        const cfg = getSettings() ?? {}
        const body = new URLSearchParams(query)
        const text = body.get('text') || ''
        const maxChars = Math.min(Number(body.get('max')) || 2400, 6000)
        if (!text.trim()) return json(res, 400, { ok: false, error: '缺少 text' })
        const compressed = await compressExcerpt(text, maxChars)
        json(res, 200, { ok: true, compressed, budgetChars: cfg.sessionBudgetChars ?? 80000 })
        return
      }
      default:
        json(res, 404, { ok: false, error: '未知接口' })
    }
  }
}

export function json(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
  })
  res.end(payload)
}

/** 读请求体（POST body），返回解析后的 JSON 对象或空。 */
export async function readBody(req) {
  try {
    let raw = ''
    for await (const chunk of req) raw += chunk
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}
