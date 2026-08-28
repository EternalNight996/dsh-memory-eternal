// 记忆核心 · Web UI 入口（浏览器/iframe 独立挂载）。
//
// 复用 src/client/index.tsx 的 MemoryLibrary（同一套 UI 与 DSH 内嵌零分叉），
// 仅替换：locale（navigator.language 判定）与挂载点（#root 全屏，非弹窗形态）。
// API 走同源相对路径 /memory-eternal/api/*，由 lib/web.js 的独立 server 提供。

import React from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryLibrary, ZH, EN } from '../client/index.tsx'

const lang = (typeof navigator !== 'undefined' && String(navigator.language || '').toLowerCase().startsWith('zh')) ? ZH : EN
const t = (key) => lang[key] ?? ZH[key] ?? key

const root = createRoot(document.getElementById('root'))
root.render(React.createElement(MemoryLibrary, { t, inModal: false }))
