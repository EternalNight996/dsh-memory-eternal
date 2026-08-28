#!/usr/bin/env node
// 记忆核心 · CLI（多宿主统一入口）
//
// 用法：
//   dsh-memory recall <query> [--limit N] [--vault DIR]   检索知识卡
//   dsh-memory capture <text | - > [--source TAG]         手动沉淀（- 读 stdin）
//   dsh-memory serve [--port N] [--vault DIR]             启动 Web UI（前台常驻）
//   dsh-memory open [--port N]                            确保 Web 存活并用浏览器打开
//   dsh-memory mcp                                        MCP stdio server（各 agent 挂载）
//   dsh-memory setup [--claude-only|--codex-only|--cursor-only] [--dry-run] [--no-hooks]
//                                                         自动挂载 MCP 到已装的 agent
//   dsh-memory sweep <dir>                                挖掘 Claude Code 会话 JSONL
//
// 环境变量：
//   MEMORY_VAULT_DIR       vault 目录（默认 ~/.dsh/memory-vault）
//   MEMORY_LLM_BASE_URL / MEMORY_LLM_KEY / MEMORY_LLM_MODEL   蒸馏 LLM（OpenAI 兼容）
//   MEMORY_ETERNAL_SKIP_AUTO=1   setup 时不动外部配置

import path from 'node:path'
import process from 'node:process'

const argv = process.argv.slice(2)
const cmd = argv[0] || 'help'
const argOf = (name) => {
  const i = argv.indexOf(name)
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null
}
const has = (name) => argv.includes(name)

/** 取位置参数（跳过子命令、flag 与 flag 的值） */
const positional = () => {
  const isFlag = (s) => typeof s === 'string' && s.startsWith('--')
  const out = []
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i]
    if (isFlag(a)) { i++; continue }   // 跳过 flag + 它的值（任意 flag 都吃掉下一项）
    out.push(a)
  }
  return out
}

async function main() {
  switch (cmd) {
    case 'recall': {
      const query = positional().join(' ')
      const { search } = await import('../lib/vault.js')
      const { defaultVaultDir } = await import('../lib/capture-run.js')
      const root = path.resolve(argOf('--vault') || defaultVaultDir())
      const limit = Math.min(Math.max(Number(argOf('--limit')) || 5, 1), 20)
      const hits = await search(root, query, { limit, minScore: 2 })
      if (!hits.length) {
        console.log(JSON.stringify({ ok: true, hits: [], note: `记忆库中没有与「${query}」相关的内容` }, null, 2))
        return
      }
      console.log(JSON.stringify({ ok: true, vaultDir: root, hits }, null, 2))
      return
    }
    case 'capture': {
      const raw = positional().join(' ')
      let text = raw
      if (raw === '-' || (!raw && !process.stdin.isTTY)) {
        text = await new Promise((resolve) => {
          let buf = ''
          process.stdin.setEncoding('utf8')
          process.stdin.on('data', (c) => { buf += c })
          process.stdin.on('end', () => resolve(buf))
        })
      }
      const { runStandaloneCapture, defaultVaultDir } = await import('../lib/capture-run.js')
      const root = path.resolve(defaultVaultDir())
      const out = await runStandaloneCapture(root, text, { source: argOf('--source') || 'cli' })
      console.log(JSON.stringify({ ...out, vaultDir: root }, null, 2))
      process.exitCode = out.ok ? 0 : 1
      return
    }
    case 'serve': {
      const { startWebServer, DEFAULT_WEB_PORT } = await import('../lib/web.js')
      const { defaultVaultDir } = await import('../lib/capture-run.js')
      const port = Number(argOf('--port')) || DEFAULT_WEB_PORT
      const vault = path.resolve(argOf('--vault') || defaultVaultDir())
      await startWebServer({ port, vaultRoot: vault })
      process.on('SIGINT', () => process.exit(0))
      process.on('SIGTERM', () => process.exit(0))
      return
    }
    case 'open': {
      const { ensureWebServer, DEFAULT_WEB_PORT } = await import('../lib/web.js')
      const { defaultVaultDir } = await import('../lib/capture-run.js')
      const port = Number(argOf('--port')) || DEFAULT_WEB_PORT
      const { url } = await ensureWebServer({ port, vaultRoot: path.resolve(defaultVaultDir()) })
      console.log(url)
      const plat = process.platform
      const { exec } = await import('node:child_process')
      if (plat === 'win32') exec(`start "" "${url}"`)
      else if (plat === 'darwin') exec(`open "${url}"`)
      else exec(`xdg-open "${url}"`)
      return
    }
    case 'mcp': {
      const { startMcpServer } = await import('../lib/mcp.js')
      startMcpServer()
      return
    }
    case 'setup': {
      const { runSetup } = await import('../lib/setup.js')
      const only = []
      if (has('--claude-only')) only.push('claude')
      if (has('--codex-only')) only.push('codex')
      if (has('--cursor-only')) only.push('cursor')
      const out = await runSetup({ only, withHooks: !has('--no-hooks'), dryRun: has('--dry-run') })
      const done = out.results.filter((r) => r.ok).length
      console.log(`\n记忆库目录：默认 ~/.dsh/memory-vault（MEMORY_VAULT_DIR 可改）`)
      console.log(`完成：${done}/${out.results.length} 项。Web UI: dsh-memory open`)
      return
    }
    case 'sweep': {
      const dir = argv[1]
      if (!dir || dir.startsWith('--')) {
        console.error('用法：dsh-memory sweep <dir>（如 ~/.claude/projects）')
        process.exitCode = 1
        return
      }
      const { sweepSessions } = await import('../lib/sweep.js')
      const out = await sweepSessions(dir)
      console.log(JSON.stringify(out, null, 2))
      return
    }
    default:
      console.log(`dsh-memory — 记忆核心 CLI

用法：
  dsh-memory recall <query> [--limit N]      检索知识卡
  dsh-memory capture <text | -> [--source T] 手动沉淀（- 读 stdin）
  dsh-memory serve [--port N]                Web UI（前台）
  dsh-memory open                            确保 Web 存活并打开浏览器
  dsh-memory mcp                             MCP stdio server
  dsh-memory setup [--dry-run] ...           自动挂载 MCP 到已装 agent
  dsh-memory sweep <dir>                     挖掘会话 JSONL

环境变量：MEMORY_VAULT_DIR / MEMORY_LLM_BASE_URL / MEMORY_LLM_KEY / MEMORY_LLM_MODEL`)
  }
}

main().catch((error) => {
  console.error(String(error?.stack || error))
  process.exit(1)
})
