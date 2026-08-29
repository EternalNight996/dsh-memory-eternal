// 记忆核心 · 独立进程沉淀管线（MCP / CLI / hooks 共用）。
//
// 复刻 index.js runCapture 的判定链（预筛→配额→LLM 蒸馏→新建/追加→词法兜底），
// 但 LLM 来源是 lib/llm-openai.js 的 OpenAI 兼容适配器而非 DSH llm 服务。
// 未配置 LLM 时降级：跳过蒸馏，直接把原文写成一张卡（kind/tool 或调用方指定），
// 保证「无 LLM 环境也能沉淀，只是不压缩」。

import path from 'node:path'
import os from 'node:os'
import { captureCard, captureUpdate, pickNeighbors, summarizeTurn } from './capture.js'
import { createLlmFromEnv } from './llm-openai.js'

export function defaultVaultDir(env = process.env) {
  if (env.MEMORY_VAULT_DIR && env.MEMORY_VAULT_DIR.trim()) return path.resolve(env.MEMORY_VAULT_DIR.trim())
  const home = env.DSH_HOME || path.join(os.homedir(), '.dsh')
  return path.join(home, 'memory-vault')
}

/**
 * 沉淀一段对话文本到 vault。
 * @returns {Promise<{ok:boolean, action:'created'|'appended'|'skipped'|'failed', path?:string, reason?:string, degraded?:boolean}>}
 */
export async function runStandaloneCapture(vaultRoot, text, { source = '', llm, env = process.env, minChars = 120 } = {}) {
  const clean = String(text || '').trim()
  if (clean.length < minChars) return { ok: false, action: 'skipped', reason: 'text too short' }

  const llmClient = llm ?? createLlmFromEnv(env)
  const route = llmClient ? { provider: llmClient.listProviders()[0].id, model: (await llmClient.listModels())[0].id } : null

  // 有 LLM：蒸馏判定链（与 DSH 侧一致）
  if (llmClient && route) {
    try {
      const neighbors = await pickNeighbors(vaultRoot, { title: '', body: clean.slice(0, 400) }, 8)
      const result = await summarizeTurn(llmClient, route, clean, { existing: neighbors, signal: AbortSignal.timeout(45000) })
      if (result && result.save === true) {
        if (result.append_to) {
          await captureUpdate(vaultRoot, result.append_to, result.update, { threshold: 0.62 })
          return { ok: true, action: 'appended', path: result.append_to }
        }
        const card = { kind: result.kind, title: result.title, tags: result.tags, body: result.body, source, status: 'pending', submittedBy: source || 'agent', severity: 'info', reason: 'AI 自动沉淀（蒸馏卡）' }
        const out = await captureCard(vaultRoot, card, { threshold: 0.62 })
        if (out.ok) return { ok: true, action: 'created', path: out.path ?? out.rel }
        if (out.duplicate) {
          await captureUpdate(vaultRoot, out.duplicate.path, `${result.title}：${result.body.slice(0, 400)}`, { threshold: 0.62 })
          return { ok: true, action: 'appended', path: out.duplicate.path }
        }
        return { ok: false, action: 'failed', reason: String(out.reason || 'write failed') }
      }
      if (result && result.save === false) return { ok: true, action: 'skipped', reason: 'model judged not durable' }
    } catch (error) {
      // LLM 失败 → 落入降级路径，不能让一次网络抖动丢掉沉淀
    }
  }

  // 降级：无 LLM（或 LLM 调用失败）→ 原文卡（kind 默认 content，dedup 开）
  const out = await captureCard(vaultRoot, {
    kind: 'content',
    title: clean.replace(/\s+/g, ' ').slice(0, 40) || '未命名记录',
    tags: ['raw'],
    body: clean,
    source: source || 'manual',
    status: 'pending',
    submittedBy: source || 'agent',
    severity: 'info',
    reason: 'AI 自动沉淀（原文卡）',
  }, { threshold: 0.62 })
  if (out.ok) return { ok: true, action: 'created', path: out.path ?? out.rel, degraded: true }
  if (out.duplicate) {
    await captureUpdate(vaultRoot, out.duplicate.path, clean.slice(0, 400), { threshold: 0.62 })
    return { ok: true, action: 'appended', path: out.duplicate.path, degraded: true }
  }
  return { ok: false, action: 'failed', reason: String(out.reason || 'write failed') }
}
