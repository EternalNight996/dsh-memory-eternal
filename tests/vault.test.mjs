// 记忆核心 · vault 层单元测试（无 DSH 依赖，node 直跑）
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  parseCard, safeSlug, textSimilarity, queryTerms, ensureVault, listCards,
  writeCard, readCard, appendUpdate, search, graph, overview, dedupCheck,
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
