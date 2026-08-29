// 记忆核心 · 一键自动挂载器。
//
// 安装/激活时自动检测本机已装的 MCP 宿主（Claude Code / Codex CLI / Cursor），
// 幂等写入各自 MCP 配置，指向本包 bin/dsh-memory.mjs —— 实现「装完即用」。
//
// 安全约定：
// - 幂等：目标配置已存在且内容一致 → 跳过；不一致 → 先备份（.memory-eternal-bak-<ts>）再覆盖
// - 透明：每一步动作输出到 stdout
// - 逃生：环境变量 MEMORY_ETERNAL_SKIP_AUTO=1 或 opts.enabled=false 时完全不动外部文件
// - 只碰自己的键（mcpServers.memory / hooks 里 id 标记的条目），不改其他内容

import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const PACKAGE_ROOT = path.join(__dirname, '..')
export const BIN_PATH = path.join(PACKAGE_ROOT, 'bin', 'dsh-memory.mjs')

const home = os.homedir()

async function exists(p) {
  try { await fs.access(p); return true } catch { return false }
}

async function backupOnce(file) {
  const bak = `${file}.memory-eternal-bak-${Date.now()}`
  await fs.copyFile(file, bak)
  return bak
}

export function mcpCommand(nodePath = process.execPath) {
  return { command: nodePath, args: [BIN_PATH, 'mcp'] }
}

function sameMcpEntry(existing, want) {
  if (!existing || typeof existing !== 'object') return false
  if (existing.type === 'stdio' || existing.type === undefined) {
    return existing.command === want.command
      && JSON.stringify(existing.args ?? []) === JSON.stringify(want.args)
  }
  return false
}

// -- Claude Code：~/.claude.json 的 mcpServers + ~/.claude/settings.json 的 hooks --

export async function setupClaude({ nodePath, withHooks = true, dryRun = false, log = () => {} } = {}) {
  const results = []
  const claudeJson = path.join(home, '.claude.json')
  if (await exists(claudeJson)) {
    const want = mcpCommand(nodePath)
    let cfg
    try { cfg = JSON.parse(await fs.readFile(claudeJson, 'utf8')) } catch { cfg = null }
    if (cfg && typeof cfg === 'object') {
      cfg.mcpServers = cfg.mcpServers ?? {}
      if (sameMcpEntry(cfg.mcpServers.memory, want)) {
        log('✓ Claude Code MCP 已是最新，跳过')
      } else if (!dryRun) {
        if (cfg.mcpServers.memory) await backupOnce(claudeJson)
        cfg.mcpServers.memory = { type: 'stdio', ...want }
        await fs.writeFile(claudeJson, JSON.stringify(cfg, null, 2), 'utf8')
        log('✓ Claude Code MCP 已写入 ~/.claude.json')
      } else {
        log('[dry-run] 将写入 Claude Code MCP ~/.claude.json')
      }
      results.push({ agent: 'claude-code', ok: true })
    }
  } else {
    log('✗ 未检测到 Claude Code（~/.claude.json 不存在）')
    results.push({ agent: 'claude-code', ok: false, reason: 'not installed' })
  }

  if (withHooks) results.push(await setupClaudeHooks({ nodePath, dryRun, log }))
  return results
}

async function setupClaudeHooks({ nodePath, dryRun, log }) {
  const hookScript = path.join(PACKAGE_ROOT, 'hooks', 'claude-session.js')
  if (!(await exists(hookScript))) {
    log('✗ hooks/claude-session.js 缺失，跳过 hooks')
    return { agent: 'claude-hooks', ok: false, reason: 'hook script missing' }
  }
  const settingsJson = path.join(home, '.claude', 'settings.json')
  let cfg = {}
  if (await exists(settingsJson)) {
    try { cfg = JSON.parse(await fs.readFile(settingsJson, 'utf8')) } catch { cfg = {} }
  }
  const want = {
    matcher: '',
    hooks: [{ type: 'command', command: `${JSON.stringify(nodePath)} ${JSON.stringify(hookScript)}` }],
  }
  const hookKey = 'SessionEnd'
  cfg.hooks = cfg.hooks ?? {}
  cfg.hooks[hookKey] = Array.isArray(cfg.hooks[hookKey]) ? cfg.hooks[hookKey] : []
  const already = cfg.hooks[hookKey].some((h) => h?.hooks?.some((c) => c?.command?.includes('claude-session.js')))
  if (already) {
    log('✓ Claude Code SessionEnd hook 已存在，跳过')
    return { agent: 'claude-hooks', ok: true }
  }
  if (!dryRun) {
    if (Object.keys(cfg).length > 0) await backupOnce(settingsJson).catch(() => {})
    cfg.hooks[hookKey].push(want)
    await fs.mkdir(path.dirname(settingsJson), { recursive: true })
    await fs.writeFile(settingsJson, JSON.stringify(cfg, null, 2), 'utf8')
    log('✓ Claude Code SessionEnd hook 已写入 ~/.claude/settings.json')
  } else {
    log('[dry-run] 将写入 Claude Code hook')
  }
  return { agent: 'claude-hooks', ok: true }
}

// -- Codex CLI：~/.codex/config.toml 的 [mcp_servers.memory] --

export async function setupCodex({ nodePath, dryRun = false, log = () => {} } = {}) {
  const codexToml = path.join(home, '.codex', 'config.toml')
  if (!(await exists(codexToml))) {
    log('✗ 未检测到 Codex CLI（~/.codex/config.toml 不存在）')
    return [{ agent: 'codex', ok: false, reason: 'not installed' }]
  }
  const want = mcpCommand(nodePath)
  const text = await fs.readFile(codexToml, 'utf8')
  const sectionRe = /^\[mcp_servers\.memory\]$/m
  if (sectionRe.test(text)) {
    log('✓ Codex MCP 配置段已存在，跳过（如需更新请手动检查）')
    return [{ agent: 'codex', ok: true, reason: 'section exists' }]
  }
  const block = [
    '',
    '# memory-eternal（自动写入；移除可运行 dsh-memory setup --codex-only --remove）',
    '[mcp_servers.memory]',
    `command = ${JSON.stringify(want.command)}`,
    `args = ${JSON.stringify(want.args)}`,
    '',
  ].join('\n')
  if (!dryRun) {
    await backupOnce(codexToml)
    await fs.writeFile(codexToml, text.replace(/\s*$/, '\n') + block, 'utf8')
    log('✓ Codex MCP 已写入 ~/.codex/config.toml')
  } else {
    log('[dry-run] 将写入 Codex MCP ~/.codex/config.toml')
  }
  return [{ agent: 'codex', ok: true }]
}

// -- Cursor：~/.cursor/mcp.json --

export async function setupCursor({ nodePath, dryRun = false, log = () => {} } = {}) {
  const cursorJson = path.join(home, '.cursor', 'mcp.json')
  let cfg = { mcpServers: {} }
  if (await exists(cursorJson)) {
    try { cfg = JSON.parse(await fs.readFile(cursorJson, 'utf8')) } catch {
      log('✗ ~/.cursor/mcp.json 解析失败，跳过')
      return [{ agent: 'cursor', ok: false, reason: 'parse error' }]
    }
  } else {
    // Cursor 目录不存在 = 未安装（保守判断：只报提示，不写文件）
    const cursorDir = path.join(home, '.cursor')
    if (!(await exists(cursorDir))) {
      log('✗ 未检测到 Cursor（~/.cursor 不存在）')
      return [{ agent: 'cursor', ok: false, reason: 'not installed' }]
    }
  }
  const want = mcpCommand(nodePath)
  cfg.mcpServers = cfg.mcpServers ?? {}
  if (sameMcpEntry(cfg.mcpServers.memory, want)) {
    log('✓ Cursor MCP 已是最新，跳过')
    return [{ agent: 'cursor', ok: true }]
  }
  if (!dryRun) {
    if (await exists(cursorJson)) await backupOnce(cursorJson)
    cfg.mcpServers.memory = want
    await fs.mkdir(path.dirname(cursorJson), { recursive: true })
    await fs.writeFile(cursorJson, JSON.stringify(cfg, null, 2), 'utf8')
    log('✓ Cursor MCP 已写入 ~/.cursor/mcp.json')
  } else {
    log('[dry-run] 将写入 Cursor MCP ~/.cursor/mcp.json')
  }
  return [{ agent: 'cursor', ok: true }]
}

// -- 总入口 -------------------------------------------------------------------

export async function runSetup(opts = {}) {
  const {
    only = [],          // ['claude','codex','cursor']；空 = 全部
    withHooks = true,
    dryRun = false,
    log = (m) => console.log(m),
    enabled = process.env.MEMORY_ETERNAL_SKIP_AUTO !== '1',
  } = opts
  if (!enabled) {
    log('⏭ MEMORY_ETERNAL_SKIP_AUTO=1，跳过自动挂载')
    return { ok: true, results: [] }
  }
  const all = []
  const want = (name) => only.length === 0 || only.includes(name)
  if (want('claude')) all.push(...await setupClaude({ nodePath: process.execPath, withHooks, dryRun, log }))
  if (want('codex')) all.push(...await setupCodex({ nodePath: process.execPath, dryRun, log }))
  if (want('cursor')) all.push(...await setupCursor({ nodePath: process.execPath, dryRun, log }))
  return { ok: true, results: all }
}

/**
 * 只读查询各 agent 的 MCP 配置状态。不修改任何文件。
 * @returns {Promise<{ok:true, agents: Array, lastCheckedAt: number}>}
 */
export async function getSetupStatus({ nodePath = process.execPath } = {}) {
  const agents = []
  const want = mcpCommand(nodePath)
  // claude-code
  const claudeJson = path.join(home, '.claude.json')
  if (!(await exists(claudeJson))) {
    agents.push({ name: 'claude-code', installed: false, mcpConfigured: false, hook: 'unknown' })
  } else {
    let cfg = null
    try { cfg = JSON.parse(await fs.readFile(claudeJson, 'utf8')) } catch {}
    const entry = cfg?.mcpServers?.memory
    const mcpExists = !!entry
    agents.push({
      name: 'claude-code',
      installed: true,
      mcpConfigured: mcpExists,
      mcpMatchesCurrentNode: mcpExists && sameMcpEntry(entry, want),
      currentNodePath: nodePath,
      configuredNodePath: entry?.command || '',
      mcpPath: claudeJson,
    })
    // hook
    const settingsJson = path.join(home, '.claude', 'settings.json')
    if (await exists(settingsJson)) {
      try {
        const scfg = JSON.parse(await fs.readFile(settingsJson, 'utf8'))
        const list = scfg?.hooks?.SessionEnd || []
        const has = list.some((h) => h?.hooks?.some((c) => c?.command?.includes('claude-session.js')))
        agents[agents.length - 1].hook = has ? 'configured' : 'missing'
      } catch { agents[agents.length - 1].hook = 'unknown' }
    } else {
      agents[agents.length - 1].hook = 'missing'
    }
  }
  // codex
  const codexToml = path.join(home, '.codex', 'config.toml')
  if (!(await exists(codexToml))) {
    agents.push({ name: 'codex', installed: false, mcpConfigured: false })
  } else {
    const text = await fs.readFile(codexToml, 'utf8')
    const has = /^\[mcp_servers\.memory\]$/m.test(text)
    let configuredNodePath = ''
    if (has) { const m = /command\s*=\s*"([^"]+)"/.exec(text); if (m) configuredNodePath = m[1] }
    agents.push({
      name: 'codex',
      installed: true,
      mcpConfigured: has,
      mcpMatchesCurrentNode: has && configuredNodePath === nodePath,
      currentNodePath: nodePath,
      configuredNodePath,
      mcpPath: codexToml,
    })
  }
  // cursor
  const cursorJson = path.join(home, '.cursor', 'mcp.json')
  const cursorDir = path.join(home, '.cursor')
  if (!(await exists(cursorDir))) {
    agents.push({ name: 'cursor', installed: false, mcpConfigured: false, reason: '~/.cursor 不存在' })
  } else if (!(await exists(cursorJson))) {
    agents.push({ name: 'cursor', installed: true, mcpConfigured: false, mcpPath: cursorJson })
  } else {
    try {
      const cfg = JSON.parse(await fs.readFile(cursorJson, 'utf8'))
      const entry = cfg?.mcpServers?.memory
      const mcpExists = !!entry
      agents.push({
        name: 'cursor',
        installed: true,
        mcpConfigured: mcpExists,
        mcpMatchesCurrentNode: mcpExists && sameMcpEntry(entry, want),
        currentNodePath: nodePath,
        configuredNodePath: entry?.command || '',
        mcpPath: cursorJson,
      })
    } catch { agents.push({ name: 'cursor', installed: true, mcpConfigured: false, mcpPath: cursorJson, reason: 'JSON 解析失败' }) }
  }
  return { ok: true, agents, lastCheckedAt: Date.now(), want: { command: nodePath, args: want.args } }
}
