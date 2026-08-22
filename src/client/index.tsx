// 记忆核心（client 侧）：设置 → 记忆 图形化知识库页面 + 侧边栏「记忆」按钮。
//
// 提供：
// - 侧边栏底部 footer 新增「记忆」按钮（sidebar.footer.action），一键打开完整记忆库弹窗；
// - 完整记忆库弹窗：统计概览 + 检索 + 分类筛选 + 知识卡网格 + 知识图谱（比设置页内嵌更开阔）；
// - 增强版知识图谱（力导向布局 / 渐变发光节点 / 曲线渐变连线 / 节点按度数放大 / 悬停高亮 / 入场动画）；
// - 设置 → 记忆 内嵌页面（复用同一套 MemoryLibrary）。
//
// 数据全部来自 host 的 /memory-eternal/api/* JSON 路由（同源 fetch），不引入额外依赖。

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const NS = 'memory-eternal'
const API = '/memory-eternal/api'

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
  kindTool: '工具',
  kindMistake: '教训',
  cardsTab: '知识卡',
  graphTab: '知识图谱',
  graph: '知识图谱',
  graphHint: '节点=知识卡；连线=[[链接]] 或共享标签。点击节点阅读卡片。',
  graphTip: '左键凸显关联节点 · 右键打开卡片 · 滚轮缩放 · 按住左键拖动画布',
  capped: '已展示最核心的',
  clearFocus: '取消高亮',
  empty: '记忆库还是空的。多聊几轮后，值得保存的内容会自动沉淀成知识卡。',
  emptyGraph: '图谱暂无数据。',
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
  memoryTitle: '记忆库',
  memoryHint: '你的本地第二大脑',
  zoomIn: '放大',
  zoomOut: '缩小',
  fit: '适应',
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
  kindTool: 'Tools',
  kindMistake: 'Mistakes',
  cardsTab: 'Cards',
  graphTab: 'Graph',
  graph: 'Knowledge Graph',
  graphHint: 'Nodes = cards; edges = [[links]] or shared tags. Click a node to read.',
  graphTip: 'Left-click focuses neighbors · right-click opens card · scroll to zoom · hold left to pan',
  capped: 'Showing the',
  clearFocus: 'Clear highlight',
  empty: 'Memory is empty. After a few conversations, valuable content is auto-captured.',
  emptyGraph: 'No graph data yet.',
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
  memoryTitle: 'Memory Library',
  memoryHint: 'Your local second brain',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  fit: 'Fit',
}

const KIND_IDS = ['all', 'project', 'knowledge', 'content', 'prompt', 'business', 'tool', 'mistake']
const KIND_COLORS = { project: '#3b82f6', knowledge: '#22c55e', content: '#f43f5e', prompt: '#06b6d4', business: '#eab308', tool: '#f97316', mistake: '#a855f7', other: '#64748b' }
const KIND_LABELS = { project: 'kindProject', knowledge: 'kindKnowledge', content: 'kindContent', prompt: 'kindPrompt', business: 'kindBusiness', tool: 'kindTool', mistake: 'kindMistake', other: 'kindKnowledge' }

const CSS = `
.memory-eternal-root { font-family: inherit; color: var(--dsw-alias-label-primary, #1f2937); }
.mc-card { background: var(--dsw-alias-bg-layer-1, #fff); border: 1px solid var(--dsw-alias-border-l1, #e5e7eb); border-radius: 12px; padding: 14px 16px; }
.mc-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 10px; margin-bottom: 14px; }
.mc-stat { text-align: center; }
.mc-stat b { display: block; font-size: 22px; line-height: 1.2; }
.mc-stat span { font-size: 12px; opacity: 0.65; }
.mc-toolbar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 12px; }
.mc-toolbar input[type=text] { flex: 1; min-width: 180px; padding: 7px 10px; border-radius: 8px; border: 1px solid var(--dsw-alias-border-l2, #d1d5db); background: var(--dsw-alias-bg-base, #f9fafb); color: inherit; font-size: 13px; }
.mc-btn { border: 1px solid var(--dsw-alias-border-l2, #d1d5db); background: transparent; color: inherit; border-radius: 8px; padding: 6px 12px; font-size: 12px; cursor: pointer; }
.mc-btn:hover { opacity: 0.85; }
.mc-tabs { display: inline-flex; gap: 4px; padding: 3px; background: var(--dsw-alias-bg-base, #f3f4f6); border-radius: 999px; }
.mc-tab { border: 0; background: transparent; color: inherit; border-radius: 999px; padding: 5px 14px; font-size: 12px; cursor: pointer; opacity: 0.7; }
.mc-tab.active { background: var(--dsw-alias-bg-layer-1, #fff); opacity: 1; font-weight: 600; box-shadow: 0 1px 4px rgba(0,0,0,0.12); }
.mc-chips { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
.mc-chip { border: 1px solid var(--dsw-alias-border-l2, #d1d5db); background: transparent; color: inherit; border-radius: 999px; padding: 4px 12px; font-size: 12px; cursor: pointer; opacity: 0.7; }
.mc-chip.active { opacity: 1; font-weight: 600; border-color: currentColor; }
.mc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px; }
.mc-cardrow { cursor: pointer; transition: border-color 0.15s, transform 0.15s; display: flex; flex-direction: column; gap: 6px; min-height: 110px; }
.mc-cardrow:hover { border-color: var(--dsw-alias-brand-primary, #6366f1); transform: translateY(-1px); box-shadow: 0 8px 22px rgba(0,0,0,0.08); }
.mc-cardrow h4 { margin: 0; font-size: 14px; line-height: 1.35; }
.mc-cardrow p { margin: 0; font-size: 12px; opacity: 0.7; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.mc-cardrow footer { margin-top: auto; display: flex; justify-content: space-between; align-items: center; font-size: 11px; opacity: 0.55; }
.mc-tags { display: flex; gap: 4px; flex-wrap: wrap; }
.mc-tag { font-size: 10px; padding: 1px 7px; border-radius: 999px; background: var(--dsw-alias-border-l1, #e5e7eb); opacity: 0.85; }
.mc-kind { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 6px; }
.mc-empty { text-align: center; padding: 40px 10px; opacity: 0.6; font-size: 13px; }
.mc-flag { font-size: 11px; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--dsw-alias-border-l2, #d1d5db); margin-left: 6px; }

/* ---- sidebar footer button ---- */
.me-footer { width: 100%; }
.me-footer-btn { display: flex; align-items: center; gap: 9px; width: 100%; padding: 7px 10px; border: none; background: transparent; color: var(--dsw-alias-label-secondary, #6b7280); font: inherit; font-size: 13.5px; line-height: 18px; border-radius: 8px; cursor: pointer; text-align: left; }
.me-footer-btn:hover { background: var(--dsw-alias-bg-layer-1, rgba(255,255,255,0.06)); color: var(--dsw-alias-label-primary, #111); }
.me-footer-btn:active { transform: translateY(0.5px); }
.me-footer-ico { display: inline-flex; flex: none; width: 18px; height: 18px; align-items: center; justify-content: center; }
.me-footer-ico svg { width: 18px; height: 18px; }
.me-footer-label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.me-footer.rail .me-footer-btn { justify-content: center; padding: 7px 0; }
.me-footer.rail .me-footer-label { display: none; }

/* ---- full library modal ---- */
.me-overlay-top { position: fixed; inset: 0; z-index: 1001; background: rgba(0,0,0,0.55); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; padding: 28px; }
.me-modal { width: min(1120px, 96vw); height: min(88vh, 940px); display: flex; flex-direction: column; background: var(--dsw-alias-bg-overlay, #fff); color: var(--dsw-alias-label-primary, #111); border: 1px solid var(--dsw-alias-border-l1, #e5e7eb); border-radius: 18px; box-shadow: 0 34px 90px rgba(0,0,0,0.5); overflow: hidden; animation: me-pop 0.22s cubic-bezier(0.2,0.8,0.2,1); }
@keyframes me-pop { from { opacity: 0; transform: translateY(12px) scale(0.985); } }
.me-modal-head { display: flex; align-items: center; gap: 12px; padding: 16px 20px; border-bottom: 1px solid var(--dsw-alias-border-l1, #e5e7eb); }
.me-modal-title { display: flex; align-items: baseline; gap: 10px; min-width: 0; }
.me-modal-title h2 { margin: 0; font-size: 17px; font-weight: 700; }
.me-modal-title span { font-size: 12px; opacity: 0.55; }
.me-modal-head .spacer { flex: 1; }
.me-modal-close { border: 1px solid var(--dsw-alias-border-l2, #d1d5db); background: transparent; color: inherit; border-radius: 8px; width: 30px; height: 30px; line-height: 1; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.me-modal-close:hover { background: var(--dsw-alias-bg-layer-1, #f3f4f6); }
.me-modal-body { flex: 1; padding: 18px 20px; overflow: auto; }
.me-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 1002; display: flex; align-items: center; justify-content: center; padding: 24px; }
.me-dialog { background: var(--dsw-alias-bg-overlay, #fff); color: var(--dsw-alias-label-primary, #111); border-radius: 14px; max-width: 760px; width: 100%; max-height: 84vh; display: flex; flex-direction: column; box-shadow: 0 24px 60px rgba(0,0,0,0.3); }
.me-dialog-head { display: flex; justify-content: space-between; align-items: center; padding: 12px 18px; border-bottom: 1px solid var(--dsw-alias-border-l1, #e5e7eb); }
.me-dialog-head h3 { margin: 0; font-size: 15px; }
.me-dialog-body { padding: 14px 18px; overflow: auto; font-size: 13px; line-height: 1.7; white-space: pre-wrap; word-break: break-word; }

/* ---- enhanced graph ---- */
.me-graph { display: flex; flex-direction: column; gap: 8px; height: 100%; min-height: 320px; }
.me-graph-toolbar { display: flex; align-items: center; gap: 8px; }
.me-graph-count { font-size: 12px; opacity: 0.7; }
.me-graph-canvas { position: relative; flex: 1; min-height: 300px; border-radius: 14px; overflow: hidden; background: radial-gradient(120% 120% at 50% 40%, var(--dsw-alias-bg-layer-2, #f8fafc) 0%, var(--dsw-alias-bg-base, #eef2f7) 100%); border: 1px solid var(--dsw-alias-border-l1, #e5e7eb); cursor: grab; touch-action: none; user-select: none; }
.me-graph-canvas.dragging { cursor: grabbing; }
.me-graph-tip { font-size: 11px; opacity: 0.6; }
.me-graph-canvas svg { width: 100%; height: 100%; display: block; }
.me-graph-edge { fill: none; stroke: var(--dsw-alias-border-l2, #cbd5e1); stroke-width: 1.6; opacity: 0.75; stroke-dasharray: 4 5; animation: me-dash 1.6s linear infinite; }
@keyframes me-dash { to { stroke-dashoffset: -16; } }
.me-graph-node { cursor: pointer; }
.me-graph-node circle.inner { transition: r 0.18s; }
.me-graph-node:hover circle.inner { stroke: var(--dsw-alias-brand-primary, #6366f1); stroke-width: 2.5; }
.me-graph-node text { font-size: 11px; fill: var(--dsw-alias-label-primary, #334); pointer-events: none; }
.me-labels text { font-size: 11px; fill: var(--dsw-alias-label-primary, #334); pointer-events: none; transition: opacity .12s; }
.me-labels text.minor { opacity: 0; }
.me-labels.all text { opacity: 0.9; }
.me-labels text.dim { opacity: 0.06; }
.me-graph-node.dim { opacity: 0.16; transition: opacity .18s; }
.me-graph-node.focus circle.inner { stroke: #fff; stroke-width: 3; }
.me-graph-edge.dim { opacity: 0.06; }
.me-graph-edge.focus { opacity: 1; }
.me-graph-node.in { animation: me-node-in 0.5s cubic-bezier(0.2,0.8,0.2,1) backwards; }
@keyframes me-node-in { from { opacity: 0; transform: scale(0.4); } }
.me-graph-legend { display: flex; gap: 12px; flex-wrap: wrap; padding: 2px 2px 0; font-size: 11px; opacity: 0.85; }
.me-graph-legend .lg { display: inline-flex; align-items: center; gap: 5px; }
.me-graph-hint { font-size: 11px; opacity: 0.6; margin-left: auto; }
`

export function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh: ZH, en: EN }), 'memory-eternal: locale')
  const t = ctx.locale.bind(NS)

  // 设置 → 记忆（内嵌页面，复用 MemoryLibrary）
  ctx.effect(() => ctx.slots.inject('settings.section', () => ctx.slots.register(
    { name: 'settings.section', id: NS, order: 25, label: () => t('nav'), locale: NS, inject: () => ({}) },
    () => React.createElement(MemoryLibrary, { t, inModal: false }),
  )), 'memory-eternal: settings section')

  // 侧边栏底部 footer：新增「记忆」按钮 → 完整记忆库弹窗
  ctx.effect(() => ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register(
    { name: 'sidebar.footer.action', id: `${NS}:footer`, order: 100, label: () => t('nav'), locale: NS, inject: () => ({}) },
    (props) => React.createElement(MemoryFooterButton, { t, wide: !(props && props.wide === false) }),
  )), 'memory-eternal: sidebar footer action')
}

// -- Sidebar footer button ---------------------------------------------------

function MemoryFooterButton({ t, wide }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`me-footer${wide ? '' : ' rail'}`}>
      <style>{CSS}</style>
      <button type="button" className="me-footer-btn" onClick={() => setOpen(true)} aria-label={t('nav')} title={t('nav')}>
        <span className="me-footer-ico" aria-hidden="true"><DatabaseIcon /></span>
        <span className="me-footer-label">{t('nav')}</span>
      </button>
      {open && <MemoryLibraryModal t={t} onClose={() => setOpen(false)} />}
    </div>
  )
}

function DatabaseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <ellipse cx="12" cy="5.5" rx="8" ry="3" />
      <path d="M4 5.5v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />
      <path d="M4 11.5v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />
    </svg>
  )
}

// -- Full memory library modal ----------------------------------------------

function MemoryLibraryModal({ t, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="me-overlay-top" onClick={onClose}>
      <style>{CSS}</style>
      <div className="me-modal" onClick={(e) => e.stopPropagation()}>
        <MemoryLibrary t={t} inModal onClose={onClose} />
      </div>
    </div>
  )
}

// -- Shared library content (inline settings page + modal) ------------------

function MemoryLibrary({ t, inModal, onClose }) {
  const [overview, setOverview] = useState(null)
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [kind, setKind] = useState('all')
  const [query, setQuery] = useState('')
  const [view, setView] = useState('cards') // 'cards' | 'graph'
  const [reader, setReader] = useState(null)
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
      const res = await fetch(`${API}/card?path=${encodeURIComponent(card.path || card.id)}`)
      const data = await res.json()
      if (data.ok) setReader({ path: data.path, title: card.title, text: data.text })
    } catch (e) {
      setError(String(e && e.message ? e.message : e))
    }
  }

  return (
    <div className="memory-eternal-root" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <style>{CSS}</style>
      {inModal && (
        <div className="me-modal-head">
          <div className="me-modal-title">
            <DatabaseIcon />
            <h2>{t('memoryTitle')}</h2>
            <span>{t('memoryHint')}</span>
          </div>
          <div className="spacer" />
          <button type="button" className="me-modal-close" onClick={onClose} aria-label={t('close')}>✕</button>
        </div>
      )}
      <div className="me-modal-body">
        <div className="mc-stats">
          <StatCell label={t('total')} value={overview ? overview.total : '—'} />
          <StatCell label={t('recent')} value={overview ? overview.recent : '—'} />
          <StatCell label={t('tags')} value={overview ? overview.tags : '—'} />
          <StatCell label={t('cardCount')} value={overview ? overview.byKind?.knowledge ?? 0 : '—'} />
        </div>

        <div className="mc-toolbar">
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={query}
            onChange={(e) => onSearch(e.target.value)}
          />
          <div className="mc-tabs">
            <button type="button" className={`mc-tab${view === 'cards' ? ' active' : ''}`} onClick={() => setView('cards')}>{t('cardsTab')}</button>
            <button type="button" className={`mc-tab${view === 'graph' ? ' active' : ''}`} onClick={() => setView('graph')}>{t('graphTab')}</button>
          </div>
          <button type="button" className="mc-btn" onClick={() => loadAll()}>{t('refresh')}</button>
        </div>

        {view === 'cards' && (
          <div className="mc-chips">
            {KIND_IDS.map((k) => (
              <button key={k} type="button" className={`mc-chip${kind === k ? ' active' : ''}`} onClick={() => onKind(k)}>
                {k === 'all' ? t('all') : t(KIND_LABELS[k])}
              </button>
            ))}
          </div>
        )}

        {error && <div className="mc-empty">{t('error')}：{error}</div>}

        {view === 'cards' ? (
          loading && !cards.length
            ? <div className="mc-empty">{t('loading')}</div>
            : cards.length === 0
              ? <div className="mc-empty">{t('empty')}</div>
              : <div className="mc-grid">{cards.map((card) => <CardRow key={card.path} card={card} t={t} onOpen={openCard} />)}</div>
        ) : (
          <GraphView t={t} onOpen={openCard} />
        )}

        {reader && <CardReader t={t} card={reader} onClose={() => setReader(null)} />}
      </div>
    </div>
  )
}

const StatCell = ({ label, value }) => (
  <div className="mc-stat mc-card">
    <b>{value}</b>
    <span>{label}</span>
  </div>
)

const CardRow = ({ card, t, onOpen }) => (
  <article className="mc-cardrow mc-card" onClick={() => onOpen(card)}>
    <h4>
      <span className="mc-kind" style={{ background: KIND_COLORS[card.kind] || KIND_COLORS.other }} />
      {card.title}
    </h4>
    <p>{card.summary || ''}</p>
    {card.tags.length > 0 && (
      <div className="mc-tags">
        {card.tags.slice(0, 4).map((tag) => <span key={tag} className="mc-tag">{tag}</span>)}
      </div>
    )}
    <footer>
      <span>{t(KIND_LABELS[card.kind])}</span>
      <span>{fmtDate(card.updated)}</span>
    </footer>
  </article>
)

function CardReader({ t, card, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="me-overlay" onClick={onClose}>
      <style>{CSS}</style>
      <div className="me-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="me-dialog-head">
          <h3>{card.title}</h3>
          <button type="button" className="mc-btn" onClick={onClose}>{t('close')}</button>
        </div>
        <div className="me-dialog-body">{card.text}</div>
      </div>
    </div>
  )
}

// -- Enhanced knowledge graph ------------------------------------------------

function GraphView({ t, onOpen }) {
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

  return (
    <div className="me-graph">
      <style>{CSS}</style>
      {error && <div className="mc-empty">{t('error')}：{error}</div>}
      {!data && !error && <div className="mc-empty">{t('loading')}</div>}
      {data && data.nodes.length === 0 && <div className="mc-empty">{t('emptyGraph')}</div>}
      {data && data.nodes.length > 0 && (
        <GraphCanvas
          nodes={data.nodes}
          edges={data.edges}
          onOpen={onOpen}
          t={t}
          countLabel={`${data.nodes.length} ${t('nodes')} · ${countEdges(data.edges)} ${t('edges')}`}
        />
      )}
    </div>
  )
}

function countEdges(edges) {
  const seen = new Set()
  for (const e of edges || []) seen.add([e.source, e.target].sort().join('|'))
  return seen.size
}

function GraphCanvas({ nodes, edges, onOpen, t, countLabel }) {
  const width = 980
  const height = 620
  const canvasRef = useRef(null)
  const svgRef = useRef(null)
  const innerRef = useRef(null)
  const labelsRef = useRef(null)
  const tf = useRef({ x: 0, y: 0, k: 1 })
  const dragRef = useRef(null)
  const movedRef = useRef(false)
  const [focus, setFocus] = useState(null)

  // -- 大图降噪：按连接数取核心节点/连线 + 去重（数量大抗压） ------------
  const view = useMemo(() => {
    const deg = {}
    edges.forEach((e) => { deg[e.source] = (deg[e.source] || 0) + 1; deg[e.target] = (deg[e.target] || 0) + 1 })
    const MAXN = 420
    const MAXE = 900
    let list = nodes
    let capped = false
    if (nodes.length > MAXN) {
      list = [...nodes].sort((a, b) => (deg[b.id] || 0) - (deg[a.id] || 0)).slice(0, MAXN)
      capped = true
    }
    const ids = new Set(list.map((n) => n.id))
    const seen = new Set()
    const es = []
    edges.forEach((e) => {
      if (!ids.has(e.source) || !ids.has(e.target)) return
      const key = [e.source, e.target].sort().join('|')
      if (seen.has(key)) return
      seen.add(key)
      es.push(e)
    })
    es.sort((a, b) => ((deg[a.source] || 0) + (deg[a.target] || 0)) - ((deg[b.source] || 0) + (deg[b.target] || 0)))
    const hubCount = Math.min(list.length, 28)
    const sortedDeg = list.map((nd) => deg[nd.id] || 0).sort((a, b) => b - a)
    const hubMin = hubCount > 0 ? sortedDeg[hubCount - 1] : Infinity
    return { list, es: es.slice(0, MAXE), capped, maxDeg: Math.max(1, ...Object.values(deg)), deg, hubMin }
  }, [nodes, edges])

  const layout = useMemo(() => computeLayout(view.list, view.es, width, height), [view.list, view.es, width, height])
  const idx = useMemo(() => view.list.reduce((m, n, i) => (m[n.id] = i, m), {}), [view.list])
  const adj = useMemo(() => {
    const m = {}
    view.list.forEach((n) => { m[n.id] = new Set() })
    view.es.forEach((e) => { if (m[e.source]) m[e.source].add(e.target); if (m[e.target]) m[e.target].add(e.source) })
    return m
  }, [view.list, view.es])

  // -- 平移/缩放：直接写 <g> 的 transform，避免整棵树 re-render ----------
  const applyTransform = useCallback(() => {
    const el = innerRef.current
    if (!el) return
    const { x, y, k } = tf.current
    el.setAttribute('transform', `translate(${x} ${y}) scale(${k})`)
    if (labelsRef.current) labelsRef.current.classList.toggle('all', k >= 1.4)
  }, [])
  useEffect(() => { applyTransform() }, [applyTransform, layout])

  const svgToUser = useCallback((cx, cy) => {
    const svg = svgRef.current
    if (!svg || typeof svg.getScreenCTM !== 'function') return { x: cx, y: cy }
    const ctm = svg.getScreenCTM()
    if (!ctm) return { x: cx, y: cy }
    const pt = new DOMPoint(cx, cy).matrixTransform(ctm.inverse())
    return { x: pt.x, y: pt.y }
  }, [])

  const zoomAt = useCallback((p, factor) => {
    const t = tf.current
    const k2 = Math.min(5, Math.max(0.25, t.k * factor))
    tf.current = { k: k2, x: p.x - (k2 / t.k) * (p.x - t.x), y: p.y - (k2 / t.k) * (p.y - t.y) }
    applyTransform()
  }, [applyTransform])

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const onWheel = (e) => {
      e.preventDefault()
      zoomAt(svgToUser(e.clientX, e.clientY), e.deltaY < 0 ? 1.12 : 1 / 1.12)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [svgToUser, zoomAt])

  const onPointerDown = (e) => {
    if (e.button !== 0) return
    const p = svgToUser(e.clientX, e.clientY)
    dragRef.current = { px: p.x, py: p.y, tx: tf.current.x, ty: tf.current.y, started: false, id: e.pointerId }
    movedRef.current = false
  }
  const onPointerMove = (e) => {
    const d = dragRef.current
    if (!d) return
    const p = svgToUser(e.clientX, e.clientY)
    if (Math.abs(p.x - d.px) + Math.abs(p.y - d.py) > 1.5) {
      movedRef.current = true
      if (!d.started && canvasRef.current && canvasRef.current.setPointerCapture) {
        canvasRef.current.setPointerCapture(e.pointerId)
        d.started = true
      }
      if (canvasRef.current) canvasRef.current.classList.add('dragging')
      tf.current = { ...tf.current, x: d.tx + (p.x - d.px), y: d.ty + (p.y - d.py) }
      applyTransform()
    }
  }
  const onPointerUp = () => {
    dragRef.current = null
    if (canvasRef.current) canvasRef.current.classList.remove('dragging')
  }
  const openCardNode = (node) => { onOpen({ path: node.id, title: node.title }) }
  const focusNode = (node) => { if (!movedRef.current) setFocus(node.id) }

  const sizeOf = (node) => 7 + Math.min(9, ((view.deg[node.id] || 0) / view.maxDeg) * 9)

  return (
    <div className="me-graph">
      <div className="me-graph-toolbar">
        <span className="me-graph-count">{countLabel}</span>
        {focus && <button type="button" className="mc-btn" onClick={() => setFocus(null)}>{t('clearFocus')}</button>}
        <span className="spacer" style={{ flex: 1 }} />
        <button type="button" className="mc-btn" onClick={() => zoomAt({ x: width / 2, y: height / 2 }, 1 / 1.25)} aria-label={t('zoomOut')}>−</button>
        <button type="button" className="mc-btn" onClick={() => { tf.current = { x: 0, y: 0, k: 1 }; applyTransform() }} aria-label={t('fit')}>{t('fit')}</button>
        <button type="button" className="mc-btn" onClick={() => zoomAt({ x: width / 2, y: height / 2 }, 1.25)} aria-label={t('zoomIn')}>+</button>
      </div>
      <div
        className="me-graph-canvas"
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onContextMenu={(e) => { e.preventDefault(); setFocus(null) }}
        onClick={(e) => { if (!movedRef.current) setFocus(null) }}
      >
        <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} role="img">
          <defs>
            {Object.keys(KIND_COLORS).map((k) => (
              <radialGradient key={k} id={`me-grad-${k}`} cx="35%" cy="30%" r="75%">
                <stop offset="0%" stopColor={lighten(KIND_COLORS[k], 0.55)} />
                <stop offset="60%" stopColor={KIND_COLORS[k]} />
                <stop offset="100%" stopColor={darken(KIND_COLORS[k], 0.25)} />
              </radialGradient>
            ))}
            {Object.keys(KIND_COLORS).map((k) => (
              <linearGradient key={`e-${k}`} id={`me-edge-${k}`} gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor={KIND_COLORS[k]} stopOpacity="0.4" />
                <stop offset="100%" stopColor={KIND_COLORS[k]} stopOpacity="0.85" />
              </linearGradient>
            ))}
            <filter id="me-glow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="3.2" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <g ref={innerRef} transform="translate(0 0) scale(1)">
            {view.es.map((e, i) => {
              const si = idx[e.source]
              const ti = idx[e.target]
              if (si === undefined || ti === undefined) return null
              const a = layout[si]
              const b = layout[ti]
              if (!a || !b) return null
              const kind = view.list[si].kind || 'other'
              const edgeDim = focus && e.source !== focus && e.target !== focus
              const edgeFocused = focus && (e.source === focus || e.target === focus)
              return <path key={`e${i}`} d={edgePath(a, b)} className={`me-graph-edge${edgeDim ? ' dim' : ''}${edgeFocused ? ' focus' : ''}`} style={{ stroke: `url(#me-edge-${kind})`, animationDelay: `${(i % 8) * 0.12}s` }} />
            })}

            {view.list.map((node, i) => {
              const p = layout[i]
              if (!p) return null
              const kind = node.kind || 'other'
              const r = sizeOf(node)
              const dimmed = focus && node.id !== focus && !adj[node.id].has(focus)
              const focused = focus && (node.id === focus || adj[node.id].has(focus))
              return (
                <g
                  key={node.id}
                  className={`me-graph-node in${focused ? ' focus' : ''}${dimmed ? ' dim' : ''}`}
                  style={{ animationDelay: `${i * 0.02}s` }}
                  transform={`translate(${p.x} ${p.y})`}
                  onClick={(e) => { e.stopPropagation(); focusNode(node) }}
                  onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); openCardNode(node) }}
                >
                  <circle className="inner" r={r} fill={`url(#me-grad-${kind})`} stroke={KIND_COLORS[kind]} strokeOpacity="0.9" filter="url(#me-glow)" />
                  <circle r={Math.max(2.4, r * 0.2)} fill="rgba(255,255,255,0.85)" />
                </g>
              )
            })}

            <g ref={labelsRef} className="me-labels">
              {view.list.map((node, i) => {
                const p = layout[i]
                if (!p) return null
                const r = sizeOf(node)
                const hub = (view.deg[node.id] || 0) >= view.hubMin
                const dimmed = focus && node.id !== focus && !adj[node.id].has(focus)
                return <text key={`l${node.id}`} className={`${hub ? 'me-nodelabel' : 'me-nodelabel minor'}${dimmed ? ' dim' : ''}`} x={p.x + r + 7} y={p.y + 4}>{String(node.title || '').slice(0, 16)}</text>
              })}
            </g>
          </g>
        </svg>
        <div className="me-graph-legend">
          {Object.keys(KIND_COLORS).map((k) => (
            <span key={k} className="lg"><span className="mc-kind" style={{ background: KIND_COLORS[k] }} />{t(KIND_LABELS[k])}</span>
          ))}
          <span className="me-graph-hint">{t('graphHint')}</span>
        </div>
      </div>
      <div className="me-graph-tip">{view.capped ? `${t('capped')} ${view.list.length} / ${nodes.length} ${t('nodes')} · ` : ''}{t('graphTip')}</div>
    </div>
  )
}

// 布局：小规模用力导向（有机美观），大规模用按 kind 分区的径向布局（O(n)，可扛几千节点）。
function computeLayout(nodes, edges, width, height) {
  const n = nodes.length
  if (n === 0) return []
  if (n > 160) return radialLayout(nodes, width, height)
  const iters = n < 60 ? 260 : n < 120 ? 180 : 120
  const pos = nodes.map((_, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2
    return { x: Math.cos(a), y: Math.sin(a) }
  })
  const vel = pos.map(() => ({ x: 0, y: 0 }))
  const adj = nodes.map(() => [])
  edges.forEach((e) => {
    const si = nodes.findIndex((x) => x.id === e.source)
    const ti = nodes.findIndex((x) => x.id === e.target)
    if (si >= 0 && ti >= 0 && si !== ti) { adj[si].push(ti); adj[ti].push(si) }
  })
  const repulsion = 1.35, attraction = 0.035, center = 0.03, damping = 0.84
  for (let iter = 0; iter < iters; iter++) {
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      let dx = pos[i].x - pos[j].x, dy = pos[i].y - pos[j].y
      const d2 = dx * dx + dy * dy || 0.01
      const d = Math.sqrt(d2)
      const f = repulsion / d2
      const fx = (dx / d) * f, fy = (dy / d) * f
      vel[i].x += fx; vel[i].y += fy; vel[j].x -= fx; vel[j].y -= fy
    }
    for (let i = 0; i < n; i++) for (const j of adj[i]) {
      vel[i].x += (pos[j].x - pos[i].x) * attraction
      vel[i].y += (pos[j].y - pos[i].y) * attraction
    }
    for (let i = 0; i < n; i++) { vel[i].x -= pos[i].x * center; vel[i].y -= pos[i].y * center }
    for (let i = 0; i < n; i++) {
      vel[i].x = Math.max(-0.5, Math.min(0.5, vel[i].x * damping))
      vel[i].y = Math.max(-0.5, Math.min(0.5, vel[i].y * damping))
      pos[i].x += vel[i].x
      pos[i].y += vel[i].y
    }
  }
  let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity
  pos.forEach((p) => { minx = Math.min(minx, p.x); maxx = Math.max(maxx, p.x); miny = Math.min(miny, p.y); maxy = Math.max(maxy, p.y) })
  const pad = 70
  const scale = Math.min((width - 2 * pad) / (maxx - minx || 1), (height - 2 * pad) / (maxy - miny || 1))
  const cx = (minx + maxx) / 2, cy = (miny + maxy) / 2
  return pos.map((p) => ({ x: width / 2 + (p.x - cx) * scale, y: height / 2 + (p.y - cy) * scale }))
}

// 大规模径向布局：按 kind 横向分区、环形排布，O(n)，瞬时完成（数量大不卡顿）。
function radialLayout(nodes, width, height) {
  const n = nodes.length
  const cx = width / 2
  const cy = height / 2
  const radius = Math.min(width, height) / 2 - 80
  const byKind = {}
  nodes.forEach((nd, i) => { const k = nd.kind || 'other'; (byKind[k] = byKind[k] || []).push(i) })
  const kinds = Object.keys(byKind)
  const pos = new Array(n)
  let angle = -Math.PI / 2
  for (const kind of kinds) {
    const group = byKind[kind]
    const span = (group.length / n) * Math.PI * 2
    const start = angle
    group.forEach((idx, i) => {
      const a = group.length === 1 ? start + span / 2 : start + (span * (i + 0.5)) / group.length
      pos[idx] = { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) }
    })
    angle += span
  }
  return pos
}

// 曲线连线（二次贝塞尔），让点之间不那么生硬。
function edgePath(a, b) {
  const mx = (a.x + b.x) / 2
  const my = (a.y + b.y) / 2
  const dx = b.x - a.x, dy = b.y - a.y
  const dist = Math.sqrt(dx * dx + dy * dy) || 1
  const bend = Math.min(38, dist * 0.18)
  const cx = mx - (dy / dist) * bend
  const cy = my + (dx / dist) * bend
  return `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`
}

// 颜色工具
function hexToRgb(hex) {
  const h = hex.replace('#', '')
  const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)]
}
function lighten(hex, amt) {
  const [r, g, b] = hexToRgb(hex)
  return `rgb(${Math.round(r + (255 - r) * amt)}, ${Math.round(g + (255 - g) * amt)}, ${Math.round(b + (255 - b) * amt)})`
}
function darken(hex, amt) {
  const [r, g, b] = hexToRgb(hex)
  return `rgb(${Math.round(r * (1 - amt))}, ${Math.round(g * (1 - amt))}, ${Math.round(b * (1 - amt))})`
}

const kindKey = (k) => KIND_LABELS[k] || 'kindKnowledge'

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
