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
  graphTip: '左键凸显 · Shift+拖拽框选 · 右键菜单 · 滚轮缩放 · 拖拽平移',
  rebuild: '重建',
  reset: '重置',
  expandAll: '全部展开',
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
  exportGraph: '导出',
  openCard: '打开卡片',
  focusNeighbors: '凸显关联',
  copyName: '复制名称',
  noMatch: '没有匹配的记忆',
  clearFilter: '清除过滤',
  sortRecent: '最近',
  sortTitle: '标题',
  sortHot: '热点',
  exportSel: '导出选中',
  clearSelection: '清空选择',
  download: '下载',
  openNewTab: '新标签打开',
  copyImage: '复制图片',
  done: '完成',
  downloaded: '已开始下载',
  openedTab: '已在新标签打开',
  copied: '已复制',
  exportedSel: '个节点已导出',
  fullscreen: '全屏',
  exitFull: '退出全屏',
  copyFail: '复制失败',
  timeDim: '时间维',
  timeNew: '3 天内',
  timeRecent: '2 周内',
  timeMonth: '1 月内',
  timeOld: '更早',
  newBadge: '新',
  expand: '展开全部',
  collapse: '收起',
  exportVault: '导出MD',
  exportJson: '导出JSON',
  exporting: '导出中…',
  exportedVault: '记忆库已导出',
  exportFail: '导出失败',
  importVault: '导入',
  importedVault: '导入完成',
  importedSkipped: '（跳过重复 ',
  importFail: '导入失败',
  location: '自选位置',
  saveAs: '另存为',
  saveAsUnsupported: '当前环境不支持选择保存位置',
  exportedTo: '已导出到',
  defaultDownloads: '默认下载文件夹',
  exportCancel: '已取消导出',
  manage: '管理',
  tabUsage: '用量/今日',
  tabOptimize: '整理建议',
  todayAdd: '今日新增',
  weekAdd: '近 7 天',
  byKind: '分类统计',
  todayList: '今日沉淀',
  budgetLabel: '会话预算',
  budgetChars: '预算字符',
  recallLimitLabel: '召回条数',
  embeddingLabel: '语义召回',
  mergePairs: '相似卡对（可合并）',
  staleCards: '陈旧卡（>90 天未更新）',
  noOptimize: '暂无可整理项，很健康 🎉',
  mergeNow: '合并',
  delete: '删除',
  deleteConfirm: '确定删除该记忆卡？此操作不可撤销。',
  deleted: '已删除',
  deleteFail: '删除失败',
  deleteSelected: '删除选中',
  deletedSelected: '张卡已删除',
  merge: '合并',
  mergeNeed: '至少选 2 张卡',
  mergeConfirm: '将所选卡片合并为一张并删除原卡？',
  merged: '已合并',
  mergeFail: '合并失败',
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
  graphTip: 'Left-click highlights · Shift+drag box-select · right-click menu · scroll zoom · drag to pan',
  rebuild: 'Rebuild',
  reset: 'Reset',
  expandAll: 'Expand all',
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
  exportGraph: 'Export',
  openCard: 'Open card',
  focusNeighbors: 'Highlight links',
  copyName: 'Copy name',
  noMatch: 'No matching memory',
  clearFilter: 'Clear filter',
  sortRecent: 'Recent',
  sortTitle: 'Title',
  sortHot: 'Hot',
  exportSel: 'Export selected',
  clearSelection: 'Clear selection',
  download: 'Download',
  openNewTab: 'Open in new tab',
  copyImage: 'Copy image',
  done: 'Done',
  downloaded: 'Download started',
  openedTab: 'Opened in new tab',
  copied: 'Copied',
  exportedSel: ' nodes exported',
  fullscreen: 'Fullscreen',
  exitFull: 'Exit fullscreen',
  copyFail: 'Copy failed',
  timeDim: 'Time',
  timeNew: '≤3 days',
  timeRecent: '≤2 weeks',
  timeMonth: '≤1 month',
  timeOld: 'Older',
  newBadge: 'NEW',
  expand: 'Expand',
  collapse: 'Collapse',
  exportVault: 'Export MD',
  exportJson: 'Export JSON',
  exporting: 'Exporting…',
  exportedVault: 'Vault exported',
  exportFail: 'Export failed',
  importVault: 'Import',
  importedVault: 'Import complete',
  importedSkipped: ' (skipped dup ',
  importFail: 'Import failed',
  location: 'Choose location',
  saveAs: 'Save as',
  saveAsUnsupported: 'Choose-save-location not supported here',
  exportedTo: 'Exported to',
  defaultDownloads: 'default Downloads folder',
  exportCancel: 'Export cancelled',
  manage: 'Manage',
  tabUsage: 'Usage / Today',
  tabOptimize: 'Optimize',
  todayAdd: 'Added today',
  weekAdd: 'Last 7d',
  byKind: 'By kind',
  todayList: 'Captured today',
  budgetLabel: 'Session budget',
  budgetChars: 'Budget chars',
  recallLimitLabel: 'Recall limit',
  embeddingLabel: 'Semantic recall',
  mergePairs: 'Similar pairs (mergeable)',
  staleCards: 'Stale (>90d)',
  noOptimize: 'Nothing to organize, healthy 🎉',
  mergeNow: 'Merge',
  delete: 'Delete',
  deleteConfirm: 'Delete this memory card? This cannot be undone.',
  deleted: 'Deleted',
  deleteFail: 'Delete failed',
  deleteSelected: 'Delete selected',
  deletedSelected: ' cards deleted',
  merge: 'Merge',
  mergeNeed: 'Select at least 2 cards',
  mergeConfirm: 'Merge the selected cards into one and delete the originals?',
  merged: 'Merged',
  mergeFail: 'Merge failed',
}

const KIND_IDS = ['all', 'project', 'knowledge', 'content', 'prompt', 'business', 'tool', 'mistake']
const KIND_COLORS = { project: '#3B82F6', knowledge: '#10B981', content: '#F59E0B', prompt: '#A855F7', business: '#EC4899', tool: '#06B6D4', mistake: '#EF4444', other: '#6B7280' }
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
.mc-btn.me-on { background: var(--dsw-alias-accent, #2563eb) !important; color: #fff !important; border-color: transparent !important; }
.mc-new { display: inline-block; margin-left: 7px; padding: 1px 7px; border-radius: 999px; font-size: 10.5px; line-height: 16px; font-weight: 600; color: #fff; background: linear-gradient(135deg, #f97316, #ef4444); vertical-align: middle; }
.mc-hl { background: rgba(245,158,11,0.35); color: inherit; border-radius: 2px; padding: 0 1px; }
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
.mc-card-del { border: none; background: transparent; color: inherit; cursor: pointer; font-size: 13px; line-height: 1; padding: 2px 5px; border-radius: 5px; opacity: 0.45; }
.mc-cardrow:hover .mc-card-del { opacity: 0.9; }
.mc-card-del:hover { color: #ef4444; background: rgba(239,68,68,0.12); }
/* 知识库滚动条：清晰可见 */
.memory-eternal-root * { scrollbar-width: thin; scrollbar-color: var(--dsw-alias-label-secondary, #94a3b8) transparent; }
.memory-eternal-root ::-webkit-scrollbar { width: 10px; height: 10px; }
.memory-eternal-root ::-webkit-scrollbar-thumb { background: var(--dsw-alias-label-secondary, #94a3b8); border-radius: 6px; }
.memory-eternal-root ::-webkit-scrollbar-thumb:hover { background: var(--dsw-alias-label-primary, #64748b); }
.memory-eternal-root ::-webkit-scrollbar-track { background: rgba(127,127,127,0.08); }
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
.me-modal { width: min(1340px, 97vw); height: min(96vh, 1020px); display: flex; flex-direction: column; background: var(--dsw-alias-bg-overlay, #fff); color: var(--dsw-alias-label-primary, #111); border: 1px solid var(--dsw-alias-border-l1, #e5e7eb); border-radius: 18px; box-shadow: 0 34px 90px rgba(0,0,0,0.5); overflow: hidden; animation: me-pop 0.22s cubic-bezier(0.2,0.8,0.2,1); }
@keyframes me-pop { from { opacity: 0; transform: translateY(12px) scale(0.985); } }
.me-modal-head { display: flex; align-items: center; gap: 12px; padding: 16px 20px; border-bottom: 1px solid var(--dsw-alias-border-l1, #e5e7eb); }
.me-modal-title { display: flex; align-items: center; gap: 10px; min-width: 0; }
.me-modal-title h2 { margin: 0; font-size: 17px; font-weight: 700; white-space: nowrap; }
.me-modal-title span { font-size: 12px; opacity: 0.55; white-space: nowrap; }
.me-modal-title .me-wicon { width: 26px; height: 26px; flex: none; }
.me-modal-title .me-wicon svg { display: block; width: 100%; height: 100%; }
.me-modal-head .spacer { flex: 1; }
.me-modal-close { border: 1px solid var(--dsw-alias-border-l2, #d1d5db); background: transparent; color: inherit; border-radius: 8px; width: 30px; height: 30px; line-height: 1; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.me-modal-close:hover { background: var(--dsw-alias-bg-layer-1, #f3f4f6); }
.me-modal-body { flex: 1; padding: 18px 20px; overflow: auto; }
.me-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 1002; display: flex; align-items: center; justify-content: center; padding: 24px; }
.me-dialog { background: var(--dsw-alias-bg-overlay, #fff); color: var(--dsw-alias-label-primary, #111); border-radius: 14px; max-width: 760px; width: 100%; max-height: 84vh; display: flex; flex-direction: column; box-shadow: 0 24px 60px rgba(0,0,0,0.3); }
.me-dialog-head { display: flex; justify-content: space-between; align-items: center; padding: 12px 18px; border-bottom: 1px solid var(--dsw-alias-border-l1, #e5e7eb); }
.me-dialog-head h3 { margin: 0; font-size: 15px; }
.me-dialog-body { padding: 14px 18px; overflow: auto; font-size: 13px; line-height: 1.7; white-space: pre-wrap; word-break: break-word; }
.me-dialog-body h3 { font-size: 15px; margin: 10px 0 6px; color: var(--dsw-alias-label-primary, #111); }
.me-dialog-body h4 { font-size: 13px; margin: 8px 0 4px; color: var(--dsw-alias-label-primary, #111); }
.me-dialog-body b, .me-dialog-body strong { font-weight: 700; }
.me-dialog-body code { background: var(--dsw-alias-bg-layer-1, rgba(127,127,127,0.14)); border-radius: 4px; padding: 1px 5px; font-size: 0.9em; font-family: ui-monospace, SFMono-Regular, monospace; }
.me-dialog-body pre { background: var(--dsw-alias-bg-layer-1, rgba(127,127,127,0.1)); border-radius: 8px; padding: 10px; overflow: auto; margin: 8px 0; }
.me-dialog-body pre code { background: none; padding: 0; }
.me-dialog-body ul, .me-dialog-body ol { margin: 6px 0; padding-left: 20px; }
.me-dialog-body a { color: var(--dsw-alias-accent, #2563eb); }
.me-dialog-body blockquote { border-left: 3px solid var(--dsw-alias-border-l2, #d1d5db); margin: 6px 0; padding: 2px 12px; opacity: 0.85; }

/* ---- enhanced graph ---- */
.me-graph { display: flex; flex-direction: column; gap: 8px; height: 100%; min-height: 320px; }
.me-graph-toolbar { display: flex; align-items: center; gap: 8px; }
.me-graph-count { font-size: 12px; opacity: 0.7; }
.me-graph-canvas { position: relative; flex: 1; min-height: 300px; border-radius: 14px; overflow: hidden; background: radial-gradient(120% 120% at 50% 40%, var(--dsw-alias-bg-layer-2, #f8fafc) 0%, var(--dsw-alias-bg-base, #eef2f7) 100%); border: 1px solid var(--dsw-alias-border-l1, #e5e7eb); cursor: grab; touch-action: none; user-select: none; }
.me-graph-canvas.dragging { cursor: grabbing; }
.me-graph-tip { font-size: 11px; opacity: 0.6; }
.me-graph-canvas svg { width: 100%; height: 100%; display: block; }
.me-graph-edge { fill: none; stroke-width: 1; }
.me-graph-node { cursor: pointer; }
.me-nodelabel { font-size: 11px; fill: var(--dsw-alias-label-primary, #334); pointer-events: none; transition: opacity .12s; }
.me-nodelabel.core { font-weight: 650; }
.me-graph-legend { display: flex; gap: 12px; flex-wrap: wrap; padding: 2px 2px 0; font-size: 11px; opacity: 0.85; }
.me-graph-legend .lg { display: inline-flex; align-items: center; gap: 5px; border: none; background: transparent; color: inherit; font: inherit; font-size: 11px; padding: 3px 6px; border-radius: 7px; cursor: pointer; }
.me-graph-legend .lg:hover { background: var(--dsw-alias-bg-layer-1, rgba(255,255,255,0.08)); }
.me-graph-legend .lg.active { background: var(--dsw-alias-bg-layer-1, rgba(255,255,255,0.14)); box-shadow: 0 0 0 1px var(--dsw-alias-border-l1, #d1d5db); }
.me-graph-legend .lg.lg-clear { opacity: 0.85; }
.me-graph-ctxmenu { min-width: 156px; padding: 6px; background: rgba(28,28,32,0.95); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); color: #eee; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; box-shadow: 0 12px 34px rgba(0,0,0,.3); font-size: 12px; }
.me-graph-ctxmenu button { display: block; width: 100%; text-align: left; padding: 7px 10px; border: none; border-radius: 7px; background: transparent; color: inherit; font: inherit; cursor: pointer; }
.me-graph-ctxmenu button:hover { background: rgba(255,255,255,0.1); }
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
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id="mg-brain" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFC46B" />
          <stop offset="50%" stopColor="#F97316" />
          <stop offset="100%" stopColor="#EA580C" />
        </linearGradient>
      </defs>
      <path fill="url(#mg-brain)" d="M12 4.5a3.2 3.2 0 0 0-6.4.1 4.1 4.1 0 0 0-2.7 5.9 4.1 4.1 0 0 0 .6 6.7A4.2 4.2 0 0 0 12 18.2Z" />
      <path fill="url(#mg-brain)" d="M12 4.5a3.2 3.2 0 0 1 6.4.1 4.1 4.1 0 0 1 2.7 5.9 4.1 4.1 0 0 1-.6 6.7A4.2 4.2 0 0 1 12 18.2Z" />
      <path d="M12 9.2c-.8-1.4-1.7-2-3.1-2.2M12 9.2c.8-1.4 1.7-2 3.1-2.2M12 12.4c-1.2 1-3.2 1.6-5 1.4M12 12.4c1.2 1 3.2 1.6 5 1.4M12 13.2v4" fill="none" stroke="rgba(255,255,255,0.62)" strokeWidth="1" strokeLinecap="round" />
      <circle cx="12" cy="8.6" r="1.1" fill="rgba(255,255,255,0.85)" />
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
  const [sort, setSort] = useState('recent') // 'recent' | 'title' | 'hot'
  const [libToast, setLibToast] = useState(null)
  const libToastTimer = useRef(null)
  const importRef = useRef(null)
  const [exporting, setExporting] = useState(false)
  const [exportLoc, setExportLoc] = useState(false)
  const [reader, setReader] = useState(null)
  const [admin, setAdmin] = useState(null)
  const searchTimer = useRef(null)
  const [visibleCount, setVisibleCount] = useState(24)
  const sentinelRef = useRef(null)

  // 无限滚动：滚动到底部哨兵进入视口时再加载一批。
  useEffect(() => {
    if (view !== 'cards') return
    const el = sentinelRef.current
    if (!el) return
    const io = new IntersectionObserver((entries) => { if (entries[0] && entries[0].isIntersecting) setVisibleCount((v) => v + 24) }, { rootMargin: '400px' })
    io.observe(el)
    return () => io.disconnect()
  }, [view, cards, kind, query])

  const loadCards = useCallback(async (nextKind = kind, nextQuery = query) => {
    try {
      setLoading(true)
      setError('')
      const qs = new URLSearchParams()
      if (nextKind && nextKind !== 'all') qs.set('kind', nextKind)
      if (nextQuery.trim()) qs.set('q', nextQuery.trim())
      const res = await fetch(`${API}/cards?${qs.toString()}`)
      const data = await res.json()
      if (data.ok) { setCards(data.cards || []); setVisibleCount(24) }
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
      if (cardsRes.ok) { setCards(cardsRes.cards || []); setVisibleCount(24) }
    } catch (e) {
      setError(String(e && e.message ? e.message : e))
    } finally {
      setLoading(false)
    }
  }, [])

  // 删除单张记忆卡（卡片行按钮 / 卡片阅读器）
  const deleteMemory = async (path) => {
    try {
      const res = await fetch(`${API}/delete?path=${encodeURIComponent(path)}`)
      const data = await res.json()
      if (data.ok) { setLibToast({ ok: true, msg: t('deleted') }); await loadAll() }
      else setLibToast({ ok: false, msg: (data.error || t('deleteFail')) })
    } catch (e) {
      setLibToast({ ok: false, msg: t('deleteFail') })
    }
    if (libToastTimer.current) clearTimeout(libToastTimer.current)
    libToastTimer.current = setTimeout(() => setLibToast(null), 2000)
  }

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

  const exportVault = async (format, selfPick) => {
    setExporting(true)
    try {
      const res = await fetch(`${API}/export`)
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'export failed')
      let content, name, mime
      if (format === 'json') { name = 'memory-vault.json'; mime = 'application/json'; content = JSON.stringify(data.cards.map((c) => ({ path: c.path, title: c.title, kind: c.kind, text: c.text })), null, 2) }
      else { name = 'memory-vault.md'; mime = 'text/markdown;charset=utf-8'; content = data.cards.map((c) => c.text.trim()).filter(Boolean).join('\n\n---\n\n') }
      const blob = new Blob([content], { type: mime })
      const r = await saveFile(blob, name, selfPick)
      if (!r.ok) { setLibToast({ ok: false, msg: (r.aborted ? t('exportCancel') : t('exportFail')) }); setExporting(false); return }
      setLibToast({ ok: true, msg: (r.picked ? t('exportedTo') + '：' + r.name : t('exportedTo') + '：' + t('defaultDownloads') + ' · ' + r.name) })
    } catch (e) {
      setLibToast({ ok: false, msg: t('exportFail') + ' · ' + (e.message || '') })
    } finally {
      setExporting(false)
    }
    if (libToastTimer.current) clearTimeout(libToastTimer.current)
    libToastTimer.current = setTimeout(() => setLibToast(null), 2600)
  }

  const importVault = async (e) => {
    const file = e.target.files && e.target.files[0]
    e.target.value = ''
    if (!file) return
    try {
      const text = await file.text()
      const res = await fetch(`${API}/import`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: text })
      const data = await res.json()
      if (data.ok) { await loadAll(); setLibToast({ ok: true, msg: t('importedVault') + '：' + (data.imported || 0) + (data.skipped ? t('importedSkipped') + (data.skipped) : '') }) }
      else setLibToast({ ok: false, msg: (data.error || t('importFail')) })
    } catch (err) {
      setLibToast({ ok: false, msg: t('importFail') })
    }
    if (libToastTimer.current) clearTimeout(libToastTimer.current)
    libToastTimer.current = setTimeout(() => setLibToast(null), 2400)
  }

  const sortedCards = useMemo(() => {
    const arr = cards.slice()
    if (sort === 'title') arr.sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')))
    else if (sort === 'hot') arr.sort((a, b) => ((b.weight || b.links || 0) - (a.weight || a.links || 0)))
    else arr.sort((a, b) => (new Date(b.updated || 0).getTime() - new Date(a.updated || 0).getTime()))
    return arr
  }, [cards, sort])

  return (
    <div className="memory-eternal-root" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <style>{CSS}</style>
      {libToast && <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'fixed', left: '50%', transform: 'translateX(-50%)', top: 22, zIndex: 70, background: 'rgba(20,22,26,0.97)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', color: '#f5f5f5', borderRadius: 12, padding: '10px 20px', fontSize: 13.5, fontWeight: 600, boxShadow: '0 14px 44px rgba(0,0,0,.5)', pointerEvents: 'none', animation: 'me-pop .22s ease', borderLeft: '4px solid ' + (libToast.ok ? '#22c55e' : '#ef4444'), maxWidth: '90vw' }}><span style={{ color: libToast.ok ? '#34d399' : '#f87171', fontWeight: 800, fontSize: 15 }}>{libToast.ok ? '✓' : '✕'}</span><span>{libToast.msg}</span></div>}
      {inModal && (
        <div className="me-modal-head">
          <div className="me-modal-title">
            <span className="me-wicon"><DatabaseIcon /></span>
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
          <input ref={importRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={importVault} />
          <button type="button" className="mc-btn" onClick={() => importRef.current && importRef.current.click()}>{t('importVault')}</button>
          <label className="mc-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer' }} title={t('location')}><input type="checkbox" checked={exportLoc} onChange={(e) => setExportLoc(e.target.checked)} />{t('location')}</label>
          <button type="button" className="mc-btn" disabled={exporting} onClick={() => exportVault('md', exportLoc)}>{exporting ? t('exporting') : t('exportVault')}</button>
          <button type="button" className="mc-btn" disabled={exporting} onClick={() => exportVault('json', exportLoc)}>{exporting ? t('exporting') : t('exportJson')}</button>
          <button type="button" className="mc-btn" onClick={() => setAdmin({ tab: 'stats' })}>{t('manage')}</button>
          <button type="button" className="mc-btn" onClick={() => loadAll()}>{t('refresh')}</button>
        </div>

        {view === 'cards' && (
          <div className="mc-chips">
            {KIND_IDS.map((k) => (
              <button key={k} type="button" className={`mc-chip${kind === k ? ' active' : ''}`} onClick={() => onKind(k)}>
                {k === 'all' ? t('all') : t(KIND_LABELS[k])}
              </button>
            ))}
            <span className="spacer" style={{ flex: 1 }} />
            {[{ key: 'recent', label: t('sortRecent') }, { key: 'title', label: t('sortTitle') }, { key: 'hot', label: t('sortHot') }].map((o) => (
              <button key={o.key} type="button" className={`mc-chip${sort === o.key ? ' active' : ''}`} onClick={() => setSort(o.key)}>{o.label}</button>
            ))}
          </div>
        )}

        {error && <div className="mc-empty">{t('error')}：{error}</div>}

        {view === 'cards' ? (
          loading && !cards.length
            ? <div className="mc-empty">{t('loading')}</div>
            : cards.length === 0
              ? <div className="mc-empty">{t('empty')}</div>
              : <><div className="mc-grid">{sortedCards.slice(0, visibleCount).map((card) => <CardRow key={card.path} card={card} t={t} query={query.trim()} onOpen={openCard} onDelete={deleteMemory} />)}</div>{sortedCards.length > visibleCount && <div ref={sentinelRef} style={{ height: 1 }} />}</>
        ) : (
          <GraphView t={t} onOpen={openCard} />
        )}

        {reader && <CardReader t={t} card={reader} onClose={() => setReader(null)} onDelete={(p) => { setReader(null); deleteMemory(p) }} />}
        {admin && <LibraryAdmin t={t} tab={admin.tab} onTab={(tb) => setAdmin({ tab: tb })} onClose={() => setAdmin(null)} onReload={() => loadAll()} />}
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

const CardRow = ({ card, t, onOpen, query, onDelete }) => (
  <article className="mc-cardrow mc-card" onClick={() => onOpen(card)}>
    <h4>
      <span className="mc-kind" style={{ background: KIND_COLORS[card.kind] || KIND_COLORS.other }} />
      {query ? highlightMatches(card.title, query) : card.title}
      {isNewCard(card.updated) && <span className="mc-new">{t('newBadge')}</span>}
    </h4>
    <p>{query ? highlightMatches(card.summary || '', query) : (card.summary || '')}</p>
    {card.tags.length > 0 && (
      <div className="mc-tags">
        {card.tags.slice(0, 4).map((tag) => <span key={tag} className="mc-tag">{tag}</span>)}
      </div>
    )}
    <footer>
      <span>{t(KIND_LABELS[card.kind])}</span>
      <span>{fmtDate(card.updated)}</span>
      <span className="spacer" style={{ flex: 1 }} />
      <button type="button" className="mc-card-del" title={t('delete')} onClick={(e) => { e.stopPropagation(); if (window.confirm(t('deleteConfirm'))) onDelete && onDelete(card.path) }}>✕</button>
    </footer>
  </article>
)

// 管理面板：用量/今日 + 整理建议（非破坏预览）+ 会话预算。
function LibraryAdmin({ t, tab, onTab, onClose, onReload }) {
  const [stats, setStats] = useState(null)
  const [opt, setOpt] = useState(null)
  const [budget, setBudget] = useState(null)
  const fetchAll = useCallback(async () => {
    try {
      const [s, o, b] = await Promise.all([
        fetch(`${API}/stats`).then((r) => r.json()),
        fetch(`${API}/optimize`).then((r) => r.json()),
        fetch(`${API}/budget`).then((r) => r.json()),
      ])
      if (s.ok) setStats(s)
      if (o.ok) setOpt(o)
      if (b.ok) setBudget(b)
    } catch (e) { /* 静默 */ }
  }, [])
  useEffect(() => { fetchAll() }, [fetchAll])
  const doMerge = async (a, b) => {
    if (!window.confirm(t('mergeConfirm'))) return
    try { const r = await fetch(`${API}/merge?paths=${encodeURIComponent(a + ',' + b)}`).then((x) => x.json()); if (r.ok) { await fetchAll(); onReload && onReload() } } catch (e) {}
  }
  const doDelete = async (p) => {
    if (!window.confirm(t('deleteConfirm'))) return
    try { const r = await fetch(`${API}/delete?path=${encodeURIComponent(p)}`).then((x) => x.json()); if (r.ok) { await fetchAll(); onReload && onReload() } } catch (e) {}
  }
  const kinds = ['project', 'knowledge', 'content', 'prompt', 'business', 'tool', 'mistake']
  const KN = ({ title, kind, updated, path }) => (
    <li style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 4px', borderBottom: '1px solid rgba(127,127,127,0.12)' }}>
      <span className="mc-kind" style={{ background: KG.colors[kind] || '#666' }} />
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
      <span style={{ opacity: 0.55, fontSize: 11 }}>{fmtDate(updated)}</span>
      <button type="button" className="mc-btn" style={{ padding: '2px 8px' }} onClick={() => doDelete(path)}>{t('delete')} ✕</button>
    </li>
  )
  return (
    <div className="me-overlay" onClick={onClose}>
      <style>{CSS}</style>
      <div className="me-dialog" style={{ maxWidth: 720, width: '94vw', maxHeight: '86vh' }} onClick={(e) => e.stopPropagation()}>
        <div className="me-dialog-head">
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className={`mc-tab${tab === 'stats' ? ' active' : ''}`} onClick={() => onTab('stats')}>{t('tabUsage')}</button>
            <button type="button" className={`mc-tab${tab === 'optimize' ? ' active' : ''}`} onClick={() => onTab('optimize')}>{t('tabOptimize')}</button>
          </div>
          <div className="spacer" style={{ flex: 1 }} />
          <button type="button" className="mc-btn" onClick={onClose}>{t('close')}</button>
        </div>
        <div className="me-dialog-body" style={{ overflow: 'auto' }}>
          {tab === 'stats' && (
            <div>
              {stats && (
                <>
                  <div className="mc-stats">
                    <div className="mc-stat mc-card"><b>{stats.total}</b><span>{t('total')}</span></div>
                    <div className="mc-stat mc-card"><b>{stats.today}</b><span>{t('todayAdd')}</span></div>
                    <div className="mc-stat mc-card"><b>{stats.week}</b><span>{t('weekAdd')}</span></div>
                    <div className="mc-stat mc-card"><b>{stats.tags}</b><span>{t('tags')}</span></div>
                  </div>
                  <div className="mc-card" style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{t('byKind')}</div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{kinds.map((k) => <span key={k} style={{ fontSize: 12 }}><span className="mc-kind" style={{ background: KG.colors[k] || '#666' }} />{t(KIND_LABELS[k])}: {stats.byKind?.[k] || 0}</span>)}</div>
                  </div>
                  {(budget && (budget.budgetChars || budget.recallLimit || budget.embedding)) && (
                    <div className="mc-card" style={{ marginBottom: 10, fontSize: 12 }}>
                      <b>{t('budgetLabel')}</b>：{t('budgetChars')} <b>{budget.budgetChars || 80000}</b> · {t('recallLimitLabel')} <b>{budget.recallLimit || 5}</b> · {t('embeddingLabel')} {budget.embedding ? 'ON' : 'OFF'}
                    </div>
                  )}
                  <div className="mc-card">
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{t('todayList')}（{stats.todayCards?.length || 0}）</div>
                    {stats.todayCards?.length ? <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>{stats.todayCards.map((c) => <KN key={c.path} title={c.title} kind={c.kind} updated={c.updated} path={c.path} />)}</ul> : <div style={{ opacity: 0.6, fontSize: 12 }}>{t('noOptimize')}</div>}
                  </div>
                </>
              )}
            </div>
          )}
          {tab === 'optimize' && (
            <div>
              {opt && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{t('mergePairs')}</div>
                  {opt.merge?.length ? (
                    <ul style={{ margin: '0 0 12px', padding: 0, listStyle: 'none' }}>
                      {opt.merge.map((m, i) => (
                        <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 4px', borderBottom: '1px solid rgba(127,127,127,0.12)', fontSize: 12 }}>
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.a.title} ⇄ {m.b.title}</span>
                          <span style={{ opacity: 0.6 }}>{Math.round(m.sim * 100)}%</span>
                          <button type="button" className="mc-btn" style={{ padding: '2px 8px' }} onClick={() => doMerge(m.a.path, m.b.path)}>{t('mergeNow')}</button>
                        </li>
                      ))}
                    </ul>
                  ) : <div style={{ opacity: 0.6, fontSize: 12, marginBottom: 12 }}>{t('noOptimize')}</div>}
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{t('staleCards')}（{opt.stale?.length || 0}）</div>
                  {opt.stale?.length ? <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>{opt.stale.map((s) => <KN key={s.path} title={s.title} kind="other" updated={s.updated} path={s.path} />)}</ul> : <div style={{ opacity: 0.6, fontSize: 12 }}>{t('noOptimize')}</div>}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CardReader({ t, card, onClose, onDelete }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const [expanded, setExpanded] = useState(false)
  const long = (card.text || '').length > 460
  return (
    <div className="me-overlay" onClick={onClose}>
      <style>{CSS}</style>
      <div className="me-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="me-dialog-head">
          <h3>{card.title}</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            {long && <button type="button" className="mc-btn" onClick={() => setExpanded((v) => !v)}>{expanded ? t('collapse') : t('expand')}</button>}
            <button type="button" className="mc-btn" style={{ color: '#f87171' }} onClick={() => { if (window.confirm(t('deleteConfirm'))) onDelete && onDelete(card.path) }}>{t('delete')}</button>
            <button type="button" className="mc-btn" onClick={onClose}>{t('close')}</button>
          </div>
        </div>
        <div className="me-dialog-body" style={expanded ? {} : { maxHeight: 300, overflow: 'hidden' }} dangerouslySetInnerHTML={{ __html: renderMd(card.text) }} />
      </div>
    </div>
  )
}

// -- Enhanced knowledge graph ------------------------------------------------

function GraphView({ t, onOpen }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    try {
      const r = await fetch(`${API}/graph`)
      const d = await r.json()
      setData(d.ok ? d : null)
      setError('')
    } catch (e) {
      setError(String(e && e.message ? e.message : e))
    }
  }, [])

  useEffect(() => {
    let alive = true
    fetch(`${API}/graph`)
      .then((r) => r.json())
      .then((d) => { if (alive) setData(d.ok ? d : null) })
      .catch((e) => { if (alive) setError(String(e && e.message ? e.message : e)) })
    return () => { alive = false }
  }, [])

  const del = useCallback(async (path) => {
    try {
      const r = await fetch(`${API}/delete?path=${encodeURIComponent(path)}`)
      const d = await r.json()
      if (d && d.ok) { await reload(); return true }
      return false
    } catch (e) { return false }
  }, [reload])

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
          onDelete={del}
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

// agentmemory 式图谱：canvas 力导向 + 按 kind 聚合 + 分型节点 + 渐变/发光 + 药丸标签 + 网格。
const KG = {
  colors: { project:'#3B82F6', knowledge:'#10B981', content:'#F59E0B', prompt:'#A855F7', business:'#EC4899', tool:'#06B6D4', mistake:'#EF4444', other:'#6B7280' },
  shapes: { project:'circle', knowledge:'circle', content:'rect', prompt:'diamond', business:'hexagon', tool:'circle', mistake:'diamond', other:'circle' },
}

function GraphCanvas({ nodes, edges, onOpen, onDelete, t, countLabel }) {
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const simRef = useRef(null)
  const fitRef = useRef(null)
  const resetRef = useRef(null)
  const onOpenRef = useRef(onOpen)
  useEffect(() => { onOpenRef.current = onOpen }, [onOpen])
  const onDeleteRef = useRef(onDelete)
  useEffect(() => { onDeleteRef.current = onDelete }, [onDelete])
  const [search, setSearch] = useState('')
  const [sel, setSel] = useState(null)
  const searchRef = useRef('')
  useEffect(() => { searchRef.current = search.trim().toLowerCase() }, [search])
  const [filterKind, setFilterKind] = useState('all')
  const filterRef = useRef('all')
  const [timeMode, setTimeMode] = useState(false)
  const timeRef = useRef(false)
  const [ctx, setCtx] = useState(null)
  useEffect(() => { filterRef.current = filterKind }, [filterKind])
  useEffect(() => { timeRef.current = timeMode }, [timeMode])
  const noMatch = (() => { const q = search.trim().toLowerCase(); return !!q && !nodes.some((n) => (n.title || n.name || '').toLowerCase().includes(q) || String(n.kind || '').toLowerCase().includes(q) || String(KIND_LABELS[n.kind] || '').toLowerCase().includes(q)) })()
  // 搜索变化时唤醒仿真重绘（否则布局停车后搜索不刷新）
  useEffect(() => { const s = simRef.current; if (s && s.wake) s.wake() }, [search])
  // 图例过滤变化时直接重绘（不重启布局）
  useEffect(() => { const s = simRef.current; if (s && s.render) s.render() }, [filterKind, timeMode])
  const tooltipRef = useRef(null)
  const [multi, setMulti] = useState([])
  const [exportData, setExportData] = useState(null)
  const [exportFull, setExportFull] = useState(false)
  const [toast, setToast] = useState(null)
  const [exportDone, setExportDone] = useState('') // 'download' | 'copy' | 'tab' | 'full'
  const toastTimer = useRef(null)
  const exportTimer = useRef(null)
  const notify = (msg, ok = true) => { if (toastTimer.current) clearTimeout(toastTimer.current); setToast({ msg, ok }); toastTimer.current = setTimeout(() => setToast(null), 1900) }
  const markDone = (k) => { setExportDone(k); if (exportTimer.current) clearTimeout(exportTimer.current); exportTimer.current = setTimeout(() => setExportDone(''), 1600) }
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); if (exportTimer.current) clearTimeout(exportTimer.current) }, [])
  const nodeById = useMemo(() => nodes.reduce((m, n) => (m[n.id] = n, m), {}), [nodes])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || nodes.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = Math.max(1, window.devicePixelRatio || 1)
    const degrade = () => document.documentElement.getAttribute('data-theme') === 'dark'

    const deg = {}
    edges.forEach((e) => { deg[e.source] = (deg[e.source] || 0) + 1; deg[e.target] = (deg[e.target] || 0) + 1 })
    const maxDeg = Math.max(1, ...Object.values(deg))

    const sim = {
      nodes: nodes.map((n) => ({ id: n.id, name: n.title || '', type: n.kind || 'other', r: 9 + Math.min(10, ((deg[n.id] || 0) / maxDeg) * 8), x: 0, y: 0, vx: 0, vy: 0 })),
      edges: edges.map((e) => ({ sourceNodeId: e.source, targetNodeId: e.target, weight: 1 })),
      panX: 0, panY: 0, zoom: 1, running: true, raf: 0, tickCount: 0, quietTicks: 0, dragNode: null, selectedId: null, mouseX: 0, mouseY: 0, w: 0, h: 0, dpr, ctx, multi: [], marquee: null,
    }
    sim.domain = nodes
    sim.domainById = nodes.reduce((m, n) => (m[n.id] = n, m), {})
    sim.nodes.forEach((n, i) => { const a = (i / sim.nodes.length) * Math.PI * 2 - Math.PI / 2; n.x = Math.cos(a) * 60; n.y = Math.sin(a) * 60 })
    const types = [...new Set(sim.nodes.map((n) => n.type))]
    sim.clustered = types.length > 1
    sim.typeCenters = {}
    types.forEach((ty, i) => { const a = (i / types.length) * Math.PI * 2 - Math.PI / 2; sim.typeCenters[ty] = { x: Math.cos(a) * 160, y: Math.sin(a) * 160 } })
    simRef.current = sim

    const resize = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight
      sim.w = w; sim.h = h
      canvas.width = w * dpr; canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas.parentElement)

    const truncate = (s, n) => (s && s.length > n ? s.slice(0, n) + '…' : s)

    const drawShape = (x, y, r, shape) => {
      ctx.beginPath()
      if (shape === 'rect') ctx.rect(x - r, y - r * 0.75, r * 2, r * 1.5)
      else if (shape === 'diamond') { ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath() }
      else if (shape === 'hexagon') { for (let i = 0; i < 6; i++) { const a = (Math.PI / 3) * i - Math.PI / 2; const hx = x + r * Math.cos(a), hy = y + r * Math.sin(a); if (i === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy) } ctx.closePath() }
      else ctx.arc(x, y, r, 0, Math.PI * 2)
    }

    const fit = () => {
      if (!sim.nodes.length) return
      let minX = 1/0, maxX = -1/0, minY = 1/0, maxY = -1/0
      sim.nodes.forEach((n) => { minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x); minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y) })
      const pad = 36
      const spanX = (maxX - minX) + pad * 2, spanY = (maxY - minY) + pad * 2
      const z = Math.min(sim.w / spanX, sim.h / spanY)
      sim.zoom = Math.max(0.45, Math.min(2.4, z * 1.22))
      sim.panX = sim.w / 2 - ((minX + maxX) / 2) * sim.zoom
      sim.panY = sim.h / 2 - ((minY + maxY) / 2) * sim.zoom
    }
    fitRef.current = fit

    const render = () => {
      ctx.clearRect(0, 0, sim.w, sim.h)
      sim.searchTerm = searchRef.current
      sim.kindFilter = filterRef.current
      sim.timeMode = timeRef.current
      const kf = sim.kindFilter
      const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      // grid
      ctx.save()
      ctx.strokeStyle = degrade() ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'
      ctx.lineWidth = 0.5
      for (let gx = 0; gx < sim.w; gx += 24) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, sim.h); ctx.stroke() }
      for (let gy = 0; gy < sim.h; gy += 24) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(sim.w, gy); ctx.stroke() }
      ctx.restore()
      ctx.save()
      ctx.translate(sim.panX, sim.panY); ctx.scale(sim.zoom, sim.zoom)
      const nodeMap = {}
      sim.nodes.forEach((n) => (nodeMap[n.id] = n))
      const dense = sim.nodes.length > 40
      const labelThreshold = dense ? 1.5 : 0.55
      const focusId = sim.selectedId || sim.hoverId
      // edges
      sim.edges.forEach((e) => {
        const s = nodeMap[e.sourceNodeId], t = nodeMap[e.targetNodeId]
        if (!s || !t) return
        if (kf !== 'all') { const sK = sim.domainById[e.sourceNodeId] && sim.domainById[e.sourceNodeId].kind; const tK = sim.domainById[e.targetNodeId] && sim.domainById[e.targetNodeId].kind; if (sK !== kf && tK !== kf) return }
        let dr = t.x - s.x, dy = t.y - s.y
        const len = Math.sqrt(dr * dr + dy * dy) || 1
        const curve = dense ? 12 : 18
        const ox = -dy / len * curve, oy = dr / len * curve
        const cpx = (s.x + t.x) / 2 + ox, cpy = (s.y + t.y) / 2 + oy
        const color = KG.colors[sim.domainById[s.id] ? (sim.domainById[s.id].kind || 'other') : 'other']
        const focused = focusId && (e.sourceNodeId === focusId || e.targetNodeId === focusId)
        const alpha = focusId ? (focused ? 0.6 : 0.08) : (dense ? 0.14 : 0.24)
        const cr = parseInt(color.slice(1,3),16), cg = parseInt(color.slice(3,5),16), cb = parseInt(color.slice(5,7),16)
        ctx.strokeStyle = 'rgba(' + cr + ',' + cg + ',' + cb + ',' + alpha + ')'
        ctx.lineWidth = focused ? 1.6 + (e.weight||1) : 0.8 + (e.weight||1)*0.5
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.quadraticCurveTo(cpx, cpy, t.x, t.y); ctx.stroke()
      })
      // nodes
      const drawn = []
      sim.nodes.forEach((n) => {
        const info = sim.domainById[n.id] || {}
        const kind = info.kind || 'other'
        const color = sim.timeMode ? recencyColor(info.updated) : KG.colors[kind]
        const shape = KG.shapes[kind]
        const isSel = sim.selectedId === n.id, isHov = sim.hoverId === n.id
        const searchTerm = sim.searchTerm || ''
        const searchHit = !searchTerm || (n.name || '').toLowerCase().includes(searchTerm) || String(KIND_LABELS[kind] || '').toLowerCase().includes(searchTerm) || String(kind).toLowerCase().includes(searchTerm)
        const kindOk = kf === 'all' || kind === kf
        const dimmed = (focusId && n.id !== focusId && !sim.edges.some((ed) => (ed.sourceNodeId === focusId && ed.targetNodeId === n.id) || (ed.targetNodeId === focusId && ed.sourceNodeId === n.id))) || (searchTerm && !searchHit) || !kindOk
        ctx.save()
        ctx.globalAlpha = dimmed ? 0.08 : 1
        if (isSel || isHov) { ctx.shadowColor = color; ctx.shadowBlur = isSel ? 20 : 14 }
        drawShape(n.x, n.y, n.r, shape)
        const cr = parseInt(color.slice(1,3),16), cg = parseInt(color.slice(3,5),16), cb = parseInt(color.slice(5,7),16)
        const grad = ctx.createRadialGradient(n.x - n.r*0.3, n.y - n.r*0.3, 0, n.x, n.y, n.r*1.2)
        grad.addColorStop(0, 'rgba(' + Math.min(255,cr+70) + ',' + Math.min(255,cg+70) + ',' + Math.min(255,cb+70) + ',0.95)')
        grad.addColorStop(1, color)
        ctx.fillStyle = grad; ctx.fill(); ctx.restore()
        if (isSel) { ctx.save(); drawShape(n.x, n.y, n.r+3, shape); ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.shadowColor = color; ctx.shadowBlur = 12; ctx.stroke(); ctx.restore() }
        else if (isHov) { ctx.save(); drawShape(n.x, n.y, n.r+2, shape); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke(); ctx.restore() }
        else if (searchTerm && searchHit) { ctx.save(); drawShape(n.x, n.y, n.r+2, shape); ctx.strokeStyle = '#e11d48'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore() }
        else if (sim.multi.indexOf(n.id) >= 0) { ctx.save(); drawShape(n.x, n.y, n.r+2, shape); ctx.strokeStyle = '#60a5fa'; ctx.lineWidth = 2; ctx.shadowColor = '#60a5fa'; ctx.shadowBlur = 8; ctx.stroke(); ctx.restore() }
        // pill label
        const label = truncate(n.name, 16)
        const showLab = (isSel || isHov || sim.zoom > labelThreshold || (!dense && sim.zoom > 0.6)) && kindOk
        if (showLab) {
          const zi = 1 / sim.zoom
          ctx.font = '500 ' + (12 * zi).toFixed(1) + 'px -apple-system,Segoe UI,sans-serif'
          const tw = ctx.measureText(label).width
          const lw = tw + 16 * zi, lh = 18 * zi
          const ly = n.y + n.r + 8 * zi
          let fits = true
          for (const r of drawn) { if (n.x - lw/2 < r.x + r.w && n.x + lw/2 > r.x && ly < r.y + r.h && ly + lh > r.y) { fits = false; break } }
          if (!fits && !isSel && !isHov) return
          drawn.push({ x: n.x - lw/2, y: ly, w: lw, h: lh })
          ctx.fillStyle = degrade() ? 'rgba(30,30,35,0.92)' : 'rgba(255,255,255,0.92)'
          ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(n.x - lw/2, ly, lw, lh, 4*zi); else ctx.rect(n.x - lw/2, ly, lw, lh); ctx.fill()
          ctx.strokeStyle = degrade() ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
          ctx.lineWidth = 1 * zi; ctx.stroke()
          ctx.fillStyle = degrade() ? (isSel||isHov ? '#eee' : '#bbb') : (isSel||isHov ? '#111' : '#444')
          ctx.textAlign = 'center'; ctx.fillText(label, n.x, ly + 13 * zi)
        }
      })
      ctx.restore()
      // Marquee 框选矩形（屏幕坐标）
      if (sim.marquee) {
        const m = sim.marquee
        const mx = Math.min(m.sx, m.ex), my = Math.min(m.sy, m.ey), mw = Math.abs(m.ex - m.sx), mh = Math.abs(m.ey - m.sy)
        ctx.save()
        ctx.setLineDash([4, 4])
        ctx.strokeStyle = 'rgba(96,165,250,0.9)'; ctx.lineWidth = 1
        ctx.fillStyle = 'rgba(96,165,250,0.12)'
        ctx.fillRect(mx, my, mw, mh); ctx.strokeRect(mx, my, mw, mh)
        ctx.restore()
      }
      // 玻璃拟态 tooltip
      if (sim.hoverId && tooltipRef.current) {
        const hn = sim.domainById[sim.hoverId]
        const sn = sim.nodes.find(function (x) { return x.id === sim.hoverId })
        if (hn && sn) {
          const conn = sim.edges.filter(function (ed) { return ed.sourceNodeId === hn.id || ed.targetNodeId === hn.id }).length
          const lx = sn.x * sim.zoom + sim.panX, ly = sn.y * sim.zoom + sim.panY
          tooltipRef.current.style.display = 'block'
          tooltipRef.current.style.left = (lx + 14) + 'px'
          tooltipRef.current.style.top = (ly - 6) + 'px'
          tooltipRef.current.innerHTML = '<b>' + esc(hn.title || hn.name || '') + '</b><br/><span style="opacity:.8">' + esc(hn.kind || '') + ' · ' + conn + ' 连接</span>'
        }
      } else if (tooltipRef.current) tooltipRef.current.style.display = 'none'
    }

    const wake = () => { sim.running = true; if (!sim.raf) sim.raf = requestAnimationFrame(step) }
    sim.wake = wake
    sim.render = render

    const tick = () => {
      const nn = sim.nodes.length
      sim.tickCount++
      const cool = Math.min(0.4, sim.tickCount / 1500)
      const damping = 0.9 - cool
      const repulsion = nn > 1000 ? 3000 : nn > 100 ? 2000 : nn > 50 ? 1200 : 800
      const attraction = nn > 100 ? 0.002 : 0.005
      const centerGravity = nn > 1000 ? 0.012 : nn > 100 ? 0.005 : 0.01
      const velCap = nn > 1000 ? 6 : nn > 200 ? 12 : 24
      const map = {}; sim.nodes.forEach((n) => (map[n.id] = n))
      for (let i = 0; i < nn; i++) {
        if (sim.dragNode === sim.nodes[i]) continue
        const n = sim.nodes[i]; let fx = 0, fy = 0
        for (let j = 0; j < nn; j++) { if (i === j) continue; const dx = n.x - sim.nodes[j].x, dy = n.y - sim.nodes[j].y; const d = Math.sqrt(dx*dx+dy*dy)||1; const f = repulsion/(d*d); fx += dx/d*f; fy += dy/d*f }
        if (sim.clustered && sim.typeCenters[n.type]) { const tc = sim.typeCenters[n.type]; fx += (tc.x - n.x) * 0.006; fy += (tc.y - n.y) * 0.006 }
        else { fx -= n.x * centerGravity; fy -= n.y * centerGravity }
        let nvx = (n.vx + fx) * damping, nvy = (n.vy + fy) * damping
        nvx = Math.max(-velCap, Math.min(velCap, nvx)); nvy = Math.max(-velCap, Math.min(velCap, nvy))
        n.vx = nvx; n.vy = nvy
      }
      sim.edges.forEach((e) => {
        const s = map[e.sourceNodeId], t = map[e.targetNodeId]; if (!s || !t) return
        const dx = t.x - s.x, dy = t.y - s.y; const d = Math.sqrt(dx*dx+dy*dy)||1
        const f = (d - 100) * attraction; const fx = dx/d*f, fy = dy/d*f
        if (sim.dragNode !== s) { s.vx += fx; s.vy += fy }
        if (sim.dragNode !== t) { t.vx -= fx; t.vy -= fy }
      })
      let kinetic = 0
      sim.nodes.forEach((n) => { if (sim.dragNode === n) return; n.x += n.vx; n.y += n.vy; kinetic += n.vx*n.vx + n.vy*n.vy })
      if (sim.autoFitPending && sim.tickCount > 45) { sim.autoFitPending = false; fit() }
      const rms = nn ? Math.sqrt(kinetic / nn) : 0
      if (rms < 0.05 && sim.tickCount > 60 && !sim.dragNode) sim.quietTicks = (sim.quietTicks|0)+1; else sim.quietTicks = 0
    }

    const step = () => {
      if (!sim.running) return
      try { tick(); render() } catch (er) { /* 绘制/物理异常不拖垮窗口 */ }
      if (sim.quietTicks > 30) { sim.raf = 0; return }
      sim.raf = requestAnimationFrame(step)
    }

    // interactions
    const toWorld = (cx, cy) => { const r = canvas.getBoundingClientRect(); return { x: (cx - r.left - sim.panX) / sim.zoom, y: (cy - r.top - sim.panY) / sim.zoom } }
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
    const onMove = (e) => { sim.mouseX = e.clientX; sim.mouseY = e.clientY; const w = toWorld(e.clientX, e.clientY); let hov = null; for (let i = sim.nodes.length-1; i>=0; i--) { const n = sim.nodes[i]; if (filterRef.current !== 'all' && (sim.domainById[n.id] && sim.domainById[n.id].kind) !== filterRef.current) continue; const dx = n.x - w.x, dy = n.y - w.y; if (dx*dx + dy*dy < n.r*n.r + 36) { hov = n.id; break } } if (hov !== sim.hoverId) { sim.hoverId = hov; wake() } }
    const onDown = (e) => {
      if (e.button !== 0) return
      const w = toWorld(e.clientX, e.clientY); let hit = null
      for (let i = sim.nodes.length-1; i>=0; i--) { const n = sim.nodes[i]; if (filterRef.current !== 'all' && (sim.domainById[n.id] && sim.domainById[n.id].kind) !== filterRef.current) continue; const dx = n.x - w.x, dy = n.y - w.y; if (dx*dx + dy*dy < n.r*n.r + 25) { hit = n; break } }
      if (e.shiftKey) { sim.marquee = { sx: e.clientX, sy: e.clientY, ex: e.clientX, ey: e.clientY }; return }
      sim.dragStart = { x: e.clientX, y: e.clientY, px: sim.panX, py: sim.panY }
      sim.dragging = false; sim.dragNode = hit || null
      if (hit) sim.dragOffset = { dx: hit.x - w.x, dy: hit.y - w.y }
    }
    const onDrag = (e) => {
      if (sim.marquee) { sim.marquee.ex = e.clientX; sim.marquee.ey = e.clientY; wake(); return }
      if (!sim.dragStart) return
      const dx = e.clientX - sim.dragStart.x, dy = e.clientY - sim.dragStart.y
      if (Math.abs(dx) + Math.abs(dy) > 3) sim.dragging = true
      if (sim.dragNode) { const w = toWorld(e.clientX, e.clientY); sim.dragNode.x = w.x + sim.dragOffset.dx; sim.dragNode.y = w.y + sim.dragOffset.dy; wake() }
      else if (sim.dragging) { sim.panX = clamp(sim.dragStart.px + dx, -1e5, 1e5); sim.panY = clamp(sim.dragStart.py + dy, -1e5, 1e5); wake() }
    }
    const onUp = (e) => {
      if (sim.marquee) {
        const m = sim.marquee; sim.marquee = null
        const rect = canvas.getBoundingClientRect()
        const x1 = Math.min(m.sx, m.ex) - rect.left, x2 = Math.max(m.sx, m.ex) - rect.left
        const y1 = Math.min(m.sy, m.ey) - rect.top, y2 = Math.max(m.sy, m.ey) - rect.top
        const ids = sim.nodes.filter((n) => { const wx = n.x * sim.zoom + sim.panX, wy = n.y * sim.zoom + sim.panY; return wx >= x1 && wx <= x2 && wy >= y1 && wy <= y2 }).map((n) => n.id)
        sim.multi = ids; setMulti(ids)
        wake(); return
      }
      const wasClick = sim.dragStart && !sim.dragging
      if (wasClick) {
        const w = toWorld(e.clientX, e.clientY); let hit = null
        for (let i = sim.nodes.length-1; i>=0; i--) { const n = sim.nodes[i]; if (filterRef.current !== 'all' && (sim.domainById[n.id] && sim.domainById[n.id].kind) !== filterRef.current) continue; const dx = n.x - w.x, dy = n.y - w.y; if (dx*dx + dy*dy < n.r*n.r + 20) { hit = n; break } }
        if (hit) { sim.selectedId = hit.id; setSel(hit.id); wake() }
        else { sim.selectedId = null; sim.hoverId = null; if (!e.shiftKey) { sim.multi = []; setMulti([]) } setSel(null); wake() }
      }
      sim.dragStart = null; sim.dragging = false; sim.dragNode = null
    }
    const onCtx = (e) => {
      e.preventDefault()
      const w = toWorld(e.clientX, e.clientY); let hit = null
      for (let i = sim.nodes.length-1; i>=0; i--) { const n = sim.nodes[i]; if (filterRef.current !== 'all' && (sim.domainById[n.id] && sim.domainById[n.id].kind) !== filterRef.current) continue; const dx = n.x - w.x, dy = n.y - w.y; if (dx*dx + dy*dy < n.r*n.r + 25) { hit = n; break } }
      if (hit) { const d = sim.domainById[hit.id]; if (d) setCtx({ x: e.clientX, y: e.clientY, id: hit.id, path: d.id, title: d.title }) }
      else setCtx(null)
    }
    const onWheel = (e) => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const wx = (e.clientX - rect.left - sim.panX) / sim.zoom
      const wy = (e.clientY - rect.top - sim.panY) / sim.zoom
      const newZoom = Math.max(0.3, Math.min(3, sim.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1)))
      sim.panX = clamp(sim.panX + wx * (sim.zoom - newZoom), -1e5, 1e5)
      sim.panY = clamp(sim.panY + wy * (sim.zoom - newZoom), -1e5, 1e5)
      sim.zoom = newZoom
      wake()
    }
    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onDrag)
    window.addEventListener('mouseup', onUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('contextmenu', onCtx)

    resetRef.current = () => { sim.selectedId = null; sim.hoverId = null; sim.multi = []; setMulti([]); fit(); wake() }
    // 稳定初始化：先同步力到接近收敛再显示，避免初始画面漂移/视角切换
    for (let s = 0; s < 200; s++) tick()
    fit()
    wake()

    return () => { sim.running = false; if (sim.raf) cancelAnimationFrame(sim.raf); ro.disconnect(); canvas.removeEventListener('mousemove', onMove); canvas.removeEventListener('mousedown', onDown); window.removeEventListener('mousemove', onDrag); window.removeEventListener('mouseup', onUp); canvas.removeEventListener('wheel', onWheel); canvas.removeEventListener('contextmenu', onCtx) }
  }, [nodes, edges])

  return (
    <div className="me-graph" ref={wrapRef}>
      <div className="me-graph-toolbar">
        <span className="me-graph-count">{nodes.length} {t('nodes')} · {edges.length} {t('edges')}</span>
        <span className="spacer" style={{ flex: 1 }} />
        <input type="text" className="mc-btn" style={{ padding: '6px 10px', minWidth: 140 }} placeholder={t('search')} value={search} onChange={(e) => setSearch(e.target.value)} />
        <button type="button" className={`mc-btn${timeMode ? ' me-on' : ''}`} onClick={() => setTimeMode((v) => !v)}>{t('timeDim')}</button>
        <button type="button" className="mc-btn" onClick={() => { const c = canvasRef.current; if (!c) return; try { c.toBlob((blob) => { if (!blob) return; setExportData({ url: URL.createObjectURL(blob), blob }) }, 'image/png') } catch (e) { /* 预览兜底 */ } }}>{t('exportGraph')}</button>
        <button type="button" className="mc-btn" onClick={() => fitRef.current && fitRef.current()}>{t('fit')}</button>
        <button type="button" className="mc-btn" onClick={() => { setSel(null); setFilterKind('all'); resetRef.current && resetRef.current() }}>{t('reset')}</button>
      </div>
      <div className="me-graph-canvas" style={{ position: 'relative', overflow: 'hidden' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', cursor: 'grab' }} />
        <div className="me-graph-tooltip" ref={tooltipRef} style={{ display: 'none', position: 'absolute', zIndex: 4, pointerEvents: 'none', background: 'rgba(28,28,32,0.88)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', color: '#eee', borderRadius: 8, padding: '7px 10px', fontSize: 12, maxWidth: 220, boxShadow: '0 8px 24px rgba(0,0,0,.2)' }} />
        <div className="me-graph-legend" style={{ position: 'absolute', left: 12, bottom: 8, zIndex: 2 }}>
          {timeMode ? (
            [{ c: '#10b981', l: t('timeNew') }, { c: '#f59e0b', l: t('timeRecent') }, { c: '#f97316', l: t('timeMonth') }, { c: '#94a3b8', l: t('timeOld') }].map((o) => (
              <span key={o.c} className="lg"><span className="mc-kind" style={{ background: o.c }} />{o.l}</span>
            ))
          ) : Object.keys(KIND_COLORS).map((k) => (
            <button key={k} type="button" className={`lg${filterKind === k ? ' active' : ''}`} onClick={() => setFilterKind((f) => (f === k ? 'all' : k))}>
              <span className="mc-kind" style={{ background: KG.colors[k] || KIND_COLORS[k] }} />{t(KIND_LABELS[k])}
            </button>
          ))}
          {!timeMode && filterKind !== 'all' && <button type="button" className="lg lg-clear" onClick={() => setFilterKind('all')}>{t('clearFilter')} ✕</button>}
        </div>
        {noMatch && <div className="mc-empty" style={{ position: 'absolute', inset: 0, zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)' }}>{t('noMatch')}</div>}
        {ctx && <div className="me-graph-ctx-back" style={{ position: 'fixed', inset: 0, zIndex: 30 }} onMouseDown={() => setCtx(null)} />}
        {ctx && (
          <div className="me-graph-ctxmenu" style={{ position: 'fixed', left: ctx.x, top: ctx.y, zIndex: 31 }} onMouseDown={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => { onOpenRef.current({ path: ctx.path, title: ctx.title }); setCtx(null) }}>{t('openCard')}</button>
            <button type="button" onClick={() => { if (ctx.id) { simRef.current.selectedId = ctx.id; setSel(ctx.id) } setCtx(null); const s = simRef.current; if (s && s.wake) s.wake() }}>{t('focusNeighbors')}</button>
            <button type="button" onClick={() => { try { if (navigator.clipboard) navigator.clipboard.writeText(ctx.title || '') } catch (e) {} setCtx(null); notify(t('copied')) }}>{t('copyName')}</button>
            <button type="button" style={{ color: '#f87171' }} onClick={() => { const p = ctx.path; setCtx(null); if (window.confirm(t('deleteConfirm'))) { (async () => { try { const ok = onDeleteRef.current ? await onDeleteRef.current(p) : false; if (ok) { notify(t('deleted')) } else { notify(t('deleteFail'), false) } } catch (e) { notify(t('deleteFail'), false) } })() } }}>{t('delete')}</button>
          </div>
        )}
        {multi.length > 0 && (
          <div style={{ position: 'absolute', left: 10, top: 10, zIndex: 3, display: 'flex', gap: 8, alignItems: 'center', background: 'rgba(28,28,32,0.92)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', color: '#eee', borderRadius: 10, padding: '6px 10px', fontSize: 12, boxShadow: '0 10px 30px rgba(0,0,0,.25)' }}>
            <span style={{ fontWeight: 700 }}>{multi.length} {t('nodes')}</span>
            <button type="button" className="mc-btn" onClick={() => { const ns = multi.map((id) => nodeById[id]).filter(Boolean); const txt = ns.map((n) => n.title || n.name).join('\n'); const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'memory-selected.txt'; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 1000); notify(multi.length + t('exportedSel')) }}>{t('exportSel')}</button>
            <button type="button" className="mc-btn" onClick={() => { if (multi.length < 2) { notify(t('mergeNeed'), false); return } const paths = multi.map((id) => (nodeById[id] ? nodeById[id].id : id)); if (!window.confirm(t('mergeConfirm'))) return; setMulti([]); const st = simRef.current; if (st) { st.multi = [] } fetch(`${API}/merge?paths=${encodeURIComponent(paths.join(','))}`).then((r) => r.json()).then((d) => { if (d && d.ok) { notify(t('merged')) } else { notify(t('mergeFail'), false) } }).catch(() => notify(t('mergeFail'), false)) }}>{t('merge')}</button>
            <button type="button" className="mc-btn" style={{ color: '#f87171' }} onClick={() => { if (!window.confirm(t('deleteConfirm'))) return; const paths = multi.map((id) => (nodeById[id] ? nodeById[id].id : id)); setMulti([]); const s = simRef.current; if (s) { s.multi = [] } (async () => { let n = 0; for (const p of paths) { try { const ok = onDeleteRef.current ? await onDeleteRef.current(p) : false; if (ok) n++ } catch (e) {} } notify(n + t('deletedSelected'), n > 0) })() }}>{t('deleteSelected')}</button>
            <button type="button" className="mc-btn" onClick={() => { const s = simRef.current; if (s) { s.multi = [] } setMulti([]); const s2 = simRef.current; if (s2 && s2.render) s2.render() }}>{t('clearSelection')}</button>
          </div>
        )}
        {sel && <div className="me-graph-sidebar" style={{ position: 'absolute', right: 10, top: 10, zIndex: 3, maxWidth: 240, background: 'rgba(28,28,32,0.92)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', color: '#eee', borderRadius: 10, padding: 12, fontSize: 12, boxShadow: '0 10px 30px rgba(0,0,0,.25)' }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{nodeById[sel] ? (nodeById[sel].title || nodeById[sel].name) : sel}</div>
          <div style={{ opacity: .8, marginBottom: 8 }}>{nodeById[sel] ? t(KIND_LABELS[nodeById[sel].kind] || 'kindKnowledge') : '—'}</div>
          <div style={{ fontSize: 11, opacity: .65, letterSpacing: '.04em', marginBottom: 6 }}>{t('graphHint')}</div>
          {(edges.filter((e) => e.source === sel || e.target === sel) || []).slice(0, 8).map((e, i) => {
            const o = e.source === sel ? e.target : e.source
            const nn = nodeById[o]
            return <div key={i} style={{ padding: '4px 6px', cursor: 'pointer', borderRadius: 6 }} onMouseDown={(ev) => { ev.preventDefault(); const s = simRef.current; if (s) { s.selectedId = o; s.hoverId = o; if (s.wake) s.wake() } setSel(o) }}>{nn ? (nn.title || nn.name).slice(0, 28) : o}</div>
          })}
        </div>}
      </div>
      <div className="me-graph-tip">{t('graphTip')}</div>
      {toast && <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'fixed', left: '50%', transform: 'translateX(-50%)', top: 22, zIndex: 70, background: 'rgba(20,22,26,0.97)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', color: '#f5f5f5', borderRadius: 12, padding: '10px 20px', fontSize: 13.5, fontWeight: 600, boxShadow: '0 14px 44px rgba(0,0,0,.5)', pointerEvents: 'none', animation: 'me-pop .22s ease', borderLeft: '4px solid ' + (toast.ok ? '#22c55e' : '#ef4444'), maxWidth: '90vw' }}><span style={{ color: toast.ok ? '#34d399' : '#f87171', fontWeight: 800, fontSize: 15 }}>{toast.ok ? '✓' : '✕'}</span><span style={{ wordBreak: 'break-all' }}>{toast.msg}</span></div>}
      {exportData && (
        <div className="me-overlay" onClick={() => { if (exportData.url) URL.revokeObjectURL(exportData.url); setExportData(null); setExportFull(false) }}>
          <style>{CSS}</style>
          <div className="me-dialog" style={{ maxWidth: exportFull ? '100vw' : 900, width: exportFull ? '100vw' : '92vw', maxHeight: exportFull ? '100vh' : '90vh', height: exportFull ? '100vh' : undefined, borderRadius: exportFull ? 0 : 14 }} onClick={(e) => e.stopPropagation()}>
            <div className="me-dialog-head">
              <h3>{t('exportGraph')}</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <a className="mc-btn" href={exportData.url} download="memory-graph.png" onClick={() => { markDone('download'); notify(t('downloaded') + ' · ' + t('defaultDownloads')) }} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>{exportDone === 'download' ? t('done') : t('download')}</a>
                <button type="button" className="mc-btn" onClick={() => { markDone('save'); const b = exportData.blob; if (b && typeof window.showSaveFilePicker === 'function') { saveFile(b, 'memory-graph.png', true).then((r) => { if (r.ok) notify(t('exportedTo') + '：' + r.name); else if (r.aborted) notify(t('exportCancel')); else notify(t('exportFail'), false) }) } else { notify(t('saveAsUnsupported'), false) } }}>{exportDone === 'save' ? t('done') : t('saveAs')}</button>
                <button type="button" className="mc-btn" onClick={() => { markDone('full'); setExportFull((f) => !f); notify(t('fullscreen')) }}>{exportDone === 'full' ? t('done') : (exportFull ? t('exitFull') : t('fullscreen'))}</button>
                <button type="button" className="mc-btn" onClick={() => { const cb = exportData.blob; if (cb && window.ClipboardItem && navigator.clipboard) { navigator.clipboard.write([new window.ClipboardItem({ 'image/png': cb })]).then(() => { markDone('copy'); notify(t('copied')) }).catch(() => { notify(t('copyFail'), false) }) } else { notify(t('copyFail'), false) } }}>{exportDone === 'copy' ? t('done') : t('copyImage')}</button>
                <button type="button" className="mc-btn" onClick={() => { if (exportData.url) URL.revokeObjectURL(exportData.url); setExportData(null); setExportFull(false) }}>{t('close')}</button>
              </div>
            </div>
            <div className="me-dialog-body" style={{ display: 'flex', justifyContent: 'center', background: exportFull ? 'var(--dsw-alias-bg-base, #0b0d10)' : 'var(--dsw-alias-bg-base, #f3f4f6)' }}>
              <img src={exportData.url} alt={t('exportGraph')} style={{ maxWidth: '100%', maxHeight: exportFull ? 'calc(100vh - 64px)' : '70vh', borderRadius: exportFull ? 0 : 8, cursor: 'zoom-in' }} onClick={() => setExportFull((f) => !f)} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// 布局：力导向（发散、大范围）并强制最小间距；大规模（>140）用多环径向 + 最小间距。O(n)~O(n²)，几千节点不卡。
function computeLayout(nodes, edges, width, height) {
  const n = nodes.length
  if (n === 0) return []
  const minD = 42
  let pts = n > 140 ? radialLayout(nodes, edges, width, height) : forceLayout(nodes, edges, width, height)
  return enforceMinDist(pts, minD, width, height, 24)
}

// 力导向：斥力主导 + 弱弹力 + 轻向心，节点向四周发散；最后归一化铺满视口（范围更大）。
function forceLayout(nodes, edges, width, height) {
  const n = nodes.length
  if (n === 0) return []
  const iters = 260
  const init = Math.max(4, Math.sqrt(n) * 2.0)
  const pos = nodes.map((_, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2
    return { x: init * Math.cos(a), y: init * Math.sin(a) }
  })
  const vel = pos.map(() => ({ x: 0, y: 0 }))
  const adj = nodes.map(() => [])
  edges.forEach((e) => {
    const si = nodes.findIndex((x) => x.id === e.source)
    const ti = nodes.findIndex((x) => x.id === e.target)
    if (si >= 0 && ti >= 0 && si !== ti) { adj[si].push(ti); adj[ti].push(si) }
  })
  const repulse = 3.8, attract = 0.015, center = 0.01, damping = 0.86
  for (let iter = 0; iter < iters; iter++) {
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      let dx = pos[i].x - pos[j].x, dy = pos[i].y - pos[j].y
      const d2 = dx * dx + dy * dy || 0.02
      const d = Math.sqrt(d2)
      const f = repulse / d2
      const ux = dx / d, uy = dy / d
      vel[i].x += ux * f; vel[i].y += uy * f; vel[j].x -= ux * f; vel[j].y -= uy * f
    }
    for (let i = 0; i < n; i++) for (const j of adj[i]) {
      vel[i].x += (pos[j].x - pos[i].x) * attract
      vel[i].y += (pos[j].y - pos[i].y) * attract
    }
    for (let i = 0; i < n; i++) { vel[i].x -= pos[i].x * center; vel[i].y -= pos[i].y * center }
    for (let i = 0; i < n; i++) {
      vel[i].x = Math.max(-0.4, Math.min(0.4, vel[i].x * damping))
      vel[i].y = Math.max(-0.4, Math.min(0.4, vel[i].y * damping))
      pos[i].x += vel[i].x; pos[i].y += vel[i].y
    }
  }
  // 归一化铺满视口（范围更大）
  let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity
  pos.forEach((p) => { minx = Math.min(minx, p.x); maxx = Math.max(maxx, p.x); miny = Math.min(miny, p.y); maxy = Math.max(maxy, p.y) })
  const pad = 40
  const scale = Math.min((width - 2 * pad) / (maxx - minx || 1), (height - 2 * pad) / (maxy - miny || 1))
  const cx = (minx + maxx) / 2, cy = (miny + maxy) / 2
  return pos.map((p) => ({ x: width / 2 + (p.x - cx) * scale, y: height / 2 + (p.y - cy) * scale }))
}

// 多环径向：按 kind 分扇区、枢纽内圈，O(n)；供大规模（>140）使用，随后也会做最小间距处理。
function radialLayout(nodes, edges, width, height) {
  const n = nodes.length
  const cx = width / 2, cy = height / 2
  const maxR = Math.min(width, height) / 2 - 46
  const deg = {}
  edges.forEach((e) => { deg[e.source] = (deg[e.source] || 0) + 1; deg[e.target] = (deg[e.target] || 0) + 1 })
  const byKind = {}
  nodes.forEach((nd, i) => { const k = nd.kind || 'other'; (byKind[k] = byKind[k] || []).push(i) })
  const kinds = Object.keys(byKind)
  const pos = new Array(n)
  let angle = -Math.PI / 2
  const SPACING = 44, RINGSTEP = 54
  for (const kind of kinds) {
    const group = byKind[kind].sort((a, b) => (deg[nodes[b].id] || 0) - (deg[nodes[a].id] || 0))
    const span = (group.length / n) * Math.PI * 2
    const start = angle
    let placed = 0, ringIdx = 0
    while (placed < group.length && ringIdx < 60) {
      const radius = Math.min(60 + ringIdx * RINGSTEP, maxR)
      const cap = Math.max(1, Math.floor(radius * span / SPACING))
      const count = Math.min(cap, group.length - placed)
      for (let j = 0; j < count; j++) {
        const a = start + (span * (placed + j + 0.5)) / group.length
        pos[group[placed + j]] = { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) }
      }
      placed += count; ringIdx++
    }
    let guard = 0
    while (placed < group.length && guard < group.length) {
      const a = start + (span * (placed + 0.5)) / group.length
      pos[group[placed]] = { x: cx + maxR * Math.cos(a), y: cy + maxR * Math.sin(a) }
      placed++; guard++
    }
    angle += span
  }
  return pos
}

// 强制最小间距：把靠太近的点沿连线推开到 minD，最后夹在画布内 —— 保证任意两点距离 >= minD，发散不重叠。
function enforceMinDist(pts, minD, width, height, pad) {
  const n = pts.length
  const w = width || 0, h = height || 0, p = pad || 20
  const arr = pts
  for (let s = 0; s < 8; s++) {
    let moved = false
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      let dx = arr[j].x - arr[i].x, dy = arr[j].y - arr[i].y
      let d = Math.sqrt(dx * dx + dy * dy)
      if (d < minD) {
        if (d < 1e-4) { dx = Math.cos(i * 1.3 + j); dy = Math.sin(i * 0.7 + j); d = 1 }
        const push = (minD - d) / 2, ux = dx / d, uy = dy / d
        arr[i].x -= ux * push; arr[i].y -= uy * push
        arr[j].x += ux * push; arr[j].y += uy * push
        moved = true
      }
    }
    if (!moved) break
  }
  if (w && h) return arr.map((pt) => ({ x: Math.max(p, Math.min(w - p, pt.x)), y: Math.max(p, Math.min(h - p, pt.y)) }))
  return arr
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
// 时间维配色：按最后更新时间距今天数着色（新→旧）。
function recencyColor(updated) {
  const t = new Date(updated || 0).getTime()
  if (!t) return '#94a3b8'
  const days = (Date.now() - t) / 86400000
  if (days < 3) return '#10b981'
  if (days < 14) return '#f59e0b'
  if (days < 30) return '#f97316'
  return '#94a3b8'
}
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

function isNewCard(updated) { const t = new Date(updated || 0).getTime(); return !!t && (Date.now() - t) / 86400000 < 3 }

// 保存 Blob：selfPick=true 时用系统「另存为」对话框（Chromium 可用），否则默认下载。返回 {ok, picked, name}。
async function saveFile(blob, filename, selfPick) {
  if (selfPick && typeof window.showSaveFilePicker === 'function') {
    try {
      const handle = await window.showSaveFilePicker({ suggestedName: filename })
      const w = await handle.createWritable()
      await w.write(blob); await w.close()
      return { ok: true, picked: true, name: handle.name }
    } catch (e) { if (e && e.name === 'AbortError') return { ok: false, aborted: true }; return { ok: false, err: String(e.message || e) } }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return { ok: true, picked: false, name: filename }
}

// 搜索命中高亮（大小写不敏感，拆分文本并在命中处包 <mark>）。
function highlightMatches(text, q) {
  if (!q || !text) return text
  const lower = text.toLowerCase(); const ql = q.toLowerCase()
  const out = []; let i = 0
  while (i < text.length) {
    const idx = lower.indexOf(ql, i)
    if (idx < 0) { out.push(text.slice(i)); break }
    if (idx > i) out.push(text.slice(i, idx))
    out.push(<mark key={idx} className="mc-hl">{text.slice(idx, idx + ql.length)}</mark>)
    i = idx + ql.length
  }
  return out
}

// 轻量安全 Markdown 渲染：先整体 HTML 转义，再套受控标签（本地记忆文本，白名单标签 + 校验链接协议）。
function renderMd(text) {
  if (!text) return ''
  let s = String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const blocks = []
  s = s.replace(/```([\w-]*)\n([\s\S]*?)```/g, function (m, lang, code) { blocks.push('<pre><code>' + code + '</code></pre>'); return '\u0000' + (blocks.length - 1) + '\u0000' })
  s = s.replace(/^(#{1,3})\s+(.+)$/gm, function (m, h, t) { return '<h' + h.length + '>' + t + '</h' + h.length + '>' })
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>')
  s = s.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (m, txt, url) { if (!/^(https?:|\/)/.test(url)) return txt; return '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + txt + '</a>' })
  s = s.replace(/^(-)\s+(.+)$/gm, '• $2')
  s = s.replace(/^\s*(&gt;)\s*(.+)$/gm, '<blockquote>$2</blockquote>')
  s = s.replace(/\n/g, '<br/>')
  s = s.replace(/\u0000(\d+)\u0000/g, function (m, i) { return blocks[i] })
  return s
}

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
