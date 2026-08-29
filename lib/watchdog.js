// 记忆核心 · 看门狗（独立进程保活 lib/web.js）。
//
// 用法（经 CLI）：dsh-memory watchdog [--port 7999] [--interval 5] [--max-restart 10]
//
// 行为：
// - 启动时探测端口：活则只监督不接管；死则 spawn 新 web server
// - 周期性探活：HTTP GET /memory-eternal/api/overview（不是我们服务视为死）
// - 探到死：清理残留进程 → spawn 新 web server → restart 计数 +1
// - restart 超过 max-restart（默认 10）→ fatal 退出，不再保活
// - SIGINT/SIGTERM：优雅退出（停掉 watchdog 自己拉起的 web，但不动用户手动起的）
// - 所有状态输出到 stderr（看门狗 daemon 的标准约定）
//
// 独立性：watchdog 完全独立于 DSH 宿主——即便旧版插件（无 autoWeb）跑的
// DSH 环境，watchdog 也能拉起并保活 web server，让浏览器始终可达。

import http from 'node:http'
import net from 'node:net'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WEB_JS = path.join(__dirname, 'web.js')
const API_PREFIX = '/memory-eternal/api'

const ts = () => new Date().toISOString().slice(11, 19) // HH:MM:SS
const log = (...args) => process.stderr.write(`[${ts()}] [watchdog] ${args.join(' ')}\n`)

/** 探测某端口是否在响应 + 是我们的服务（响应含 vaultDir 标记）。 */
export async function probe(port, timeoutMs = 1000) {
  return new Promise((resolve) => {
    const req = http.request({ host: '127.0.0.1', port, path: `${API_PREFIX}/overview`, method: 'GET', timeout: timeoutMs }, (res) => {
      if (res.statusCode !== 200) return resolve(null)
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        try {
          const data = JSON.parse(Buffer.concat(chunks).toString('utf8'))
          if (data && data.ok === true && typeof data.vaultDir === 'string') return resolve(data)
          resolve(null)
        } catch { resolve(null) }
      })
      res.on('error', () => resolve(null))
    })
    req.on('error', () => resolve(null))
    req.on('timeout', () => { req.destroy(); resolve(null) })
    req.end()
  })
}

/** 探测端口是否有任何 TCP 监听（即便不是我们的服务也占用）。 */
export async function probeTcp(port, timeoutMs = 600) {
  return new Promise((resolve) => {
    const s = new net.Socket()
    s.setTimeout(timeoutMs)
    s.once('connect', () => { s.destroy(); resolve(true) })
    s.once('timeout', () => { s.destroy(); resolve(false) })
    s.once('error', () => resolve(false))
    s.connect(port, '127.0.0.1')
  })
}

/**
 * 启动看门狗。返回对象含 .stop() 优雅退出。
 * @param {object} opts
 * @param {number} [opts.port=7999]
 * @param {string} [opts.vaultRoot]    // 默认 ~/.dsh/memory-vault
 * @param {number} [opts.interval=5000]
 * @param {number} [opts.maxRestart=10]
 * @param {boolean} [opts.autoStart=true]  // 首次探测到死时是否自动拉起
 */
export function startWatchdog({ port = 7999, vaultRoot, interval = 5000, maxRestart = 10, autoStart = true } = {}) {
  let child = null   // 我们 spawn 的 web 进程
  let ownedByUs = false
  let restartCount = 0
  let stopped = false
  let timer = null

  // 找空闲端口：port, port+1, ... 最多 +10
  const findFreePort = async (start) => {
    for (let p = start; p < start + 10; p++) {
      if (await probeTcp(p) === false) return p
    }
    return start
  }

  const spawnWeb = async () => {
    if (child && !child.killed) {
      try { child.kill('SIGTERM') } catch {}
    }
    const targetPort = await findFreePort(port)
    const args = [WEB_JS, '--port', String(targetPort)]
    if (vaultRoot) args.push('--vault', vaultRoot)
    log(`spawn web: node ${args.join(' ')}`)
    const c = spawn(process.execPath, args, {
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, MEMORY_VAULT_DIR: vaultRoot || process.env.MEMORY_VAULT_DIR || '' },
      windowsHide: true,
    })
    c.on('exit', (code, sig) => {
      if (!stopped && code !== 0) log(`web exited code=${code} sig=${sig}`)
    })
    c.unref()
    child = c
    ownedByUs = true
    return targetPort
  }

  const tick = async () => {
    if (stopped) return
    const alive = await probe(port)
    if (alive) {
      // 是我们的服务
      if (!ownedByUs) {
        log(`port ${port} 已存活（外部实例）→ 切换为保活模式（不接管）`)
        ownedByUs = true // 至少逻辑上"知道"它活了
      }
      return
    }
    // 端口死
    if (restartCount >= maxRestart) {
      log(`restart 次数达上限 ${maxRestart} → 退出看门狗（请人工排查）`)
      stop()
      return
    }
    if (!autoStart) {
      log(`port ${port} 已死，但 --no-restart 设置，跳过`)
      return
    }
    restartCount += 1
    log(`port ${port} 离线 → 第 ${restartCount} 次拉起 web server`)
    try {
      const newPort = await spawnWeb()
      // 等待 ready
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 500))
        const a = await probe(newPort)
        if (a) {
          log(`web 在 ${newPort} 就绪（vault: ${a.vaultDir}）`)
          if (newPort !== port) log(`提示：目标端口 ${port} 被占，watchdog 在 ${newPort} 上保活`)
          return
        }
      }
      log(`web 未能在 15s 内就绪`)
    } catch (error) {
      log(`spawn 失败：${error?.message || error}`)
    }
  }

  const stop = () => {
    if (stopped) return
    stopped = true
    if (timer) { clearInterval(timer); timer = null }
    if (child && !child.killed) {
      try { child.kill('SIGTERM') } catch {}
      setTimeout(() => { try { child && child.kill('SIGKILL') } catch {} }, 1000).unref()
    }
    log('看门狗退出')
    process.exit(0)
  }

  // 首次探测
  ;(async () => {
    const alive = await probe(port)
    if (alive) {
      log(`port ${port} 已活（外部实例），启动保活监督（间隔 ${interval}ms）`)
    } else if (autoStart) {
      log(`port ${port} 离线 → 首次拉起 web`)
      restartCount += 1
      try {
        const np = await spawnWeb()
        for (let i = 0; i < 30; i++) {
          await new Promise((r) => setTimeout(r, 500))
          if (await probe(np)) { log(`web 在 ${np} 就绪`); break }
        }
      } catch (e) { log(`首次拉起失败：${e?.message || e}`) }
    }
    timer = setInterval(tick, interval)
  })()

  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
  return { stop, get port() { return port }, get restartCount() { return restartCount } }
}

// 脚本入口：node lib/watchdog.js [--port N] [--interval MS] [--max-restart N] [--vault DIR]
if (process.argv[1] && /[\\/]watchdog\.js$/.test(process.argv[1])) {
  const argv = process.argv.slice(2)
  const argOf = (name) => {
    const i = argv.indexOf(name)
    return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null
  }
  const port = Number(argOf('--port')) || 7999
  const interval = Number(argOf('--interval')) || 5000
  const maxRestart = Number(argOf('--max-restart')) || 10
  const vaultRoot = argOf('--vault') || undefined
  const autoStart = !argv.includes('--no-restart')
  startWatchdog({ port, interval, maxRestart, vaultRoot, autoStart })
}