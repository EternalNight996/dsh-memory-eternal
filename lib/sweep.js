// 记忆核心 · 会话记录挖掘（简版 sweep）。
//
// 扫描目录下的 Claude Code 会话 JSONL（*.jsonl），每文件提取对话文本，
// 按文件粒度蒸馏入库（source 带 sweep 标记；重复跑幂等靠 vault 词法去重）。
// 适用：Codex sessions 目录 / Claude Code projects 目录 / 任意兼容 JSONL。

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { runStandaloneCapture, defaultVaultDir } from './capture-run.js'

async function* walk(dir) {
  let entries
  try { entries = await fs.readdir(dir, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) yield* walk(p)
    else if (e.name.endsWith('.jsonl')) yield p
  }
}

function extractConversation(jsonlText) {
  const texts = []
  for (const line of jsonlText.split('\n')) {
    if (!line.trim()) continue
    let rec
    try { rec = JSON.parse(line) } catch { continue }
    const msg = rec?.message
    if (!msg || !msg.role) continue
    let text = ''
    if (typeof msg.content === 'string') text = msg.content
    else if (Array.isArray(msg.content)) {
      text = msg.content.filter((c) => c?.type === 'text').map((c) => c.text).join('\n')
    }
    if (text && text.trim().length > 4) texts.push(`${msg.role}: ${text.trim()}`)
  }
  return texts.slice(-60).join('\n\n')
}

export async function sweepSessions(dir, { vaultRoot = defaultVaultDir(), limit = 50 } = {}) {
  const root = path.resolve(dir)
  let scanned = 0
  let captured = 0
  let skipped = 0
  for await (const file of walk(root)) {
    if (scanned >= limit) break
    scanned++
    try {
      const text = extractConversation(await fs.readFile(file, 'utf8'))
      if (text.trim().length < 200) { skipped++; continue }
      const out = await runStandaloneCapture(vaultRoot, text, { source: `sweep:${path.basename(file)}` })
      if (out.ok && out.action !== 'skipped') captured++
      else skipped++
    } catch { skipped++ }
  }
  return { ok: true, dir: root, scanned, captured, skipped }
}
