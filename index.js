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

import { promises as fs, readFileSync, appendFileSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const __filename = fileURLToPath(import.meta.url)
const PACKAGE_ROOT = path.resolve(path.dirname(__filename))
// 插件版本号（供「记忆配置」页面展示）
const versionRef = (() => { try { const p = JSON.parse(readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8')); return p.version } catch { return '' } })()
import z from '@deepseek-ai/schemastery'
import { buildConfig, partitionPatch, BOOT_ONLY_FIELDS } from './lib/config-schema.js'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { ensureVault, search, generateDailyBrief } from './lib/vault.js'
import { summarizeTurn, extractLastTurn, sliceNewEvents, resolveRoute, resolveSessionEvents, trimTurnText, captureCard, captureUpdate, pickNeighbors } from './lib/capture.js'
import { createApi, json } from './lib/api.js'
import { resolveSettingsScope } from './lib/settings-scope.js'

export const name = 'memory-eternal'
// 声明本插件真正读取的服务：0.2.x 上 `ctx.get(name)` 只对已声明的服务生效，
// 未声明的会返回 undefined —— 而下面用 `ctx.get('tools' | 'webServer' | 'llm')`
// 时只做了 undefined 判断，结果是「工具没注册、同源 API 没挂上」且不报错。
export const inject = ['systemPrompt', 'settings', 'tools', 'webServer', 'llm']

// 字段清单与「哪些能热改」的划线理由见 lib/config-schema.js；
// 只有标了 .volatile() 的字段才允许设置页直写（宿主 0.2.x 的硬约束）。
export const Config = buildConfig(z)

const API_PREFIX = '/memory-eternal/api'
// DSH 宿主自动沉淀卡的署名：用可读名而非 agent 会话 id，便于在智能体筛选中归组。
const DSH_AGENT = 'deepseek-harness'

export function apply(ctx, config) {
  // 旧宿主（0.1.x）用 settings.register 注册配置段；0.2.0-rc.x 已移除该方法
  // （配置改由 Loader 行的 Config schema 派生），无条件调用会抛
  // TypeError: ctx.settings.register is not a function 并中断整个 fiber。
  // 这里按宿主能力自适应，详细原因见 lib/settings-scope.js。
  const settings = resolveSettingsScope(
    ctx.settings, 'memory-eternal', Config, config, () => ctx.fiber?.config,
  )

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
  // 把完整配置写入共享文件，使独立 web / MCP hook 捕获与 DSH 设置同步（不同步修复）。
  const syncConfigFile = async () => {
    try {
      const cfg = settings.get() ?? {}
      const { configFilePath } = await import('./lib/capture-run.js')
      await (await import('node:fs')).promises.writeFile(configFilePath(process.env), JSON.stringify(cfg, null, 2), 'utf8')
    } catch { /* 静默 */ }
  }
  syncConfigFile()
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

  // 自动审核：根据配置决定新卡 status（免审→approved，否则 pending）
  const resolveAuditStatus = (cfg, kind, submittedBy) => {
    if (cfg.auditMode === 'none') return 'approved'
    const agents = Array.isArray(cfg.auditExemptAgents) ? cfg.auditExemptAgents : []
    const kinds = Array.isArray(cfg.auditExemptKinds) ? cfg.auditExemptKinds : []
    if (agents.includes('__all__') || agents.includes(submittedBy)) return 'approved'
    if (kinds.includes('__all__') || kinds.includes(kind)) return 'approved'
    return 'pending'
  }

  const runCapture = async (agent, events) => {
    let debug = false
    try {
      const cfg = settings.get() ?? {}
      debug = cfg.captureDebug === true
      // 排查用：每次跳过都留下原因（captureDebug=false 时零输出）。
      const dlog = (msg) => { if (debug) console.error(`[memory-eternal] capture: ${msg}`) }
      if (!cfg.enabled || !cfg.autoCapture) return
      const llm = ctx.get('llm')
      const trimmed = trimTurnText(extractLastTurn(events))
      const text = trimmed.text
      if (trimmed.trimmed) dlog(`turn text trimmed to the newest ${text.length} chars (TURN_TEXT_MAX)`)
      const minChars = cfg.captureMinChars ?? 200
      if (text.length < minChars) { dlog(`skipped: turn text ${text.length} chars < captureMinChars ${minChars}`); return }
      // 日配额：防止一次大扫荡烧光 token。
      if (!(await underDailyQuota(cfg.maxCardsPerDay))) { dlog('skipped: daily quota reached'); return }
      const source = DSH_AGENT
      // 成本控制：distillEnabled=false 时不调 LLM，直接存原文卡（零蒸馏成本）
      const storeRaw = async (why) => {
        await captureCard(vaultDir(), {
          kind: 'content',
          title: text.replace(/\s+/g, ' ').slice(0, 40) || '未命名记录',
          tags: ['raw'],
          body: text,
          source,
          status: resolveAuditStatus(cfg, 'content', source || 'unknown'),
          submittedBy: source || 'unknown',
          severity: 'info',
          reason: `AI 自动沉淀（原文卡·${why}）`,
        }, { threshold: cfg.dedupThreshold })
        dlog(`stored raw card (${why})`)
      }
      if (cfg.distillEnabled === false || !llm) {
        await storeRaw(cfg.distillEnabled === false ? 'distillEnabled=false' : 'no llm service')
        return
      }
      const route = await resolveRoute(llm)
      if (!route) {
        // 解析不出路由时旧行为是静默 return：库里永远没卡、控制台也没线索。
        if (cfg.captureFallbackToRaw) { await storeRaw('no llm route'); return }
        dlog('skipped: no llm route (listProviders/listConfigurableProviders empty) - set captureFallbackToRaw=true to store raw cards anyway')
        return
      }
      // 语义去重近邻：把已有卡片索引喂给模型，让模型决定新建 vs 追加。
      // 成本控制：dedupByLLM=false 时跳过喂 LLM 的近邻采样（纯词法去重兜底）。
      const draft = { title: '', body: text.slice(0, 400) }
      const neighbors = cfg.dedupByLLM === false ? [] : await pickNeighbors(vaultDir(), draft, 8)
      const result = await summarizeTurn(llm, route, text, { signal: AbortSignal.timeout(45000), existing: neighbors, maxTokens: cfg.captureMaxTokens ?? 900 })
      if (!result || result.save !== true) { dlog(`model declined to save (${result ? 'save!==true' : 'no result'})`); return }
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
        source: DSH_AGENT,
        status: resolveAuditStatus(cfg, result.kind, DSH_AGENT),
        submittedBy: DSH_AGENT,
        severity: 'info',
        reason: 'AI 自动沉淀（蒸馏卡）',
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
  // 钩子层诊断：这一层出错时 runCapture 根本不会跑，所以必须在这里也能出声。
  // captureDebug 打开时同时写控制台与 $DSH_HOME/memory-eternal-capture.log。
  const hookLog = (msg) => {
    try {
      const cfg = settings.get() ?? {}
      if (cfg.captureDebug !== true) return
      const line = `${new Date().toISOString()} ${msg}`
      console.error(`[memory-eternal] capture: ${msg}`)
      try {
        const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
        appendFileSync(path.join(home, 'memory-eternal-capture.log'), line + '\n')
      } catch { /* 落盘失败不影响主流程 */ }
    } catch { /* 诊断本身绝不抛 */ }
  }
  ctx.on('agent/turn-stopping', ({ agent }) => {
    const events = resolveSessionEvents(agent)
    if (events.length === 0) {
      hookLog('skipped: agent.session 没有可读事件（0.2.x 需要 session.snapshotEvents()）')
      return
    }
    const sessionId = agent?.session?.id ?? agent?.id ?? 'unknown'
    const last = events[events.length - 1]
    const latestSeq = typeof last?.seq === 'number' ? last.seq : 0
    // 插件是在会话进行中被加载/重启的：第一次看到的是一整段历史，直接沉淀会把整段会话
    // 塞给模型（贵且产出垃圾卡）。首次只登记水位线、跳过存量，从下一轮开始增量沉淀。
    if (!lastSeqs.has(sessionId)) {
      lastSeqs.set(sessionId, latestSeq)
      hookLog(`first sight of session ${sessionId}: skipped ${events.length} historical events, capturing from the next turn`)
      return
    }
    const lastSeq = lastSeqs.get(sessionId) ?? 0
    scheduleCapture(agent, events, lastSeq)
    if (latestSeq > lastSeq) lastSeqs.set(sessionId, latestSeq)
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

  // 回收站清理：每 30 分钟永久删除超过保留期（默认 30 天）的软删卡。
  const purgeTimer = setInterval(() => {
    const cfg = settings.get() ?? {}
    const days = Number(cfg.recycleRetentionDays) || 30
    import('./lib/vault.js').then((v) => v.purgeExpired(vaultDir(), days)).catch(() => {})
  }, 30 * 60 * 1000)
  ctx.effect(() => () => clearInterval(purgeTimer), 'memory-eternal: recycle purge timer')

  // -- 3. 知识库 JSON API（客户端设置页数据源） ----------------------------
  // 多宿主状态：web server 常驻地址（ensureWebServer 的结果，client 壳经
  // /web-info 读取后用 iframe 渲染 web 端 UI——DSH 渲染也走 web，单一真源）。
  let webInfo = { url: 'http://127.0.0.1:7999', port: 7999, alive: false }
  const refreshWebInfo = (info) => { if (info && info.url) webInfo = { ...info, alive: true } }

  const webServer = ctx.get('webServer')
  if (webServer !== undefined) {
    const handleApi = createApi({
      vaultDir, vaultRoots, getSettings: settings.get,
      getDshInfo: () => ({
        name: 'deepseek-harness',
        label: 'DeepSeek Harness（当前宿主）',
        installed: true,
        memoryRecallTool: !!ctx.get('tools'),
        autoCapture: (settings.get() ?? {}).autoCapture !== false,
        autoRecall: (settings.get() ?? {}).autoRecall !== false,
        vaultDir: vaultDir(),
        version: versionRef,
      }),
    })
    webServer.register({
      kind: 'prefix',
      path: API_PREFIX,
      handler: async (req, res) => {
        try {
          const pathname = new URL(req.url, 'http://localhost').pathname
          if (pathname === API_PREFIX + '/web-info') {
            return json(res, 200, { ok: true, ...webInfo })
          }
          if (pathname === API_PREFIX + '/setup-run') {
            // 「补全 MCP」：真正执行 runSetup（写外部 agent 配置），返回每项结果，成功/失败可见
            if (req.method !== 'POST') return json(res, 405, { ok: false, error: '需 POST' })
            try {
              const { runSetup } = await import('./lib/setup.js')
              const out = await runSetup({ log: () => {}, enabled: true })
              json(res, 200, { ok: true, results: out.results })
            } catch (e) {
              json(res, 500, { ok: false, error: String(e?.message || e) })
            }
            return
          }
          if (pathname === API_PREFIX + '/mcp/action') {
            // 单智能体安装/卸载 MCP：POST {agent, action}
            if (req.method !== 'POST') return json(res, 405, { ok: false, error: '需 POST' })
            try {
              let raw = ''
              for await (const chunk of req) raw += chunk
              const body = JSON.parse(raw || '{}')
              const agent = String(body.agent || '')
              const action = String(body.action || '')
              const { mcpAgentAction } = await import('./lib/setup.js')
              const out = await mcpAgentAction(agent, action, { log: () => {} })
              json(res, 200, out)
            } catch (e) {
              json(res, 500, { ok: false, error: String(e?.message || e) })
            }
            return
          }
          if (pathname === API_PREFIX + '/config') {
            const method = req.method || 'GET'
            if (method === 'GET') {
              const cfg = settings.get() ?? {}
              // 只暴露可安全展示/回填的字段
              const safe = {
                autoCapture: cfg.autoCapture, autoRecall: cfg.autoRecall, recallLimit: cfg.recallLimit, recallSummaryLen: cfg.recallSummaryLen, recallIncludeBody: cfg.recallIncludeBody,
                captureMinChars: cfg.captureMinChars, captureCooldownMs: cfg.captureCooldownMs, dedupThreshold: cfg.dedupThreshold, maxCardsPerDay: cfg.maxCardsPerDay,
                distillEnabled: cfg.distillEnabled, dedupByLLM: cfg.dedupByLLM, captureMaxTokens: cfg.captureMaxTokens, recallMinScore: cfg.recallMinScore,
                autoWeb: cfg.autoWeb, autoWebMode: cfg.autoWebMode, webPort: cfg.webPort, webCheckIntervalMs: cfg.webCheckIntervalMs, webMaxRestart: cfg.webMaxRestart, watchdogAutoSpawn: cfg.watchdogAutoSpawn, autoMcpSetup: cfg.autoMcpSetup,
                auditMode: cfg.auditMode ?? 'all', auditExemptAgents: cfg.auditExemptAgents || [], auditExemptKinds: cfg.auditExemptKinds || [], recycleRetentionDays: cfg.recycleRetentionDays ?? 30,
              }
              const descriptor = (ctx.get('settings') ?? {}).describe?.({ redactSecrets: true }) ?? []
              const me = descriptor.find((d) => d.ns === 'memory-eternal')
              const dshInfo = {
                name: 'deepseek-harness',
                label: 'DeepSeek Harness（当前宿主）',
                installed: true,
                memoryRecallTool: !!ctx.get('tools'),
                autoCapture: cfg.autoCapture !== false,
                autoRecall: cfg.autoRecall !== false,
                vaultDir: vaultDir(),
                version: versionRef,
              }
              return json(res, 200, { ok: true, config: safe, revision: me?.revision ?? 0, writable: true, readonly: false, schema: me?.schema ?? null, bootOnly: BOOT_ONLY_FIELDS, dsh: dshInfo, version: versionRef })
            }
            if (method === 'POST') {
              let raw = ''
              for await (const chunk of req) raw += chunk
              let body = {}
              try { body = JSON.parse(raw || '{}') } catch { return json(res, 400, { ok: false, error: 'JSON 解析失败' }) }
              const patch = body.patch ?? {}
              const expectedRevision = Number.isInteger(body.expectedRevision) ? body.expectedRevision : undefined
              // 仅允许写入 Config 中声明过的键（白名单，防注入）。schemastery 用 .dict 存 object schema 字段表。
              // 同时分辨出「启动期字段」：它们同样能写下来（两类字段都标了 volatile），
              // 但只有重启 DSH 后由 apply 重新读取才生效 —— 回复里点名说明，不假装立刻生效。
              const { live: clean, needsRestart, unknown } = partitionPatch(Config, patch)
              if (Object.keys(clean).length === 0) {
                if (unknown.length > 0) return json(res, 400, { ok: false, error: `未知字段：${unknown.join('、')}` })
                return json(res, 400, { ok: false, error: '无可写入字段' })
              }
              if (typeof settings.update === 'function') {
                try {
                  await settings.update(clean)
                  // 把完整配置写入共享文件，让独立 web / MCP hook 与 DSH 设置同步（不同步修复）
                  syncConfigFile()
                  return json(res, 200, {
                    ok: true,
                    applied: Object.keys(clean),
                    needsRestart,
                    note: needsRestart.length > 0
                      ? `已保存。其中 ${needsRestart.join('、')} 需要重启 DSH 才生效（其余立即生效）。`
                      : '已保存，立即生效',
                  })
                } catch (e) {
                  const message = String(e?.message || e)
                  if (e && e.code === 'SETTINGS_CONFLICT') return json(res, 409, { ok: false, error: '配置已被外部修改，请刷新后重试（revision conflict）' })
                  // 宿主只接受 volatile 字段（正常路径不该走到这里：Config 里两类字段都标了）。
                  if (/has no volatile fields|is not volatile/.test(message)) {
                    return json(res, 400, {
                      ok: false,
                      error: '当前宿主不接受这个字段的热写；请改 profile 的 cordis.patch.yml 里 memory-eternal 这一行的 config 再重启 DSH。',
                      detail: message,
                    })
                  }
                  return json(res, 500, { ok: false, error: message })
                }
              }
              return json(res, 501, { ok: false, error: '当前环境不支持写配置' })
            }
            return json(res, 405, { ok: false, error: 'method not allowed' })
          }
          // DSH host 同源配置页 UI：/memory-eternal/ui/config + /memory-eternal/ui/app.js
          // 让 DSH iframe 的「配置」页在 host 同源加载 → /config API 同源可读写（修复独立 web 7979 /config 404 导致的「一直加载中」）
          if (pathname === API_PREFIX + '/ui/config' || pathname === API_PREFIX + '/ui/app.js') {
            const { readFile } = fs
            const webRoot = path.join(PACKAGE_ROOT, 'web')
            if (pathname.endsWith('app.js')) {
              const buf = await readFile(path.join(webRoot, 'app.js'))
              res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store' })
              return res.end(buf)
            }
            const buf = await readFile(path.join(webRoot, 'index.html'))
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
            return res.end(buf)
          }
          await handleApi(req, res)
        } catch (error) {
          json(res, 500, { ok: false, error: String(error?.message || error) })
        }
      },
    })
  }

  // -- 4. 多宿主常驻：MCP 挂载 + web server 保活（按设置项分层） -----------------
  // 全部后台异步、静默失败：插件激活不能被外部环境问题卡住。
  let intervalTimer = null
  let watchdogProc = null
  ctx.effect(() => {
    const cfg0 = settings.get() ?? {}
    if (cfg0.enabled === false) return () => {}

    // (1) MCP 自动挂载：默认关闭；只有用户显式开启才动外部配置。
    if (cfg0.autoMcpSetup === true && process.env.MEMORY_ETERNAL_SKIP_AUTO !== '1') {
      import('./lib/setup.js')
        .then((m) => m.runSetup({ log: () => {} }))
        .catch(() => {})
    }

    // (2) web server：根据 autoWeb + autoWebMode 决策
    const mode = cfg0.autoWebMode || 'init'
    const port = Number(cfg0.webPort) || 7999
    const ensureOpts = { port, vaultRoot: vaultDir() }
    const ensureWeb = () => import('./lib/web.js')
      .then((m) => m.ensureWebServer(ensureOpts))
      .then((info) => { refreshWebInfo(info); return info })
      .catch((error) => console.error('[memory-eternal] web server failed:', error?.message || error))

    if (cfg0.autoWeb === true) {
      if (mode === 'manual') {
        // manual：不自动拉起；只在 dsh-memory open / WebFrame 触发 ensure
        import('./lib/web.js')
          .then((m) => m.probeWebServer(port))
          .then((alive) => { if (alive) refreshWebInfo({ url: `http://127.0.0.1:${port}`, port, spawned: false }) })
          .catch(() => {})
      } else if (mode === 'init') {
        // init：拉起一次（首次）；之后不管（用户已设了，那看门狗都不开）
        ensureWeb()
      } else if (mode === 'interval') {
        // interval：DSH 进程内 setInterval 周期保活
        const intervalMs = Number(cfg0.webCheckIntervalMs) || 5000
        const maxRestart = Number(cfg0.webMaxRestart) || 10
        let restartCount = 0
        const tick = async () => {
          if (restartCount >= maxRestart) {
            console.error(`[memory-eternal] web 已连续重启 ${maxRestart} 次，停止保活`)
            if (intervalTimer) { clearInterval(intervalTimer); intervalTimer = null }
            return
          }
          const alive = await import('./lib/web.js').then((m) => m.probeWebServer(port)).catch(() => null)
          if (!alive) {
            restartCount++
            console.error(`[memory-eternal] web 离线 → 第 ${restartCount}/${maxRestart} 次拉起`)
            await ensureWeb()
          } else {
            // 探到活则重置计数
            restartCount = 0
          }
        }
        // 立即跑一次（首启 + 间隔循环）
        ensureWeb()
        intervalTimer = setInterval(tick, intervalMs)
      }
    }

    // (3) 看门狗独立进程：默认不 spawn；开启时启动一个与 DSH 解耦的 node watchdog。
    if (cfg0.watchdogAutoSpawn === true && cfg0.autoWeb !== false) {
      import('./lib/watchdog.js')
        .then((m) => {
          const port = Number(cfg0.webPort) || 7999
          const wd = spawn(
            process.execPath,
            [path.join(PACKAGE_ROOT, 'lib', 'watchdog.js'), '--port', String(port), '--interval', String(cfg0.webCheckIntervalMs || 5000), '--max-restart', String(cfg0.webMaxRestart || 10)],
            { detached: true, stdio: 'ignore', env: { ...process.env, MEMORY_VAULT_DIR: vaultDir() }, windowsHide: true },
          )
          wd.unref()
          watchdogProc = wd
          console.error(`[memory-eternal] watchdog spawned pid=${wd.pid} port=${port}`)
        })
        .catch(() => {})
    }

    return () => {
      if (intervalTimer) { clearInterval(intervalTimer); intervalTimer = null }
      // 注意：watchdog 进程是独立的，故意不杀（7×24 用法）—— 配置改变由下次重启 DSH 时重新 spawn 替换
    }
  }, 'memory-eternal: multi-host ensure')

  // 首次激活时确保 vault 目录存在。
  ctx.effect(() => {
    const root = vaultDir()
    ensureVault(root).catch((error) => console.error('[memory-eternal] ensureVault failed:', error))
  }, 'memory-eternal: ensure vault')
}
