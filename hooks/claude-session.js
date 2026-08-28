#!/usr/bin/env node
// 记忆核心 · Claude Code SessionEnd/PreCompact hook（Windows 友好，纯 node）。
//
// Claude Code 在会话结束/压缩前触发，stdin 传入 JSON：
//   { session_id, transcript_path, hook_event_name, cwd, ... }
// 本脚本解析 transcript JSONL，提取最近若干轮 user/assistant 文本，蒸馏入库。
// 由 lib/setup.js 自动注册到 ~/.claude/settings.json 的 hooks.SessionEnd。
//
// 特性：静默失败（hook 崩溃不能影响 Claude Code）；幂等（重复跑同一段只追加）。

import { promises as fs } from 'node:fs'
import path from 'node:path'

async function main() {
  let input = {}
  try {
    const raw = await new Promise((resolve) => {
      let buf = ''
      process.stdin.setEncoding('utf8')
      process.stdin.on('data', (c) => { buf += c })
      process.stdin.on('end', () => resolve(buf))
      setTimeout(() => resolve(buf), 2000)
    })
    input = JSON.parse(raw || '{}')
  } catch { /* 静默 */ }

  const transcriptPath = input.transcript_path
  if (!transcriptPath) return
  let lines
  try { lines = (await fs.readFile(transcriptPath, 'utf8')).split('\n').filter(Boolean) } catch { return }

  // 提取尾部对话文本（user 与 assistant 的 message.content 文本部分）
  const texts = []
  for (const line of lines.slice(-400)) {
    let rec
    try { rec = JSON.parse(line) } catch { continue }
    const msg = rec?.message
    if (!msg || !msg.role) continue
    const content = msg.content
    let text = ''
    if (typeof content === 'string') text = content
    else if (Array.isArray(content)) {
      text = content.filter((c) => c?.type === 'text').map((c) => c.text).join('\n')
    }
    if (text && text.trim().length > 4) texts.push(`${msg.role}: ${text.trim()}`)
  }
  const conversation = texts.slice(-30).join('\n\n')
  if (conversation.trim().length < 120) return

  const { runStandaloneCapture, defaultVaultDir } = await import('../lib/capture-run.js')
  await runStandaloneCapture(defaultVaultDir(), conversation, {
    source: `claude-code:${input.session_id || path.basename(transcriptPath)}`,
  })
}

main().catch(() => { /* hook 静默失败 */ })
