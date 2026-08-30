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

import { promises as fs, readFileSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const __filename = fileURLToPath(import.meta.url)
const PACKAGE_ROOT = path.resolve(path.dirname(__filename))
// 插件版本号（供「记忆配置」页面展示）
const versionRef = (() => { try { const p = JSON.parse(readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8')); return p.version } catch { return '' } })()
import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { ensureVault, search, generateDailyBrief } from './lib/vault.js'
import { summarizeTurn, extractLastTurn, sliceNewEvents, resolveRoute, captureCard, captureUpdate, pickNeighbors } from './lib/capture.js'
import { createApi, json } from './lib/api.js'

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
  // 成本控制（v0.6.2）：让用户精控 LLM token / 蒸馏调用 / 召回注入量
  // 蒸馏：true=LLM 压缩成知识卡；false=只存原文卡，零 LLM 消耗（最大省钱）
  distillEnabled: z.boolean().default(true),
  // 语义去重：true=把已有卡索引喂 LLM 决定「新建 vs 追加」；false=纯词法去重（省一次蒸馏前的 LLM 调用）
  dedupByLLM: z.boolean().default(true),
  // 蒸馏单次输出上限（token），越高越准越贵
  captureMaxTokens: z.number().min(100).max(4000).default(900),
  // 召回相关性阈值（minScore），越高召回越少越精越省
  recallMinScore: z.number().min(0).max(50).default(2),
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
  // 多宿主：激活时自动把 MCP 挂载到本机已装的 Claude Code/Codex/Cursor（幂等，
  // MEMORY_ETERNAL_SKIP_AUTO=1 可完全禁用）。**默认 false**——不碰外部配置，需要时显式开启。
  autoMcpSetup: z.boolean().default(false),
  autoWeb: z.boolean().default(true),
  // web server 保活模式：
  //   init    = DSH 激活时拉起一次（默认；最低开销，DSH 死后 web 仍活但无人看守）
  //   interval= DSH 进程内 setInterval 周期探活+自动拉起（额外 0 内存；DSH 死则停保活）
  //   manual  = 完全不自动拉起；只在 `dsh-memory open` 时 ensure-alive（最保守）
  autoWebMode: z.union([z.const('init'), z.const('interval'), z.const('manual')]).default('init'),
  webPort: z.number().min(1).max(65535).default(7999),
  webCheckIntervalMs: z.number().min(1000).max(600000).default(5000),
  webMaxRestart: z.number().min(1).max(1000).default(10),
  // 是否 spawn 独立 watchdog 进程（与 DSH 解耦，7×24 保活；额外 ~47 MB 常驻）
  // **v0.6.0 起默认 true**——DSH 进程内 setInterval 在 DSH 退出后失效；
  // 常驻 web 场景需要独立 watchdog；代价是 ~47 MB 额外常驻内存。
  watchdogAutoSpawn: z.boolean().default(true),
  // 回收站保留天数：软删卡超过此天数自动永久删除（默认 30）
  recycleRetentionDays: z.number().min(1).max(3650).default(30),
  // 自动审核配置
  //   auditMode: 'all'=全部要审(默认) | 'none'=全部免审直接入库
  //   auditExemptAgents: 免审的智能体名列表（如 codex / claude-code / 本地 DSH）
  //   auditExemptKinds: 免审的知识类型列表（如 tool / mistake）
  // 命中任一免审条件 → 新卡直接 approved 入库，否则进 pending 待审
  auditMode: z.union([z.const('all'), z.const('none')]).default('all'),
  auditExemptAgents: z.array(z.string()).default([]),
  auditExemptKinds: z.array(z.string()).default([]),
})

const API_PREFIX = '/memory-eternal/api'
// DSH 宿主自动沉淀卡的署名：用可读名而非 agent 会话 id，便于在智能体筛选中归组。
const DSH_AGENT = 'deepseek-harness'

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
    try {
      const cfg = settings.get() ?? {}
      if (!cfg.enabled || !cfg.autoCapture) return
      const llm = ctx.get('llm')
      const text = extractLastTurn(events)
      if (text.length < (cfg.captureMinChars ?? 200)) return
      // 日配额：防止一次大扫荡烧光 token。
      if (!(await underDailyQuota(cfg.maxCardsPerDay))) return
      // 成本控制：distillEnabled=false 时不调 LLM，直接存原文卡（零蒸馏成本）
      const source = DSH_AGENT
      if (cfg.distillEnabled === false || !llm) {
        await captureCard(vaultDir(), {
          kind: 'content',
          title: text.replace(/\s+/g, ' ').slice(0, 40) || '未命名记录',
          tags: ['raw'],
          body: text,
          source,
          status: resolveAuditStatus(cfg, 'content', source || 'unknown'),
          submittedBy: source || 'unknown',
          severity: 'info',
          reason: 'AI 自动沉淀（原文卡）',
        }, { threshold: cfg.dedupThreshold })
        return
      }
      const route = await resolveRoute(llm)
      if (!route) return
      // 语义去重近邻：把已有卡片索引喂给模型，让模型决定新建 vs 追加。
      // 成本控制：dedupByLLM=false 时跳过喂 LLM 的近邻采样（纯词法去重兜底）。
      const draft = { title: '', body: text.slice(0, 400) }
      const neighbors = cfg.dedupByLLM === false ? [] : await pickNeighbors(vaultDir(), draft, 8)
      const result = await summarizeTurn(llm, route, text, { signal: AbortSignal.timeout(45000), existing: neighbors, maxTokens: cfg.captureMaxTokens ?? 900 })
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
              return json(res, 200, { ok: true, config: safe, revision: me?.revision ?? 0, writable: true, readonly: false, schema: me?.schema ?? null, dsh: dshInfo, version: versionRef })
            }
            if (method === 'POST') {
              let raw = ''
              for await (const chunk of req) raw += chunk
              let body = {}
              try { body = JSON.parse(raw || '{}') } catch { return json(res, 400, { ok: false, error: 'JSON 解析失败' }) }
              const patch = body.patch ?? {}
              const expectedRevision = Number.isInteger(body.expectedRevision) ? body.expectedRevision : undefined
              // 仅允许写入 Config 中声明过的键（白名单，防注入）。schemastery 用 .dict 存 object schema 字段表。
              const allowed = new Set(Object.keys(Config.dict || {}))
              const clean = {}
              for (const k of Object.keys(patch)) { if (allowed.has(k)) clean[k] = patch[k] }
              if (Object.keys(clean).length === 0) return json(res, 400, { ok: false, error: '无可写入字段' })
              if (typeof settings.update === 'function') {
                try {
                  await settings.update(clean)
                  // 把完整配置写入共享文件，让独立 web / MCP hook 与 DSH 设置同步（不同步修复）
                  syncConfigFile()
                  return json(res, 200, { ok: true, applied: Object.keys(clean), note: '已保存。autoWebMode/watchdogAutoSpawn 等需重启 DSH 生效' })
                } catch (e) {
                  if (e && e.code === 'SETTINGS_CONFLICT') return json(res, 409, { ok: false, error: '配置已被外部修改，请刷新后重试（revision conflict）' })
                  return json(res, 500, { ok: false, error: String(e?.message || e) })
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
