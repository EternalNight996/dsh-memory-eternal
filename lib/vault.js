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

/** 主题目录根。 */
export const KIND_ROOTS = {
  project: '02-Projects',
  knowledge: '03-Knowledge',
  content: '04-Content',
  prompt: '05-Prompts',
  business: '06-Business',
  tool: '07-Tools',
  mistake: '08-Mistakes',
}

export const CAPTURE_KINDS = ['project', 'knowledge', 'content', 'prompt', 'business', 'tool', 'mistake']

/** 从 Markdown 文本提取 frontmatter 与正文。 */
export function parseCard(text) {
  // formatVersion 守卫：读侧始终向后兼容——旧卡无此字段 = v0 按旧逻辑读；
  // 未来结构变更时升 FORMAT_VERSION 并在读侧加迁移分支，多副本环境
  // （DSH profile + 全局）版本漂移不会互相写坏库。
  const meta = { title: '', kind: 'knowledge', tags: [], created: '', updated: '', source: '', formatVersion: 0, status: 'pending', submittedBy: '', severity: 'info', reason: '', deletedAt: '' }
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
      if (key === 'formatVersion') {
        meta.formatVersion = Number(value) || 0
      } else if (key === 'kind' || key === 'title' || key === 'created' || key === 'updated' || key === 'source' || key === 'status' || key === 'submittedBy' || key === 'severity' || key === 'reason' || key === 'deletedAt') {
        meta[key] = value.replace(/^['"]|['"]$/g, '')
      }
    }
  }
  // 审核中心为最高控制：无 status 字段的卡（含 agent 直写 vault 的绕过）一律视为待审核。
  if (!meta.status) meta.status = 'pending'
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

// 目录名 → kind 推断（直写/非标准目录也归入可读集合）
function kindFromDir(topDir) {
  for (const [k, v] of Object.entries(KIND_ROOTS)) { if (v.toLowerCase() === String(topDir || '').toLowerCase()) return k }
  return 'knowledge'
}

/** 递归列出一个目录及其子孙目录下所有 *.md（相对路径，正斜杠）。 */
async function walkAll(dir, base = dir, out = []) {
  let ents = []
  try { ents = await fs.readdir(dir, { withFileTypes: true }) } catch { return out }
  for (const ent of ents) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) await walkAll(full, base, out)
    else if (ent.name.endsWith('.md')) out.push(path.relative(base, full).split(path.sep).join('/'))
  }
  return out
}

/** 递归列出 vault 下所有卡片（整个根目录 *.md，含直写到任意子目录的卡），返回解析后的卡摘要。 */
export async function listCards(root, { status } = {}) {
  // 默认 status=['approved']（主库视图/统计/检索只用已批卡）；audit/recycle 显式传 ['pending','rejected'] / ['deleted']
  const want = status ?? ['approved']
  const cards = []
  const files = await walkAll(root)
  for (const rel of files) {
    try {
      const full = path.join(root, rel)
      const text = await fs.readFile(full, 'utf8')
      const { meta, body, summary } = parseCard(text)
      const stat = await fs.stat(full)
      const s = meta.status || 'approved'
      if (want && !want.includes(s)) continue
      const topDir = rel.split('/')[0]
      cards.push({
        path: rel,
        kind: meta.kind || kindFromDir(topDir),
        title: meta.title || rel.replace(/\.[^.]*$/, '').replace(/^[^/]*\//, ''),
        tags: meta.tags,
        summary,
        created: meta.created,
        updated: meta.updated || stat.mtime.toISOString(),
        mtime: stat.mtimeMs,
        status: s,
        submittedBy: meta.submittedBy || '',
        severity: meta.severity || 'info',
        reason: meta.reason || '',
        deletedAt: meta.deletedAt || '',
      })
    } catch {
      // 跳过坏文件
    }
  }
  cards.sort((a, b) => b.mtime - a.mtime)
  return cards
}

/** 审核队列（待审核卡）：status=pending。 */
export async function auditQueue(root) {
  const cards = await listCards(root, { status: ['pending', 'rejected'] })
  return { pending: cards.filter((c) => c.status === 'pending'), rejected: cards.filter((c) => c.status === 'rejected') }
}

/** 回收站（软删卡）：status=deleted，按删除时间倒序。 */
export async function recycleList(root) {
  const cards = await listCards(root, { status: ['deleted'] })
  return cards.sort((a, b) => new Date(b.deletedAt || 0) - new Date(a.deletedAt || 0))
}

/** 清理超过 retentionDays 天的回收卡（永久删除）。 */
export async function purgeExpired(root, retentionDays = 30) {
  const cut = Date.now() - retentionDays * 86400000
  const items = await recycleList(root)
  let purged = 0
  for (const c of items) {
    const d = new Date(c.deletedAt || 0).getTime()
    if (d && d < cut) {
      try { await deleteCard(root, c.path, { permanent: true }); purged++ } catch {}
    }
  }
  return { ok: true, purged }
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

/** 确保 vault 目录结构存在（00-System + 02-08）。 */
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

/** 合并多张卡为一张（保留第一张的 kind/title 前缀「（合并）」，并集标签，用 --- 分隔正文，删原卡）。 */
export async function mergeCards(root, paths) {
  const list = (Array.isArray(paths) ? paths : []).map((p) => String(p || '').trim()).filter(Boolean)
  if (list.length < 2) return { ok: false, error: '至少选 2 张卡' }
  const texts = []
  for (const p of list) {
    try { texts.push({ path: p, text: await readCard(root, p) }) } catch { /* 跳过读不到的 */ }
  }
  if (texts.length < 2) return { ok: false, error: '读取失败' }
  const first = parseCard(texts[0].text)
  const tags = new Set(first.meta.tags || [])
  let combined = ''
  texts.forEach((t, i) => {
    let body = t.text
    try { const p = parseCard(t.text); body = p.body; (p.meta.tags || []).forEach((x) => tags.add(x)) } catch {}
    combined += (i ? '\n\n---\n\n' : '') + body.trim()
  })
  const title = (first.meta.title || '合并记忆') + '（合并）'
  const r = await writeCard(root, { kind: first.meta.kind || 'knowledge', title, tags: [...tags], body: combined, source: 'merge', status: 'approved' }, { dedup: false })
  if (!r.ok) return { ok: false, error: '写入失败' }
  for (const t of texts) { try { await deleteCard(root, t.path, { permanent: true }) } catch { /* 尽力删除 */ } }
  return { ok: true, path: r.path, merged: texts.length }
}

/** 软删卡片：标记 status=deleted + deletedAt（进回收站，文件保留可恢复）。不再立即 unlink。 */
export async function deleteCard(root, rel, { permanent = false } = {}) {
  const target = resolveInside(root, rel)
  if (!target) throw new Error('路径越界')
  if (permanent) {
    await fs.unlink(target)
    const dir = path.dirname(target)
    try { await fs.rmdir(dir) } catch { /* 目录非空则保留 */ }
    return { ok: true, permanent: true }
  }
  // 软删：把 frontmatter status 改 deleted + deletedAt
  const text = await fs.readFile(target, 'utf8')
  const { meta, body } = parseCard(text)
  const now = new Date().toISOString()
  const rewritten = [
    '---',
    `formatVersion: 1`,
    `kind: ${meta.kind || 'knowledge'}`,
    `title: ${yamlString(meta.title)}`,
    `tags: [${(meta.tags || []).map((t) => yamlString(t)).join(', ')}]`,
    `created: ${meta.created || now}`,
    `updated: ${now}`,
    `status: deleted`,
    `deletedAt: ${now}`,
    ...(meta.submittedBy ? [`submittedBy: ${yamlString(meta.submittedBy)}`] : []),
    ...(meta.severity ? [`severity: ${meta.severity}`] : []),
    ...(meta.reason ? [`reason: ${yamlString(meta.reason)}`] : []),
    ...(meta.source ? [`source: ${meta.source}`] : []),
    '---',
    '',
    body.trim(),
    '',
  ].join('\n')
  await fs.writeFile(target, rewritten, 'utf8')
  return { ok: true, soft: true }
}

/** 恢复软删卡：status=approved，清除 deletedAt。 */
export async function restoreCard(root, rel) {
  const target = resolveInside(root, rel)
  if (!target) throw new Error('路径越界')
  const text = await fs.readFile(target, 'utf8')
  const { meta, body } = parseCard(text)
  const now = new Date().toISOString()
  const rewritten = [
    '---',
    `formatVersion: 1`,
    `kind: ${meta.kind || 'knowledge'}`,
    `title: ${yamlString(meta.title)}`,
    `tags: [${(meta.tags || []).map((t) => yamlString(t)).join(', ')}]`,
    `created: ${meta.created || now}`,
    `updated: ${now}`,
    `status: approved`,
    ...(meta.submittedBy ? [`submittedBy: ${yamlString(meta.submittedBy)}`] : []),
    ...(meta.severity ? [`severity: ${meta.severity}`] : []),
    ...(meta.reason ? [`reason: ${yamlString(meta.reason)}`] : []),
    ...(meta.source ? [`source: ${meta.source}`] : []),
    '---',
    '',
    body.trim(),
    '',
  ].join('\n')
  await fs.writeFile(target, rewritten, 'utf8')
  return { ok: true, restored: true }
}

/** 更新卡状态（审核批准/驳回）。 */
export async function setCardStatus(root, rel, status) {
  const target = resolveInside(root, rel)
  if (!target) throw new Error('路径越界')
  const text = await fs.readFile(target, 'utf8')
  const { meta, body } = parseCard(text)
  const now = new Date().toISOString()
  const rewritten = [
    '---',
    `formatVersion: 1`,
    `kind: ${meta.kind || 'knowledge'}`,
    `title: ${yamlString(meta.title)}`,
    `tags: [${(meta.tags || []).map((t) => yamlString(t)).join(', ')}]`,
    `created: ${meta.created || now}`,
    `updated: ${now}`,
    `status: ${status}`,
    ...(meta.submittedBy ? [`submittedBy: ${yamlString(meta.submittedBy)}`] : []),
    ...(meta.severity ? [`severity: ${meta.severity}`] : []),
    ...(meta.reason ? [`reason: ${yamlString(meta.reason)}`] : []),
    ...(meta.source ? [`source: ${meta.source}`] : []),
    '---',
    '',
    body.trim(),
    '',
  ].join('\n')
  await fs.writeFile(target, rewritten, 'utf8')
  return { ok: true, status }
}

/** 原子写卡；先去重（target 目录内），命中返回 {duplicate}。 */
export async function writeCard(root, { kind, title, tags = [], body, source = '', status = 'approved', submittedBy = '', severity = 'info', reason = '', deletedAt = '' }, { threshold = 0.62, dedup = true } = {}) {
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
    `formatVersion: 1`,
    `kind: ${kind}`,
    `title: ${yamlString(title)}`,
    `tags: [${tags.map((t) => yamlString(t)).join(', ')}]`,
    `created: ${now}`,
    `updated: ${now}`,
    `status: ${status}`,
    ...(deletedAt ? [`deletedAt: ${deletedAt}`] : []),
    ...(submittedBy ? [`submittedBy: ${yamlString(submittedBy)}`] : []),
    ...(severity ? [`severity: ${severity}`] : []),
    ...(reason ? [`reason: ${yamlString(reason)}`] : []),
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
    `formatVersion: 1`,
    `kind: ${meta.kind || 'knowledge'}`,
    `title: ${yamlString(meta.title)}`,
    `tags: [${(meta.tags || []).map((t) => yamlString(t)).join(', ')}]`,
    `created: ${meta.created || now}`,
    `updated: ${now}`,
    `status: ${meta.status || 'pending'}`,
    ...(meta.submittedBy ? [`submittedBy: ${yamlString(meta.submittedBy)}`] : []),
    ...(meta.severity ? [`severity: ${meta.severity}`] : []),
    ...(meta.reason ? [`reason: ${yamlString(meta.reason)}`] : []),
    ...(meta.source ? [`source: ${meta.source}`] : []),
    ...(meta.deletedAt ? [`deletedAt: ${meta.deletedAt}`] : []),
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

/** 检索：整词/中文 bigram 命中 path + 正文。返回卡片摘要（带命中度）。minScore 过滤弱命中；semantic=true 加本地语义分；有反馈则据此反哺排序。 */
export async function search(root, query, { limit = 30, minScore = 0, semantic = false } = {}) {
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
    // 本地语义加分：Jaccard bigram 相似度（无 embedding 依赖），覆盖「同义改写/片段命中」
    if (semantic) score += Math.round(textSimilarity(q, `${card.title} ${card.summary}`) * 6)
    if (score > 0 && score >= minScore) {
      out.push({ ...card, score })
    }
  }
  // 反馈反哺排序：对该查询「有用」的卡加分、「无关」的减分；query 与本次有词交集即生效。
  const fb = await readFeedback(root)
  const ql = q.toLowerCase()
  const fbByPath = {}
  for (const f of fb) {
    if (!f.path) continue
    const fq = String(f.query || '').toLowerCase()
    const overlap = fq && (fq === ql || ql.includes(fq) || fq.includes(ql) || queryTerms(f.query).some((term) => wanted.includes(term)))
    if (!overlap) continue
    const rec = fbByPath[f.path] = fbByPath[f.path] || { useful: 0, irr: 0 }
    if (f.useful) rec.useful += 1; else rec.irr += 1
  }
  for (const hit of out) {
    const rec = fbByPath[hit.path]
    if (rec) hit.score += rec.useful * 2 - rec.irr * 2
  }
  out.sort((a, b) => b.score - a.score || b.mtime - a.mtime)
  return out.slice(0, limit)
}

/** 当日简报：按 mtime 列出今天新增/更新的卡（供每日回顾）。 */
export function dailyBrief(cardsToday) {
  if (!cardsToday || cardsToday.length === 0) return '今天还没有新的记忆沉淀。'
  return cardsToday.map((c) => `- ${c.kind}｜${c.title}`).join('\n')
}

/** 生成今日简报文件到 00-System/daily-YYYY-MM-DD.md，幂等（已存在则跳过）。 */
export async function generateDailyBrief(root) {
  const d = new Date()
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const dir = path.join(root, '00-System')
  const file = path.join(dir, `daily-${date}.md`)
  try {
    if (await exists(file)) return { ok: true, existed: true, file }
    const s = await stats(root)
    const content = `---\nkind: prompt\ntitle: 每日回顾 ${date}\ntags: [每日回顾, 统计]\ncreated: ${new Date().toISOString()}\nupdated: ${new Date().toISOString()}\nsource: daily-brief\nstatus: approved\n---\n# 每日回顾 ${date}\n\n今日新增 ${s.today} · 近 7 天 ${s.week} · 总 ${s.total}\n\n## 今日沉淀\n${dailyBrief(s.todayCards)}\n`
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(file, content, 'utf8')
    return { ok: true, existed: false, file }
  } catch (e) {
    return { ok: false, error: String(e.message || e) }
  }
}

/** 用量趋势：返回最近 N 天每天新增卡片数 [{date, count}]。 */
export async function dailyCounts(root, days = 30) {
  const cards = await listCards(root)
  const now = Date.now()
  const buckets = {}
  for (let d = 0; d < days; d++) {
    const date = new Date(now - d * 86400000)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    buckets[key] = 0
  }
  for (const c of cards) {
    if (!c.created) continue
    const d = new Date(c.created)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (key in buckets) buckets[key]++
  }
  return Object.entries(buckets).sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }))
}

/** 导出全部卡片原始 Markdown。 */
export async function exportCards(root) {
  const cards = await listCards(root)
  const out = []
  for (const c of cards) {
    try { out.push({ path: c.path, title: c.title, kind: c.kind, text: await fs.readFile(path.join(root, c.path), 'utf8') }) } catch { /* 跳过坏文件 */ }
  }
  return out
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
    updated: c.updated,
    mtime: c.mtime,
    linkCount: 0,
  }))
  const nodeById = new Map(nodes.map((n) => [n.id, n]))
  const addDegree = (p) => { const n = nodeById.get(p); if (n) n.linkCount++ }
  const edges = []
  const seen = new Set()
  const bodies = new Map()
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
    bodies.set(card.path, text)
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
          addEdge(card.path, cand, 'link'); addDegree(card.path); addDegree(cand)
          break
        }
      }
      // 也允许按标题匹配
      for (const other of cards) {
        if (other.path !== card.path && (other.title === raw || other.path.endsWith(`/${raw}.md`))) {
          addEdge(card.path, other.path, 'link'); addDegree(card.path); addDegree(other.path)
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
  // 相似度关联建议：仅在同 kind 或共享标签的候选间计算 Jaccard，>0.42 连一条「similar」边，每节点最多 1 条，避免稠密发丝球。
  const similarCount = {}
  const simCandidates = []
  for (const c of cards) simCandidates.push(c.path)
  for (let i = 0; i < simCandidates.length; i++) for (let j = i + 1; j < simCandidates.length; j++) {
    const a = simCandidates[i], b = simCandidates[j]
    const ca = byPath.get(a), cb = byPath.get(b)
    if (!ca || !cb) continue
    if (ca.kind !== cb.kind && !ca.tags.some((t) => cb.tags.includes(t))) continue
    if ((similarCount[a] || 0) >= 1 || (similarCount[b] || 0) >= 1) continue
    const sim = textSimilarity(bodies.get(a) || '', bodies.get(b) || '')
    if (sim >= 0.42) { addEdge(a, b, 'similar'); addDegree(a); addDegree(b); similarCount[a] = (similarCount[a] || 0) + 1; similarCount[b] = (similarCount[b] || 0) + 1 }
  }
  return { nodes, edges }
}

/** 统计（增强）：overview 全量 + 今日/本周新增 + 今日新增卡片明细。 */
export async function stats(root) {
  const cards = await listCards(root)
  const byKind = {}
  for (const c of cards) byKind[c.kind] = (byKind[c.kind] || 0) + 1
  const now = Date.now()
  const day = now - 86400000
  const week = now - 7 * 86400000
  const today = cards.filter((c) => c.mtime > day)
  const tagSet = new Set()
  for (const c of cards) for (const t of c.tags) tagSet.add(t)
  return {
    total: cards.length,
    today: today.length,
    week: cards.filter((c) => c.mtime > week).length,
    tags: tagSet.size,
    byKind,
    todayCards: today.slice(0, 30).map((c) => ({ path: c.path, title: c.title, kind: c.kind, updated: c.updated, summary: c.summary.slice(0, 80) })),
  }
}

/** 跨库聚合图谱：roots = [{name, root}]，每个 vault 的子图合并（node id 前缀 profile 名避免冲突）。 */
export async function graphAll(roots) {
  const nodes = []; const edges = []; const idSet = new Set()
  for (const r of roots) {
    let g
    try { g = await graph(r.root) } catch { continue }
    const pref = r.name ? `${r.name}::` : ''
    const map = new Map()
    for (const n of g.nodes) { const id = pref + n.id; if (!idSet.has(id)) { idSet.add(id); map.set(n.id, id); nodes.push({ ...n, id }) } else map.set(n.id, id) }
    for (const e of g.edges) { const s = map.get(e.source) || (pref + e.source), t = map.get(e.target) || (pref + e.target); if (s && t) edges.push({ source: s, target: t, type: e.type }) }
  }
  return { nodes, edges }
}

/** 跨库聚合检索：多个 vault 的结果合并（path 前缀 profile 名）。 */
export async function searchAll(roots, query, opts = {}) {
  const out = []
  for (const r of roots) {
    let hits
    try { hits = await search(r.root, query, opts) } catch { continue }
    const pref = r.name ? `${r.name}::` : ''
    for (const h of hits) out.push({ ...h, path: pref + h.path, score: (h.score || 0) + (r.name ? 0 : 0), profile: r.name || '' })
  }
  out.sort((a, b) => b.score - a.score || b.mtime - a.mtime)
  return out.slice(0, opts.limit || 30)
}

/** 整理建议（非破坏性预览）：高相似卡对 + 陈旧卡（>90 天未更新且无连线）。 */
export async function optimizeCandidates(root) {
  const cards = await listCards(root)
  const merge = []
  const bodies = new Map()
  for (const c of cards) {
    try { bodies.set(c.path, (await fs.readFile(path.join(root, c.path), 'utf8')).slice(0, 4000)) } catch { bodies.set(c.path, '') }
  }
  for (let i = 0; i < cards.length; i++) for (let j = i + 1; j < cards.length; j++) {
    const a = cards[i], b = cards[j]
    if (a.kind !== b.kind) continue
    const sim = textSimilarity(bodies.get(a.path) || '', bodies.get(b.path) || '')
    if (sim >= 0.55) merge.push({ a: { path: a.path, title: a.title }, b: { path: b.path, title: b.title }, sim: Math.round(sim * 100) / 100 })
  }
  merge.sort((x, y) => y.sim - x.sim)
  const old = Date.now() - 90 * 86400000
  const stale = cards.filter((c) => c.mtime < old).slice(0, 30).map((c) => ({ path: c.path, title: c.title, updated: c.updated }))
  return { merge: merge.slice(0, 40), stale }
}

/**
 * 一键优化执行：根据 /optimize 候选合并相似卡 + （可选）清理陈旧卡。
 * @param {string} root
 * @param {object} [opts]
 * @param {number} [opts.simThreshold=0.55]   相似度阈值（与 optimizeCandidates 一致）
 * @param {number} [opts.staleDays=90]        多久未更新视为「陈旧」
 * @param {boolean} [opts.cleanupStale=false] 默认不动陈旧卡（用户敏感）
 * @param {boolean} [opts.dryRun=false]       只返回计划，不执行
 * @returns {Promise<{ok:true, plan:{merged:number, staleDeleted:number, staleSkipped:number}, merged:[{from,to}], staleDeleted:[string], staleSkipped:[string], errors:[string]}>}
 */
export async function optimizeApply(root, opts = {}) {
  const simThreshold = Number(opts.simThreshold ?? 0.55)
  const staleDays = Number(opts.staleDays ?? 90)
  const cleanupStale = Boolean(opts.cleanupStale)
  const dryRun = Boolean(opts.dryRun)
  const cands = await optimizeCandidates(root)
  const merge = cands.merge
  const stale = cands.stale
  const merged = []
  const staleDeleted = []
  const staleSkipped = []
  const errors = []
  const used = new Set()
  for (const pair of merge) {
    if (used.has(pair.a.path) || used.has(pair.b.path)) continue
    if (pair.sim < simThreshold) continue
    if (!dryRun) {
      try {
        const r = await mergeCards(root, [pair.a.path, pair.b.path])
        if (r && r.ok) {
          merged.push({ from: [pair.a.path, pair.b.path], to: r.path, sim: pair.sim })
          used.add(pair.a.path); used.add(pair.b.path)
        } else { errors.push(`merge ${pair.a.path}+${pair.b.path}: ${r?.error || '失败'}`) }
      } catch (e) { errors.push(`merge ${pair.a.path}+${pair.b.path}: ${e?.message || e}`) }
    } else {
      merged.push({ from: [pair.a.path, pair.b.path], to: '(dry-run)', sim: pair.sim })
      used.add(pair.a.path); used.add(pair.b.path)
    }
  }
  if (cleanupStale) {
    for (const s of stale) {
      if (!dryRun) {
        try { await deleteCard(root, s.path); staleDeleted.push(s.path) } catch (e) { errors.push(`delete ${s.path}: ${e?.message || e}`); staleSkipped.push(s.path) }
      } else { staleDeleted.push(s.path) }
    }
  } else {
    for (const s of stale) staleSkipped.push(s.path)
  }
  return {
    ok: true,
    dryRun,
    plan: { merged: merged.length, staleDeleted: staleDeleted.length, staleSkipped: staleSkipped.length },
    merged,
    staleDeleted,
    staleSkipped,
    errors,
  }
}

/** 召回反馈记录：命中是否有用（供相关性调优）。文件存 vault 根 `.feedback.json`。 */
export async function readFeedback(root) {
  try { return JSON.parse(await fs.readFile(path.join(root, '.feedback.json'), 'utf8')) } catch { return [] }
}
export async function addFeedback(root, rec) {
  const list = await readFeedback(root)
  list.unshift({ ts: Date.now(), ...rec })
  await fs.writeFile(path.join(root, '.feedback.json'), JSON.stringify(list.slice(0, 500), null, 2), 'utf8')
  return { ok: true }
}

/** 统计：按 kind 计数 + 最近 7 天更新数 + 总标签数。 */
export async function overview(root) {  const cards = await listCards(root, { status: ['approved', 'pending', 'rejected'] })
  const byKind = {}
  const statusCounts = {}
  for (const c of cards) { byKind[c.kind] = (byKind[c.kind] || 0) + 1; statusCounts[c.status] = (statusCounts[c.status] || 0) + 1 }
  const week = Date.now() - 7 * 86400000
  const recent = cards.filter((c) => c.mtime > week).length
  const tagSet = new Set()
  for (const c of cards) for (const t of c.tags) tagSet.add(t)
  return {
    total: cards.length,
    byKind,
    recent,
    tags: tagSet.size,
    status: statusCounts,
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
