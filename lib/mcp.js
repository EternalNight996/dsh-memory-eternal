// 记忆核心 · MCP server（零依赖 stdio JSON-RPC 2.0）。
//
// 让 Claude Code / Codex CLI / Cursor / 任何 MCP 客户端共享同一个记忆库。
// 传输：MCP stdio —— stdin/stdout 每行一条 JSON-RPC 消息；日志一律走 stderr
// （stdout 是协议通道，被 console.log 污染会破坏握手）。
//
// 支持的协议版本：2025-06-18 / 2025-03-26 / 2024-11-05（协商取请求版本）。
// 工具：memory_recall / memory_capture / memory_stats。
//
// 启动：node bin/dsh-memory.mjs mcp   （或 node lib/mcp.js）

import readline from 'node:readline'
import { search, overview, stats, ensureVault } from './vault.js'
import { runStandaloneCapture, defaultVaultDir } from './capture-run.js'

const SUPPORTED_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05']
const DEFAULT_PROTOCOL_VERSION = '2024-11-05'

export const MCP_TOOLS = [
  {
    name: 'memory_recall',
    description:
      '从本地记忆核心（Markdown 知识库）检索相关知识卡。需要项目背景、历史决策、之前讨论过的方案、' +
      '或领域知识时调用；返回最相关的卡片摘要。用 query 描述要找的内容，支持中文整词与字符片段检索。',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '检索关键词或自然语言描述，如「数据库选型」「用户偏好」' },
        limit: { type: 'number', description: '返回卡片数上限，默认 5' },
      },
      required: ['query'],
    },
  },
  {
    name: 'memory_capture',
    description:
      '把一段值得长期复用的对话/知识沉淀进记忆库。配置了 MEMORY_LLM_* 环境变量时会用 LLM 蒸馏压缩成知识卡；' +
      '未配置时降级为原文卡。通常由会话结束 hook 自动调用，手动调用用于显式保存重要结论。',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: '要沉淀的对话文本或知识内容（建议 >120 字符）' },
        source: { type: 'string', description: '来源标记，如 session:xxx / claude-code / codex' },
      },
      required: ['text'],
    },
  },
  {
    name: 'memory_stats',
    description: '查看记忆库概览：总卡数、分类分布、最近新增、vault 目录路径。',
    inputSchema: { type: 'object', properties: {} },
  },
]

function toolResult(text, isError = false) {
  return { content: [{ type: 'text', text: String(text) }], ...(isError ? { isError: true } : {}) }
}

async function callTool(name, args, vaultRoot, meta = {}) {
  switch (name) {
    case 'memory_recall': {
      const query = String(args?.query || '').trim()
      if (!query) return toolResult('（未提供检索词）')
      const limit = Math.min(Math.max(Number(args?.limit) || 5, 1), 20)
      const hits = await search(vaultRoot, query, { limit, minScore: 2 })
      if (hits.length === 0) return toolResult(`记忆库中没有与「${query}」相关的内容。`)
      const lines = hits.map((h, i) => {
        const tags = h.tags.length ? ` [${h.tags.join(', ')}]` : ''
        const snippet = String(h.summary || '').replace(/\s+/g, ' ').trim().slice(0, 130)
        return `### ${i + 1}. ${h.title}${tags}\n路径：${h.path}\n${snippet}`
      })
      return toolResult(`从记忆核心检索到 ${hits.length} 条相关卡片：\n\n${lines.join('\n\n')}`)
    }
    case 'memory_capture': {
      const text = String(args?.text || '')
      const out = await runStandaloneCapture(vaultRoot, text, {
        source: String(args?.source || meta.submittedBy || 'mcp'),
      })
      if (!out.ok && out.action === 'failed') return toolResult(`沉淀失败：${out.reason}`, true)
      return toolResult(JSON.stringify(out))
    }
    case 'memory_stats': {
      await ensureVault(vaultRoot)
      const ov = await overview(vaultRoot)
      const s = await stats(vaultRoot)
      return toolResult(JSON.stringify({ vaultDir: vaultRoot, total: ov.total, byKind: ov.byKind, tags: s.tags, week: s.week }, null, 2))
    }
    default:
      throw new Error(`未知工具：${name}`)
  }
}

export function startMcpServer({ vaultRoot = defaultVaultDir() } = {}) {
  const rl = readline.createInterface({ input: process.stdin })
  const write = (msg) => process.stdout.write(JSON.stringify(msg) + '\n')
  let pendingCalls = 0
  let closing = false
  // MCP 客户端信息：initialize 时记录（agent 名），供 memory_capture 署名用
  let clientInfo = {}
  const maybeExit = () => { if (closing && pendingCalls === 0) process.exit(0) }

  rl.on('line', (line) => {
    const raw = line.trim()
    if (!raw) return
    let msg
    try {
      msg = JSON.parse(raw)
    } catch {
      write({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })
      return
    }
    const { id, method, params } = msg
    // notification（无 id）不回包
    if (id === undefined || id === null) {
      if (method === 'notifications/initialized' || method === 'notifications/cancelled') return
      return
    }
    try {
      if (method === 'initialize') {
        const requested = String(params?.protocolVersion || '')
        const negotiated = SUPPORTED_PROTOCOL_VERSIONS.includes(requested) ? requested : DEFAULT_PROTOCOL_VERSION
        clientInfo = params?.clientInfo || {}
        write({
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: negotiated,
            capabilities: { tools: {} },
            serverInfo: { name: 'dsh-memory-eternal', version: '1.0.0' },
          },
        })
        return
      }
      if (method === 'ping') {
        write({ jsonrpc: '2.0', id, result: {} })
        return
      }
      if (method === 'tools/list') {
        write({ jsonrpc: '2.0', id, result: { tools: MCP_TOOLS } })
        return
      }
      if (method === 'tools/call') {
        const name = params?.name
        const args = params?.arguments ?? {}
        const sub = clientInfo?.name ? `${clientInfo.name}${clientInfo.version ? '@' + clientInfo.version : ''}` : 'mcp'
        pendingCalls++
        callTool(name, args, vaultRoot, { submittedBy: sub })
          .then((result) => write({ jsonrpc: '2.0', id, result }))
          .catch((error) => write({ jsonrpc: '2.0', id, result: toolResult(String(error?.message || error), true) }))
          .finally(() => { pendingCalls--; maybeExit() })
        return
      }
      write({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } })
    } catch (error) {
      write({ jsonrpc: '2.0', id, error: { code: -32603, message: String(error?.message || error) } })
    }
  })

  rl.on('close', () => { closing = true; maybeExit() })
  process.stderr.write(`[memory-eternal] MCP server ready (vault: ${vaultRoot})\n`)
}

// 作为脚本直接运行（node lib/mcp.js / node bin/dsh-memory.mjs mcp 的转发目标）时自动启动。
if (process.argv[1] && /[\\/]mcp\.js$/.test(process.argv[1])) {
  startMcpServer()
}
