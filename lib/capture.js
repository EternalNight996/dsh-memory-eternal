// 记忆核心 · 自动沉淀管线
//
// 移植 boujoy-harness 的「知识捕获」理念：模型负责判定价值（score）与压缩
// （卡片正文），本模块只负责安全（写哪、多短拒绝、去重守卫）。
//
// 与 boujoy 的区别：不需要用户点「沉淀」——会话每轮结束后由 index.js 监听
// agent/turn-stopping 自动触发 summarizeTurn → writeCard/appendUpdate。
//
// 去重：两级。第一级是词法（Jaccard bigram，阈值 0.62，捕获纯重复）；第二级
// 是语义——把「现有卡片索引」（标题+摘要，最多近邻 8 张）喂给模型，让模型
// 判断新知识是「新建卡片」还是「追加到已有卡片」（append_to），这正是
// boujoy 的「追加更新记录，不要堆重复卡」语义，且对 LLM 改写免疫。

import { writeCard, appendUpdate, textSimilarity, dedupCheck, listCards, queryTerms } from './vault.js'

/** 默认去重阈值（与 boujoy 一致）。 */
export const DEDUP_THRESHOLD = 0.62

/** 参与语义去重的近邻卡片数上限（控制 token）。 */
export const DEDUP_NEIGHBORS = 8

// 沉淀预筛：仅当对话含「可复用」信号时才调用 LLM，避免对纯闲聊/寒暄发起昂贵的 LLM 判定。
const DURABLE_SIGNALS = /(#{1,3}\s|```|\[\[|\]|\(https?:|\.(md|ts|js|py|json|yml|yaml|sh|sql)\b|`|\b\d{2,}\b|选择|决定|采用|方案|结论|原因|根因|问题|解决|修复|报错|错误|教训|架构|设计|配置|部署|流程|步骤|算法|原理|函数|接口|参数|命令|依赖|版本|坑|踩|优化|性能|数据库|索引|模型|token|推荐|偏好|约定|规范)/

/** 判断一段对话是否值得送 LLM 判定（省 token 的启发式预筛）。 */
export function looksDurable(text) {
  const t = String(text || '')
  if (t.trim().length < 120) return false
  if (DURABLE_SIGNALS.test(t)) return true
  // 列表/编号密度：≥2 个列表项且有一定长度 => 大概率是结构化知识
  const items = (t.match(/(^|\n)\s*[-*]\s+/gm) || []).length + (t.match(/(^|\n)\s*\d+[.、)]\s+/gm) || []).length
  return items >= 2 && t.trim().length >= 160
}

/**
 * 用当前模型把一段对话压缩成知识卡（或判定不值得保存 / 应追加到已有卡）。
 * @param llm - dsh 的 llm 服务（ctx.get('llm')）
 * @param route - { provider, model } 解析结果
 * @param conversation - 本轮对话文本（用户+助手）
 * @param opts - { maxTokens, signal, existing }：existing 为 [{path,title,summary}]
 * @returns Promise<null | { save:boolean } | { save:true, title, kind, tags, body } | { append_to, update }>
 */
export async function summarizeTurn(llm, route, conversation, opts = {}) {
  const text = String(conversation || '').trim()
  if (text.length < 120) return null // 太短，没有沉淀价值
  if (!looksDurable(text)) return null // 启发式预筛：无可复用信号则跳过 LLM 判定（省 token）

  const existing = Array.isArray(opts.existing) ? opts.existing.slice(0, DEDUP_NEIGHBORS) : []
  const existingBlock = existing.length
    ? '\n\n## 记忆库已有卡片索引（若新知识属于其中某张，必须用 append_to 追加而不是新建）\n' +
      existing.map((e, i) => `${i + 1}. [${e.path}] ${e.title}${e.summary ? `：${e.summary.slice(0, 120)}` : ''}`).join('\n')
    : ''

  const system = [
    '你是本地知识库的「记忆沉淀引擎」。你的唯一任务：判断一段对话中是否有值得长期复用的知识，若有则压缩成一张知识卡。',
    '判断标准（全部满足才保存）：',
    '1. 内容对未来有复用价值（技术方案、项目背景、设计决策、领域知识、偏好约定等）；',
    '2. 不是纯闲聊、寒暄或一次性指令；',
    '3. 与已有知识不重复（见下）。',
    '输出严格 JSON（不要 markdown 代码块、不要多余文字）：',
    '{"save": false} 表示不值得保存；',
    '否则输出：',
    '{"save": true, "title": "简短标题", "kind": "knowledge|project|content|prompt|business|tool|mistake", "tags": ["标签"], "body": "300-800字的压缩正文，markdown，含要点列表，首行是# 标题"}',
    'kind 含义：project=项目背景/进度；knowledge=通用知识/技术方案/设计决策；content=内容素材/资料；prompt=提示词/工作流；business=业务/商业；tool=工具链/CLI/配置/环境坑；mistake=错误/反模式/踩坑/“别这么做”/debug 教训。',
    '正文要求：去掉对话口水，只留可复用的结论、参数、步骤、原因。语言与对话一致。',
    '已有卡片规则：若新知识与某张已有卡片是同一主题（同一技术、同一项目、同一决策），不要新建——输出',
    '{"append_to": "已有卡片的 path 字段原样", "update": "追加/修正的短文本（一段话）"}',
    '只有当已有卡片索引为空或不相关时，才新建卡片。',
  ].join('\n')

  const { BlockAssembler, createUserMessage } = await importLlmHelpers()
  const assembler = new BlockAssembler()
  const messages = [createUserMessage({
    content: [{ type: 'text', text: text + existingBlock }],
    source: { kind: 'plugin', plugin: 'memory-eternal' },
  })]

  const options = {
    provider: route.provider,
    model: route.model,
    messages,
    system,
    maxTokens: opts.maxTokens ?? 900,
    reasoningEffort: 'off',
    purpose: 'memory-capture',
    signal: opts.signal ?? AbortSignal.timeout(45000),
  }
  for await (const chunk of llm.stream(options)) assembler.push(chunk)
  const out = assembler.blocks().filter((b) => b.type === 'text').map((b) => b.text).join('').trim()
  return parseCaptureJson(out)
}

/**
 * 语义去重近邻：按关键词重叠为候选卡排序，返回最相似的若干张。
 * 关键词 = 新卡标题/正文的 CJK 整词 + bigram 与已有卡标题/摘要的命中数。
 */
export async function pickNeighbors(root, card, limit = DEDUP_NEIGHBORS) {
  const haystack = `${card.title}\n${card.body}`.toLowerCase()
  const wanted = queryTerms(haystack)
  const cards = await listCards(root)
  const scored = []
  for (const existing of cards) {
    let score = 0
    const target = `${existing.title}\n${existing.summary}`.toLowerCase()
    for (const term of wanted) if (target.includes(term.toLowerCase())) score += 1
    if (score > 0) scored.push({ ...existing, score })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit)
}

/**
 * 去重守卫：目标目录里已有高度相似卡片时返回它，否则返回 null。
 * @returns Promise<null | { path, score }>
 */
export function makeDedupChecker(dir) {
  return (text, threshold = DEDUP_THRESHOLD) => dedupCheck(dir, text, threshold)
}

/** 写卡（带目录级去重守卫），命中返回 duplicate 而非写卡。 */
export async function captureCard(root, card, opts = {}) {
  const threshold = opts.threshold ?? DEDUP_THRESHOLD
  return writeCard(root, card, { threshold, dedup: true })
}

/** 追加更新记录（去重命中时）。 */
export async function captureUpdate(root, rel, text, opts = {}) {
  return appendUpdate(root, rel, text, { threshold: opts.threshold ?? DEDUP_THRESHOLD })
}

// -- helpers ---------------------------------------------------------------

async function importLlmHelpers() {
  // 延迟加载，避免在无 llm 服务时拉高启动成本；dsh-llm 是 peerDependency。
  // 独立进程（MCP server / CLI / web）没有 DSH 环境，import 失败时退回本地
  // 极简 shim：只实现 summarizeTurn 用到的最小面（push text chunk / blocks /
  // 构造 user message），供 lib/llm-openai.js 的 OpenAI 兼容适配器配合使用。
  try {
    const { BlockAssembler, createUserMessage } = await import('@deepseek-ai/dsh-llm')
    return { BlockAssembler, createUserMessage }
  } catch {
    return {
      BlockAssembler: class {
        constructor() { this.parts = [] }
        push(chunk) {
          if (typeof chunk === 'string') this.parts.push(chunk)
          else if (chunk && typeof chunk.text === 'string') this.parts.push(chunk.text)
          else if (chunk && typeof chunk.delta?.text === 'string') this.parts.push(chunk.delta.text)
        }
        blocks() {
          const text = this.parts.join('')
          return text ? [{ type: 'text', text }] : []
        }
      },
      createUserMessage: (msg) => ({ role: 'user', content: msg?.content ?? msg, source: msg?.source }),
    }
  }
}

export function parseCaptureJson(text) {
  if (!text) return null
  // 去掉可能的 ```json 围栏
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  let parsed
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    // 容错：截取第一个 { 到最后一个 }
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start < 0 || end <= start) return null
    try {
      parsed = JSON.parse(cleaned.slice(start, end + 1))
    } catch {
      return null
    }
  }
  if (!parsed || parsed.save === false) return { save: false }
  // 追加已有卡片：append_to 命中的优先级最高
  if (parsed.append_to) {
    const target = String(parsed.append_to).trim()
    const update = String(parsed.update || '').trim()
    if (target && update.length >= 10) return { append_to: target, update }
    return null
  }
  const title = String(parsed.title || '').trim().slice(0, 80)
  const body = String(parsed.body || '').trim()
  if (!title || body.length < 20) return null
  const kind = ['project', 'knowledge', 'content', 'prompt', 'business', 'tool', 'mistake'].includes(parsed.kind) ? parsed.kind : 'knowledge'
  const tags = Array.isArray(parsed.tags)
    ? parsed.tags.map((t) => String(t).trim().slice(0, 30)).filter(Boolean).slice(0, 8)
    : []
  return { save: true, title, kind, tags, body }
}

/** 从会话事件里提取「增量片段」的可读对话文本（用户 + 助手）。 */
export function extractLastTurn(events, _turn) {
  const lines = []
  const pushMessage = (event) => {
    const data = event.data || event
    const message = data.message || data
    const role = message.role
    const content = message.content
    if (Array.isArray(content)) {
      for (const block of content) {
        if (block.type === 'text' && block.text) lines.push(`${role === 'user' ? '用户' : '助手'}：${block.text}`)
      }
    } else if (typeof content === 'string' && content) {
      lines.push(`${role === 'user' ? '用户' : '助手'}：${content}`)
    }
  }
  for (const event of events) {
    const type = event.type
    const data = event.data || event
    if (type === 'user/message' || (type === 'message' && data.role === 'user')) {
      pushMessage(data)
    } else if (type === 'assistant/message' || type === 'assistant/chunk') {
      if (type === 'assistant/message') pushMessage(data)
      else if (data.chunk?.content) {
        const content = data.chunk.content
        if (typeof content === 'string') lines.push(`助手：${content}`)
        else if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'text' && block.text) lines.push(`助手：${block.text}`)
          }
        }
      }
    }
  }
  return lines.join('\n').trim()
}

/** 取增量事件：seq 大于 lastSeq 的 user/assistant 消息事件。 */
export function sliceNewEvents(events, lastSeq) {
  const out = []
  for (const event of events) {
    const seq = event.seq
    if (seq !== undefined && lastSeq !== undefined && seq <= lastSeq) continue
    const type = event.type
    if (type === 'user/message' || type === 'assistant/message') out.push(event)
  }
  return out
}

/** 解析当前模型路由：取第一个 provider 的旗舰模型（与驯兽师一致）。 */
/** 记忆侧「压缩产物」接口：确定性（无 LLM）从一段文本抽出结构化关键内容，供 harness 会话内压缩旧轮次时注入。 */
export function compressExcerpt(text, maxChars = 2400) {
  const lines = String(text || '').split(/\r?\n/).map((L) => L.trim()).filter(Boolean)
  const structured = lines.filter((L) => /^(#{1,6}\s|[-*]\s|\d+[.、)]\s|>|`|\[x\]|\[ \])/.test(L))
  const src = structured.length ? structured : lines
  let out = src.join('\n')
  if (out.length > maxChars) out = out.slice(0, maxChars).replace(/\n+$/, '') + '\n…（已压缩，细节见记忆库）'
  return out
}

/** 解析当前模型路由：取第一个 provider 的旗舰模型（与驯兽师一致）。 */
export async function resolveRoute(llm) {
  try {
    const providers = llm.listProviders()
    if (!providers || providers.length === 0) return null
    const models = await llm.listModels(providers[0].id)
    if (!models || models.length === 0) return null
    return { provider: providers[0].id, model: models[0].id }
  } catch {
    return null
  }
}
