// 记忆核心 · Config schema 测试：可热改（.volatile）与启动期字段的划线。
// 需要 @deepseek-ai/schemastery（插件的依赖）；未安装时整体跳过，不假装通过。
import { test } from 'node:test'
import assert from 'node:assert/strict'

let z
try {
  z = (await import('@deepseek-ai/schemastery')).default
} catch {
  z = undefined
}

const { buildConfig, BOOT_ONLY_FIELDS, partitionPatch } = await import('../lib/config-schema.js')

test('partitionPatch: everything is written, boot-only fields are flagged for restart', () => {
  // 设置页把整份表单一起提交（含端口 / 保活 / 看门狗）：两类字段都写下去，
  // 但要把「需重启才生效」的那几个点名回给用户。
  const Config = { dict: { captureDebug: {}, captureMinChars: {}, autoWeb: {}, webPort: {}, watchdogAutoSpawn: {} } }
  const { live, needsRestart, unknown } = partitionPatch(Config, {
    captureDebug: true,
    captureMinChars: 120,
    autoWeb: false,
    webPort: 8123,
    notAField: 1,
  })
  assert.deepEqual(live, { captureDebug: true, captureMinChars: 120, autoWeb: false, webPort: 8123 })
  assert.deepEqual(needsRestart.sort(), ['autoWeb', 'webPort'])
  assert.deepEqual(unknown, ['notAField'])

  // 只动启动期字段 → 依然能存下来，只是提示需重启（不再整次失败）
  const onlyBoot = partitionPatch(Config, { webPort: 8123 })
  assert.deepEqual(onlyBoot.live, { webPort: 8123 })
  assert.deepEqual(onlyBoot.needsRestart, ['webPort'])

  // 空 patch / undefined 不该炸
  assert.deepEqual(partitionPatch(Config, undefined).live, {})
  assert.deepEqual(partitionPatch(undefined, { a: 1 }).needsRestart, [])
  assert.deepEqual(partitionPatch(undefined, { a: 1 }).unknown, ['a'])
})

test('config schema: every field is writable, boot-only ones are only flagged', { skip: z ? false : '@deepseek-ai/schemastery 未安装' }, () => {
  const Config = buildConfig(z)
  const dict = Config.dict ?? {}
  const keys = Object.keys(dict)
  assert.ok(keys.length > 30, `字段数异常：${keys.length}`)

  // 宿主 0.2.x 只接受 volatile 字段，且设置页是整份表单一起提交：
  // 只要有字段没标，整次保存就会报 `is not volatile`（线上实测）。
  const notVolatile = keys.filter((k) => dict[k]?.meta?.volatile !== true)
  assert.deepEqual(notVolatile, [], '所有字段都要标 volatile，否则整份表单保存会被宿主整批驳回')

  // 「改了要重启」的字段由 BOOT_ONLY_FIELDS 单独标注（与能不能写解耦）。
  for (const k of BOOT_ONLY_FIELDS) assert.ok(keys.includes(k), `启动期字段 ${k} 不存在于 schema`)

  // 沉淀/召回相关的高频旋钮必须可热改（这正是设置页主要用来调的东西）。
  for (const k of ['enabled', 'autoCapture', 'autoRecall', 'captureMinChars', 'captureDebug', 'captureFallbackToRaw', 'distillEnabled', 'dedupThreshold', 'maxCardsPerDay', 'recallLimit', 'auditMode', 'webPort']) {
    assert.equal(dict[k]?.meta?.volatile, true, `${k} 应可热改`)
  }

  // 每个 volatile 字段都得落在固定对象路径上（宿主会拒绝 dict/动态键下的 volatile）。
  for (const k of keys) {
    const node = dict[k]
    assert.notEqual(node?.meta?.dict, true, `${k} 若是 dict 则不能标 volatile（宿主会抛 volatile fields require a fixed object path）`)
  }

  // 分区语义：全部可写；启动期字段额外进 needsRestart；未知键单独报告
  const part = partitionPatch(Config, { captureDebug: true, webPort: 8123, vaultDir: 'E:/v', nope: 1 })
  assert.deepEqual(Object.keys(part.live).sort(), ['captureDebug', 'vaultDir', 'webPort'])
  assert.deepEqual(part.needsRestart, ['webPort'])
  assert.deepEqual(part.unknown, ['nope'])
})

test('config schema: defaults survive the volatile wrapper', { skip: z ? false : '@deepseek-ai/schemastery 未安装' }, () => {
  const Config = buildConfig(z)
  // 直接读 meta.default：宿主设置页同样只依赖 schema 的 meta，不依赖某版本的解析入口签名。
  const dflt = (k) => Config.dict[k]?.meta?.default
  assert.equal(dflt('autoCapture'), true)
  assert.equal(dflt('captureDebug'), false)
  assert.equal(dflt('captureFallbackToRaw'), false)
  assert.equal(dflt('captureMinChars'), 200)
  assert.equal(dflt('webPort'), 7999)
  assert.deepEqual(dflt('vaultProfiles'), [])
})

test('vol() is a no-op when the host schema library has no .volatile()', () => {
  // 老宿主 / 老 schemastery：没有 .volatile 时必须原样返回，否则整个插件起不来。
  const node = () => {
    const field = { meta: {}, default: () => field, min: () => field, max: () => field, role: () => field }
    return field
  }
  const fake = {
    object: (shape) => ({ dict: shape }),
    boolean: () => node(),
    string: () => node(),
    number: () => node(),
    array: () => node(),
    dict: () => node(),
    const: () => node(),
    union: () => node(),
  }
  const Config = buildConfig(fake)
  assert.ok(Object.keys(Config.dict).length > 30)
  for (const field of Object.values(Config.dict)) assert.equal(field.meta.volatile, undefined)
})
