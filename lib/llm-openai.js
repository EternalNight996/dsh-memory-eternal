// 记忆核心 · OpenAI 兼容 LLM 适配器（独立进程用）。
//
// 在没有 DSH llm 服务的环境（MCP server / CLI / web / hooks）里，为
// lib/capture.js 的 summarizeTurn 提供同形状的 llm 对象：
//   - listProviders() / listModels() → 供 resolveRoute 解析路由
//   - stream(options) → async iterable，yield 纯文本 chunk（由 capture.js
//     fallback BlockAssembler 拼装）
//
// 配置（环境变量，或显式传参覆盖）：
//   MEMORY_LLM_BASE_URL  OpenAI 兼容端点，如 https://api.deepseek.com、
//                        http://127.0.0.1:11434/v1（Ollama）等
//   MEMORY_LLM_KEY       API key（本地端点可留空）
//   MEMORY_LLM_MODEL     模型名，如 deepseek-chat
// 未配置时 createLlmFromEnv() 返回 null：调用方应降级（recall 不受影响，
// capture 退化为存原文卡）。

function flatContent(content) {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((c) => (typeof c === 'string' ? c : c?.text ?? ''))
      .filter(Boolean)
      .join('\n')
  }
  return String(content ?? '')
}

export function createOpenAiLlm({ baseUrl, apiKey = '', model, purpose = 'memory-capture' } = {}) {
  if (!baseUrl || !model) return null
  const endpoint = baseUrl.replace(/\/+$/, '') + '/chat/completions'

  return {
    purpose,

    listProviders() {
      return [{ id: 'openai-compat' }]
    },

    async listModels() {
      return [{ id: model }]
    },

    /**
     * 非流式调用，整体作为单个 chunk yield（capture 的蒸馏一次性输出 JSON，
     * 无需逐 token 流式）。signal 超时/中断会向上抛出。
     */
    async *stream(options = {}) {
      const messages = []
      if (options.system) messages.push({ role: 'system', content: options.system })
      for (const m of options.messages ?? []) {
        messages.push({ role: m?.role ?? 'user', content: flatContent(m?.content) })
      }
      const body = {
        model: options.model || model,
        messages,
        max_tokens: options.maxTokens ?? 900,
        stream: false,
      }
      const headers = { 'Content-Type': 'application/json' }
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`
      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: options.signal ?? undefined,
      })
      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        throw new Error(`[memory-eternal] LLM ${res.status}: ${detail.slice(0, 300)}`)
      }
      const data = await res.json()
      const text = data?.choices?.[0]?.message?.content ?? ''
      if (text) yield text
    },
  }
}

export function createLlmFromEnv(env = process.env) {
  const baseUrl = env.MEMORY_LLM_BASE_URL || env.OPENAI_BASE_URL || ''
  const apiKey = env.MEMORY_LLM_KEY || env.OPENAI_API_KEY || ''
  const model = env.MEMORY_LLM_MODEL || ''
  if (!baseUrl || !model) return null
  return createOpenAiLlm({ baseUrl, apiKey, model })
}
