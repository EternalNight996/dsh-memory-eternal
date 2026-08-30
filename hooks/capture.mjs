#!/usr/bin/env node
// 记忆核心 · 通用「会话结束自动沉淀」hook（claude-code / codex / cursor 共用）。
//
// 用法：node capture.mjs <agent>     agent ∈ claude-code | codex | cursor
// stdin（平台 hook 注入）：
//   { session_id, transcript_path, hook_event_name, cwd, last_assistant_message, prompt, ... }
//
// 行为：读 transcript（JSONL/JSON 兼容）或显式文本字段 → 调 runStandaloneCapture 蒸馏入库。
// 设计约束：
//   - 静默失败（hook 崩溃不能影响宿主 agent）
//   - 幂等（去重/追加在 runStandaloneCapture 内处理）
//   - 署名 source = agent 名，便于智能体筛选；vault 由 MEMORY_VAULT_DIR 或 ~/.dsh/memory-vault 决定（与全库统一）
//
// Windows 友好：纯 node，无外部依赖（同 claude-session.js）。

import { promises as fs } from 'node:fs'

const agent = process.argv[2] || 'agent'

const readStdin = () => new Promise((resolve) => {
  let buf = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', (c) => { buf += c })
  process.stdin.on('end', () => resolve(buf))
  setTimeout(() => resolve(buf), 2000)
})

/** 从 message 对象里抽可读文本（兼容 claude 的 {role,content} 与 codex/cursor 的 {text|content}）。 */
function textOf(msg) {
  if (!msg) return ''
  if (typeof msg === 'string') return msg
  const c = msg.content
  if (typeof c === 'string') return c
  if (Array.isArray(c)) return c.filter((x) => x && x.type === 'text').map((x) => x.text).join('\n')
  return msg.text || msg.message || ''
}

/** 读 transcript 文件并抽取最近对话文本。优先 JSONL 行解析，退回整体文本。 */
async function extractTranscript(transcriptPath) {
  let text
  try { text = await fs.readFile(transcriptPath, 'utf8') } catch { return '' }
  if (!text.trim()) return ''
  text = text.replace(/^\uFEFF/, '') // 去掉可能存在的 UTF-8 BOM
  const lines = text.split('\n').filter(Boolean)
  const parts = []
  let structured = 0
  for (const line of lines.slice(-400)) {
    let rec
    try { rec = JSON.parse(line); structured++ } catch { continue }
    const t = textOf(rec?.message)
    if (t && t.trim().length > 4) {
      const role = rec?.message?.role || rec?.role || 'msg'
      parts.push(`${role}: ${t.trim()}`)
    }
  }
  if (structured >= 1 && parts.length) return parts.slice(-30).join('\n\n')
  // 非结构化：取尾部可读文本（去掉控制字符）
  return text.replace(/\r/g, '').replace(/\u0000/g, '').slice(-6000)
}

async function main() {
  let meta = {}
  try { meta = JSON.parse((await readStdin()) || '{}') } catch { /* 静默 */ }

  let conversation = ''
  if (meta.transcript_path) { try { conversation = await extractTranscript(meta.transcript_path) } catch { /* 静默 */ } }
  if (!conversation || conversation.trim().length < 120) {
    conversation = meta.last_assistant_message || meta.prompt || meta.context || ''
  }
  if (!conversation || conversation.trim().length < 120) return

  const { runStandaloneCapture, defaultVaultDir } = await import('../lib/capture-run.js')
  const src = agent // 署名 = agent 名（可筛选）；若想保留会话粒度可用 `${agent}:${session_id}`
  await runStandaloneCapture(defaultVaultDir(), conversation, { source: src })
}

main().catch(() => { /* hook 静默失败 */ })
