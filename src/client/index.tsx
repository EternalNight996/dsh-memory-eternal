// 记忆核心（client 侧）：设置 → 记忆 —— 图形化知识库页面。
//
// 提供：
// - 统计概览（总数 / 分 kind / 最近 7 天 / 标签数）；
// - 检索框（CJK 感知，走 host /memory-core/api/search）；
// - 知识卡网格（kind 筛选 + 全文阅读弹层）；
// - 知识图谱（SVG：节点=卡片，连线=[[wikilink]] 或共享标签），点击节点打开卡片。
//
// 数据全部来自 host 的 /memory-core/api/* JSON 路由（同源 fetch），
// 不引入额外依赖。

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const NS = 'memory-core'
const API = '/memory-core/api'

export const inject = ['settingsScope', 'slots', 'locale', 'connection', 'remote']

const ZH = {
  nav: '记忆',
  loading: '加载中…',
  refresh: '刷新',
  overview: '记忆库概览',
  total: '知识卡',
  recent: '近 7 天新增',
  tags: '标签',
  searchPlaceholder: '搜索记忆（支持中文片段）…',
  search: '搜索',
  all: '全部',
  kindProject: '项目',
  kindKnowledge: '知识',
  kindContent: '内容',
  kindPrompt: '提示词',
  kindBusiness: '业务',
  graph: '知识图谱',
  graphHint: '节点=知识卡；连线=[[链接]] 或共享标签。点击节点阅读卡片。',
  empty: '记忆库还是空的。多聊几轮后，值得保存的内容会自动沉淀成知识卡。',
  open: '阅读',
  updated: '更新于',
  created: '创建于',
  source: '来源',
  close: '关闭',
  vaultDir: '记忆库目录',
  capture: '自动沉淀',
  recall: '自动召回',
  enabled: '已启用',
  disabled: '已禁用',
  error: '加载失败',
  back: '返回列表',
  cardCount: '张卡',
  nodes: '节点',
  edges: '连线',
}

const EN = {
  nav: 'Memory',
  loading: 'Loading…',
  refresh: 'Refresh',
  overview: 'Memory Overview',
  total: 'Cards',
  recent: 'Added (7d)',
  tags: 'Tags',
  searchPlaceholder: 'Search memory…',
  search: 'Search',
  all: 'All',
  kindProject: 'Projects',
  kindKnowledge: 'Knowledge',
  kindContent: 'Content',
  kindPrompt: 'Prompts',
  kindBusiness: 'Business',
  graph: 'Knowledge Graph',
  graphHint: 'Nodes = cards; edges = [[links]] or shared tags. Click a node to read.',
  empty: 'Memory is empty. After a few conversations, valuable content is auto-captured.',
  open: 'Read',
  updated: 'Updated',
  created: 'Created',
  source: 'Source',
  close: 'Close',
  vaultDir: 'Vault directory',
  capture: 'Auto capture',
  recall: 'Auto recall',
  enabled: 'on',
  disabled: 'off',
  error: 'Load failed',
  back: 'Back to list',
  cardCount: 'cards',
  nodes: 'nodes',
  edges: 'edges',
}

const KIND_IDS = ['all', 'project', 'knowledge', 'content', 'prompt', 'business']
const KIND_COLORS = { project: '#3b82f6', knowledge: '#22c55e', content: '#f43f5e', prompt: '#06b6d4', business: '#eab308', other: '#8b5cf6' }

const CSS = `
.memory-core-root { font-family: inherit; color: var(--dsh-color-text, #1f2937); }
.memory-core-root .mc-card { background: var(--dsh-color-surface, #ffffff); border: 1px solid var(--dsh-color-border, #e5e7eb); border-radius: 12px; padding: 14px 16px; }
.memory-core-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 10px; margin-bottom: 14px; }
.memory-core-stat { text-align: center; }
.memory-core-stat b { display: block; font-size: 22px; line-height: 1.2; }
.memory-core-stat span { font-size: 12px; opacity: 0.65; }
.memory-core-toolbar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 12px; }
.memory-core-toolbar input[type=text] { flex: 1; min-width: 180px; padding: 7px 10px; border-radius: 8px; border: 1px solid var(--dsh-color-border, #d1d5db); background: var(--dsh-color-input, #f9fafb); color: inherit; font-size: 13px; }
.memory-core-chips { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
.memory-core-chip { border: 1px solid var(--dsh-color-border, #d1d5db); background: transparent; color: inherit; border-radius: 999px; padding: 4px 12px; font-size: 12px; cursor: pointer; opacity: 0.7; }
.memory-core-chip.active { opacity: 1; font-weight: 600; border-color: currentColor; }
.memory-core-btn { border: 1px solid var(--dsh-color-border, #d1d5db); background: transparent; color: inherit; border-radius: 8px; padding: 6px 12px; font-size: 12px; cursor: pointer; }
.memory-core-btn:hover { opacity: 0.85; }
.memory-core-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px; }
.memory-core-card { cursor: pointer; transition: border-color 0.15s; display: flex; flex-direction: column; gap: 6px; min-height: 110px; }
.memory-core-card:hover { border-color: var(--dsh-color-accent, #6366f1); }
.memory-core-card h4 { margin: 0; font-size: 14px; line-height: 1.35; }
.memory-core-card p { margin: 0; font-size: 12px; opacity: 0.7; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.memory-core-card footer { margin-top: auto; display: flex; justify-content: space-between; align-items: center; font-size: 11px; opacity: 0.55; }
.memory-core-tags { display: flex; gap: 4px; flex-wrap: wrap; }
.memory-core-tag { font-size: 10px; padding: 1px 7px; border-radius: 999px; background: var(--dsh-color-border, #e5e7eb); opacity: 0.85; }
.memory-core-kind { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 6px; }
.memory-core-empty { text-align: center; padding: 40px 10px; opacity: 0.6; font-size: 13px; }
.memory-core-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 999; display: flex; align-items: center; justify-content: center; padding: 24px; }
.memory-core-dialog { background: var(--dsh-color-surface, #fff); color: var(--dsh-color-text, #111); border-radius: 14px; max-width: 720px; width: 100%; max-height: 84vh; display: flex; flex-direction: column; box-shadow: 0 24px 60px rgba(0,0,0,0.3); }
.memory-core-dialog-head { display: flex; justify-content: space-between; align-items: center; padding: 12px 18px; border-bottom: 1px solid var(--dsh-color-border, #e5e7eb); }
.memory-core-dialog-head h3 { margin: 0; font-size: 15px; }
.memory-core-dialog-body { padding: 14px 18px; overflow: auto; font-size: 13px; line-height: 1.7; white-space: pre-wrap; word-break: break-word; }
.memory-core-graph-wrap { width: 100%; height: 420px; position: relative; }
.memory-core-graph-wrap svg { width: 100%; height: 100%; }
.memory-core-graph-line { stroke: var(--dsh-color-border, #d1d5db); stroke-width: 1; opacity: 0.6; }
.memory-core-graph-node { cursor: pointer; }
.memory-core-graph-node:hover circle { stroke: var(--dsh-color-accent, #6366f1); stroke-width: 2; }
.memory-core-graph-label { font-size: 11px; fill: var(--dsh-color-text, #333); pointer-events: none; }
.memory-core-graph-legend { display: flex; gap: 10px; flex-wrap: wrap; padding: 8px 2px 0; font-size: 11px; opacity: 0.8; }
.memory-core-flag { font-size: 11px; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--dsh-color-border, #d1d5db); margin-left: 6px; }
`

export function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh: ZH, en: EN }), 'memory-core: locale')
  const t = ctx.locale.bind(NS)

  ctx.effect(() => ctx.slots.inject('settings.section', () => ctx.slots.register(
    { name: 'settings.section', id: NS, order: 25, label: () => t('nav'), locale: NS, inject: () => ({}) },
    () => React.createElement(MemoryPage, { t, scope: ctx.settingsScope.bind({ namespace: NS }) }),
  )), 'memory-core: settings section')
}

// -- Page -------------------------------------------------------------------

function MemoryPage({ t }) {
  const [overview, setOverview] = useState(null)
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [kind, setKind] = useState('all')
  const [query, setQuery] = useState('')
  const [reader, setReader] = useState(null) // { path, title, text }
  const [graphOpen, setGraphOpen] = useState(false)
  const searchTimer = useRef(null)

  const loadCards = useCallback(async (nextKind = kind, nextQuery = query) => {
    try {
      setLoading(true)
      setError('')
      const qs = new URLSearchParams()
      if (nextKind && nextKind !== 'all') qs.set('kind', nextKind)
      if (nextQuery.trim()) qs.set('q', nextQuery.trim())
      const res = await fetch(`${API}/cards?${qs.toString()}`)
      const data = await res.json()
      if (data.ok) setCards(data.cards || [])
    } catch (e) {
      setError(String(e && e.message ? e.message : e))
    } finally {
      setLoading(false)
    }
  }, [kind, query])

  const loadAll = useCallback(async () => {
    try {
      const [ov, cardsRes] = await Promise.all([
        fetch(`${API}/overview`).then((r) => r.json()),
        fetch(`${API}/cards`).then((r) => r.json()),
      ])
      if (ov.ok) setOverview(ov)
      if (cardsRes.ok) setCards(cardsRes.cards || [])
    } catch (e) {
      setError(String(e && e.message ? e.message : e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAll()
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [loadAll])

  const onSearch = (value) => {
    setQuery(value)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => loadCards(kind, value), 280)
  }

  const onKind = (k) => {
    setKind(k)
    loadCards(k, query)
  }

  const openCard = async (card) => {
    try {
      const res = await fetch(`${API}/card?path=${encodeURIComponent(card.path)}`)
      const data = await res.json()
      if (data.ok) setReader({ path: card.path, title: card.title, text: data.text })
    } catch (e) {
      setError(String(e && e.message ? e.message : e))
    }
  }

  const kindLabel = (k) => t(kindKey(k))

  return React.createElement('div', { className: 'memory-core-root mc-card' },
    React.createElement('style', { key: 'mc-css' }, CSS),
    // 概览
    React.createElement('div', { className: 'memory-core-stats' },
      statCell(t('total'), overview ? overview.total : '—'),
      statCell(t('recent'), overview ? overview.recent : '—'),
      statCell(t('tags'), overview ? overview.tags : '—'),
      statCell(t('cardCount'), overview ? overview.byKind?.knowledge ?? 0 : '—'),
    ),
    // 工具栏
    React.createElement('div', { className: 'memory-core-toolbar' },
      React.createElement('input', {
        type: 'text',
        placeholder: t('searchPlaceholder'),
        value: query,
        onChange: (e) => onSearch(e.target.value),
      }),
      React.createElement('button', { className: 'memory-core-btn', onClick: () => loadAll() }, t('refresh')),
      React.createElement('button', { className: 'memory-core-btn', onClick: () => setGraphOpen(true) }, t('graph')),
    ),
    // 筛选
    React.createElement('div', { className: 'memory-core-chips' },
      KIND_IDS.map((k) => React.createElement('button', {
        key: k,
        className: `memory-core-chip${kind === k ? ' active' : ''}`,
        onClick: () => onKind(k),
      }, k === 'all' ? t('all') : t(kindKey(k)))),
    ),
    error && React.createElement('div', { className: 'memory-core-empty' }, `${t('error')}：${error}`),
    loading && !cards.length
      ? React.createElement('div', { className: 'memory-core-empty' }, t('loading'))
      : cards.length === 0
        ? React.createElement('div', { className: 'memory-core-empty' }, t('empty'))
        : React.createElement('div', { className: 'memory-core-grid' },
            cards.map((card) => cardRow(card, t, openCard)),
          ),
    reader && React.createElement(CardReader, { t, card: reader, onClose: () => setReader(null) }),
    graphOpen && React.createElement(GraphDialog, { t, onClose: () => setGraphOpen(false), onOpen: openCard }),
  )
}

const statCell = (label, value) => React.createElement('div', { className: 'memory-core-stat mc-card' },
  React.createElement('b', null, value),
  React.createElement('span', null, label),
)

const cardRow = (card, t, onOpen) => React.createElement('article', {
  key: card.path,
  className: 'memory-core-card mc-card',
  onClick: () => onOpen(card),
},
  React.createElement('h4', null,
    React.createElement('span', { className: 'memory-core-kind', style: { background: KIND_COLORS[card.kind] || KIND_COLORS.other } }),
    card.title,
  ),
  React.createElement('p', null, card.summary || ''),
  card.tags.length > 0 && React.createElement('div', { className: 'memory-core-tags' },
    card.tags.slice(0, 4).map((tag) => React.createElement('span', { key: tag, className: 'memory-core-tag' }, tag)),
  ),
  React.createElement('footer', null,
    React.createElement('span', null, t(kindKey(card.kind))),
    React.createElement('span', null, fmtDate(card.updated)),
  ),
)

function CardReader({ t, card, onClose }) {
  return React.createElement('div', { className: 'memory-core-overlay', onClick: onClose },
    React.createElement('div', { className: 'memory-core-dialog', onClick: (e) => e.stopPropagation() },
      React.createElement('div', { className: 'memory-core-dialog-head' },
        React.createElement('h3', null, card.title),
        React.createElement('button', { className: 'memory-core-btn', onClick: onClose }, t('close')),
      ),
      React.createElement('div', { className: 'memory-core-dialog-body' }, card.text),
    ),
  )
}

function GraphDialog({ t, onClose, onOpen }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    fetch(`${API}/graph`)
      .then((r) => r.json())
      .then((d) => { if (alive) setData(d.ok ? d : null) })
      .catch((e) => { if (alive) setError(String(e && e.message ? e.message : e)) })
    return () => { alive = false }
  }, [])

  return React.createElement('div', { className: 'memory-core-overlay', onClick: onClose },
    React.createElement('div', { className: 'memory-core-dialog', onClick: (e) => e.stopPropagation() },
      React.createElement('div', { className: 'memory-core-dialog-head' },
        React.createElement('h3', null, `${t('graph')}（${data ? data.nodes.length : 0} ${t('nodes')} · ${data ? countEdges(data.edges) : 0} ${t('edges')}）`),
        React.createElement('button', { className: 'memory-core-btn', onClick: onClose }, t('close')),
      ),
      React.createElement('div', { className: 'memory-core-dialog-body' },
        error && React.createElement('div', { className: 'memory-core-empty' }, `${t('error')}：${error}`),
        !data && !error && React.createElement('div', { className: 'memory-core-empty' }, t('loading')),
        data && data.nodes.length === 0 && React.createElement('div', { className: 'memory-core-empty' }, t('empty')),
        data && data.nodes.length > 0 && React.createElement(GraphCanvas, { nodes: data.nodes, edges: data.edges, onOpen, t }),
      ),
    ),
  )
}

function countEdges(edges) {
  const seen = new Set()
  for (const e of edges || []) seen.add([e.source, e.target].sort().join('|'))
  return seen.size
}

function GraphCanvas({ nodes, edges, onOpen, t }) {
  const width = 660
  const height = 380
  const cx = width / 2
  const cy = height / 2
  const radius = Math.min(width, height) / 2 - 46

  // 圆形布局：按 kind 分组扇区
  const byKind = {}
  nodes.forEach((n, i) => { (byKind[n.kind] = byKind[n.kind] || []).push(i) })
  const kinds = Object.keys(byKind)
  const pos = new Array(nodes.length)
  let angle = -Math.PI / 2
  for (const kind of kinds) {
    const group = byKind[kind]
    const span = (group.length / nodes.length) * Math.PI * 2
    const start = angle
    group.forEach((idx, i) => {
      const a = group.length === 1 ? start + span / 2 : start + (span * (i + 0.5)) / group.length
      pos[idx] = { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) }
    })
    angle += span
  }

  const edgeKey = new Set()
  const shownEdges = (edges || []).filter((e) => {
    const key = [e.source, e.target].sort().join('|')
    if (edgeKey.has(key)) return false
    edgeKey.add(key)
    return true
  })

  return React.createElement('div', null,
    React.createElement('div', { className: 'memory-core-graph-wrap' },
      React.createElement('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img' },
        shownEdges.map((e, i) => React.createElement('line', {
          key: `e${i}`,
          className: 'memory-core-graph-line',
          x1: pos[nodes.findIndex((n) => n.id === e.source)]?.x,
          y1: pos[nodes.findIndex((n) => n.id === e.source)]?.y,
          x2: pos[nodes.findIndex((n) => n.id === e.target)]?.x,
          y2: pos[nodes.findIndex((n) => n.id === e.target)]?.y,
        })),
        nodes.map((node, i) => {
          const p = pos[i]
          if (!p) return null
          return React.createElement('g', {
            key: node.id,
            className: 'memory-core-graph-node',
            transform: `translate(${p.x} ${p.y})`,
            onClick: () => onOpen({ path: node.id, title: node.title }),
          },
            React.createElement('circle', {
              r: node.kind === 'project' ? 9 : 7,
              fill: KIND_COLORS[node.kind] || KIND_COLORS.other,
            }),
            React.createElement('text', {
              className: 'memory-core-graph-label',
              x: 12,
              y: 3,
            }, String(node.title || '').slice(0, 14)),
          )
        }),
      ),
    ),
    React.createElement('div', { className: 'memory-core-graph-legend' },
      Object.keys(KIND_COLORS).map((k) => React.createElement('span', { key: k },
        React.createElement('span', { className: 'memory-core-kind', style: { background: KIND_COLORS[k] } }),
        t(kindKey(k)),
      )),
      React.createElement('span', { style: { opacity: 0.6, marginLeft: 6 } }, t('graphHint')),
    ),
  )
}

const kindKey = (k) => ({ project: 'kindProject', knowledge: 'kindKnowledge', content: 'kindContent', prompt: 'kindPrompt', business: 'kindBusiness', other: 'kindKnowledge' }[k] || 'kindKnowledge')

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const pad = (n) => String(n).padStart(2, '0')
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  return sameDay ? hm : `${d.getMonth() + 1}-${d.getDate()} ${hm}`
}
