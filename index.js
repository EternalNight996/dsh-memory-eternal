// 记忆核心（host 侧）：自动沉淀 + 自动召回 + 知识库 JSON API。
//
// 职责：
// 1. 注册 `memory-eternal` 设置命名空间（enabled / autoCapture / autoRecall /
//    vaultDir / dedupThreshold / captureMinChars / captureCooldownMs）。
// 2. 监听 `agent/turn-stopping`：每轮对话结束自动把「值得长期复用的内容」
//    压缩成知识卡写入本地 Markdown Vault（去重守卫：相似卡拒绝新建、改为
//    追加更新记录）。零人工干预。
// 3. 注入 systemPrompt 分段：告知 Agent 它有一块记忆核心、可随时
//    memory_recall 召回历史上下文；并注册 `memory_recall` 工具。
// 4. 注册 `/memory-eternal/api/*` JSON 路由：供客户端设置页渲染统计 / 卡片 /
//    知识图谱 / 检索。
//
// 存储全部落在本地 Markdown Vault（默认 $DSH_HOME/memory-vault），不依赖
// 外部数据库；卡是普通 .md 文件，可手动编辑、可 git 管理。

import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { ensureVault, listCards, readCard, search, searchAll, graph, graphAll, overview, exportCards, deleteCard, writeCard, parseCard, stats, optimizeCandidates, readFeedback, addFeedback, dailyBrief, generateDailyBrief, mergeCards } from './lib/vault.js'
import { compressExcerpt } from './lib/capture.js'
import { summarizeTurn, extractLastTurn, sliceNewEvents, resolveRoute, captureCard, captureUpdate, pickNeighbors } from './lib/capture.js'

export const name = 'memory-eternal'
export const inject = ['systemPrompt', 'settings']

export const Config = z.object({
  enabled: z.boolean().default(true),
  autoCapture: z.boolean().default(true),
  autoRecall: z.boolean().default(true),
  vaultDir: z.string().default(''),
  dedupThreshold: z.number().min(0).max(1).default(0.62),
  captureMinChars: z.number().default(200),
  captureCooldownMs: z.number().default(5 * 60 * 1000),
  maxCardsPerDay: z.number().default(60),
  // 注入体积可配置（召回）
  recallLimit: z.number().min(1).max(20).default(5),
  recallSummaryLen: z.number().min(40).max(400).default(130),
  recallIncludeBody: z.boolean().default(false),
  // 多 Vault / 多 Profile：命名分库，当前激活一个
  vaultProfiles: z.array(z.object({ name: z.string(), path: z.string() })).default([]),
  activeVault: z.string().default(''),
  // 语义召回（可选 embedding provider，默认空=零依赖 bigram + LLM 判定兜底）
  recallEmbedding: z.string().default(''),
  // 会话级 token 预算（字符），供 harness 触发压缩/轮换；记忆侧提供估算与阈值
  sessionBudgetChars: z.number().default(80000),
})

const API_PREFIX = '/memory-eternal/api'

export function apply(ctx, config) {
  const settings = ctx.settings.register('memory-eternal', Config, { base: config ?? {} })

  const vaultDir = () => {
    const cfg = settings.get() ?? {}
    // 多 Vault：若配了 vaultProfiles 且选中了 activeVault，则用该 profile 的目录。
    const profiles = Array.isArray(cfg.vaultProfiles) ? cfg.vaultProfiles : []
    const active = String(cfg.activeVault || '').trim()
    const hit = active && profiles.find((p) => p.name === active)
    if (hit && hit.path && hit.path.trim()) return path.resolve(hit.path.trim())
    if (cfg.vaultDir && cfg.vaultDir.trim()) return path.resolve(cfg.vaultDir.trim())
    const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
    return path.join(home, 'memory-vault')
  }

  // 所有 profile 目录（当前激活 + 其余命名的），供跨库聚合。
  const vaultRoots = () => {
    const cfg = settings.get() ?? {}
    const active = vaultDir()
    const roots = [{ name: '', root: active }]
    const seen = new Set([active])
    const profiles = Array.isArray(cfg.vaultProfiles) ? cfg.vaultProfiles : []
    for (const p of profiles) {
      if (!p || !p.path || !p.path.trim()) continue
      const r = path.resolve(p.path.trim())
      if (seen.has(r)) continue
      seen.add(r)
      roots.push({ name: p.name || r, root: r })
    }
    return roots
  }
  // agent/turn-stopping 是 serial 事件：不在监听器里 await LLM（会拖慢收尾），
  // 同步抓取增量事件快照后，把真正的捕获调度到后台队列执行。
  const pending = new Map() // sessionId -> merged events array
  let captureQueue = Promise.resolve()

  const scheduleCapture = (agent, events, lastSeq) => {
    const cfg = settings.get() ?? {}
    if (!cfg.enabled || !cfg.autoCapture) return
    const sessionId = agent?.session?.id ?? agent?.id ?? 'unknown'
    const newEvents = sliceNewEvents(events, lastSeq)
    if (newEvents.length === 0) return
    const existing = pending.get(sessionId)
    if (existing) {
      // 连续轮次合并：把新事件接到待处理队列尾，一次 LLM 调用处理。
      pending.set(sessionId, [...existing, ...newEvents])
      return
    }
    pending.set(sessionId, newEvents)
    captureQueue = captureQueue.then(() => runCapture(agent, pending.get(sessionId) ?? newEvents))
  }

  const runCapture = async (agent, events) => {
    try {
      const cfg = settings.get() ?? {}
      if (!cfg.enabled || !cfg.autoCapture) return
      const llm = ctx.get('llm')
      if (!llm) return
      const text = extractLastTurn(events)
      if (text.length < (cfg.captureMinChars ?? 200)) return
      // 日配额：防止一次大扫荡烧光 token。
      if (!(await underDailyQuota(cfg.maxCardsPerDay))) return
      const route = await resolveRoute(llm)
      if (!route) return
      // 语义去重近邻：把已有卡片索引喂给模型，让模型决定新建 vs 追加。
      const draft = { title: '', body: text.slice(0, 400) }
      const neighbors = await pickNeighbors(vaultDir(), draft, 8)
      const result = await summarizeTurn(llm, route, text, { signal: AbortSignal.timeout(45000), existing: neighbors })
      if (!result || result.save !== true) return
      if (result.append_to) {
        // 模型判定属于已有卡 → 追加更新记录，不新建（boujoy 语义）。
        await captureUpdate(vaultDir(), result.append_to, result.update, { threshold: cfg.dedupThreshold })
        return
      }
      const card = {
        kind: result.kind,
        title: result.title,
        tags: result.tags,
        body: result.body,
        source: agent?.session?.id ? `session:${agent.session.id}` : '',
      }
      const out = await captureCard(vaultDir(), card, { threshold: cfg.dedupThreshold })
      if (!out.ok && out.duplicate) {
        // 词法兜底：高度相似 → 追加更新记录而不是再建一张重复卡。
        await captureUpdate(vaultDir(), out.duplicate.path, `${result.title}：${result.body.slice(0, 400)}`, {
          threshold: cfg.dedupThreshold,
        })
      }
    } catch (error) {
      console.error('[memory-eternal] capture failed:', error)
    } finally {
      const sessionId = agent?.session?.id ?? agent?.id ?? 'unknown'
      pending.delete(sessionId)
    }
  }

  const lastDayStamps = []
  const underDailyQuota = async (max) => {
    const now = Date.now()
    const dayStart = now - 86400000
    while (lastDayStamps.length && lastDayStamps[0] < dayStart) lastDayStamps.shift()
    if (lastDayStamps.length >= (max ?? 60)) return false
    lastDayStamps.push(now)
    return true
  }

  const lastSeqs = new Map() // sessionId -> last processed seq
  ctx.on('agent/turn-stopping', ({ agent }) => {
    const events = agent?.session?.events
    if (!Array.isArray(events)) return
    const sessionId = agent?.session?.id ?? agent?.id ?? 'unknown'
    const lastSeq = lastSeqs.get(sessionId) ?? 0
    scheduleCapture(agent, events, lastSeq)
    lastSeqs.set(sessionId, events.length ? events[events.length - 1].seq : lastSeq)
  })

  // -- 2. 自动召回：systemPrompt 分段 + memory_recall 工具 -----------------
  ctx.effect(() => {
    let disposeSection = null
    const refresh = (cfg) => {
      if (disposeSection) {
        const dispose = disposeSection
        disposeSection = null
        dispose()
      }
      if (!cfg || cfg.enabled === false || cfg.autoRecall !== true) return
      const text = [
        '你拥有一个本地「记忆核心」（Markdown 知识库，位于 ' + vaultDir() + '）。',
        '规则：',
        '1. 每轮对话结束后，值得长期复用的内容会被自动沉淀成知识卡，你无需询问用户、也无需手动保存。',
        '2. 当任务需要项目背景、历史决策、之前讨论过的方案或领域知识时，先调用 memory_recall 检索相关卡片，再作答。',
        '3. 若检索结果为空，就诚实说明当前记忆库没有相关内容，不要编造。',
        '4. 知识卡是普通 Markdown 文件，你可以用文件工具直接读写它。',
      ].join('\n')
      disposeSection = ctx.systemPrompt.section({
        name: 'memory-eternal: auto-recall',
        order: 600,
        text,
      })
    }
    refresh(settings.get())
    const unwatch = settings.watch(refresh)
    return () => {
      if (typeof unwatch === 'function') unwatch()
      if (disposeSection) disposeSection()
    }
  }, 'memory-eternal: recall section')

  const tools = ctx.get('tools')
  if (tools !== undefined) {
    tools.register(defineTool({
      name: 'memory_recall',
      description:
        '从本地记忆核心（Markdown 知识库）检索相关知识卡。需要项目背景、历史决策、之前讨论过的方案、' +
        '或领域知识时调用；返回最相关的卡片摘要。用 query 描述要找的内容，支持中文整词与字符片段检索。',
      parameters: {
        query: { type: 'string', required: true, description: '检索关键词或自然语言描述，如「数据库选型」「用户偏好」' },
        limit: { type: 'number', description: '返回卡片数上限，默认 5' },
      },
      output: {
        schema: { type: 'string' },
        render(_a, v) { return [{ type: 'text', text: v }] },
      },
      timeoutMs: 20000,
      async execute(args) {
        const cfg = settings.get() ?? {}
        if (!cfg.enabled) return '（记忆核心已禁用）'
        const query = String(args.query || '').trim()
        if (!query) return '（未提供检索词）'
        const cfg2 = settings.get() ?? {}
        const defLimit = Number(cfg2.recallLimit) || 5
        const defLen = Number(cfg2.recallSummaryLen) || 130
        const includeBody = cfg2.recallIncludeBody === true
        const limit = Math.min(Math.max(Number(args.limit) || defLimit, 1), 20)
        const hits = await search(vaultDir(), query, { limit, minScore: 2 })
        if (hits.length === 0) return `记忆库中没有与「${query}」相关的内容。`
        const lines = hits.map((h, i) => {
          const tags = h.tags.length ? ` [${h.tags.join(', ')}]` : ''
          const snippet = String(includeBody ? h.summary : h.summary || '')
            .replace(/\s+/g, ' ').trim().slice(0, defLen)
          const body = includeBody ? `\n${String(h.excerpt || '')}` : ''
          return `### ${i + 1}. ${h.title}${tags}\n路径：${h.path}\n${snippet}${body}`
        })
        return `从记忆核心检索到 ${hits.length} 条相关卡片：\n\n${lines.join('\n\n')}`
      },
    }))
  }

  // 每日回顾：每 30 分钟检查一次，跨天就生成当日简报文件（幂等，凌晨/首日各一次）。
  let lastBriefDate = ''
  const briefTimer = setInterval(() => {
    const d = new Date()
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (lastBriefDate === date) return
    lastBriefDate = date
    generateDailyBrief(vaultDir()).catch(() => {})
  }, 30 * 60 * 1000)
  ctx.effect(() => () => clearInterval(briefTimer), 'memory-eternal: daily brief timer')

  // -- 3. 知识库 JSON API（客户端设置页数据源） ----------------------------
  const webServer = ctx.get('webServer')
  if (webServer !== undefined) {
    webServer.register({
      kind: 'prefix',
      path: API_PREFIX,
      handler: async (req, res) => {
        try {
          await handleApi(req, res, vaultDir())
        } catch (error) {
          json(res, 500, { ok: false, error: String(error?.message || error) })
        }
      },
    })
  }

  // 首次激活时确保 vault 目录存在。
  ctx.effect(() => {
    const root = vaultDir()
    ensureVault(root).catch((error) => console.error('[memory-eternal] ensureVault failed:', error))
  }, 'memory-eternal: ensure vault')
}

// -- API -------------------------------------------------------------------

async function handleApi(req, res, vaultRoot) {
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
      const limit = Math.min(Number(query.get('limit')) || 200, 500)
      let cards = await listCards(vaultRoot)
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
      const hits = all ? await searchAll(vaultRoots(), q, { limit: 30, semantic }) : await search(vaultRoot, q, { limit: 30, semantic })
      json(res, 200, { ok: true, hits })
      return
    }
    case '/graph': {
      await ensureVault(vaultRoot)
      const all = query.get('all') === '1'
      json(res, 200, { ok: true, ...(all ? await graphAll(vaultRoots()) : await graph(vaultRoot)) })
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
      await deleteCard(vaultRoot, rel)
      json(res, 200, { ok: true })
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
        const r = await writeCard(vaultRoot, { kind, title, tags, body, source })
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
      json(res, 200, { ok: true, ...(await stats(vaultRoot)) })
      return
    }
    case '/optimize': {
      // 非破坏性：只返回「整理建议」（相似卡对 + 陈旧卡），不自动删改。
      json(res, 200, { ok: true, ...(await optimizeCandidates(vaultRoot)) })
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
        const cfg = settings.get() ?? {}
        json(res, 200, { ok: true, budgetChars: cfg.sessionBudgetChars ?? 80000, recallLimit: cfg.recallLimit ?? 5, embedding: cfg.recallEmbedding || '' })
      } catch (e) {
        // 配置读取异常时降级返回默认值，避免面板整块红屏
        json(res, 200, { ok: true, budgetChars: 80000, recallLimit: 5, embedding: '' })
      }
      return
    }
    case '/compress': {
      // 记忆侧「压缩产物」接口：供 harness 在会话内压缩旧轮次时调用，返回一段可注入的摘要。
      const cfg = settings.get() ?? {}
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

function json(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
  })
  res.end(payload)
}
