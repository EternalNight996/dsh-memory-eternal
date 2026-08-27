// 记忆核心 · API 层集成测试：直接调用 handleApi 逻辑对应的 vault 函数，
// 覆盖 client 会用到的 overview / cards / search / graph / card 数据形状。
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { ensureVault, writeCard, listCards, readCard, search, graph, overview, stats, optimizeCandidates, graphAll, searchAll } from '../lib/vault.js'

const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mc-api-'))
const root = path.join(tmpRoot, 'vault')
after(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true })
})

test('API data shapes: overview', async () => {
  await ensureVault(root)
  await writeCard(root, { kind: 'knowledge', title: 'A', tags: ['t1'], body: '内容A足够长以便写入知识库文件。这是关于知识卡片的内容，用于验证数据形状。' })
  await writeCard(root, { kind: 'project', title: 'B', tags: ['t1'], body: '项目B的进展与里程碑规划，包括团队分工和交付时间表，用于验证项目类卡片的写入。' })
  const ov = await overview(root)
  assert.equal(ov.total, 2)
  assert.equal(ov.byKind.knowledge, 1)
  assert.equal(ov.byKind.project, 1)
  assert.equal(ov.roots.knowledge, '03-Knowledge/')
  assert.equal(ov.roots.project, '02-Projects/')
})

test('API data shapes: cards list with filter', async () => {
  const cards = await listCards(root)
  assert.equal(cards.length, 2)
  const knowledgeOnly = cards.filter((c) => c.kind === 'knowledge')
  assert.equal(knowledgeOnly.length, 1)
  for (const c of cards) {
    assert.equal(typeof c.title, 'string')
    assert.ok(Array.isArray(c.tags))
    assert.equal(typeof c.path, 'string')
    assert.equal(typeof c.mtime, 'number')
  }
})

test('API data shapes: card text', async () => {
  const cards = await listCards(root)
  const text = await readCard(root, cards[0].path)
  assert.ok(text.includes('---'))
  assert.ok(text.includes('#'))
})

test('API data shapes: search hits carry score', async () => {
  const hits = await search(root, '内容A')
  assert.ok(hits.length >= 1)
  assert.ok(hits[0].score >= 1)
})

test('API data shapes: graph nodes+edges', async () => {
  const g = await graph(root)
  assert.equal(g.nodes.length, 2)
  // 共享标签 t1 → 应有 tag 边
  const tagEdge = g.edges.find((e) => e.type.startsWith('tag:'))
  assert.ok(tagEdge)
  assert.ok(g.nodes.every((n) => typeof n.id === 'string' && typeof n.title === 'string'))
})

test('API data shapes: stats (overview + todayCards + byKind)', async () => {
  const s = await stats(root)
  assert.equal(s.total, 2)
  assert.equal(s.byKind.knowledge, 1)
  assert.equal(s.byKind.project, 1)
  assert.ok(Array.isArray(s.todayCards))
  assert.equal(s.todayCards.length, 2)
  assert.equal(typeof s.week, 'number')
  assert.equal(typeof s.tags, 'number')
})

test('API data shapes: optimizeCandidates returns merge/stale arrays', async () => {
  const o = await optimizeCandidates(root)
  assert.ok(Array.isArray(o.merge))
  assert.ok(Array.isArray(o.stale))
})

test('API data shapes: cross-vault graphAll + searchAll aggregate', async () => {
  const aRoot = path.join(tmpRoot, 'a')
  const bRoot = path.join(tmpRoot, 'b')
  await ensureVault(aRoot)
  await ensureVault(bRoot)
  await writeCard(aRoot, { kind: 'knowledge', title: 'A', tags: ['t1'], body: '跨库聚合内容足够长便于写入知识库文件以验证聚合。' }, { dedup: false })
  await writeCard(bRoot, { kind: 'knowledge', title: 'B', tags: ['t1'], body: '跨库聚合另一张内容足够长便于写入知识库文件以验证聚合。' }, { dedup: false })
  const roots = [{ name: '', root: aRoot }, { name: 'v2', root: bRoot }]
  const g = await graphAll(roots)
  assert.ok(g.nodes.length >= 2)
  // 命名 profile 的节点 id 前缀 'name::' 防冲突；当前(active)根保持原 id
  assert.ok(g.nodes.some((n) => n.id.startsWith('v2::')), '命名 profile 节点应带 v2:: 前缀')
  const hits = await searchAll(roots, '跨库聚合', { limit: 10 })
  assert.ok(hits.length >= 2)
})
