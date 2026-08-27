// 记忆核心 · vault 层单元测试（无 DSH 依赖，node 直跑）
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  parseCard, safeSlug, textSimilarity, queryTerms, ensureVault, listCards,
  writeCard, readCard, appendUpdate, search, graph, overview, dedupCheck,
  stats, optimizeCandidates, searchAll, graphAll, dailyBrief, generateDailyBrief, readFeedback, addFeedback, mergeCards,
} from '../lib/vault.js'

const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mc-vault-'))
after(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true })
})

let counter = 0
const freshRoot = async () => {
  const root = path.join(tmpRoot, `vault-${counter++}`)
  await ensureVault(root)
  return root
}

test('ensureVault creates 00-System and 02-06 roots', async () => {
  const root = await freshRoot()
  for (const dir of ['00-System', '02-Projects', '03-Knowledge', '04-Content', '05-Prompts', '06-Business']) {
    await assert.doesNotReject(fs.access(path.join(root, dir)))
  }
})

test('parseCard extracts frontmatter + body', () => {
  const text = `---\nkind: knowledge\ntitle: 测试卡\ntags: [a, b]\ncreated: 2026-01-01\n---\n# 测试卡\n\n内容正文`
  const { meta, body } = parseCard(text)
  assert.equal(meta.kind, 'knowledge')
  assert.equal(meta.title, '测试卡')
  assert.deepEqual(meta.tags, ['a', 'b'])
  assert.ok(body.includes('内容正文'))
})

test('safeSlug keeps CJK and replaces illegal chars', () => {
  assert.equal(safeSlug('Hello World'), 'hello-world')
  assert.equal(safeSlug('数据库 选型!'), '数据库-选型')
  assert.equal(safeSlug(''), 'card')
})

test('textSimilarity: identical ~1, disjoint ~0', () => {
  const a = '今天学习强化学习的策略梯度方法，核心是梯度估计'
  assert.ok(textSimilarity(a, a) > 0.95)
  assert.ok(textSimilarity(a, '天气很好我们去公园散步吃饭') < 0.1)
  assert.equal(textSimilarity('', 'abc'), 0)
})

test('queryTerms: CJK bigram + whole token', () => {
  const terms = queryTerms('强化学习 蒸馏')
  assert.ok(terms.has('强化学习'))
  assert.ok(terms.has('强化'))
  assert.ok(terms.has('蒸馏'))
})

test('writeCard + listCards + readCard roundtrip', async () => {
  const root = await freshRoot()
  const out = await writeCard(root, {
    kind: 'knowledge',
    title: '强化学习基础',
    tags: ['rl', '机器学习'],
    body: '策略梯度是一类直接优化策略参数的强化学习方法。\n- 优点：连续动作空间友好\n- 缺点：方差大',
    source: 'session:test',
  })
  assert.equal(out.ok, true)
  assert.ok(out.path.startsWith('03-Knowledge/'))
  const cards = await listCards(root)
  assert.equal(cards.length, 1)
  assert.equal(cards[0].title, '强化学习基础')
  assert.deepEqual(cards[0].tags, ['rl', '机器学习'])
  const text = await readCard(root, out.path)
  assert.ok(text.includes('策略梯度'))
})

test('dedup guard refuses near-duplicate card', async () => {
  const root = await freshRoot()
  const bodyA = '我们讨论了PostgreSQL与MySQL的选型问题，最终确定使用PostgreSQL，因为它的扩展性和JSONB支持更好，团队也更熟悉，迁移成本可控。同时我们决定用pgvector做向量检索，与现有ORM集成。'
  // 近重复：仅追加细节，正文几乎一致 → 应触发去重
  const bodyB = bodyA + '补充：主从复制用流复制，故障切换由Patroni管理，备份用pgBackRest。'
  const a = await writeCard(root, { kind: 'knowledge', title: '数据库选型-分析', body: bodyA })
  assert.equal(a.ok, true)
  const b = await writeCard(root, { kind: 'knowledge', title: '数据库选型-结论', body: bodyB })
  assert.equal(b.ok, false)
  assert.ok(b.duplicate)
  const c = await writeCard(root, { kind: 'knowledge', title: '前端构建工具', body: 'vite基于esbuild和rollup，开发体验好，生态成熟，适合中大型项目。HMR极快，配置简单，社区插件丰富。' })
  assert.equal(c.ok, true)
})

test('appendUpdate appends update record and bumps updated', async () => {
  const root = await freshRoot()
  const out = await writeCard(root, { kind: 'knowledge', title: '部署方案', body: '使用Docker Compose部署三个服务，Nginx做反代，配置了健康检查。' })
  const updated = await appendUpdate(root, out.path, '补充：增加自动扩容策略，基于CPU使用率。')
  assert.equal(updated.ok, true)
  const text = await readCard(root, out.path)
  assert.ok(text.includes('## 更新记录'))
  assert.ok(text.includes('自动扩容策略'))
})

test('search: CJK fragment finds cards', async () => {
  const root = await freshRoot()
  await writeCard(root, { kind: 'knowledge', title: '强化学习基础', tags: ['rl'], body: '策略梯度是一类直接优化策略参数的强化学习方法。', source: 'session:x' })
  const hits = await search(root, '策略梯度')
  assert.ok(hits.length >= 1)
  assert.ok(hits[0].title.includes('强化学习'))
  const miss = await search(root, '量子计算')
  assert.equal(miss.length, 0)
})

test('graph: wikilink + shared tag edges', async () => {
  const root = await freshRoot()
  await writeCard(root, { kind: 'knowledge', title: '强化学习基础', tags: ['rl'], body: '策略梯度是核心。参考 [[数据库选型]]', source: 'session:x' })
  await writeCard(root, { kind: 'knowledge', title: '数据库选型', tags: ['rl'], body: 'PostgreSQL 优于 MySQL。', source: 'session:x' })
  const g = await graph(root)
  assert.equal(g.nodes.length, 2)
  const linkEdges = g.edges.filter((e) => e.type === 'link')
  assert.ok(linkEdges.length >= 1, 'wikilink 应产生连线')
  const tagEdges = g.edges.filter((e) => e.type.startsWith('tag:'))
  assert.ok(tagEdges.length >= 1, '共享标签应产生连线')
})

test('overview aggregates counts', async () => {
  const root = await freshRoot()
  await writeCard(root, { kind: 'knowledge', title: 'A', body: '内容A足够长以便写入知识库文件。' })
  await writeCard(root, { kind: 'project', title: 'B', body: '内容B足够长以便写入知识库文件。' })
  const ov = await overview(root)
  assert.equal(ov.total, 2)
  assert.equal(ov.byKind.knowledge, 1)
  assert.equal(ov.byKind.project, 1)
  assert.equal(typeof ov.recent, 'number')
})

test('dedupCheck finds best match in dir', async () => {
  const root = await freshRoot()
  await writeCard(root, { kind: 'knowledge', title: '数据库选型', body: 'PostgreSQL与MySQL选型，结论是PostgreSQL，扩展性与JSONB是关键。团队熟悉，迁移成本可控，向量检索用pgvector。' })
  const dir = path.join(root, '03-Knowledge')
  const hit = await dedupCheck(dir, 'PostgreSQL与MySQL选型，结论是PostgreSQL，扩展性与JSONB是关键。团队熟悉，迁移成本可控，向量检索用pgvector。', 0.62)
  assert.ok(hit)
  assert.ok(hit.path.includes('.md'))
})

test('stats returns overview + todayCards', async () => {
  const root = await freshRoot()
  await writeCard(root, { kind: 'knowledge', title: '知识点A', tags: ['t1'], body: '内容A足够长便于写入知识库文件。' })
  const s = await stats(root)
  assert.equal(s.total, 1)
  assert.ok(s.today >= 1)
  assert.ok(s.todayCards.length >= 1)
  assert.equal(s.byKind.knowledge, 1)
  assert.equal(typeof s.week, 'number')
})

test('optimizeCandidates returns merge/stale (non-destructive)', async () => {
  const root = await freshRoot()
  const a = '数据库索引B+树的原理与加速机制，索引是数据库为加速查找而额外维护的数据结构。'
  const b = '数据库索引B+树加速查询的原理，索引为数据库加速查找，是额外维护的数据结构。'
  await writeCard(root, { kind: 'knowledge', title: '索引A', tags: [], body: a }, { dedup: false })
  await writeCard(root, { kind: 'knowledge', title: '索引B', tags: [], body: b }, { dedup: false })
  const o = await optimizeCandidates(root)
  assert.ok(Array.isArray(o.merge))
  assert.ok(Array.isArray(o.stale))
  assert.ok(o.merge.length >= 1, '相似卡应进入合并建议')
})

test('search semantic + minScore + feedback roundtrip', async () => {
  const root = await freshRoot()
  await writeCard(root, { kind: 'knowledge', title: 'React性能', tags: [], body: 'React memo 和 useMemo 优化重渲染性能。' })
  const hits = await search(root, 'react性能', { limit: 10, semantic: true })
  assert.ok(hits.length >= 1)
  await addFeedback(root, { query: 'react性能', path: hits[0].path, useful: true })
  const fb = await readFeedback(root)
  assert.ok(fb.length >= 1)
  assert.equal(fb[0].useful, true)
})

test('cross-vault searchAll + graphAll aggregate multiple roots', async () => {
  const a = await freshRoot(); const b = await freshRoot()
  await writeCard(a, { kind: 'knowledge', title: 'A卡', tags: [], body: '跨库内容一件大事。' })
  await writeCard(b, { kind: 'knowledge', title: 'B卡', tags: [], body: '跨库内容另一件大事。' })
  const roots = [{ name: '', root: a }, { name: 'v2', root: b }]
  const hits = await searchAll(roots, '跨库内容', { limit: 10 })
  assert.ok(hits.length >= 1)
  const g = await graphAll(roots)
  assert.ok(Array.isArray(g.nodes))
  assert.ok(g.nodes.length >= 1)
})

test('dailyBrief + generateDailyBrief idempotent', async () => {
  const root = await freshRoot()
  await writeCard(root, { kind: 'knowledge', title: '今日卡', tags: [], body: '今天沉淀的内容正文。' })
  assert.ok(dailyBrief([{ kind: 'knowledge', title: '今日卡' }]).includes('今日卡'))
  const r1 = await generateDailyBrief(root)
  assert.equal(r1.ok, true)
  const r2 = await generateDailyBrief(root)
  assert.equal(r2.existed, true, '生成应幂等，当天已存在则跳过')
})

test('mergeCards: 合并两张同 kind 卡为一张（保留 kind/并集标签/删除原卡）', async () => {
  const root = await freshRoot()
  const a = await writeCard(root, { kind: 'knowledge', title: 'A 卡', tags: ['t1'], body: '内容A足够长便于写入知识库文件。' }, { dedup: false })
  const b = await writeCard(root, { kind: 'knowledge', title: 'B 卡', tags: ['t2'], body: '内容B足够长便于写入知识库文件。' }, { dedup: false })
  const r = await mergeCards(root, [a.path, b.path])
  assert.equal(r.ok, true)
  assert.ok(r.path)
  // 原 2 张应被删除
  const cards = await listCards(root)
  assert.equal(cards.length, 1)
  // 新卡应保留 kind=knowledge、标签并集、含原文 + 分隔符
  const text = await readCard(root, cards[0].path)
  const { meta, body } = parseCard(text)
  assert.equal(meta.kind, 'knowledge')
  assert.ok(meta.tags.includes('t1') && meta.tags.includes('t2'))
  assert.ok(body.includes('内容A足够长'))
  assert.ok(body.includes('内容B足够长'))
  assert.ok(body.includes('---'))
  assert.ok(meta.title.includes('（合并）'))
})

test('mergeCards: <2 张卡应返回错误（不执行合并）', async () => {
  const root = await freshRoot()
  const a = await writeCard(root, { kind: 'knowledge', title: '单卡', tags: [], body: '单卡正文足够长便于写入知识库文件。' }, { dedup: false })
  const r1 = await mergeCards(root, [])
  assert.equal(r1.ok, false)
  const r2 = await mergeCards(root, [a.path])
  assert.equal(r2.ok, false)
  // 原卡应仍在
  assert.equal((await listCards(root)).length, 1)
})
