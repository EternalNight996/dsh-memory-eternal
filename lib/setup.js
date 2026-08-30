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

// 是否已写入我们（capture.mjs）的会话结束 hook。
// marker 用于区分宿主：codex 走 hooks.json 的 Stop；cursor 走 hooks.json 的 stop/sessionEnd。
async function hookState(hooksJson, agent, cursorStyle = false) {
  try {
    const cfg = JSON.parse(await fs.readFile(hooksJson, 'utf8'))
    const hooks = cfg.hooks || {}
    // 遍历所有事件下命令里是否含 capture.mjs
    const all = Object.values(hooks)
    for (const arr of all) {
      if (!Array.isArray(arr)) continue
      for (const h of arr) {
        const cmd = typeof h === 'object' ? (h.command || h.hooks?.map((x) => x.command).join(' ')) : String(h)
        if (cmd && cmd.includes('capture.mjs')) return 'configured'
      }
    }
    return 'missing'
  } catch {
    return 'missing'
  }
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
  const hookScript = path.join(PACKAGE_ROOT, 'hooks', 'capture.mjs')
  if (!(await exists(hookScript))) {
    log('✗ hooks/capture.mjs 缺失，跳过 hooks')
    return { agent: 'claude-hooks', ok: false, reason: 'hook script missing' }
  }
  const settingsJson = path.join(home, '.claude', 'settings.json')
  let cfg = {}
  if (await exists(settingsJson)) {
    try { cfg = JSON.parse(await fs.readFile(settingsJson, 'utf8')) } catch { cfg = {} }
  }
  const want = {
    matcher: '',
    hooks: [{ type: 'command', command: `${JSON.stringify(nodePath)} ${JSON.stringify(hookScript)} claude` }],
  }
  const hookKey = 'SessionEnd'
  cfg.hooks = cfg.hooks ?? {}
  cfg.hooks[hookKey] = Array.isArray(cfg.hooks[hookKey]) ? cfg.hooks[hookKey] : []
  const already = cfg.hooks[hookKey].some((h) => h?.hooks?.some((c) => c?.command?.includes('capture.mjs')))
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
    // 已存在：检查 command 是否与当前 node 一致，不一致则重写为当前 node（修复 dsh-desktop vs node 路径漂移）
    const curCmd = /command\s*=\s*"([^"]*)"/.exec(text)?.[1]
    if (curCmd && curCmd === want.command) {
      log('✓ Codex MCP 已是最新，跳过')
      return [{ agent: 'codex', ok: true, reason: 'section exists' }]
    }
    // node 路径不一致 → 重写 command 行
    const newText = text.replace(/command\s*=\s*"[^"]*"/, `command = ${JSON.stringify(want.command)}`)
    if (!dryRun) {
      await backupOnce(codexToml)
      await fs.writeFile(codexToml, newText, 'utf8')
      log(`✓ Codex MCP node 路径已更新：${want.command}`)
    } else {
      log('[dry-run] 将更新 Codex MCP node 路径')
    }
    return [{ agent: 'codex', ok: true, reason: 'node path updated' }]
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
        const has = list.some((h) => h?.hooks?.some((c) => c?.command?.includes('capture.mjs')))
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
      hook: await hookState(path.join(home, '.codex', 'hooks.json'), 'codex'),
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
        hook: await hookState(path.join(home, '.cursor', 'hooks.json'), 'cursor', true),
      })
    } catch { agents.push({ name: 'cursor', installed: true, mcpConfigured: false, mcpPath: cursorJson, reason: 'JSON 解析失败' }) }
  }
  return { ok: true, agents, lastCheckedAt: Date.now(), want: { command: nodePath, args: want.args } }
}

// -- 会话结束自动沉淀 hook（connect <agent>，agentmemory 的 `connect --with-hooks` 兜底路径）--
// 不依赖 plugin（Codex Desktop 也适用），只写「用户级 hooks.json + 绝对路径指向 capture.mjs」，
// 幂等 + 备份，只碰 capture.mjs 标记的条目，绝不动其它用户条目。

/** capture.mjs 的完整调用（绝对路径，避免升级后路径内嵌版本号而失效）。 */
function captureCmd(agent) {
  const node = process.execPath
  const script = path.join(PACKAGE_ROOT, 'hooks', 'capture.mjs')
  return `${JSON.stringify(node)} ${JSON.stringify(script)} ${agent}`
}

/** 写一个幂等 hooks.json：events → [{command}]（cursor 风格）或 {hooks:[{type,command}]}（codex 风格）。
 * 幂等 + 路径迁移：已有 capture.mjs 条目但路径不同 → 就地改为当前包路径；没有 → 追加；正确 → 跳过。 */
async function writeHooksJson(hooksJson, evEntries, { dryRun = false, log = () => {} } = {}) {
  let cfg = { version: 1, hooks: {} }
  if (await exists(hooksJson)) {
    try { cfg = JSON.parse(await fs.readFile(hooksJson, 'utf8')) } catch {
      log(`✗ ${hooksJson} 解析失败，跳过`)
      return { ok: false, reason: 'parse error' }
    }
  }
  cfg.hooks = cfg.hooks ?? {}
  let changed = false
  for (const ev of evEntries) {
    const arr = cfg.hooks[ev.event] = Array.isArray(cfg.hooks[ev.event]) ? cfg.hooks[ev.event] : []
    const wantCmd = ev.cmd
    // 找已存在的 capture.mjs 条目（可能是本脚本旧路径，或其它包的同脚本名）
    const idx = arr.findIndex((h) => JSON.stringify(h).includes('capture.mjs'))
    if (idx >= 0) {
      const entry = ev.codexStyle ? (arr[idx].hooks || []).find((x) => x.command && x.command.includes('capture.mjs')) : arr[idx]
      if (entry && entry.command === wantCmd) continue // 已正确
      if (entry) { entry.command = wantCmd; changed = true } // 路径迁移
      else { arr[idx] = ev.codexStyle ? { hooks: [{ type: 'command', command: wantCmd, timeout: 60, statusMessage: 'memory: save session' }] } : { command: wantCmd }; changed = true }
    } else {
      arr.push(ev.codexStyle ? { hooks: [{ type: 'command', command: wantCmd, timeout: 60, statusMessage: 'memory: save session' }] } : { command: wantCmd })
      changed = true
    }
  }
  if (!changed) { log(`✓ ${hooksJson} 已是最新，跳过`); return { ok: true, skipped: true } }
  if (dryRun) { log(`[dry-run] 将写入 ${hooksJson}`); return { ok: true, dry: true } }
  if (await exists(hooksJson)) await backupOnce(hooksJson)
  await fs.mkdir(path.dirname(hooksJson), { recursive: true })
  await fs.writeFile(hooksJson, JSON.stringify(cfg, null, 2), 'utf8')
  log(`✓ 会话结束 hook 已写入 ${hooksJson}`)
  return { ok: true }
}

/** Codex：用户级 ~/.codex/hooks.json 的 Stop 事件（CLI 与 Desktop 都可用）。 */
export async function connectCodexHooks(opts = {}) {
  return writeHooksJson(path.join(home, '.codex', 'hooks.json'), [{ event: 'Stop', codexStyle: true, cmd: captureCmd('codex') }], opts)
}

/** Cursor：~/.cursor/hooks.json 的 stop / sessionEnd 事件。 */
export async function connectCursorHooks(opts = {}) {
  return writeHooksJson(path.join(home, '.cursor', 'hooks.json'), [{ event: 'stop', cmd: captureCmd('cursor') }, { event: 'sessionEnd', cmd: captureCmd('cursor') }], opts)
}

/** 统一入口：claude 复用 setupClaude 的 SessionEnd（capture.mjs）；codex/cursor 写 capture.mjs hooks。 */
export async function connectAgentHooks(agent, opts = {}) {
  if (agent === 'claude' || agent === 'claude-code') {
    const results = await setupClaude({ nodePath: process.execPath, withHooks: true, log: opts.log })
    return { ok: results.every((r) => r.ok), results }
  }
  if (agent === 'codex') return connectCodexHooks(opts)
  if (agent === 'cursor') return connectCursorHooks(opts)
  return { ok: false, error: `未知 agent: ${agent}` }
}

// -- 单智能体 MCP 安装 / 卸载 ----------------------------------------------------

/** 卸载 Claude Code 的 memory MCP + SessionEnd hook。 */
export async function removeClaudeMcp({ dryRun = false, log = () => {} } = {}) {
  const claudeJson = path.join(home, '.claude.json')
  let removed = false
  if (await exists(claudeJson)) {
    try {
      const cfg = JSON.parse(await fs.readFile(claudeJson, 'utf8'))
      if (cfg.mcpServers && cfg.mcpServers.memory) {
        if (!dryRun) { await backupOnce(claudeJson); delete cfg.mcpServers.memory; await fs.writeFile(claudeJson, JSON.stringify(cfg, null, 2), 'utf8') }
        removed = true
      }
    } catch {}
  }
  // 移除 SessionEnd hook
  const settingsJson = path.join(home, '.claude', 'settings.json')
  if (await exists(settingsJson)) {
    try {
      const scfg = JSON.parse(await fs.readFile(settingsJson, 'utf8'))
      if (scfg.hooks?.SessionEnd) {
        const kept = scfg.hooks.SessionEnd.filter((h) => !(h.hooks || []).some((c) => c?.command?.includes('capture.mjs')))
        if (kept.length !== scfg.hooks.SessionEnd.length) {
          if (!dryRun) { await backupOnce(settingsJson); scfg.hooks.SessionEnd = kept; await fs.writeFile(settingsJson, JSON.stringify(scfg, null, 2), 'utf8') }
          removed = true
        }
      }
    } catch {}
  }
  log(removed ? (dryRun ? '[dry-run] 将卸载 Claude Code MCP' : '✓ 已卸载 Claude Code MCP') : '✓ Claude Code MCP 未配置')
  return { agent: 'claude-code', ok: true, removed }
}

/** 卸载 Codex 的 memory MCP 段。 */
export async function removeCodexMcp({ dryRun = false, log = () => {} } = {}) {
  const codexToml = path.join(home, '.codex', 'config.toml')
  if (!(await exists(codexToml))) return { agent: 'codex', ok: false, reason: 'not installed' }
  const text = await fs.readFile(codexToml, 'utf8')
  const sectionRe = /^\s*\[mcp_servers\.memory\]\s*$/m
  if (!sectionRe.test(text)) { log('✓ Codex MCP 未配置'); return { agent: 'codex', ok: true, removed: false } }
  if (!dryRun) {
    const newText = text.replace(/^\s*# memory-eternal.*\n?/m, '').replace(/^\s*\[mcp_servers\.memory\]\s*\n(?:command\s*=.*\n|args\s*=.*\n)+\s*/m, '')
    await backupOnce(codexToml)
    await fs.writeFile(codexToml, newText.replace(/\n{3,}/g, '\n\n'), 'utf8')
  }
  log(dryRun ? '[dry-run] 将卸载 Codex MCP' : '✓ 已卸载 Codex MCP')
  return { agent: 'codex', ok: true, removed: true }
}

/** 卸载 Cursor 的 memory MCP。 */
export async function removeCursorMcp({ dryRun = false, log = () => {} } = {}) {
  const cursorJson = path.join(home, '.cursor', 'mcp.json')
  if (!(await exists(cursorJson))) return { agent: 'cursor', ok: false, reason: 'not installed' }
  try {
    const cfg = JSON.parse(await fs.readFile(cursorJson, 'utf8'))
    if (cfg.mcpServers && cfg.mcpServers.memory) {
      if (!dryRun) { await backupOnce(cursorJson); delete cfg.mcpServers.memory; await fs.writeFile(cursorJson, JSON.stringify(cfg, null, 2), 'utf8') }
      log(dryRun ? '[dry-run] 将卸载 Cursor MCP' : '✓ 已卸载 Cursor MCP')
      return { agent: 'cursor', ok: true, removed: true }
    }
  } catch {}
  log('✓ Cursor MCP 未配置')
  return { agent: 'cursor', ok: true, removed: false }
}

/** 对单个智能体执行安装/卸载 MCP。action: 'install' | 'uninstall'。agent: 'claude-code'|'codex'|'cursor' */
export async function mcpAgentAction(agent, action, { dryRun = false, log = () => {} } = {}) {
  if (action === 'install') {
    const nodePath = process.execPath
    if (agent === 'claude-code') return { ok: true, results: await setupClaude({ nodePath, dryRun, log }) }
    if (agent === 'codex') return { ok: true, results: await setupCodex({ nodePath, dryRun, log }) }
    if (agent === 'cursor') return { ok: true, results: await setupCursor({ nodePath, dryRun, log }) }
  } else if (action === 'uninstall') {
    if (agent === 'claude-code') return { ok: true, results: [await removeClaudeMcp({ dryRun, log })] }
    if (agent === 'codex') return { ok: true, results: [await removeCodexMcp({ dryRun, log })] }
    if (agent === 'cursor') return { ok: true, results: [await removeCursorMcp({ dryRun, log })] }
  }
  return { ok: false, error: `未知 agent/action: ${agent}/${action}` }
}
