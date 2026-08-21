// 记忆核心 · Markdown Vault 存储层
//
// 从 boujoy-harness 的记忆模块移植（web/boujoy_server.py 的知识库部分）：
// - 卡片 = 带 YAML frontmatter 的 Markdown 文件，落在 02-06 主题目录；
// - 去重 = Jaccard 字符 bigram 相似度（阈值默认 0.62），命中后拒绝新建并返回原卡；
// - 检索 = CJK 感知：整词 + 字符 bigram 命中（无需全文引擎）；
// - 图谱 = 卡片之间的 [[wikilink]] 与共享标签连线。
//
// 本文件不依赖 DSH 运行时，可单独单测。

import { promises as fs } from 'node:fs'
import path from 'node:path'

/** 与 boujoy 一致的主题目录根。 */
export const KIND_ROOTS = {
  project: '02-Projects',
  knowledge: '03-Knowledge',
  content: '04-Content',
  prompt: '05-Prompts',
  business: '06-Business',
}

export const CAPTURE_KINDS = ['project', 'knowledge', 'content', 'prompt', 'business']

/** 从 Markdown 文本提取 frontmatter 与正文。 */
export function parseCard(text) {
  const meta = { title: '', kind: 'knowledge', tags: [], created: '', updated: '', source: '' }
  let body = text
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text)
  if (m) {
    body = text.slice(m[0].length)
    for (const line of m[1].split(/\r?\n/)) {
      const eq = line.indexOf(':')
      if (eq <= 0) continue
      const key = line.slice(0, eq).trim()
      let value = line.slice(eq + 1).trim()
      if (key === 'tags') {
        value = value.replace(/^\[/, '').replace(/\]$/, '')
        meta.tags = value.split(',').map((t) => t.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)
        continue
      }
      if (key === 'kind' || key === 'title' || key === 'created' || key === 'updated' || key === 'source') {
        meta[key] = value.replace(/^['"]|['"]$/g, '')
      }
    }
  }
  // 标题：frontmatter 的 title 优先，否则取第一个 # 标题，否则取首行。
  if (!meta.title) {
    const h = /^#\s+(.+)$/m.exec(body)
    meta.title = h ? h[1].trim() : body.trim().split(/\r?\n/)[0].slice(0, 60)
  }
  const summary = body.trim().slice(0, 200)
  return { meta, body: body.trim(), summary }
}

/** 生成安全 slug（中文保留、非法字符替换为 -）。 */
export function safeSlug(name) {
  const base = String(name || 'card')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\w\u4e00-\u9fff-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return base || 'card'
}

/** Jaccard-like 相似度：字符 bigram 集合（移植 boujoy _text_similarity）。 */
export function textSimilarity(a, b) {
  const bigrams = (text) => {
    const cleaned = String(text)
      .replace(/[\s#*_`|[\]()（）\-—・]+/g, '')
      .toLowerCase()
    const out = new Set()
    for (let i = 0; i < cleaned.length - 1; i++) out.add(cleaned.slice(i, i + 2))
    if (cleaned.length === 1) out.add(cleaned)
    return out
  }
  const ba = bigrams(a)
  const bb = bigrams(b)
  if (ba.size === 0 || bb.size === 0) return 0
  let inter = 0
  for (const g of ba) if (bb.has(g)) inter++
  return inter / (ba.size + bb.size - inter)
}

/** 在目标目录中找与候选文本最相似的现有卡（去重守卫）。比较正文（剔除 frontmatter）。 */
export async function dedupCheck(dir, text, threshold = 0.62) {
  let best = null
  let entries = []
  try {
    entries = await fs.readdir(dir)
  } catch {
    return null
  }
  for (const name of entries) {
    if (!name.toLowerCase().endsWith('.md')) continue
    try {
      const existing = await fs.readFile(path.join(dir, name), 'utf8')
      // 只比较正文，避免 frontmatter 稀释相似度
      const { body } = parseCard(existing)
      const score = textSimilarity(text, body || existing)
      if (score >= threshold && (!best || score > best.score)) best = { path: name, score }
    } catch {
      // 跳过不可读文件
    }
  }
  return best
}

/** CJK 感知查询词：整词 + 中文字符 bigram（移植 boujoy query_terms）。 */
export function queryTerms(query) {
  const tokens = new Set(String(query).split(/[^\w\u4e00-\u9fff]+/).filter(Boolean))
  for (let i = 0; i < query.length - 1; i++) {
    const c1 = query[i]
    const c2 = query[i + 1]
    if (/[\u4e00-\u9fff]/.test(c1) && /[\u4e00-\u9fff]/.test(c2)) tokens.add(c1 + c2)
  }
  return tokens
}

/** 递归列出 vault 下所有卡片（02-06 目录内 *.md），返回解析后的卡摘要。 */
export async function listCards(root) {
  const cards = []
  for (const kind of CAPTURE_KINDS) {
    const dir = path.join(root, KIND_ROOTS[kind])
    let files = []
    try {
      files = await walkMd(dir)
    } catch {
      continue
    }
    for (const rel of files) {
      try {
        const full = path.join(dir, rel)
        const text = await fs.readFile(full, 'utf8')
        const { meta, body, summary } = parseCard(text)
        const stat = await fs.stat(full)
        cards.push({
          path: `${KIND_ROOTS[kind]}/${rel}`,
          kind,
          title: meta.title || rel.replace(/\.md$/, ''),
          tags: meta.tags,
          summary,
          created: meta.created,
          updated: meta.updated || stat.mtime.toISOString(),
          mtime: stat.mtimeMs,
        })
      } catch {
        // 跳过坏文件
      }
    }
  }
  cards.sort((a, b) => b.mtime - a.mtime)
  return cards
}

async function walkMd(dir) {
  const out = []
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const ent of entries) {
    const rel = path.join('.', ent.name)
    if (ent.isDirectory()) {
      out.push(...(await walkMd(path.join(dir, ent.name))).map((f) => path.join(rel, f)))
    } else if (ent.name.toLowerCase().endsWith('.md')) {
      out.push(rel.replace(/\\/g, '/'))
    }
  }
  return out
}

/** 确保 vault 目录结构存在（00-System + 02-06）。 */
export async function ensureVault(root) {
  await fs.mkdir(path.join(root, '00-System'), { recursive: true })
  for (const dir of Object.values(KIND_ROOTS)) {
    await fs.mkdir(path.join(root, dir), { recursive: true })
  }
}

/** 读取一张卡（相对路径，安全限定在 vault 内）。 */
export async function readCard(root, rel) {
  const target = resolveInside(root, rel)
  if (!target) throw new Error('路径越界')
  return fs.readFile(target, 'utf8')
}

/** 原子写卡；先去重（target 目录内），命中返回 {duplicate}。 */
export async function writeCard(root, { kind, title, tags = [], body, source = '' }, { threshold = 0.62, dedup = true } = {}) {
  const kindRoot = KIND_ROOTS[kind] || KIND_ROOTS.knowledge
  const dir = path.join(root, kindRoot)
  await fs.mkdir(dir, { recursive: true })
  if (dedup) {
    const hit = await dedupCheck(dir, body, threshold)
    if (hit) return { ok: false, duplicate: { ...hit, path: `${kindRoot}/${hit.path}` } }
  }
  const slug = safeSlug(title)
  let rel = `${slug}.md`
  let index = 2
  while (await exists(path.join(dir, rel))) {
    rel = `${slug}-${index}.md`
    index++
  }
  const now = new Date().toISOString()
  const text = [
    '---',
    `kind: ${kind}`,
    `title: ${yamlString(title)}`,
    `tags: [${tags.map((t) => yamlString(t)).join(', ')}]`,
    `created: ${now}`,
    `updated: ${now}`,
    ...(source ? [`source: ${source}`] : []),
    '---',
    '',
    `# ${title}`,
    '',
    body.trim(),
    '',
  ].join('\n')
  const target = path.join(dir, rel)
  const tmp = target + '.tmp'
  await fs.writeFile(tmp, text, 'utf8')
  await fs.rename(tmp, target)
  return { ok: true, path: `${kindRoot}/${rel}`, kind }
}

/** 向已存在的卡追加「更新记录」段（去重命中时的正确动作，移植 boujoy 语义）。 */
export async function appendUpdate(root, rel, updateText, { threshold = 0.62 } = {}) {
  const target = resolveInside(root, rel)
  if (!target) throw new Error('路径越界')
  const existing = await fs.readFile(target, 'utf8')
  const { meta, body } = parseCard(existing)
  const now = new Date().toISOString()
  const updated = [
    '---',
    `kind: ${meta.kind || 'knowledge'}`,
    `title: ${yamlString(meta.title)}`,
    `tags: [${(meta.tags || []).map((t) => yamlString(t)).join(', ')}]`,
    `created: ${meta.created || now}`,
    `updated: ${now}`,
    ...(meta.source ? [`source: ${meta.source}`] : []),
    '---',
    '',
    body.trim(),
    '',
    '## 更新记录',
    '',
    `- ${now.slice(0, 10)}：${updateText.trim()}`,
    '',
  ].join('\n')
  const tmp = target + '.tmp'
  await fs.writeFile(tmp, updated, 'utf8')
  await fs.rename(tmp, target)
  return { ok: true, path: rel, kind: meta.kind || 'knowledge', updated: now }
}

/** 检索：整词/中文 bigram 命中 path + 正文。返回卡片摘要（带命中度）。 */
export async function search(root, query, { limit = 30 } = {}) {
  const q = String(query || '').trim()
  if (!q) return []
  const cards = await listCards(root)
  const wanted = queryTerms(q)
  const out = []
  for (const card of cards) {
    let text
    try {
      text = await fs.readFile(path.join(root, card.path), 'utf8')
    } catch {
      continue
    }
    const haystack = `${card.path}\n${card.title}\n${text}`.toLowerCase()
    let score = 0
    if (haystack.includes(q.toLowerCase())) score = 3
    for (const term of wanted) {
      if (haystack.includes(term.toLowerCase())) score += 1
    }
    if (score > 0) {
      out.push({ ...card, score })
    }
  }
  out.sort((a, b) => b.score - a.score || b.mtime - a.mtime)
  return out.slice(0, limit)
}

/** 图谱：节点 = 卡片；边 = [[wikilink]]（同 vault 命中）或共享标签。 */
export async function graph(root) {
  const cards = await listCards(root)
  const byPath = new Map(cards.map((c) => [c.path, c]))
  const nodes = cards.map((c) => ({
    id: c.path,
    title: c.title,
    kind: c.kind,
    tags: c.tags,
    summary: c.summary.slice(0, 80),
  }))
  const edges = []
  const seen = new Set()
  const addEdge = (a, b, type) => {
    const key = [a, b].sort().join('|') + '|' + type
    if (seen.has(key)) return
    seen.add(key)
    edges.push({ source: a, target: b, type })
  }
  for (const card of cards) {
    let text = ''
    try {
      text = await fs.readFile(path.join(root, card.path), 'utf8')
    } catch {
      continue
    }
    // wikilinks：[[目标路径]] 或 [[标题]]
    for (const m of text.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)) {
      const raw = m[1].trim().replace(/\.md$/, '')
      const candidates = [
        `${card.kind === 'knowledge' ? KIND_ROOTS.knowledge : KIND_ROOTS[card.kind]}/${raw}.md`,
        `${KIND_ROOTS.knowledge}/${raw}.md`,
        `${raw}.md`,
      ]
      for (const cand of candidates) {
        if (cand !== card.path && byPath.has(cand)) {
          addEdge(card.path, cand, 'link')
          break
        }
      }
      // 也允许按标题匹配
      for (const other of cards) {
        if (other.path !== card.path && (other.title === raw || other.path.endsWith(`/${raw}.md`))) {
          addEdge(card.path, other.path, 'link')
          break
        }
      }
    }
    // 共享标签（同一标签出现两次以上才连线，避免全连）
    for (const tag of card.tags) {
      for (const other of cards) {
        if (other.path !== card.path && other.tags.includes(tag)) addEdge(card.path, other.path, `tag:${tag}`)
      }
    }
  }
  return { nodes, edges }
}

/** 统计：按 kind 计数 + 最近 7 天更新数 + 总标签数。 */
export async function overview(root) {
  const cards = await listCards(root)
  const byKind = {}
  for (const c of cards) byKind[c.kind] = (byKind[c.kind] || 0) + 1
  const week = Date.now() - 7 * 86400000
  const recent = cards.filter((c) => c.mtime > week).length
  const tagSet = new Set()
  for (const c of cards) for (const t of c.tags) tagSet.add(t)
  return {
    total: cards.length,
    byKind,
    recent,
    tags: tagSet.size,
    roots: Object.fromEntries(Object.entries(KIND_ROOTS).map(([k, v]) => [k, `${v}/`])),
  }
}

// -- helpers ---------------------------------------------------------------

function resolveInside(root, rel) {
  const target = path.resolve(root, rel)
  const rootResolved = path.resolve(root)
  if (target !== rootResolved && !target.startsWith(rootResolved + path.sep)) return null
  return target
}

async function exists(p) {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

function yamlString(value) {
  const s = String(value ?? '')
  return /[:#\[\]{}"',&*!|>%@`]/.test(s) ? `"${s.replace(/"/g, '\\"')}"` : s
}
