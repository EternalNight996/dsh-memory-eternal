// 记忆核心 · settings-scope 单元测试（不联网、不依赖宿主）：
// 旧宿主（settings.register）/ 新宿主（SettingsForms.mutate）/ 无写入口三种形态。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveSettingsScope, isVolatileRef, plainConfig } from '../lib/settings-scope.js'

const schema = { dict: { autoCapture: {}, captureDebug: {} } }

/** 造一个和宿主 volatile 引用同形的对象：写句柄用全局注册 symbol 做键。 */
const ref = (value) => ({ get: () => value, [Symbol.for('cosmokit.volatile.write')]: () => {} })

test('legacy host: registers a scope and reads through it', () => {
  const calls = []
  let current = { autoCapture: false }
  const settings = {
    register: (ns, sc, opts) => {
      calls.push({ ns, sc, opts })
      return {
        get: () => ({ ...current, ...opts.base }),
        watch: (cb) => { cb(); return () => {} },
        describe: () => [{ namespace: ns, revision: 3 }],
      }
    },
  }
  const scope = resolveSettingsScope(settings, 'memory-eternal', schema, { auditMode: 'none' })
  assert.equal(scope.mode, 'scope')
  assert.equal(scope.get().auditMode, 'none')
  assert.equal(scope.describe()[0].revision, 3)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].ns, 'memory-eternal')
  // 旧宿主没有 entry-mode 的 update（写路径走注册出去的 scope）
  assert.equal(typeof scope.update, 'undefined')
})

test('new host: reads the live row config, falls back to the boot config', () => {
  let live
  const scope = resolveSettingsScope({ mutate: async () => {} }, 'memory-eternal', schema, { autoCapture: true }, () => live)
  assert.equal(scope.mode, 'entry')
  assert.equal(scope.get().autoCapture, true)
  live = { autoCapture: false, captureDebug: true }
  assert.equal(scope.get().captureDebug, true)
  // live 读取抛错时退回启动入参
  const throwing = resolveSettingsScope({}, 'memory-eternal', schema, { auditMode: 'none' }, () => { throw new Error('boom') })
  assert.equal(throwing.get().auditMode, 'none')
  // watch 是空退订函数，不是 undefined
  assert.equal(typeof scope.watch(() => {}), 'function')
})

test('new host: update() translates a patch into namespace path ops', async () => {
  const seen = []
  const scope = resolveSettingsScope(
    { mutate: async (ns, ops, revision) => { seen.push({ ns, ops, revision }) } },
    'memory-eternal', schema, {}, undefined,
  )
  assert.equal(typeof scope.update, 'function')
  await scope.update({ captureDebug: true, captureMinChars: 200, auditMode: 'none' })
  assert.equal(seen.length, 1)
  assert.equal(seen[0].ns, 'memory-eternal')
  assert.deepEqual(seen[0].ops, [
    { op: 'set', path: ['captureDebug'], value: true },
    { op: 'set', path: ['captureMinChars'], value: 200 },
    { op: 'set', path: ['auditMode'], value: 'none' },
  ])
  // 不传 expectedRevision：调用方拿不到宿主 revision，传 0 只会被判冲突
  assert.equal(seen[0].revision, undefined)
  // 空 patch 不产生任何写入
  await scope.update({})
  await scope.update(undefined)
  assert.equal(seen.length, 1)
})

test('new host: a host-side conflict surfaces as SETTINGS_CONFLICT', async () => {
  const scope = resolveSettingsScope(
    { mutate: async () => { const e = new Error('revision conflict'); e.code = 'SETTINGS_CONFLICT'; throw e } },
    'memory-eternal', schema, {}, undefined,
  )
  await assert.rejects(() => scope.update({ autoCapture: false }), (e) => e.code === 'SETTINGS_CONFLICT')
  // 其它错误原样抛出，交由上层回 500 并带上宿主原文
  const plain = resolveSettingsScope(
    { mutate: async () => { throw new Error('disk full') } },
    'memory-eternal', schema, {}, undefined,
  )
  await assert.rejects(() => plain.update({ autoCapture: false }), /disk full/)
})

test('no settings service: no update, so callers keep the honest 501', () => {
  for (const settings of [undefined, null, {}, 'nope', { mutate: 'not-a-function' }]) {
    const scope = resolveSettingsScope(settings, 'memory-eternal', schema, { auditMode: 'none' })
    assert.equal(scope.mode, 'entry')
    assert.equal(typeof scope.update, 'undefined', `settings=${JSON.stringify(settings)} 不该暴露写入口`)
    assert.equal(scope.get().auditMode, 'none')
  }
})

test('volatile refs are unwrapped before the plugin reads them', () => {
  // 这是线上事故的回归：schema 标了 .volatile() 后，宿主交给插件的 config 里
  // 那些字段是引用对象；不还原就 `cfg.vaultDir.trim()` → TypeError，插件整个 fiber 起不来。
  assert.equal(isVolatileRef(ref('x')), true)
  assert.equal(isVolatileRef({ get: () => 'x' }), false, '普通对象不算引用')
  assert.equal(isVolatileRef('x'), false)
  assert.equal(isVolatileRef(null), false)

  // 逐层还原：引用、数组内引用、嵌套对象内引用
  const raw = {
    vaultDir: ref('E:/vault'),
    captureDebug: ref(true),
    vaultProfiles: [ref({ name: 'a', path: 'E:/a' }), { name: ref('b'), path: 'E:/b' }],
    auditMode: 'none',
    nested: { deep: ref(7) },
  }
  const plain = plainConfig(raw)
  assert.equal(plain.vaultDir, 'E:/vault')
  assert.equal(plain.captureDebug, true)
  assert.deepEqual(plain.vaultProfiles, [{ name: 'a', path: 'E:/a' }, { name: 'b', path: 'E:/b' }])
  assert.equal(plain.auditMode, 'none')
  assert.equal(plain.nested.deep, 7)
  // 结果必须能直接 JSON.stringify（写共享配置文件要用）
  assert.equal(JSON.parse(JSON.stringify(plain)).vaultDir, 'E:/vault')

  // entry 模式与 scope 模式都要还原
  const entry = resolveSettingsScope({ mutate: async () => {} }, 'memory-eternal', schema, { vaultDir: ref('E:/v') })
  assert.equal(entry.get().vaultDir, 'E:/v')
  const legacy = resolveSettingsScope({
    register: () => ({ get: () => ({ vaultDir: ref('E:/legacy') }), watch: () => () => {}, describe: () => [] }),
  }, 'memory-eternal', schema, {})
  assert.equal(legacy.get().vaultDir, 'E:/legacy')
})
