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

export const ZH = {
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
  enterFullscreen: '全屏',
  exitFullscreen: '退出全屏',
  exportGraph: '导出',
  openCard: '打开卡片',
  focusNeighbors: '凸显关联',
  copyName: '复制名称',
  noMatch: '没有匹配的记忆',
  clearFilter: '清除过滤',
  filterLabel: '筛选',
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
  adminLoadFail: '数据加载失败：请彻底重启 dsh-desktop（host 需加载新版 /memory-eternal 路由）',
  retry: '重试',
  mergeSimilar: '一键合并相似',
  trendLabel: '近 30 天趋势',
  cleanStale: '🗑️ 一键清理陈旧',
  deletedStale: '个陈旧卡已清理',
  newCard: '新建',
  tplDecision: '📝 技术决策',
  tplBug: '🐛 踩坑',
  tplMeeting: '📋 会议纪要',
  tplWeekly: '📊 周报',
  createCard: '创建',
  cardTitle: '标题',
  cardBody: '正文',
  fbUseful: '有用',
  fbIrr: '无关',
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
  oneClickOptimize: '一键优化',
  oneClickOptimizeConfirm: '确认一键优化？将合并所有相似卡对（默认不清理陈旧卡）。',
  oneClickAlsoStale: '同时清理陈旧卡',
  oneClickOptimizeDone: '一键优化完成',
  optimizedMerged: '对已合并',
  optimizedStaleDeleted: '张陈旧卡已清理',
  mcpSetupStatus: 'Agent MCP 挂载状态',
  rerunSetup: '补全 MCP',
  notInstalled: '未安装',
  noMcpEntry: '配置缺失',
  nodePathMismatch: 'node 路径不一致，建议重跑 setup',
  nodePathNote: 'node 环境不同（可用）',
  healthy: '配置正常',
  mcpSetupHint: '「自动挂载 MCP」= 让 Claude Code / Codex / Cursor 这些工具能调用记忆库。开启后自动把它们配置好；关掉就不动你电脑上任何配置文件，需要时手动跑 dsh-memory setup。',
  mcpManageHint: '每个 agent 用下方按钮单独安装/卸载 MCP',
  tabConfig: '记忆配置',
  tabAudit: '审核中心',
  statusApproved: '已审核',
  statusPending: '待审核',
  statusRejected: '已驳回',
  allStatus: '全部状态',
  tabRecycle: '回收中心',
  pending: '待审核',
  rejected: '已驳回',
  selectAll: '全选',
  approve: '批准',
  reject: '驳回',
  allAgents: '全部智能体',
  noAuditItems: '暂无审核项目',
  deletedAt: '删除于',
  restore: '恢复',
  restoreDelete: '删除进回收站',
  purge: '永久删除',
  emptyRecycle: '回收站为空',
  recycleHint: '删除的卡片先进回收站，30 天内可恢复，超期自动永久删除',
  purgeConfirm: '确定永久删除？不可恢复。',
  recycleDeleteConfirm: '确定删除进回收站？30 天内可恢复。',
  modeInit: '启动时拉一次',
  modeInterval: '周期保活',
  modeManual: '仅手动',
  serviceConfig: '服务自管理配置',
  auditConfig: '自动审核配置',
  auditHint: '命中免审的新卡直接入库，其余进待审核',
  auditMode: '审核模式',
  auditAll: '全部要审核',
  auditNone: '全部免审',
  auditExemptAgents: '免审智能体',
  auditExemptKinds: '免审类型',
  allExempt: '全部免审',
  recycleDays: '回收保留天数',
  editInSetting: '编辑请到 DSH 设置 → 记忆',
  setupRunInTerminal: '请复制以下命令到终端执行：',
  dshMemoryConfig: 'DSH 记忆配置',
  autoCapture: '自动沉淀',
  autoRecall: '自动召回',
  captureMinChars: '捕获最小长度',
  maxCardsPerDay: '日配额',
  dedupThreshold: '去重阈值',
  recallLimit: '召回条数',
  recallSummaryLen: '召回摘要长度',
  recallBody: '召回含正文',
  autoWeb: 'Web server',
  autoWebMode: '保活模式',
  webPort: 'Web 端口',
  webCheckIntervalMs: '探活间隔(ms)',
  webMaxRestart: '最大重启次数',
  watchdogAutoSpawn: '看门狗进程',
  autoMcpSetup: '自动挂载 MCP',
  saveConfig: '保存配置',
  saveFail: '保存失败',
  savedOk: '已保存',
  recallTool: 'recall 工具',
  costControl: '成本控制',
  costHint: '省 token、控 LLM 消耗',
  distillEnabled: '蒸馏知识卡(开=LLM 压缩, 关=原文卡零 LLM)',
  dedupByLLM: '语义去重喂 LLM(关=纯词法更省)',
  captureMaxTokens: '蒸馏输出上限(token)',
  recallMinScore: '召回相关性阈值(越高越省)',
  configNeedsDsh: '配置编辑需在 DSH 内打开（本页可能只读或有部分缺失）',
  installMcp: '安装 MCP',
  uninstallMcp: '卸载 MCP',
  uninstallConfirm: '确认卸载该智能体的 MCP？Claude Code/Codex 将无法再调用记忆库。',
  presetConfig: '一键推荐配置',
  presetHint: '点击填充对应方案，点保存生效',
  planA: 'A 轻量省心',
  planB: 'B 极致省钱',
  planC: 'C 高质量',
  pluginInfo: '插件信息',
  organizeTitle: '整理建议',
  scanAndOrganize: '一键搜索和整理',
  scanHint: '点「🔍 一键搜索和整理」扫描相似卡/陈旧卡，再用「⚡ 一键优化」执行。',
  mergeNow: '合并',
  delete: '删除',
  todayBriefLabel: '每日回顾',
  todayBrief: '查看今日简报',
  batchMerge: '一键智能合并',
  mergeAllConfirm: '将按相似度分组的卡片各合并为一张（保留各自 kind），原卡删除？',
  crossVault: '跨库聚合',
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

export const EN = {
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
  enterFullscreen: 'Fullscreen',
  exitFullscreen: 'Exit fullscreen',
  exportGraph: 'Export',
  openCard: 'Open card',
  focusNeighbors: 'Highlight links',
  copyName: 'Copy name',
  noMatch: 'No matching memory',
  clearFilter: 'Clear filter',
  filterLabel: 'Filter',
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
  adminLoadFail: 'Load failed: fully restart dsh-desktop so the host picks up the new /memory-eternal routes',
  retry: 'Retry',
  mergeSimilar: 'Merge similar',
  trendLabel: 'Last 30 days trend',
  cleanStale: '🗑️ Clean stale',
  deletedStale: ' stale cards cleaned',
  newCard: 'New',
  tplDecision: '📝 Decision',
  tplBug: '🐛 Bug',
  tplMeeting: '📋 Meeting',
  tplWeekly: '📊 Weekly',
  createCard: 'Create',
  cardTitle: 'Title',
  cardBody: 'Body',
  fbUseful: 'Useful',
  fbIrr: 'Irrelevant',
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
  oneClickOptimize: 'One-click optimize',
  oneClickOptimizeConfirm: 'Confirm one-click optimize? This will merge all similar pairs (stale cards are NOT deleted by default).',
  oneClickAlsoStale: 'Also clean stale cards',
  oneClickOptimizeDone: 'One-click optimize done',
  optimizedMerged: 'pairs merged',
  optimizedStaleDeleted: 'stale cards cleaned',
  mcpSetupStatus: 'Agent MCP mount status',
  rerunSetup: 'Re-run setup',
  notInstalled: 'not installed',
  noMcpEntry: 'no MCP entry',
  nodePathMismatch: 'node path mismatch, consider re-running setup',
  nodePathNote: 'different node env (usable)',
  healthy: 'healthy',
  mcpSetupHint: '"Auto-mount MCP" = lets Claude Code / Codex / Cursor use the memory vault. On = auto-configures them; Off = never touches your machine config, run dsh-memory setup manually when needed.',
  mcpManageHint: 'Use each agent row to install/uninstall MCP individually',
  tabConfig: 'Memory Config',
  tabAudit: 'Audit Center',
  statusApproved: 'Approved',
  statusPending: 'Pending',
  statusRejected: 'Rejected',
  allStatus: 'All statuses',
  tabRecycle: 'Recycle Bin',
  pending: 'Pending',
  rejected: 'Rejected',
  selectAll: 'Select all',
  approve: 'Approve',
  reject: 'Reject',
  allAgents: 'All agents',
  noAuditItems: 'No items to review',
  deletedAt: 'deleted',
  restore: 'Restore',
  restoreDelete: 'Delete to recycle',
  purge: 'Purge',
  emptyRecycle: 'Recycle bin is empty',
  recycleHint: 'Deleted cards go to the recycle bin — recover within 30 days, else auto-purged',
  purgeConfirm: 'Permanently delete? This cannot be undone.',
  recycleDeleteConfirm: 'Delete to recycle? Recoverable within 30 days.',
  modeInit: 'Init once',
  modeInterval: 'Interval keep-alive',
  modeManual: 'Manual only',
  serviceConfig: 'Service self-hosting config',
  auditConfig: 'Auto-audit config',
  auditHint: 'Cards matching an exemption go straight in; others await audit',
  auditMode: 'Audit mode',
  auditAll: 'Audit all',
  auditNone: 'Skip all',
  auditExemptAgents: 'Exempt agents',
  auditExemptKinds: 'Exempt kinds',
  allExempt: 'Exempt all',
  recycleDays: 'Recycle retention days',
  editInSetting: 'Edit in DSH Settings → Memory',
  setupRunInTerminal: 'Copy this command to your terminal:',
  dshMemoryConfig: 'DSH Memory Config',
  autoCapture: 'Auto capture',
  autoRecall: 'Auto recall',
  captureMinChars: 'Min capture chars',
  maxCardsPerDay: 'Daily quota',
  dedupThreshold: 'Dedup threshold',
  recallLimit: 'Recall limit',
  recallSummaryLen: 'Recall summary len',
  recallBody: 'Recall with body',
  autoWeb: 'Web server',
  autoWebMode: 'Keep-alive mode',
  webPort: 'Web port',
  webCheckIntervalMs: 'Probe interval (ms)',
  webMaxRestart: 'Max restart',
  watchdogAutoSpawn: 'Watchdog process',
  autoMcpSetup: 'Auto-mount MCP',
  saveConfig: 'Save config',
  saveFail: 'Save failed',
  savedOk: 'Saved',
  recallTool: 'recall tool',
  costControl: 'Cost control',
  costHint: 'save tokens, control LLM usage',
  distillEnabled: 'Distill cards (on=LLM compress, off=raw cards zero LLM)',
  dedupByLLM: 'Dedup feeds LLM (off=pure lexical, cheaper)',
  captureMaxTokens: 'Distill output cap (tokens)',
  recallMinScore: 'Recall min score (higher = cheaper)',
  configNeedsDsh: 'Edit config inside DSH (this page may be read-only or partially missing)',
  installMcp: 'Install MCP',
  uninstallMcp: 'Uninstall MCP',
  uninstallConfirm: 'Confirm uninstall MCP for this agent? Claude Code/Codex will lose access to the memory vault.',
  presetConfig: 'One-click preset config',
  presetHint: 'Click to fill a plan, then hit Save',
  planA: 'A Light',
  planB: 'B Budget',
  planC: 'C Premium',
  pluginInfo: 'Plugin info',
  organizeTitle: 'Organize',
  scanAndOrganize: 'Scan & organize',
  scanHint: 'Click "🔍 Scan & organize" to find similar/stale cards, then "⚡ One-click optimize" to run.',
  mergeNow: 'Merge',
  delete: 'Delete',
  todayBriefLabel: 'Daily review',
  todayBrief: 'Today brief',
  batchMerge: 'Smart batch merge',
  mergeAllConfirm: 'Merge similar-grouped cards into one each (keep kind), delete originals?',
  crossVault: 'All vaults',
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
// DSH 宿主自动沉淀卡的署名（与 index.js 的 DSH_AGENT 保持一致）。
// 归一化：session:<uuid> / agent / unknown / 空 → deepseek-harness；claude-code → claude；其余取冒号前 token。
const DSH_AGENT = 'deepseek-harness'
const normAgent = (sub) => {
  const s = String(sub || '')
  const l = s.toLowerCase()
  if (!s || s === 'agent' || s === 'unknown' || s.startsWith('session:') || l.startsWith('claude-code')) {
    return l.startsWith('claude-code') ? 'claude' : DSH_AGENT
  }
  if (l === 'deepseek harness') return DSH_AGENT
  return s.split(':')[0] || DSH_AGENT
}
// 智能体筛选候选 = 恒含 DSH + 已配置外部智能体 + 卡上出现过的署名。
const KNOWN_AGENTS = [DSH_AGENT, 'claude', 'codex', 'cursor', 'codex-desktop']
const agentOptions = (existing = []) => [...new Set([...KNOWN_AGENTS, ...(existing || []).map(normAgent)])]

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
.mc-viewbar { display: flex; gap: 8px; align-items: center; margin-bottom: 12px; }
.mc-rail { width: 54px; flex: none; display: flex; flex-direction: column; gap: 8px; align-items: stretch; padding-right: 12px; border-right: 1px solid var(--dsw-alias-border-l1, #e5e7eb); transition: width 0.18s ease; }
.mc-rail.open { width: 150px; }
.mc-rail-collapse { align-self: flex-start; border: 1px solid var(--dsw-alias-border-l2, #d1d5db); background: var(--dsw-alias-bg-base, #f3f4f6); color: var(--dsw-alias-label-secondary, #6b7280); border-radius: 8px; width: 26px; height: 26px; line-height: 1; cursor: pointer; font-size: 12px; display: flex; align-items: center; justify-content: center; transition: all 0.15s ease; }
.mc-rail-collapse:hover { color: var(--dsw-alias-label-primary, #111); border-color: var(--dsw-alias-brand-primary, #3b82f6); }
.mc-railbtn { width: 100%; height: 44px; border-radius: 12px; border: 1px solid var(--dsw-alias-border-l1, #e5e7eb); background: var(--dsw-alias-bg-base, #f3f4f6); color: var(--dsw-alias-label-secondary, #6b7280); cursor: pointer; display: flex; align-items: center; gap: 9px; padding: 0 10px; font-size: 13px; font-weight: 650; transition: all 0.16s ease; }
.mc-railbtn .mc-rail-ico { font-size: 18px; flex: none; }
.mc-railbtn .mc-rail-label { white-space: nowrap; overflow: hidden; }
.mc-rail:not(.open) .mc-railbtn { justify-content: center; padding: 0; }
.mc-rail:not(.open) .mc-railbtn .mc-rail-label, .mc-rail:not(.open) .mc-rail-collapse { position: relative; }
.mc-railbtn:hover { border-color: var(--dsw-alias-brand-primary, #3b82f6); color: var(--dsw-alias-label-primary, #111); background: var(--dsw-alias-bg-layer-1, #fff); }
.mc-railbtn.active { background: #3b82f6; border-color: transparent; color: #fff; box-shadow: 0 6px 18px rgba(59,130,246,0.35); }
.mc-main { flex: 1; min-width: 0; overflow: auto; display: flex; flex-direction: column; }
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
.mc-tag { font-size: 10px; padding: 1px 7px; border-radius: 999px; background: var(--dsw-alias-border-l2, #d1d5db); opacity: 1; color: var(--dsw-alias-label-primary, #1f2937); }
.mc-status { display: inline-block; margin-left: 7px; padding: 1px 7px; border-radius: 999px; font-size: 10px; line-height: 16px; font-weight: 600; color: #fff; vertical-align: middle; }
.mc-kind { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 6px; }
.mc-empty { text-align: center; padding: 40px 10px; opacity: 0.6; font-size: 13px; }
.mc-flag { font-size: 11px; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--dsw-alias-border-l2, #d1d5db); margin-left: 6px; }

/* ---- sidebar footer button ---- */
/* 让「记忆」按钮独占一行：让容器可换行，本按钮 flex-basis:100% 占满整行。
   同时命中「footerActions 直接包含」与「中间隔一层 wrapper」两种情况（:has 在 WebView2/Chromium 均支持）。 */
[class*="footerActions"]:has(.me-footer), :has(> .me-footer) { flex-wrap: wrap; width: 100%; }
.me-footer { width: 100%; flex: 1 1 100%; }
.me-footer-btn { display: flex; align-items: center; gap: 9px; width: 100%; padding: 7px 10px; border: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.14)); background: var(--dsw-alias-bg-layer-1, rgba(255,255,255,0.04)); color: var(--dsw-alias-label-secondary, #6b7280); font: inherit; font-size: 13.5px; line-height: 18px; border-radius: 8px; cursor: pointer; text-align: left; }
.me-footer-btn:hover { background: var(--dsw-alias-bg-layer-1, rgba(255,255,255,0.06)); color: var(--dsw-alias-label-primary, #111); }
.me-footer-btn:active { transform: translateY(0.5px); }
.me-footer-ico { display: inline-flex; flex: none; width: 18px; height: 18px; align-items: center; justify-content: center; }
.me-footer-ico svg { width: 18px; height: 18px; }
.me-footer-label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.me-footer.rail .me-footer-btn { justify-content: center; padding: 7px 0; }
.me-footer.rail .me-footer-label { display: none; }

/* ---- full library modal ---- */
.me-overlay-top { position: fixed; inset: 0; z-index: 1001; background: rgba(0,0,0,0.72); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; padding: 28px; }
.me-modal { width: min(1380px, 98vw); height: min(98vh, 1080px); display: flex; flex-direction: column; background: var(--dsw-alias-bg-layer-1, #1e232c); color: var(--dsw-alias-label-primary, #e5e7eb); border: 1px solid var(--dsw-alias-border-l1, #2c333c); border-radius: 18px; box-shadow: 0 34px 90px rgba(0,0,0,0.6); overflow: hidden; animation: me-pop 0.22s cubic-bezier(0.2,0.8,0.2,1); }
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
.me-modal-body { flex: 1; padding: 18px 20px; overflow: hidden; display: flex; }
.me-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.66); z-index: 1002; display: flex; align-items: center; justify-content: center; padding: 24px; }
.me-dialog { background: var(--dsw-alias-bg-layer-1, #1e232c); color: var(--dsw-alias-label-primary, #e5e7eb); border-radius: 14px; max-width: 760px; width: 100%; max-height: 84vh; display: flex; flex-direction: column; box-shadow: 0 24px 60px rgba(0,0,0,0.5); border: 1px solid var(--dsw-alias-border-l1, #2c333c); }
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
.me-graph { display: flex; flex-direction: column; gap: 8px; flex: 1; min-height: 0; }
.me-graph-toolbar { display: flex; align-items: center; gap: 8px; }
.me-graph-toolbar input[type=text] { flex: 1; min-width: 180px; padding: 7px 10px; border-radius: 8px; border: 1px solid var(--dsw-alias-border-l2, #d1d5db); background: var(--dsw-alias-bg-base, #f9fafb); color: inherit; font-size: 13px; }
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
/* 图谱筛选下拉：选项深色底浅字，避免白卡片刺眼 */
.me-graph-legend-pop { color: #e5e7eb; }
.me-graph-legend-pop .lg { width: 100%; background: rgba(255,255,255,0.06); color: #e5e7eb; padding: 7px 9px; margin-bottom: 2px; border-radius: 7px; }
.me-graph-legend-pop .lg:hover { background: rgba(255,255,255,0.14); }
.me-graph-legend-pop .lg.active { background: rgba(59,130,246,0.32); color: #fff; box-shadow: 0 0 0 1px rgba(59,130,246,0.5); }
.me-graph-legend-pop .lg.lg-clear { color: #f87171; }
.me-graph-ctxmenu { min-width: 156px; padding: 6px; background: rgba(28,28,32,0.95); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); color: #eee; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; box-shadow: 0 12px 34px rgba(0,0,0,.3); font-size: 12px; }
.me-graph-ctxmenu button { display: block; width: 100%; text-align: left; padding: 7px 10px; border: none; border-radius: 7px; background: transparent; color: inherit; font: inherit; cursor: pointer; }
.me-graph-ctxmenu button:hover { background: rgba(255,255,255,0.1); }
.me-graph-hint { font-size: 11px; opacity: 0.6; margin-left: auto; }
`

export function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh: ZH, en: EN }), 'memory-eternal: locale')
  const t = ctx.locale.bind(NS)

  // 设置 → 记忆：顶部「可编辑配置」+ 下方记忆库浏览（同源 DSH host）
  //   - 配置表单内嵌 ConfigPanel（DSH 设置页即 DSH host 同源 → /config 可读写）
  //   - 记忆库用 iframe 加载独立 web（浏览）
  ctx.effect(() => ctx.slots.inject('settings.section', () => ctx.slots.register(
    { name: 'settings.section', id: NS, order: 25, label: () => t('nav'), locale: NS, inject: () => ({}) },
    () => React.createElement(SettingSection, { t }),
  )), 'memory-eternal: settings section')

  // 侧边栏底部 footer：「记忆」按钮 → 弹窗内嵌 web 端（记忆配置已并入记忆视图，左栏⚙ 可开）
  ctx.effect(() => ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register(
    { name: 'sidebar.footer.action', id: `${NS}:footer`, order: 100, label: () => t('nav'), locale: NS, inject: () => ({}) },
    (props) => React.createElement(MemoryFooterButton, { t, wide: !(props && props.wide === false) }),
  )), 'memory-eternal: sidebar footer action')
}

// -- Web 端 iframe 壳 ----------------------------------------------------------

/** 从 host 拿 web server 地址（失败回退默认端口）。 */
function useWebUrl() {
  const [url, setUrl] = useState('http://127.0.0.1:7999/')
  useEffect(() => {
    fetch('/memory-eternal/api/web-info')
      .then((r) => r.json())
      .then((d) => {
        if (d && d.ok && d.url) setUrl(d.url.endsWith('/') ? d.url : d.url + '/')
      })
      .catch(() => {})
  }, [])
  return url
}

/** 设置 → 记忆 左栏整页：仅记忆配置（同源 DSH host 可写），不含记忆库浏览。 */
function SettingSection({ t }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <style>{CSS}</style>
      <ConfigPanel t={t} onReload={() => {}} version={0} />
    </div>
  )
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
      {open && <WebModal t={t} onClose={() => setOpen(false)} />}
    </div>
  )
}

/** 侧边栏底部「⚙ 配置」按钮 → 弹窗内嵌 web 配置视图（?tab=config）。 */
/** 全屏弹窗内嵌 web 端（渲染走 web，与浏览器访问同一份 UI）。可选 tab 指定初始视图。 */
function WebModal({ t, onClose, tab }) {
  const [full, setFull] = useState(false)
  const base = useWebUrl()
  // tab=config 走 DSH host 同源配置页（/memory-eternal/ui/config），保证 /config API 同源可读写；
  // 其他 tab 走独立 web server。
  const url = tab === 'config'
    ? `${API}/ui/config?tab=config`
    : tab ? `${base.replace(/\/$/, '')}/?tab=${tab}` : base
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="me-overlay-top" onClick={onClose}>
      <style>{CSS}</style>
      <div className="me-modal" onClick={(e) => e.stopPropagation()} style={full ? { position: 'fixed', inset: 0, width: '100vw', height: '100vh', maxWidth: '100vw', maxHeight: '100vh', borderRadius: 0 } : {}}>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, position: 'relative' }}>
          {/* 右上角控制条：全屏 toggle + 关闭。浮在 iframe 上方，半透明背景。 */}
          <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 10, display: 'flex', gap: 4, padding: '4px 6px', background: 'var(--dsw-alias-bg-overlay, rgba(17,24,39,0.45))', borderRadius: 8, backdropFilter: 'blur(4px)' }}>
            <button type="button" onClick={() => setFull((f) => !f)} aria-label={full ? t('exitFullscreen') : t('enterFullscreen')} title={full ? t('exitFullscreen') : t('enterFullscreen')} style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.08)', color: '#fff', cursor: 'pointer', fontSize: 14, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{full ? '⤡' : '⤢'}</button>
            <button type="button" onClick={onClose} aria-label={t('close')} title={t('close')} style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.08)', color: '#fff', cursor: 'pointer', fontSize: 16, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>
          <iframe src={url} title="memory-eternal" style={{ width: '100%', flex: 1, border: 0, borderRadius: 'inherit', background: 'var(--dsw-alias-bg-base, #fff)' }} />
        </div>
      </div>
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

// -- Shared library content (inline settings page + modal) ------------------

export function MemoryLibrary({ t, inModal, onClose, onFull, full }) {
  const [overview, setOverview] = useState(null)
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [kind, setKind] = useState('all')
  const [query, setQuery] = useState('')
  const [agentFilter, setAgentFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  // 'cards' | 'graph' | 'stats' | 'audit' | 'optimize' | 'config'
  const [view, setView] = useState(() => {
    try {
      const tab = new URLSearchParams(typeof location !== 'undefined' ? location.search : '').get('tab')
      const map = { cards: 'cards', graph: 'graph', usage: 'stats', stats: 'stats', audit: 'audit', recycle: 'optimize', optimize: 'optimize', config: 'config' }
      if (tab && map[tab]) return map[tab] // 深链：?tab=audit / config / graph / usage / recycle
    } catch {}
    return 'cards'
  })
  const [sort, setSort] = useState('recent') // 'recent' | 'title' | 'hot'
  const [libToast, setLibToast] = useState(null)
  const libToastTimer = useRef(null)
  const importRef = useRef(null)
  const [exporting, setExporting] = useState(false)
  const [reader, setReader] = useState(null)
  const [allVaults, setAllVaults] = useState(false)
  const [railOpen, setRailOpen] = useState(true)
  const [newCard, setNewCard] = useState(null)
  const [dataVer, setDataVer] = useState(0)
  const bump = useCallback(() => setDataVer((v) => v + 1), [])
  const searchTimer = useRef(null)
  const [visibleCount, setVisibleCount] = useState(100)
  const sentinelRef = useRef(null)
  const mainRef = useRef(null)

  // 无限滚动：滚动到底部哨兵进入视口时再加载一批。root 指向实际滚动容器(.mc-main)，
  // 否则 IntersectionObserver 默认 viewport 基准在内部滚动容器里判定失效，导致不触发。
  useEffect(() => {
    if (view !== 'cards') return
    const el = sentinelRef.current
    const root = mainRef.current
    if (!el) return
    const io = new IntersectionObserver((entries) => { if (entries[0] && entries[0].isIntersecting) setVisibleCount((v) => v + 24) }, { root: root || null, rootMargin: '400px' })
    io.observe(el)
    return () => io.disconnect()
  }, [view, cards, kind, query])

  const loadCards = useCallback(async (nextKind = kind, nextQuery = query, nextStatus = statusFilter) => {
    try {
      setLoading(true)
      setError('')
      const qs = new URLSearchParams()
      if (nextKind && nextKind !== 'all') qs.set('kind', nextKind)
      if (nextQuery.trim()) qs.set('q', nextQuery.trim())
      qs.set('status', nextStatus || 'all')
      qs.set('limit', '500')
      const res = await fetch(`${API}/cards?${qs.toString()}`)
      const data = await res.json()
      if (data.ok) { setCards(data.cards || []); setVisibleCount(100) }
    } catch (e) {
      setError(String(e && e.message ? e.message : e))
    } finally {
      setLoading(false)
    }
  }, [kind, query, statusFilter])

  const loadAll = useCallback(async () => {
    try {
      const [ov, cardsRes] = await Promise.all([
        fetch(`${API}/overview`).then((r) => r.json()),
        fetch(`${API}/cards?status=all&limit=500`).then((r) => r.json()),
      ])
      if (ov.ok) setOverview(ov)
      if (cardsRes.ok) { setCards(cardsRes.cards || []); setVisibleCount(100) }
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
    searchTimer.current = setTimeout(() => loadCards(kind, value, statusFilter), 280)
  }

  const onKind = (k) => {
    setKind(k)
    loadCards(k, query, statusFilter)
  }

  // 状态筛选变更 → 按该状态重新拉取（pending/rejected 走 /cards?status=）
  useEffect(() => { loadCards(kind, query, statusFilter) }, [statusFilter])

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
      const r = await saveFile(blob, name, false)
      if (!r.ok) { setLibToast({ ok: false, msg: t('exportFail') }); setExporting(false); return }
      setLibToast({ ok: true, msg: t('exportedTo') + '：' + t('defaultDownloads') + ' · ' + r.name })
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
    let arr = cards.slice()
    if (agentFilter !== 'all') arr = arr.filter((c) => normAgent(c.submittedBy) === agentFilter)
    if (statusFilter !== 'all') arr = arr.filter((c) => (c.status || 'approved') === statusFilter)
    if (sort === 'title') arr.sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')))
    else if (sort === 'hot') arr.sort((a, b) => ((b.weight || b.links || 0) - (a.weight || a.links || 0)))
    else arr.sort((a, b) => (new Date(b.updated || 0).getTime() - new Date(a.updated || 0).getTime()))
    return arr
  }, [cards, sort, agentFilter, statusFilter])
  const cardAgents = useMemo(() => [...new Set(cards.map((c) => normAgent(c.submittedBy)))], [cards])

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
          {onFull && <button type="button" className="me-modal-close" onClick={onFull} aria-label={full ? t('exitFull') : t('fullscreen')}>{full ? '❐' : '⛶'}</button>}
          <button type="button" className="me-modal-close" onClick={onClose} aria-label={t('close')}>✕</button>
        </div>
      )}
      <div className="me-modal-body">
        <div className={`mc-rail${railOpen ? ' open' : ''}`}>
          <button type="button" className="mc-rail-collapse" onClick={() => setRailOpen((v) => !v)} aria-label={railOpen ? t('collapse') : t('expand')} title={railOpen ? t('collapse') : t('expand')}>{railOpen ? '«' : '»'}</button>
          <button type="button" className={`mc-railbtn${view === 'cards' ? ' active' : ''}`} onClick={() => setView('cards')} title={t('cardsTab')}>
            <span className="mc-rail-ico">📇</span>
            {railOpen && <span className="mc-rail-label">{t('cardsTab')}</span>}
          </button>
          <button type="button" className={`mc-railbtn${view === 'graph' ? ' active' : ''}`} onClick={() => setView('graph')} title={t('graphTab')}>
            <span className="mc-rail-ico">🕸</span>
            {railOpen && <span className="mc-rail-label">{t('graphTab')}</span>}
          </button>
          <button type="button" className={`mc-railbtn${view === 'stats' ? ' active' : ''}`} onClick={() => setView('stats')} title={t('tabUsage')}>
            <span className="mc-rail-ico">📊</span>
            {railOpen && <span className="mc-rail-label">{t('tabUsage')}</span>}
          </button>
          <button type="button" className={`mc-railbtn${view === 'audit' ? ' active' : ''}`} onClick={() => setView('audit')} title={t('tabAudit')}>
            <span className="mc-rail-ico">🛡️</span>
            {railOpen && <span className="mc-rail-label">{t('tabAudit')}</span>}
          </button>
          <button type="button" className={`mc-railbtn${view === 'optimize' ? ' active' : ''}`} onClick={() => setView('optimize')} title={t('tabRecycle')}>
            <span className="mc-rail-ico">🗑️</span>
            {railOpen && <span className="mc-rail-label">{t('tabRecycle')}</span>}
          </button>
          <button type="button" className={`mc-railbtn${view === 'config' ? ' active' : ''}`} onClick={() => setView('config')} title={t('tabConfig')}>
            <span className="mc-rail-ico">⚙️</span>
            {railOpen && <span className="mc-rail-label">{t('tabConfig')}</span>}
          </button>
        </div>
        <div className="mc-main" ref={mainRef}>
        {view === 'cards' && (
        <div className="mc-stats">
          <StatCell label={t('total')} value={overview ? overview.total : '—'} />
          <StatCell label={t('recent')} value={overview ? overview.recent : '—'} />
          <StatCell label={t('tags')} value={overview ? overview.tags : '—'} />
          <StatCell label={t('pending')} value={overview?.status?.pending ?? 0} />
          <StatCell label={t('rejected')} value={overview?.status?.rejected ?? 0} />
          <StatCell label={t('cardCount')} value={overview ? overview.byKind?.knowledge ?? 0 : '—'} />
        </div>
        )}

        {view === 'cards' && (
          <div className="mc-toolbar">
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={query}
              onChange={(e) => onSearch(e.target.value)}
            />
            <input ref={importRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={importVault} />
            <button type="button" className="mc-btn" onClick={() => importRef.current && importRef.current.click()}>{t('importVault')}</button>
            <button type="button" className="mc-btn me-on" onClick={() => setNewCard({ kind: 'knowledge', title: '', body: '', tags: '', template: '' })}>+ {t('newCard')}</button>
            <button type="button" className="mc-btn" disabled={exporting} onClick={() => exportVault('md')}>{exporting ? t('exporting') : t('exportVault')}</button>
            <button type="button" className="mc-btn" disabled={exporting} onClick={() => exportVault('json')}>{exporting ? t('exporting') : t('exportJson')}</button>
            <button type="button" className="mc-btn" onClick={() => loadAll()}>{t('refresh')}</button>
          </div>
        )}

        {view === 'cards' && (
          <div className="mc-chips">
            {KIND_IDS.map((k) => (
              <button key={k} type="button" className={`mc-chip${kind === k ? ' active' : ''}`} onClick={() => onKind(k)}>
                {k === 'all' ? t('all') : t(KIND_LABELS[k])}
              </button>
            ))}
            <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} style={{ fontSize: 12, padding: '4px 8px', borderRadius: 8, background: 'var(--dsw-alias-bg-layer-1, #fff)', color: 'inherit', border: '1px solid var(--dsw-alias-border-l2, #d1d5db)' }}>
              <option value="all">🤖 {t('allAgents')}</option>
              {agentOptions(cardAgents).map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ fontSize: 12, padding: '4px 8px', borderRadius: 8, background: 'var(--dsw-alias-bg-layer-1, #fff)', color: 'inherit', border: '1px solid var(--dsw-alias-border-l2, #d1d5db)' }}>
              <option value="all">{t('allStatus')}</option>
              <option value="approved">{t('statusApproved')}</option>
              <option value="pending">{t('statusPending')}</option>
              <option value="rejected">{t('statusRejected')}</option>
            </select>
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
        ) : view === 'graph' ? (
          <GraphView t={t} onOpen={openCard} all={allVaults} onAllChange={setAllVaults} onMutate={bump} />
        ) : view === 'config' ? (
          <ConfigPanel t={t} onReload={() => loadAll()} version={dataVer} />
        ) : view === 'stats' ? (
          <LibraryAdmin t={t} tab="stats" onReload={() => loadAll()} version={dataVer} />
        ) : view === 'audit' ? (
          <AuditPanel t={t} onReload={() => loadAll()} version={dataVer} />
        ) : view === 'optimize' ? (
          <RecoverPanel t={t} onReload={() => loadAll()} version={dataVer} />
        ) : (
          <LibraryAdmin t={t} tab="stats" onReload={() => loadAll()} version={dataVer} />
        )}

        {reader && <CardReader t={t} card={reader} query={query.trim()} onClose={() => setReader(null)} onDelete={(p) => { setReader(null); deleteMemory(p) }} onFeedback={(useful) => { const p = reader.path; fetch(`${API}/feedback`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: query.trim(), path: p, useful }) }).then(() => setLibToast({ ok: true, msg: useful ? t('fbUseful') : t('fbIrr') })).catch(() => {}); if (libToastTimer.current) clearTimeout(libToastTimer.current); libToastTimer.current = setTimeout(() => setLibToast(null), 2000) }} />}
        <NewCardModal t={t} newCard={newCard} setNewCard={setNewCard} onCreated={() => { loadAll(); bump(); setLibToast({ ok: true, msg: t('created') }); if (libToastTimer.current) clearTimeout(libToastTimer.current); libToastTimer.current = setTimeout(() => setLibToast(null), 2000) }} />
        </div>
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

/** DSH 设置→记忆 左栏配置面板：插件信息 + Agent MCP 挂载状态 + 全部配置项（一键推荐 / DSH 记忆配置 / 成本控制 / 自动审核配置 / 服务自管理配置 / 保存）。 */
function ConfigPanel({ t, onReload, version, compact }) {
  const [cfg, setCfg] = useState(null)
  const [revision, setRevision] = useState(0)
  const [schema, setSchema] = useState(null)
  const [form, setForm] = useState(null)
  const [readonly, setReadonly] = useState(false)
  const [dsh, setDsh] = useState(null)
  const [setupStatus, setSetupStatus] = useState(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState('')
  const [saved, setSaved] = useState('')
  const [runSetup, setRunSetup] = useState('')
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)
  const notify = (msg, ok = true) => { if (toastTimer.current) clearTimeout(toastTimer.current); setToast({ msg, ok }); toastTimer.current = setTimeout(() => setToast(null), 1900) }
  const load = useCallback(async () => {
    try {
      const [c, ss, b] = await Promise.all([
        fetch(`${API}/config`).then((r) => r.json()).catch(() => null),
        fetch(`${API}/setup-status`).then((r) => r.json()).catch(() => null),
        fetch(`${API}/budget`).then((r) => r.json()).catch(() => null),
      ])
      if (c && c.ok) {
        setCfg(c)
        setRevision(c.revision ?? 0)
        setSchema(c.schema ?? null)
        setForm({ ...(c.config ?? {}) })
        setDsh(c.dsh ?? null)
        setReadonly(c.writable === false)
        setErr('')
      } else {
        // /config 不可用（如独立 web server 7999 无 DSH settings）：降级用 /budget 展示 + 提示
        if (b && b.ok) {
          setForm({ ...b })
          setReadonly(true)
          setErr(t('configNeedsDsh'))
        } else {
          setErr(t('adminLoadFail'))
        }
      }
      if (ss && ss.ok) setSetupStatus(ss)
      setSaved('')
    } catch (e) { setErr(t('adminLoadFail')) }
  }, [t])
  useEffect(() => { load() }, [version, load])
  const set = (k, v) => setForm((f) => ({ ...(f ?? {}), [k]: v }))
  const autoWebModeLabel = (m) => ({ init: t('modeInit'), interval: t('modeInterval'), manual: t('modeManual') }[m] || m)
  const save = async () => {
    if (!form) return
    if (readonly) { notify(t('editInSetting'), false); return }
    setBusy('save')
    try {
      const r = await fetch(`${API}/config`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ patch: form, expectedRevision: revision }) })
      const d = await r.json()
      if (d && d.ok) { const m = d.note || t('savedOk'); setSaved(t('savedOk') + (d.note ? ` · ${d.note}` : '')); notify(m); await load() }
      else { setErr(d?.error || t('saveFail')); notify(d?.error || t('saveFail'), false) }
    } catch { setErr(t('saveFail')); notify(t('saveFail'), false) }
    finally { setBusy('') }
  }
  const resetForm = () => { setForm({ ...(cfg?.config ?? {}) }); setSaved('') }
  // 三套推荐方案值（A轻量/B省钱/C高质量）——一键填充表单
  const PLANS = {
    A: { label: t('planA'), autoWebMode: 'init', watchdogAutoSpawn: false, distillEnabled: true, dedupByLLM: true, captureMaxTokens: 900, recallMinScore: 2, recallLimit: 5, recallSummaryLen: 130, recallIncludeBody: false, captureCooldownMs: 300000 },
    B: { label: t('planB'), autoWebMode: 'init', watchdogAutoSpawn: false, distillEnabled: false, dedupByLLM: false, captureMaxTokens: 500, recallMinScore: 3, recallLimit: 3, recallSummaryLen: 80, recallIncludeBody: false, captureMinChars: 300, maxCardsPerDay: 40, captureCooldownMs: 300000 },
    C: { label: t('planC'), autoWebMode: 'interval', watchdogAutoSpawn: true, distillEnabled: true, dedupByLLM: true, captureMaxTokens: 1200, recallMinScore: 1, recallLimit: 8, recallSummaryLen: 200, recallIncludeBody: true, captureCooldownMs: 120000 },
  }
  const applyPlan = async (key) => {
    const plan = PLANS[key]
    if (!plan) return
    setForm((f) => ({ ...(f ?? {}), ...plan }))
  }
  // 单智能体安装/卸载 MCP：POST /mcp/action，操作后刷新状态
  const mcpAction = async (agent, action) => {
    setBusy(agent + action)
    try {
      const r = await fetch(`${API}/mcp/action`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agent, action }) })
      const d = await r.json()
      if (d && d.ok) notify(action === 'install' ? `✅ ${agent} MCP 已安装` : `✅ ${agent} MCP 已卸载`)
      else notify(`❌ ${agent} MCP 操作失败：${d?.error || ''}`, false)
      try { const s = await fetch(`${API}/setup-status`).then((x) => x.json()); if (s && s.ok) setSetupStatus(s) } catch {}
    } catch { notify(t('mergeFail'), false) }
    finally { setBusy('') }
  }
  const F = ({ k, label, type = 'text', step, min, max }) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12 }}>
      <span style={{ opacity: 0.6 }}>{label || k}</span>
      <input
        type={type}
        step={step} min={min} max={max}
        value={form ? (form[k] ?? '') : ''}
        onChange={(e) => set(k, type === 'number' ? Number(e.target.value) : e.target.value)}
        style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2, #d1d5db)', background: 'var(--dsw-alias-bg-layer-1, #fff)', color: 'inherit', fontSize: 12 }}
      />
    </label>
  )
  const Bool = ({ k, label }) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
      <input type="checkbox" checked={!!(form&&form[k])} onChange={(e) => set(k, e.target.checked)} />
      <span>{label || k}</span>
    </label>
  )
  return (
    <div className="mc-admin" style={{ display: 'flex', flexDirection: 'column', overflow: 'auto', flex: compact ? '0 0 auto' : 1, minHeight: 0, maxHeight: compact ? '52vh' : undefined }}>
      <style>{CSS}</style>
      {toast && <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'fixed', left: '50%', transform: 'translateX(-50%)', top: 22, zIndex: 70, background: 'rgba(20,22,26,0.97)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', color: '#f5f5f5', borderRadius: 12, padding: '10px 20px', fontSize: 13.5, fontWeight: 600, boxShadow: '0 14px 44px rgba(0,0,0,.5)', pointerEvents: 'none', animation: 'me-pop .22s ease', borderLeft: '4px solid ' + (toast.ok ? '#22c55e' : '#ef4444'), maxWidth: '90vw' }}><span style={{ color: toast.ok ? '#34d399' : '#f87171', fontWeight: 800, fontSize: 15 }}>{toast.ok ? '✓' : '✕'}</span><span style={{ wordBreak: 'break-all' }}>{toast.msg}</span></div>}
      <div style={{ overflow: 'auto', padding: 4 }}>
        {err && <div className="mc-card" style={{ borderLeft: '4px solid #ef4444', background: 'rgba(239,68,68,0.08)', padding: '12px 14px', marginBottom: 10 }}>
          <div style={{ fontSize: 13, color: '#b91c1c', fontWeight: 600, marginBottom: 6 }}>⚠ {err}</div>
          <button type="button" className="mc-btn" onClick={load}>↻ {t('retry')}</button>
        </div>}
        {readonly && <div className="mc-card" style={{ borderLeft: '4px solid #f59e0b', background: 'rgba(245,158,11,0.08)', padding: '10px 14px', marginBottom: 10, fontSize: 12, color: '#b45309' }}>ℹ️ {t('configNeedsDsh')} —— {t('editInSetting')}</div>}
        {saved && <div className="mc-card" style={{ borderLeft: '4px solid #10b981', background: 'rgba(16,185,129,0.08)', padding: '10px 14px', marginBottom: 10, fontSize: 12, color: '#059669' }}>✓ {saved}</div>}
        {/* 插件信息：版本 + 记忆库目录 */}
        {(cfg && (cfg.version || cfg.dsh?.vaultDir)) && (
          <div className="mc-card" style={{ marginBottom: 10, padding: '10px 14px', display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <b style={{ fontSize: 12 }}>📦 {t('pluginInfo')}</b>
            <span style={{ fontSize: 12, opacity: 0.7 }}>{cfg.dsh?.label || t('nav')}</span>
            {cfg.version && <code style={{ fontSize: 11, padding: '2px 8px', background: 'var(--dsw-alias-bg-layer-2, #f3f4f6)', borderRadius: 6 }}>v{cfg.version}</code>}
            {cfg.dsh?.vaultDir && <span style={{ fontSize: 11, opacity: 0.6 }}>📁 {cfg.dsh.vaultDir}</span>}
          </div>
        )}
        {/* DSH / Agent 状态面板（含 DSH 宿主行） */}
        {setupStatus && setupStatus.agents && (
          <div className="mc-card" style={{ marginBottom: 10, padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <b style={{ fontSize: 12 }}>🔌 {t('mcpSetupStatus')}</b>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 11, opacity: 0.6 }}>{t('mcpManageHint')}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {setupStatus.agents.map((a) => (
                <div key={a.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <span style={{ flex: 1 }}>
                    <b>{a.isDsh ? (a.label || 'DeepSeek Harness') : a.name}</b>
                    {a.isDsh && a.version && <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.5 }}>v{a.version}</span>}
                    {!a.installed && <span style={{ marginLeft: 6, opacity: 0.6 }}>({t('notInstalled')})</span>}
                    {a.installed && a.mcpConfigured === false && <span style={{ marginLeft: 6, color: '#f59e0b' }}>({t('noMcpEntry')})</span>}
                    {a.mcpConfigured === true && <span style={{ marginLeft: 6, color: '#10b981' }}>✓ {t('healthy')}</span>}
                    {a.mcpConfigured === true && a.mcpMatchesCurrentNode === false && <span style={{ marginLeft: 6, color: '#9ca3af', fontSize: 10 }}>({t('nodePathNote')})</span>}
                    {a.isDsh && <span style={{ marginLeft: 6, opacity: 0.6, fontSize: 11 }}>({t('recallTool')}: {a.recallTool ? t('enabled') : t('disabled')})</span>}
                  </span>
                  {a.hook && <span style={{ fontSize: 11, opacity: 0.7 }}>hook: {a.hook}</span>}
                  {!a.isDsh && a.installed && a.mcpConfigured === false && (
                    <button type="button" className="mc-btn" style={{ padding: '2px 8px' }} disabled={!!busy} onClick={() => mcpAction(a.name, 'install')}>{t('installMcp')}</button>
                  )}
                  {!a.isDsh && a.installed && a.mcpConfigured === true && (
                    <button type="button" className="mc-btn" style={{ padding: '2px 8px', color: '#f87171' }} disabled={!!busy} onClick={() => { if (window.confirm(t('uninstallConfirm'))) mcpAction(a.name, 'uninstall') }}>{t('uninstallMcp')}</button>
                  )}
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, opacity: 0.55, marginTop: 6 }}>{t('mcpSetupHint')}</div>
            {runSetup && <div style={{ fontSize: 11, marginTop: 6 }}><code style={{ padding: '2px 6px', background: 'var(--dsw-alias-bg-layer-2, #f3f4f6)', borderRadius: 4 }}>{runSetup}</code></div>}
          </div>
        )}
        {/* 可编辑配置表单 */}
        {form ? (
          <>
            {/* 一键推荐配置：三方案填充 */}
            <div className="mc-card" style={{ marginBottom: 10, padding: '12px 14px', borderLeft: '3px solid #3b82f6' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                <b style={{ fontSize: 12 }}>🎯 {t('presetConfig')}</b>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 11, opacity: 0.6 }}>{t('presetHint')}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['A', 'B', 'C'].map((k) => (
                  <button key={k} type="button" className="mc-btn" onClick={() => applyPlan(k)} disabled={!!busy}>
                    {k === 'A' ? '🟢 ' : k === 'B' ? '💰 ' : '⭐ '}{PLANS[k].label}
                  </button>
                ))}
              </div>
            </div>
            {/* DSH 记忆配置 */}
            <div className="mc-card" style={{ marginBottom: 10, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <b style={{ fontSize: 12 }}>🧠 {t('dshMemoryConfig')}</b>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
                <Bool k="autoCapture" label={t('autoCapture')} />
                <Bool k="autoRecall" label={t('autoRecall')} />
                <F k="captureMinChars" label={t('captureMinChars')} type="number" />
                <F k="maxCardsPerDay" label={t('maxCardsPerDay')} type="number" />
                <F k="dedupThreshold" label={t('dedupThreshold')} type="number" step="0.01" min="0" max="1" />
                <F k="recallLimit" label={t('recallLimit')} type="number" />
                <F k="recallSummaryLen" label={t('recallSummaryLen')} type="number" />
                <Bool k="recallIncludeBody" label={t('recallBody')} />
              </div>
            </div>
            {/* 成本控制（省钱、控 LLM 消耗） */}
            <div className="mc-card" style={{ marginBottom: 10, padding: '12px 14px', borderLeft: '3px solid #f59e0b' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <b style={{ fontSize: 12 }}>💰 {t('costControl')}</b>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 11, opacity: 0.6 }}>{t('costHint')}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8, marginTop: 6 }}>
                <Bool k="distillEnabled" label={t('distillEnabled')} />
                <Bool k="dedupByLLM" label={t('dedupByLLM')} />
                <F k="captureMaxTokens" label={t('captureMaxTokens')} type="number" />
                <F k="recallMinScore" label={t('recallMinScore')} type="number" />
              </div>
            </div>
            {/* 自动审核配置 */}
            <div className="mc-card" style={{ marginBottom: 10, padding: '12px 14px', borderLeft: '3px solid #8b5cf6' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <b style={{ fontSize: 12 }}>🛡️ {t('auditConfig')}</b>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 11, opacity: 0.6 }}>{t('auditHint')}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12 }}>
                  <span style={{ opacity: 0.6 }}>{t('auditMode')}</span>
                  <select value={form.auditMode ?? 'all'} onChange={(e) => set('auditMode', e.target.value)} style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2, #d1d5db)', background: 'var(--dsw-alias-bg-layer-1, #fff)', color: 'inherit', fontSize: 12 }}>
                    <option value="all">{t('auditAll')}</option>
                    <option value="none">{t('auditNone')}</option>
                  </select>
                </label>
                <MultiDD
                  label={t('auditExemptAgents')}
                  value={form.auditExemptAgents || []}
                  options={[{ value: '__all__', label: t('allExempt') }, ...(setupStatus?.agents || []).filter((a) => !a.isDsh).map((a) => ({ value: a.name, label: a.name }))]}
                  onChange={(v) => set('auditExemptAgents', v)}
                />
                <MultiDD
                  label={t('auditExemptKinds')}
                  value={form.auditExemptKinds || []}
                  options={[{ value: '__all__', label: t('allExempt') }, ...KIND_IDS.filter((k) => k !== 'all').map((k) => ({ value: k, label: t(KIND_LABELS[k]) }))]}
                  onChange={(v) => set('auditExemptKinds', v)}
                />
                <F k="recycleRetentionDays" label={t('recycleDays')} type="number" />
              </div>
            </div>
            {/* 服务自管理配置 */}
            <div className="mc-card" style={{ marginBottom: 10, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <b style={{ fontSize: 12 }}>🛠 {t('serviceConfig')}</b>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
                <Bool k="autoWeb" label={t('autoWeb')} />
                <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12 }}>
                  <span style={{ opacity: 0.6 }}>{t('autoWebMode')}</span>
                  <select value={form.autoWebMode ?? 'init'} onChange={(e) => set('autoWebMode', e.target.value)} style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2, #d1d5db)', background: 'var(--dsw-alias-bg-layer-1, #fff)', color: 'inherit', fontSize: 12 }}>
                    <option value="init">{t('modeInit')}</option>
                    <option value="interval">{t('modeInterval')}</option>
                    <option value="manual">{t('modeManual')}</option>
                  </select>
                </label>
                <F k="webPort" label={t('webPort')} type="number" />
                <F k="webCheckIntervalMs" label={t('webCheckIntervalMs')} type="number" />
                <F k="webMaxRestart" label={t('webMaxRestart')} type="number" />
                <Bool k="watchdogAutoSpawn" label={t('watchdogAutoSpawn')} />
                <Bool k="autoMcpSetup" label={t('autoMcpSetup')} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginBottom: 10 }}>
              <button type="button" className="mc-btn" onClick={resetForm} disabled={!!busy}>{t('reset')}</button>
              <button type="button" className="mc-btn me-on" onClick={save} disabled={!!busy || busy === 'save' || readonly}>{busy === 'save' ? t('exporting') : '💾 ' + t('saveConfig')}</button>
            </div>
          </>
        ) : <div style={{ fontSize: 12, opacity: 0.6 }}>{t('loading')}</div>}
      </div>
    </div>
  )
}

/** 审核中心：待审核/驳回卡清单 + 筛选（日期/类型/智能体/全选）+ 批准/驳回。 */
function AuditPanel({ t, onReload, version }) {
  const [pending, setPending] = useState([])
  const [rejected, setRejected] = useState([])
  const [kindF, setKindF] = useState('all')
  const [agentF, setAgentF] = useState('all')
  const [dateF, setDateF] = useState('')
  const [sel, setSel] = useState(new Set())
  const [busy, setBusy] = useState('')
  const [tab, setTab] = useState('pending')
  const agents = [...new Set([...pending, ...rejected].map((c) => c.submittedBy).filter(Boolean))]
  const load = useCallback(async () => {
    try { const r = await fetch(`${API}/audit/list`).then((x) => x.json()); if (r.ok) { setPending(r.pending || []); setRejected(r.rejected || []); setSel(new Set()) } } catch {}
  }, [])
  useEffect(() => { load() }, [version, load])
  const items = (tab === 'pending' ? pending : rejected).filter((c) => {
    if (kindF !== 'all' && c.kind !== kindF) return false
    if (agentF !== 'all' && normAgent(c.submittedBy) !== agentF) return false
    if (dateF) { const d = (c.created || '').slice(0, 10); if (d && d !== dateF) return false }
    return true
  })
  const toggle = (p) => setSel((s) => { const n = new Set(s); if (n.has(p)) { n.delete(p) } else { n.add(p) }; return n })
  const applyStatus = async (status, paths) => {
    setBusy('apply')
    try {
      for (const p of (paths || [...sel])) {
        const ep = status === 'approved' ? 'audit/approve' : status === 'rejected' ? 'audit/reject' : 'delete'
        await fetch(`${API}/${ep}?path=${encodeURIComponent(p)}${status === 'delete' ? '&permanent=0' : ''}`)
      }
      await load(); if (onReload) onReload()
    } catch {} finally { setBusy('') }
  }
  const toggled = [...sel]
  return (
    <div className="mc-admin" style={{ display: 'flex', flexDirection: 'column', overflow: 'auto', flex: 1, minHeight: 0 }}>
      <style>{CSS}</style>
      <div style={{ overflow: 'auto', padding: 4 }}>
        <div className="mc-card" style={{ marginBottom: 10, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <b style={{ fontSize: 12 }}>🛡️ {t('tabAudit')}</b>
          <div style={{ flex: 1 }} />
          <select value={kindF} onChange={(e) => setKindF(e.target.value)} style={{ fontSize: 12, padding: '4px 8px', borderRadius: 8, background: 'var(--dsw-alias-bg-layer-1, #fff)', color: 'inherit', border: '1px solid var(--dsw-alias-border-l2, #d1d5db)' }}>
            <option value="all">{t('all')}</option>
            {KIND_IDS.filter((k) => k !== 'all').map((k) => <option key={k} value={k}>{t(KIND_LABELS[k])}</option>)}
          </select>
          <select value={agentF} onChange={(e) => setAgentF(e.target.value)} style={{ fontSize: 12, padding: '4px 8px', borderRadius: 8, background: 'var(--dsw-alias-bg-layer-1, #fff)', color: 'inherit', border: '1px solid var(--dsw-alias-border-l2, #d1d5db)' }}>
            <option value="all">{t('allAgents')}</option>
            {agentOptions(agents).map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <input type="date" value={dateF} onChange={(e) => setDateF(e.target.value)} style={{ fontSize: 12, padding: '4px 8px', borderRadius: 8, background: 'var(--dsw-alias-bg-layer-1, #fff)', color: 'inherit', border: '1px solid var(--dsw-alias-border-l2, #d1d5db)' }} />
        </div>
        <div className="mc-card" style={{ marginBottom: 10, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" className={`mc-btn${tab === 'pending' ? ' me-on' : ''}`} onClick={() => setTab('pending')}>{t('pending')}（{pending.length}）</button>
          <button type="button" className={`mc-btn${tab === 'rejected' ? ' me-on' : ''}`} onClick={() => setTab('rejected')}>{t('rejected')}（{rejected.length}）</button>
          <div style={{ flex: 1 }} />
          <label style={{ fontSize: 12 }}><input type="checkbox" checked={items.length > 0 && toggled.length === items.length} onChange={(e) => { if (e.target.checked) { setSel(new Set(items.map((c) => c.path))) } else { setSel(new Set()) } }} /> {t('selectAll')}</label>
          <button type="button" className="mc-btn me-on" disabled={!toggled.length || !!busy} onClick={() => applyStatus('approved')}>✓ {tab === 'rejected' ? t('restore') : t('approve')}</button>
          {tab === 'pending'
            ? <button type="button" className="mc-btn" style={{ color: '#f87171' }} disabled={!toggled.length || !!busy} onClick={() => applyStatus('rejected')}>✕ {t('reject')}</button>
            : <button type="button" className="mc-btn" style={{ color: '#f87171' }} disabled={!toggled.length || !!busy} onClick={() => { if (window.confirm(t('recycleDeleteConfirm'))) applyStatus('delete') }}>🗑 {t('restoreDelete') || '删除进回收站'}</button>}
        </div>
        {items.length ? (
          <div className="mc-card" style={{ display: 'flex', flexDirection: 'column' }}>
            {items.map((c) => (
              <div key={c.path} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', borderBottom: '1px solid rgba(127,127,127,0.12)', fontSize: 12 }}>
                <input type="checkbox" checked={sel.has(c.path)} onChange={() => toggle(c.path)} />
                <span className="mc-kind" style={{ background: KIND_COLORS[c.kind] || '#999' }} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</span>
                <span style={{ fontSize: 10, opacity: 0.6 }}>{normAgent(c.submittedBy)}</span>
                <span style={{ fontSize: 10, opacity: 0.6 }}>{c.created ? c.created.slice(0, 16).replace('T', ' ') : '-'}</span>
                <span style={{ fontSize: 10, opacity: 0.6 }}>{c.kind}</span>
                <span style={{ fontSize: 10, opacity: 0.6, color: c.severity === 'high' ? '#f87171' : '#9ca3af' }}>{c.severity}</span>
                <span style={{ fontSize: 10, opacity: 0.6, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.reason || '-'}</span>
                {tab === 'pending' ? (
                  <>
                    <button type="button" className="mc-btn" style={{ padding: '2px 8px' }} onClick={() => applyStatus('approved', [c.path])}>✓</button>
                    <button type="button" className="mc-btn" style={{ padding: '2px 8px', color: '#f87171' }} onClick={() => applyStatus('rejected', [c.path])}>✕</button>
                  </>
                ) : (
                  <>
                    <button type="button" className="mc-btn" style={{ padding: '2px 8px' }} title={t('restore')} onClick={() => applyStatus('approved', [c.path])}>✓</button>
                    <button type="button" className="mc-btn" style={{ padding: '2px 8px', color: '#f87171' }} title={t('restoreDelete') || '删除进回收站'} onClick={() => { if (window.confirm(t('recycleDeleteConfirm'))) applyStatus('delete', [c.path]) }}>🗑</button>
                  </>
                )}
              </div>
            ))}
          </div>
        ) : <div style={{ opacity: 0.6, fontSize: 12, padding: 20, textAlign: 'center' }}>{t('noAuditItems')}</div>}
      </div>
    </div>
  )
}

/** 回收中心：软删卡列表 + 恢复/永久删除 + 30天自动清理提示。 */
function RecoverPanel({ t, onReload, version }) {
  const [items, setItems] = useState([])
  const [busy, setBusy] = useState('')
  const load = useCallback(async () => {
    try { const r = await fetch(`${API}/recycle/list`).then((x) => x.json()); if (r.ok) setItems(r.items || []) } catch {}
  }, [])
  useEffect(() => { load() }, [version, load])
  const action = async (act, p) => {
    setBusy(act + p)
    try {
      if (act === 'restore') await fetch(`${API}/recycle/restore?path=${encodeURIComponent(p)}`)
      else if (act === 'purge') await fetch(`${API}/recycle/purge?path=${encodeURIComponent(p)}`)
      await load(); if (onReload) onReload()
    } catch {} finally { setBusy('') }
  }
  return (
    <div className="mc-admin" style={{ display: 'flex', flexDirection: 'column', overflow: 'auto', flex: 1, minHeight: 0 }}>
      <style>{CSS}</style>
      <div style={{ overflow: 'auto', padding: 4 }}>
        <div className="mc-card" style={{ marginBottom: 10, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <b style={{ fontSize: 12 }}>🗑️ {t('tabRecycle')}</b>
          <span style={{ fontSize: 11, opacity: 0.6 }}>{t('recycleHint')}</span>
          <div style={{ flex: 1 }} />
          <button type="button" className="mc-btn" disabled={!!busy} onClick={async () => { setBusy('purgeAll'); try { await fetch(`${API}/recycle/purge-expired?days=0`); await load() } catch {} finally { setBusy('') } }}>{t('emptyRecycle')}</button>
        </div>
        {items.length ? (
          <div className="mc-card" style={{ display: 'flex', flexDirection: 'column' }}>
            {items.map((c) => (
              <div key={c.path} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', borderBottom: '1px solid rgba(127,127,127,0.12)', fontSize: 12 }}>
                <span className="mc-kind" style={{ background: KIND_COLORS[c.kind] || '#999' }} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</span>
                <span style={{ fontSize: 10, opacity: 0.6 }}>{t('deletedAt')} {(c.deletedAt || '').slice(0, 10)}</span>
                <button type="button" className="mc-btn" style={{ padding: '2px 8px' }} disabled={!!busy} onClick={() => action('restore', c.path)}>{t('restore')}</button>
                <button type="button" className="mc-btn" style={{ padding: '2px 8px', color: '#f87171' }} disabled={!!busy} onClick={() => { if (window.confirm(t('purgeConfirm'))) action('purge', c.path) }}>{t('purge')}</button>
              </div>
            ))}
          </div>
        ) : <div style={{ opacity: 0.6, fontSize: 12, padding: 20, textAlign: 'center' }}>{t('emptyRecycle')}</div>}
      </div>
    </div>
  )
}

const CardRow = ({ card, t, onOpen, query, onDelete }) => (  <article className="mc-cardrow mc-card" onClick={() => onOpen(card)}>
    <h4>
      <span className="mc-kind" style={{ background: KIND_COLORS[card.kind] || KIND_COLORS.other }} />
      {query ? highlightMatches(card.title, query) : card.title}
      {isNewCard(card.updated) && <span className="mc-new">{t('newBadge')}</span>}
      {card.status === 'pending' && <span className="mc-status" style={{ background: '#f59e0b' }}>{t('statusPending')}</span>}
      {card.status === 'rejected' && <span className="mc-status" style={{ background: '#ef4444' }}>{t('statusRejected')}</span>}
      {(!card.status || card.status === 'approved') && <span className="mc-status" style={{ background: '#10b981' }}>{t('statusApproved')}</span>}
    </h4>
    <p>{query ? highlightMatches(card.summary || '', query) : (card.summary || '')}</p>
    {card.tags.length > 0 && (
      <div className="mc-tags">
        {card.tags.slice(0, 4).map((tag) => <span key={tag} className="mc-tag">{tag}</span>)}
      </div>
    )}
    <footer>
      <span>{t(KIND_LABELS[card.kind])}</span>
      {<span style={{ fontSize: 10, opacity: 0.6 }}>🤖 {normAgent(card.submittedBy)}</span>}
      <span>{fmtDate(card.updated)}</span>
      <span className="spacer" style={{ flex: 1 }} />
      <button type="button" className="mc-card-del" title={t('delete')} onClick={(e) => { e.stopPropagation(); if (window.confirm(t('deleteConfirm'))) onDelete && onDelete(card.path) }}>✕</button>
    </footer>
  </article>
)

// 管理面板：用量/今日 + 整理建议（非破坏预览）+ 会话预算。
function LibraryAdmin({ t, tab, onReload, version }) {
  const [stats, setStats] = useState(null)
  const [err, setErr] = useState('')
  const [opt, setOpt] = useState(null)
  const [budget, setBudget] = useState(null)
  const [brief, setBrief] = useState('')
  const [busy, setBusy] = useState('')
  const [oneClickCleanupStale, setOneClickCleanupStale] = useState(false)
  const doBrief = useCallback(async () => { if (brief) { setBrief(''); return } try { const r = await fetch(`${API}/todayBrief`).then((x) => x.json()); setBrief(r.ok ? (r.brief || '') : '') } catch (e) {} }, [brief])
  const doBatchMerge = useCallback(async () => {
    if (!opt || !opt.merge || !opt.merge.length) return
    if (!window.confirm(t('mergeAllConfirm'))) return
    setBusy('merge')
    try {
      const parent = {}
      const find = (x) => (parent[x] === undefined ? x : (parent[x] = find(parent[x])))
      const uni = (a, b) => { parent[find(a)] = find(b) }
      const seen = new Set()
      for (const m of opt.merge) { seen.add(m.a.path); seen.add(m.b.path); uni(m.a.path, m.b.path) }
      const groups = {}
      for (const p of seen) { const r = find(p); (groups[r] = groups[r] || []).push(p) }
      let n = 0
      for (const g of Object.values(groups)) {
        if (g.length < 2) continue
        const r = await fetch(`${API}/merge?paths=${encodeURIComponent(g.join(','))}`).then((x) => x.json())
        if (r.ok) n++
      }
      await fetchAll(); if (onReload) onReload()
    } catch (e) {}
    setBusy('')
  }, [opt, fetchAll, onReload, t])
  async function fetchAll() {
    try {
      // 不自动拉 optimize（避免挂载即扫描）——由「一键搜索和整理」按钮手动触发
      const rs = await Promise.all([fetch(`${API}/stats`), fetch(`${API}/budget`)])
      const [s, b] = await Promise.all(rs.map((r) => r.json()))
      if (s.ok) setStats(s)
      if (b.ok) setBudget(b)
      setErr(!s.ok ? t('adminLoadFail') : '')
    } catch (e) { setErr(t('adminLoadFail')) }
  }
  // 手动「一键搜索和整理」：扫描相似卡对 + 陈旧卡
  const scanOptimize = useCallback(async () => {
    setBusy('scan')
    try {
      const r = await fetch(`${API}/optimize`).then((x) => x.json())
      if (r.ok) setOpt(r)
    } catch { setErr(t('adminLoadFail')) }
    finally { setBusy('') }
  }, [t])
  useEffect(() => { fetchAll() }, [version])
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
    <div className="mc-admin" style={{ display: 'flex', flexDirection: 'column', overflow: 'auto', flex: 1, minHeight: 0 }}>
      <style>{CSS}</style>
      <div style={{ overflow: 'auto' }}>
          {err && <div className="mc-card" style={{ borderLeft: '4px solid #ef4444', background: 'rgba(239,68,68,0.08)', padding: '12px 14px', marginBottom: 10 }}>
            <div style={{ fontSize: 13, color: '#b91c1c', fontWeight: 600, marginBottom: 6 }}>⚠ {err}</div>
            <button type="button" className="mc-btn" onClick={fetchAll}>↻ {t('retry')}</button>
          </div>}
          {tab === 'stats' && (
            <div>
              <div className="mc-card" style={{ marginBottom: 10, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <b style={{ fontSize: 12 }}>{t('todayBriefLabel')}</b>
                <button type="button" className="mc-btn" onClick={doBrief}>{brief ? `📕 ${t('collapse')}` : `📖 ${t('todayBrief')}`}</button>
                {brief && <pre style={{ margin: 0, fontSize: 12, width: '100%', whiteSpace: 'pre-wrap', opacity: 0.85 }}>{brief}</pre>}
              </div>
              {stats && (
                <>
                  {stats.trend && stats.trend.length > 0 && (() => {
                    const data = stats.trend; const max = Math.max(...data.map((d) => d.count), 1)
                    const w = 260, h = 50, cw = w / data.length
                    return (
                      <div className="mc-card" style={{ marginBottom: 10, padding: '10px 14px' }}>
                        <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>📈 {t('trendLabel')}</div>
                        <svg width={w} height={h} style={{ display: 'block', width: '100%', height: 50 }}>
                          {data.map((d, i) => {
                            const bh = Math.round((d.count / max) * (h - 4))
                            return <rect key={d.date} x={i * cw + 1} y={h - bh} width={Math.max(cw - 2, 2)} height={bh} rx={1.5} fill={d.count > 0 ? 'var(--dsw-alias-accent, #3b82f6)' : 'var(--dsw-alias-border-l1, #e5e7eb)'} opacity={d.count > 0 ? 0.85 : 0.35} />
                          })}
                        </svg>
                      </div>
                    )
                  })()}
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
              {/* 手动触发工具条：搜索扫描 + 一键优化（不自动执行） */}
              <div className="mc-card" style={{ marginBottom: 10, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <b style={{ fontSize: 12 }}>{t('organizeTitle')}</b>
                <div style={{ flex: 1 }} />
                <button type="button" className="mc-btn" disabled={!!busy} onClick={scanOptimize}>{busy === 'scan' ? t('exporting') : '🔍 ' + t('scanAndOrganize')}</button>
                {opt && opt.merge?.length > 0 && (
                  <button type="button" className="mc-btn me-on" disabled={!!busy} onClick={async () => {
                    if (!window.confirm(t('oneClickOptimizeConfirm'))) return
                    setBusy('oneclick')
                    try {
                      const body = JSON.stringify({ cleanupStale: oneClickCleanupStale })
                      const r = await fetch(`${API}/optimize-execute`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
                      const d = await r.json()
                      if (d && d.ok) {
                        notify(`${t('oneClickOptimizeDone')}：${d.plan.merged} ${t('optimizedMerged')}${oneClickCleanupStale ? ` · ${d.plan.staleDeleted} ${t('optimizedStaleDeleted')}` : ''}`)
                        await fetchAll(); if (onReload) onReload(); setOpt(null)
                      } else { notify(t('mergeFail'), false) }
                    } catch { notify(t('mergeFail'), false) }
                    finally { setBusy('') }
                  }}>{busy === 'oneclick' ? t('exporting') : '⚡ ' + t('oneClickOptimize')}</button>
                )}
                {opt && opt.merge?.length > 0 && (
                  <label style={{ fontSize: 11, opacity: 0.7, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input type="checkbox" checked={oneClickCleanupStale} onChange={(e) => setOneClickCleanupStale(e.target.checked)} />
                    {t('oneClickAlsoStale')}
                  </label>
                )}
              </div>
              {!opt && <div style={{ opacity: 0.6, fontSize: 12, marginBottom: 10 }}>{t('scanHint')}</div>}
              {opt && (
                <>
                  <div className="mc-card" style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <b style={{ fontSize: 12 }}>{t('mergePairs')}</b>
                      <div className="spacer" style={{ flex: 1 }} />
                      {opt.merge?.length > 0 && <button type="button" className="mc-btn me-on" disabled={!!busy} onClick={doBatchMerge}>{busy === 'merge' ? t('exporting') : t('batchMerge')}</button>}
                    </div>
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
                    {opt.stale?.length > 0 && (
                      <div style={{ marginBottom: 6 }}>
                        <button type="button" className="mc-btn" style={{ color: '#f87171' }} disabled={!!busy} onClick={async () => {
                          if (!window.confirm(t('deleteConfirm'))) return
                          setBusy('clean')
                          let n = 0
                          for (const s of opt.stale) { try { await fetch(`${API}/delete?path=${encodeURIComponent(s.path)}`); n++ } catch (e) {} }
                          setBusy('')
                          notify(`${n} ${t('deletedStale')}`)
                          await fetchAll(); if (onReload) onReload()
                        }}>{t('cleanStale')}</button>
                      </div>
                    )}
                    {opt.stale?.length ? <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>{opt.stale.map((s) => <KN key={s.path} title={s.title} kind="other" updated={s.updated} path={s.path} />)}</ul> : <div style={{ opacity: 0.6, fontSize: 12 }}>{t('noOptimize')}</div>}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
  )
}

const NEW_CARD_TEMPLATES = [
  { key: 'decision', label: 'tplDecision', kind: 'knowledge', tags: ['决策', '方案'], body: '# 技术决策：[标题]\n\n## 背景\n- 问题描述\n\n## 候选方案\n| 方案 | 优点 | 缺点 |\n| --- | --- | --- |\n| A | | |\n| B | | |\n\n## 决策\n选择方案 A，原因：\n\n## 风险与后续\n' },
  { key: 'bug', label: 'tplBug', kind: 'mistake', tags: ['踩坑', '教训'], body: '# 踩坑记录：[标题]\n\n## 现象\n- 发生了什么\n\n## 根因\n\n## 解决方案\n\n## 教训\n- 如何避免下次' },
  { key: 'meeting', label: 'tplMeeting', kind: 'content', tags: ['会议', '纪要'], body: '# 会议纪要：[标题]\n\n**日期**：\n**参会人**：\n\n## 议题\n1. \n\n## 结论\n\n## 待办\n- [ ] ' },
  { key: 'weekly', label: 'tplWeekly', kind: 'content', tags: ['周报'], body: '# 周报 [YYYY-MM-DD]\n\n## 本周完成\n- \n\n## 下周计划\n- \n\n## 风险/阻塞\n- ' },
]

function NewCardModal({ t, newCard, setNewCard, onCreated }) {
  if (!newCard) return null
  const T = NEW_CARD_TEMPLATES.find((x) => x.key === newCard.template)
  const body = newCard.body || (T ? T.body : '')
  const kind = newCard.kind || (T ? T.kind : 'knowledge')
  const tags = newCard.tags || (T ? T.tags.join(', ') : '')
  const creating = newCard._creating
  const applyTemplate = (key) => { const tpl = NEW_CARD_TEMPLATES.find((x) => x.key === key); setNewCard((v) => ({ ...v, template: key, kind: tpl ? tpl.kind : v.kind, body: tpl ? tpl.body : v.body, tags: tpl ? tpl.tags.join(', ') : v.tags })) }
  const doCreate = async () => {
    if (!newCard.title && !body) return
    setNewCard((v) => ({ ...v, _creating: true }))
    try {
      const r = await fetch(`${API}/write`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: newCard.title || '无标题', kind, tags: tags.split(',').map((t) => t.trim()).filter(Boolean), body, source: 'manual' }) }).then((x) => x.json())
      if (r.ok) { setNewCard(null); onCreated && onCreated() }
      else setNewCard((v) => ({ ...v, _creating: false }))
    } catch (e) { setNewCard((v) => ({ ...v, _creating: false })) }
  }
  return (
    <div className="me-overlay" onClick={() => setNewCard(null)}>
      <style>{CSS}</style>
      <div className="me-dialog" style={{ maxWidth: 600, width: '92vw', maxHeight: '85vh' }} onClick={(e) => e.stopPropagation()}>
        <div className="me-dialog-head">
          <h3>{t('newCard')}</h3>
          <button type="button" className="mc-btn" onClick={() => setNewCard(null)}>{t('close')}</button>
        </div>
        <div className="me-dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: 10, overflow: 'auto' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {NEW_CARD_TEMPLATES.map((tpl) => (
              <button key={tpl.key} type="button" className={`mc-btn${newCard.template === tpl.key ? ' me-on' : ''}`} onClick={() => applyTemplate(tpl.key)}>{t(tpl.label)}</button>
            ))}
            <button type="button" className={`mc-btn${newCard.template === '' ? ' me-on' : ''}`} onClick={() => setNewCard((v) => ({ ...v, template: '', body: '', tags: '', kind: 'knowledge' }))}>📄 空白</button>
          </div>
          <select className="mc-btn" value={kind} onChange={(e) => setNewCard((v) => ({ ...v, kind: e.target.value }))} style={{ maxWidth: 180, background: 'var(--dsw-alias-bg-layer-1, #fff)', color: 'var(--dsw-alias-label-primary, #111)' }}>
            {['project','knowledge','content','prompt','business','tool','mistake'].map((k) => <option key={k} value={k} style={{ background: 'var(--dsw-alias-bg-layer-1, #fff)', color: 'var(--dsw-alias-label-primary, #111)' }}>{k}</option>)}
          </select>
          <input type="text" className="mc-btn" placeholder={t('cardTitle')} value={newCard.title || ''} onChange={(e) => setNewCard((v) => ({ ...v, title: e.target.value }))} />
          <input type="text" className="mc-btn" placeholder={t('tags') + ' (逗号分隔)'} value={tags} onChange={(e) => setNewCard((v) => ({ ...v, tags: e.target.value }))} />
          <textarea className="mc-btn" placeholder={t('cardBody')} value={body} onChange={(e) => setNewCard((v) => ({ ...v, body: e.target.value }))} style={{ minHeight: 180, resize: 'vertical', fontFamily: 'inherit' }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="mc-btn me-on" disabled={creating} onClick={doCreate}>{creating ? t('exporting') : t('createCard')}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function CardReader({ t, card, query, onClose, onDelete, onFeedback }) {
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
            {query && <><button type="button" className="mc-btn" onClick={() => onFeedback && onFeedback(true)}>👍 {t('fbUseful')}</button><button type="button" className="mc-btn" onClick={() => onFeedback && onFeedback(false)}>👎 {t('fbIrr')}</button></>}
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

function GraphView({ t, onOpen, all, onAllChange, onMutate }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    try {
      const r = await fetch(`${API}/graph${all ? '?all=1' : ''}`)
      const d = await r.json()
      if (d.ok) { setData(d); setError('') }
      else { setData(null); setError(d.error || t('error')) }
    } catch (e) {
      setError(String(e && e.message ? e.message : e))
    }
  }, [all, t])

  useEffect(() => {
    let alive = true
    fetch(`${API}/graph${all ? '?all=1' : ''}`)
      .then((r) => r.json())
      .then((d) => { if (alive) { if (d.ok) { setData(d); setError('') } else { setData(null); setError(d.error || t('error')) } } })
      .catch((e) => { if (alive) setError(String(e && e.message ? e.message : e)) })
    return () => { alive = false }
  }, [all, t])

  const del = useCallback(async (path) => {
    try {
      const r = await fetch(`${API}/delete?path=${encodeURIComponent(path)}`)
      const d = await r.json()
      if (d && d.ok) { await reload(); onMutate && onMutate(); return true }
      return false
    } catch (e) { return false }
  }, [reload])

  const merge = useCallback(async (paths) => {
    if (!paths || paths.length < 2) return false
    try {
      const r = await fetch(`${API}/merge?paths=${encodeURIComponent(paths.join(','))}`).then((x) => x.json())
      if (r && r.ok) { await reload(); onMutate && onMutate(); return true }
      return false
    } catch (e) { return false }
  }, [reload, onMutate])

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
          onMerge={merge}
          t={t}
          all={all}
          onAllChange={onAllChange}
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

function GraphCanvas({ nodes, edges, onOpen, onDelete, onMerge, t, countLabel, all, onAllChange }) {
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const simRef = useRef(null)
  const fitRef = useRef(null)
  const resetRef = useRef(null)
  const onOpenRef = useRef(onOpen)
  useEffect(() => { onOpenRef.current = onOpen }, [onOpen])
  const onDeleteRef = useRef(onDelete)
  useEffect(() => { onDeleteRef.current = onDelete }, [onDelete])
  const onMergeRef = useRef(onMerge)
  useEffect(() => { onMergeRef.current = onMerge }, [onMerge])
  const [search, setSearch] = useState('')
  const [sel, setSel] = useState(null)
  const searchRef = useRef('')
  useEffect(() => { searchRef.current = search.trim().toLowerCase() }, [search])
  // 搜索定位：输入命中节点时，把画布居中到该节点并略微放大。
  useEffect(() => {
    const s = simRef.current
    if (!s) return
    const q = search.trim().toLowerCase()
    if (!q) return
    const best = s.nodes.find((n) => (n.name || '').toLowerCase().includes(q))
    if (best) { simRef.current.selectedId = best.id; setSel(best.id); s.panX = s.w / 2 - best.x * s.zoom; s.panY = s.h / 2 - best.y * s.zoom; if (s.render) s.render() }
  }, [search])
  const [filterKind, setFilterKind] = useState('all')
  const [filterOpen, setFilterOpen] = useState(false)
  const filterRef = useRef('all')
  const [filterTag, setFilterTag] = useState('')
  const tagRef = useRef('')
  const [timeMode, setTimeMode] = useState(false)
  const timeRef = useRef(false)
  const [ctx, setCtx] = useState(null)
  useEffect(() => { filterRef.current = filterKind }, [filterKind])
  useEffect(() => { tagRef.current = filterTag }, [filterTag])
  useEffect(() => { timeRef.current = timeMode }, [timeMode])
  // 标签云：从节点聚合出高频标签（去重、按频次排序、上限 24）。
  const allTags = useMemo(() => {
    const m = new Map()
    for (const n of nodes) { for (const tg of (n.tags || [])) { const t0 = String(tg).trim(); if (t0) m.set(t0, (m.get(t0) || 0) + 1) } }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24).map(([t0, n0]) => ({ tag: t0, n: n0 }))
  }, [nodes])
  const noMatch = (() => { const q = search.trim().toLowerCase(); return !!q && !nodes.some((n) => (n.title || n.name || '').toLowerCase().includes(q) || String(n.kind || '').toLowerCase().includes(q) || String(KIND_LABELS[n.kind] || '').toLowerCase().includes(q)) })()
  // 搜索变化时唤醒仿真重绘（否则布局停车后搜索不刷新）
  useEffect(() => { const s = simRef.current; if (s && s.wake) s.wake() }, [search])
  // 图例/标签/时间维 过滤变化时直接重绘（不重启布局）
  useEffect(() => { const s = simRef.current; if (s && s.render) s.render() }, [filterKind, filterTag, timeMode])
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
      const pad = 20
      const spanX = (maxX - minX) + pad * 2, spanY = (maxY - minY) + pad * 2
      const z = Math.min(sim.w / spanX, sim.h / spanY)
      // 展示全部：按边界精确缩放（不放大裁剪），让所有节点一屏可见、无滚动。
      sim.zoom = Math.max(0.35, Math.min(1.8, z))
      sim.panX = sim.w / 2 - ((minX + maxX) / 2) * sim.zoom
      sim.panY = sim.h / 2 - ((minY + maxY) / 2) * sim.zoom
    }
    fitRef.current = fit

    const render = () => {
      ctx.clearRect(0, 0, sim.w, sim.h)
      sim.searchTerm = searchRef.current
      sim.kindFilter = filterRef.current
      sim.timeMode = timeRef.current
      sim.tagFilter = tagRef.current

      const kfTag = sim.tagFilter
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
        if (kfTag) { const sT = sim.domainById[e.sourceNodeId] && (sim.domainById[e.sourceNodeId].tags || []).includes(kfTag); const tT = sim.domainById[e.targetNodeId] && (sim.domainById[e.targetNodeId].tags || []).includes(kfTag); if (!sT && !tT) return }
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
        const tagOk = !kfTag || ((info.tags || []).includes(kfTag))
        const dimmed = (focusId && n.id !== focusId && !sim.edges.some((ed) => (ed.sourceNodeId === focusId && ed.targetNodeId === n.id) || (ed.targetNodeId === focusId && ed.sourceNodeId === n.id))) || (searchTerm && !searchHit) || !kindOk || !tagOk
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
        const showLab = (isSel || isHov || sim.zoom > labelThreshold || (!dense && sim.zoom > 0.6)) && kindOk && tagOk
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
    const nodeVisible = (id) => { const info = sim.domainById[id]; if (!info) return false; if (filterRef.current !== 'all' && info.kind !== filterRef.current) return false; if (tagRef.current && !(info.tags || []).includes(tagRef.current)) return false; return true }
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
    const onMove = (e) => { sim.mouseX = e.clientX; sim.mouseY = e.clientY; const w = toWorld(e.clientX, e.clientY); let hov = null; for (let i = sim.nodes.length-1; i>=0; i--) { const n = sim.nodes[i]; if (!nodeVisible(n.id)) continue; const dx = n.x - w.x, dy = n.y - w.y; if (dx*dx + dy*dy < n.r*n.r + 36) { hov = n.id; break } } if (hov !== sim.hoverId) { sim.hoverId = hov; wake() } }
    const onDown = (e) => {
      if (e.button !== 0) return
      const w = toWorld(e.clientX, e.clientY); let hit = null
      for (let i = sim.nodes.length-1; i>=0; i--) { const n = sim.nodes[i]; if (!nodeVisible(n.id)) continue; const dx = n.x - w.x, dy = n.y - w.y; if (dx*dx + dy*dy < n.r*n.r + 25) { hit = n; break } }
      if (e.shiftKey) {
        // shift+点击节点 = 单点凸显（并入 multi）；shift+点击空白 = 拖拽框选
        if (hit) { sim.shiftClick = hit.id; return }
        sim.marquee = { sx: e.clientX, sy: e.clientY, ex: e.clientX, ey: e.clientY }; return
      }
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
      if (sim.shiftClick) {
        // shift 单点凸显：把该节点并入 multi（累积选择）
        const id = sim.shiftClick; sim.shiftClick = null
        const cur = Array.isArray(sim.multi) ? sim.multi.slice() : []
        if (!cur.includes(id)) cur.push(id)
        sim.multi = cur; setMulti(cur); wake(); return
      }
      if (wasClick) {
        const w = toWorld(e.clientX, e.clientY); let hit = null
        for (let i = sim.nodes.length-1; i>=0; i--) { const n = sim.nodes[i]; if (!nodeVisible(n.id)) continue; const dx = n.x - w.x, dy = n.y - w.y; if (dx*dx + dy*dy < n.r*n.r + 20) { hit = n; break } }
        if (hit) { sim.selectedId = hit.id; setSel(hit.id); wake() }
        else { sim.selectedId = null; sim.hoverId = null; if (!e.shiftKey) { sim.multi = []; setMulti([]) } setSel(null); wake() }
      }
      sim.dragStart = null; sim.dragging = false; sim.dragNode = null
    }
    const onCtx = (e) => {
      e.preventDefault()
      const w = toWorld(e.clientX, e.clientY); let hit = null
      for (let i = sim.nodes.length-1; i>=0; i--) { const n = sim.nodes[i]; if (!nodeVisible(n.id)) continue; const dx = n.x - w.x, dy = n.y - w.y; if (dx*dx + dy*dy < n.r*n.r + 25) { hit = n; break } }
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

    const onDocMouseDown = () => setFilterOpen(false)
    window.addEventListener('mousedown', onDocMouseDown)

    return () => { sim.running = false; if (sim.raf) cancelAnimationFrame(sim.raf); ro.disconnect(); canvas.removeEventListener('mousemove', onMove); canvas.removeEventListener('mousedown', onDown); window.removeEventListener('mousemove', onDrag); window.removeEventListener('mouseup', onUp); canvas.removeEventListener('wheel', onWheel); canvas.removeEventListener('contextmenu', onCtx); window.removeEventListener('mousedown', onDocMouseDown) }
  }, [nodes, edges])

  return (
    <div className="me-graph" ref={wrapRef}>
      <div className="me-graph-toolbar">
        <span className="me-graph-count">{nodes.length} {t('nodes')} · {edges.length} {t('edges')}</span>
        <span className="spacer" style={{ flex: 1 }} />
        <input type="text" placeholder={t('search')} value={search} onChange={(e) => setSearch(e.target.value)} />
        <span style={{ position: 'relative', display: 'inline-flex' }}>
          <button type="button" className="mc-btn" onClick={() => setFilterOpen((v) => !v)} aria-expanded={filterOpen} title="筛选" style={{ borderRadius: 8 }}>
            🔍 {t('filterLabel')} {filterKind !== 'all' || timeMode || filterTag ? '●' : '▾'}
          </button>
          {filterOpen && <div className="me-graph-legend-pop" onMouseDown={(e) => e.stopPropagation()} style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 50, background: 'rgba(28,28,32,0.92)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', color: '#eee', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 8, minWidth: 240, boxShadow: '0 12px 34px rgba(0,0,0,.35)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button type="button" className={`lg${filterKind === 'all' && !timeMode ? ' active' : ''}`} style={{ justifyContent: 'flex-start' }} onClick={() => { setFilterKind('all'); setTimeMode(false) }}>{t('all')}</button>
              {Object.keys(KIND_COLORS).map((k) => (
                <button key={k} type="button" className={`lg${filterKind === k ? ' active' : ''}`} style={{ justifyContent: 'flex-start' }} onClick={() => setFilterKind((f) => (f === k ? 'all' : k))}>
                  <span className="mc-kind" style={{ background: KG.colors[k] || KIND_COLORS[k] }} />{t(KIND_LABELS[k])}
                </button>
              ))}
              <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />
              <button type="button" className={`lg${timeMode ? ' active' : ''}`} style={{ justifyContent: 'flex-start' }} onClick={() => setTimeMode((v) => !v)}>⏱ {t('timeDim')}</button>
              {allTags.length > 0 && (
                <>
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />
                  <div style={{ maxHeight: 130, overflow: 'auto', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {allTags.map((o) => (
                      <button key={o.tag} type="button" className={`lg${filterTag === o.tag ? ' active' : ''}`} style={{ color: '#ddd', padding: '2px 7px', fontSize: 11 }} onClick={() => setFilterTag((f) => (f === o.tag ? '' : o.tag))} title={o.tag}>
                        #{o.tag} <span style={{ opacity: 0.55 }}>{o.n}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
              {(filterKind !== 'all' || timeMode || filterTag) && <button type="button" className="lg lg-clear" style={{ justifyContent: 'flex-start', color: '#f87171' }} onClick={() => { setFilterKind('all'); setTimeMode(false); setFilterTag('') }}>{t('clearFilter')} ✕</button>}
            </div>
          </div>}
        </span>
        <label className="mc-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer' }} title={t('crossVault')}><input type="checkbox" checked={!!all} onChange={(e) => onAllChange && onAllChange(e.target.checked)} />{t('crossVault')}</label>
        <button type="button" className={`mc-btn${timeMode ? ' me-on' : ''}`} onClick={() => setTimeMode((v) => !v)}>{t('timeDim')}</button>
        <button type="button" className="mc-btn" onClick={() => { const c = canvasRef.current; if (!c) return; try { c.toBlob((blob) => { if (!blob) return; setExportData({ url: URL.createObjectURL(blob), blob }) }, 'image/png') } catch (e) { /* 预览兜底 */ } }}>{t('exportGraph')}</button>
        <button type="button" className="mc-btn" onClick={() => fitRef.current && fitRef.current()}>{t('fit')}</button>
        <button type="button" className="mc-btn" onClick={() => { setSel(null); setFilterKind('all'); resetRef.current && resetRef.current() }}>{t('reset')}</button>
      </div>
      <div className="me-graph-canvas" style={{ position: 'relative', overflow: 'hidden' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', cursor: 'grab' }} />
        <div className="me-graph-tooltip" ref={tooltipRef} style={{ display: 'none', position: 'absolute', zIndex: 4, pointerEvents: 'none', background: 'rgba(28,28,32,0.88)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', color: '#eee', borderRadius: 8, padding: '7px 10px', fontSize: 12, maxWidth: 220, boxShadow: '0 8px 24px rgba(0,0,0,.2)' }} />
        {noMatch && <div className="mc-empty" style={{ position: 'absolute', inset: 0, zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)' }}>{t('noMatch')}</div>}
        {ctx && <div className="me-graph-ctx-back" style={{ position: 'fixed', inset: 0, zIndex: 30 }} onMouseDown={() => setCtx(null)} />}
        {ctx && (
          <div className="me-graph-ctxmenu" style={{ position: 'fixed', left: ctx.x, top: ctx.y, zIndex: 31 }} onMouseDown={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => { onOpenRef.current({ path: ctx.path, title: ctx.title }); setCtx(null) }}>{t('openCard')}</button>
            <button type="button" onClick={() => { if (ctx.id) { simRef.current.selectedId = ctx.id; setSel(ctx.id) } setCtx(null); const s = simRef.current; if (s && s.wake) s.wake() }}>{t('focusNeighbors')}</button>
            <button type="button" onClick={() => { try { if (navigator.clipboard) navigator.clipboard.writeText(ctx.title || '') } catch (e) {} setCtx(null); notify(t('copied')) }}>{t('copyName')}</button>
            <button type="button" onClick={() => { const s = simRef.current; const ps = (s && Array.isArray(s.multi) ? s.multi.slice() : []); const id = ctx.id; if (id && !ps.includes(id)) ps.push(id); setCtx(null); if (ps.length < 2) { notify(t('mergeNeed'), false); return } if (!window.confirm(t('mergeConfirm'))) return; const pr = onMergeRef.current && onMergeRef.current(ps); if (pr && pr.then) pr.then((ok) => ok ? notify(t('merged')) : notify(t('mergeFail'), false)).catch(() => notify(t('mergeFail'), false)); else if (pr) notify(t('merged')); }}>{t('merge')}</button>
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

/** 点击展开的多选下拉（勾选 checkbox），用于免审智能体/免审类型等配置。value 为数组，__all__ 表示免审全部。 */
function MultiDD({ label, value = [], options, onChange, placeholder, z = 20 }) {
  const [open, setOpen] = useState(false)
  const boxRef = useRef(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])
  const val = Array.isArray(value) ? value : []
  const hasAll = val.includes('__all__')
  const text = hasAll ? (options.find((o) => o.value === '__all__')?.label || '') : (val.length ? val.map((v) => options.find((o) => o.value === v)?.label || v).join('、') : '')
  const setSelected = (opt, checked) => {
    if (opt.value === '__all__') { onChange(checked ? ['__all__'] : []); return }
    const n = new Set(val); if (n.has('__all__')) n.delete('__all__')
    if (checked) n.add(opt.value); else n.delete(opt.value)
    onChange([...n])
  }
  const allOpt = options.find((o) => o.value === '__all__')
  const normalOpts = options.filter((o) => o.value !== '__all__')
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12 }}>
      <span style={{ opacity: 0.6 }}>{label}</span>
      <div ref={boxRef} style={{ position: 'relative' }}>
        <button type="button" onClick={() => setOpen((o) => !o)} style={{ width: '100%', textAlign: 'left', padding: '6px 8px', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2, #d1d5db)', background: 'var(--dsw-alias-bg-layer-1, #fff)', color: 'inherit', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{text || placeholder || '—'}</span>
          <span style={{ fontSize: 10, opacity: 0.7 }}>▾</span>
        </button>
        {open && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: z, marginTop: 2, borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2, #d1d5db)', background: 'var(--dsw-alias-bg-layer-1, #fff)', color: 'inherit', boxShadow: '0 6px 20px rgba(0,0,0,0.14)', maxHeight: 180, overflow: 'auto' }}>
            {allOpt && (
              <label onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', cursor: 'pointer', borderBottom: '1px solid rgba(127,127,127,0.12)' }}>
                <input type="checkbox" checked={hasAll} onChange={(e) => setSelected(allOpt, e.target.checked)} />
                <span>{allOpt.label}</span>
              </label>
            )}
            {normalOpts.map((o) => (
              <label key={o.value} onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={val.includes(o.value)} onChange={(e) => setSelected(o, e.target.checked)} />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </label>
  )
}

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
