// 记忆核心 · capture 层单元测试（llm 用假对象注入，不联网）
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { ensureVault, listCards, readCard } from '../lib/vault.js'
import { summarizeTurn, extractLastTurn, sliceNewEvents, parseCaptureJson, captureCard, captureUpdate, makeDedupChecker, pickNeighbors, DEDUP_THRESHOLD, compressExcerpt } from '../lib/capture.js'

const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mc-cap-'))
const root = path.join(tmpRoot, 'vault')
after(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true })
})

/** 假 llm：按 BlockAssembler 期望的 StreamChunk 格式输出文本块。 */
function fakeLlm(responseText) {
  return {
    stream: async function* () {
      yield { type: 'block-start', index: 0, blockType: 'text' }
      const chunks = responseText.match(/.{1,50}/gs) || []
      for (const text of chunks) yield { type: 'text-delta', index: 0, text }
      yield { type: 'block-end', index: 0, block: { type: 'text', text: responseText } }
      yield { type: 'finish', reason: 'stop' }
    },
  }
}

test('DEDUP_THRESHOLD matches boujoy default', () => {
  assert.equal(DEDUP_THRESHOLD, 0.62)
})

test('summarizeTurn returns parsed card from model JSON', async () => {
  const llm = fakeLlm(JSON.stringify({
    save: true,
    title: 'React 性能优化要点',
    kind: 'knowledge',
    tags: ['react', '性能'],
    body: '# React 性能优化要点\n\n- 使用 memo 减少重渲染\n- 用 useMemo 缓存计算',
  }))
  const talk = [
    '用户：我的React应用列表滚动很卡，怎么优化？',
    '助手：可以用React.memo包裹子组件减少不必要的重渲染，用useMemo缓存昂贵的计算结果，虚拟滚动可以大幅减少DOM节点数量，还应该检查是否在渲染循环里创建了新的内联对象。',
    '用户：虚拟滚动怎么选？',
    '助手：react-window轻量适合简单列表，react-virtualized功能全但包大；数据量上万且行高固定时优先react-window。',
  ].join('\n')
  const result = await summarizeTurn(llm, { provider: 'p', model: 'm' }, talk)
  assert.equal(result.save, true)
  assert.equal(result.title, 'React 性能优化要点')
  assert.equal(result.kind, 'knowledge')
  assert.deepEqual(result.tags, ['react', '性能'])
})

test('summarizeTurn skips trivial talk (heuristic prefilter, no LLM call)', async () => {
  const llm = fakeLlm(JSON.stringify({ save: false }))
  const talk = '用户：你好，在吗？\n助手：你好，我在的，请问有什么可以帮你？\n用户：没什么，随便问问。\n助手：好的，有需要随时找我。'
  // 纯寒暄无「可复用信号」：预筛直接跳过，不触发 LLM，返回 null（省 token）
  const result = await summarizeTurn(llm, { provider: 'p', model: 'm' }, talk.repeat(3))
  assert.equal(result, null)
})

test('summarizeTurn rejects too-short conversation', async () => {
  const result = await summarizeTurn(fakeLlm('{}'), { provider: 'p', model: 'm' }, 'hi')
  assert.equal(result, null)
})

test('parseCaptureJson tolerates code fences and garbage', () => {
  const good = parseCaptureJson('```json\n{"save":true,"title":"T","kind":"knowledge","tags":[],"body":"# T\\n\\n这是一段足够长的正文内容，用于验证解析逻辑能够正确处理带代码围栏的模型输出。"}```')
  assert.equal(good.save, true)
  const bad = parseCaptureJson('这里没有 JSON')
  assert.equal(bad, null)
})

test('parseCaptureJson handles append_to form', () => {
  const append = parseCaptureJson('{"append_to": "03-Knowledge/缓存策略.md", "update": "补充：增加随机过期防止雪崩。"}')
  assert.equal(append.append_to, '03-Knowledge/缓存策略.md')
  assert.ok(append.update.includes('随机过期'))
  // append_to 但没有 update 文本 → 无效
  assert.equal(parseCaptureJson('{"append_to": "x.md", "update": "短"}'), null)
})

test('compressExcerpt keeps structured lines and caps length', () => {
  const src = '# 标题\n- 要点一：数据库索引\n- 要点二：B+树加速\n普通的一句话，不讲结论。'
  const out = compressExcerpt(src, 400)
  assert.ok(out.includes('要点一'))
  assert.ok(out.length <= 410)
  const big = compressExcerpt('x'.repeat(5000), 100)
  assert.ok(big.length <= 120)
  assert.ok(big.includes('已压缩'))
})

test('pickNeighbors ranks existing cards by keyword overlap', async () => {
  const freshRoot = path.join(tmpRoot, 'vault-neighbors')
  await ensureVault(freshRoot)
  await captureCard(freshRoot, { kind: 'knowledge', title: 'Redis缓存策略', tags: ['redis'], body: 'Redis缓存热点数据，TTL设置，缓存穿透与雪崩处理。' })
  await captureCard(freshRoot, { kind: 'knowledge', title: '前端构建工具', tags: ['vite'], body: 'Vite 基于 esbuild 与 Rollup。' })
  const draft = { title: '缓存策略补充', body: 'Redis缓存TTL雪崩穿透问题再讨论' }
  const neighbors = await pickNeighbors(freshRoot, draft, 8)
  assert.ok(neighbors.length >= 1)
  assert.ok(neighbors[0].title.includes('缓存'), '缓存相关卡应排第一')
})

test('summarizeTurn with existing index can decide append_to', async () => {
  const llm = fakeLlm(JSON.stringify({
    append_to: '03-Knowledge/缓存策略.md',
    update: '补充：增加随机过期防止缓存雪崩，大key用分段缓存降低序列化开销。',
  }))
  const talk = [
    '用户：缓存雪崩怎么解决？',
    '助手：可以在TTL上增加随机过期时间，避免大量key同时失效；另外用互斥锁重建缓存，或者加一层兜底限流；大key用分段缓存降低序列化开销。',
    '用户：和缓存穿透是一回事吗？',
    '助手：不是，穿透是查不存在的数据，用空值缓存或布隆过滤器解决；雪崩是大量key同时过期。',
  ].join('\n')
  const result = await summarizeTurn(llm, { provider: 'p', model: 'm' }, talk, {
    existing: [{ path: '03-Knowledge/缓存策略.md', title: 'Redis缓存策略', summary: 'Redis缓存热点数据TTL与穿透处理' }],
  })
  assert.equal(result.append_to, '03-Knowledge/缓存策略.md')
})

test('extractLastTurn pulls all user + assistant text in the given slice', () => {
  const events = [
    { type: 'user/message', data: { turn: 1, role: 'user', content: [{ type: 'text', text: '第一轮问题' }] } },
    { type: 'assistant/message', data: { turn: 1, role: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: '第一轮回答' }] } } },
    { type: 'user/message', data: { turn: 2, role: 'user', content: [{ type: 'text', text: '第二轮问题' }] } },
    { type: 'assistant/message', data: { turn: 2, role: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: '第二轮回答' }] } } },
  ]
  const text = extractLastTurn(events)
  assert.ok(text.includes('第一轮问题'))
  assert.ok(text.includes('第一轮回答'))
  assert.ok(text.includes('第二轮问题'))
  assert.ok(text.includes('第二轮回答'))
  // 工具结果等非消息事件不进入文本
  const withTool = [
    ...events,
    { type: 'tool/result', data: { message: { role: 'tool', content: [{ type: 'text', text: '工具输出' }] } } },
  ]
  const text2 = extractLastTurn(withTool)
  assert.ok(!text2.includes('工具输出'))
})

test('sliceNewEvents returns only user/assistant events after lastSeq', () => {
  const events = [
    { type: 'turn/start', data: { turn: 1 }, seq: 0 },
    { type: 'user/message', data: { role: 'user', content: [{ type: 'text', text: '问题1' }] }, seq: 1 },
    { type: 'assistant/message', data: { message: { role: 'assistant', content: [{ type: 'text', text: '回答1' }] } }, seq: 2 },
    { type: 'tool/result', data: { message: { role: 'tool', content: [{ type: 'text', text: '结果' }] } }, seq: 3 },
    { type: 'user/message', data: { role: 'user', content: [{ type: 'text', text: '问题2' }] }, seq: 4 },
    { type: 'assistant/message', data: { message: { role: 'assistant', content: [{ type: 'text', text: '回答2' }] } }, seq: 5 },
  ]
  const fresh = sliceNewEvents(events, 0)
  assert.equal(fresh.length, 4) // 4 条消息事件（1,2,4,5）
  const incremental = sliceNewEvents(events, 2)
  assert.equal(incremental.length, 2) // 只含 4,5
  assert.ok(incremental[0].data.content[0].text.includes('问题2'))
  // 空增量
  assert.equal(sliceNewEvents(events, 99).length, 0)
})

test('captureCard writes with dedup; duplicate appends update instead', async () => {
  const freshRoot = path.join(tmpRoot, 'vault-dedup')
  await ensureVault(freshRoot)
  const body = '讨论缓存策略：Redis缓存热点数据，TTL设为10分钟，缓存穿透用空值缓存解决，并增加随机过期防止雪崩。'
  const first = await captureCard(freshRoot, {
    kind: 'knowledge',
    title: '缓存策略',
    tags: ['redis'],
    body,
  })
  assert.equal(first.ok, true)
  // 高度相似的卡 → 去重拒绝
  const dup = await captureCard(freshRoot, {
    kind: 'knowledge',
    title: '缓存策略再讨论',
    tags: ['redis'],
    body: body + '补充：大key用分段缓存，避免单次序列化过大。',
  })
  assert.equal(dup.ok, false)
  assert.ok(dup.duplicate)
  // 追加更新记录
  const upd = await captureUpdate(freshRoot, dup.duplicate.path, '补充：增加随机过期防止缓存雪崩。')
  assert.equal(upd.ok, true)
  const text = await readCard(freshRoot, dup.duplicate.path)
  assert.ok(text.includes('## 更新记录'))
  const cards = await listCards(freshRoot)
  assert.equal(cards.length, 1, '不应产生重复卡')
})

test('makeDedupChecker scans a directory', async () => {
  await ensureVault(root)
  const body = 'Redis缓存热点数据，TTL设为10分钟，缓存穿透用空值缓存解决，并增加随机过期防止雪崩，大key分段缓存。'
  await captureCard(root, { kind: 'knowledge', title: '缓存策略', tags: ['redis'], body })
  const checker = makeDedupChecker(path.join(root, '03-Knowledge'))
  const hit = await checker(body, 0.62)
  assert.ok(hit)
})
