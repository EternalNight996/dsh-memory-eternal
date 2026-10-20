/**
 * Host-version-adaptive settings scope.
 *
 * DSH 改过「插件如何声明可编辑配置」：
 * - 旧宿主（0.1.x）提供 `settings.register(ns, schema, opts)`，插件持有一个可变
 *   来源引用，并在每次操作时读取注册后的 scope。
 * - 新宿主（0.2.0-rc.x）移除了该方法：设置页由 Loader 行自己的 `Config` schema
 *   派生，`SettingsForms` 只剩 `configure/describe/update/replace/mutate`，
 *   宿主解析并校验本行 config 后交给 `apply(ctx, config)`，编辑后重新解析
 *   （`ctx.fiber.config` 始终是最新值）。
 *
 * 因此无条件调用 `settings.register` 会在新宿主上抛
 * `TypeError: ctx.settings.register is not a function`，直接中断整个插件 fiber
 * （实测：DSH 0.2.0-rc.2 + dsh-memory-eternal 0.7.0，index.js:97）。
 * 这里探测该方法，缺失时退化为「读 Loader 行 config」。
 * @module dsh-memory-eternal/settings-scope
 */

/** 把未知服务收窄成旧宿主的注册形状。 */
function legacyRegister(settings) {
  if (settings === null || typeof settings !== 'object') return undefined
  const candidate = settings.register
  return typeof candidate === 'function' ? candidate.bind(settings) : undefined
}

/**
 * 宿主注入的运行时引用用的是全局注册 symbol（cosmokit 的 volatile 协议），
 * 因此跨 ESM/CJS 副本也能认出来，不必依赖 @deepseek-ai/cosmokit。
 */
const VOLATILE_WRITE = Symbol.for('cosmokit.volatile.write')

/** 判断一个解析后的配置值是不是宿主的 volatile 引用。 */
export function isVolatileRef(value) {
  return typeof value === 'object' && value !== null && VOLATILE_WRITE in value
}

/**
 * 摘掉配置里的运行时引用，还原成普通值。等价于宿主内部的 `plainConfig()`
 * （packages/settings/settings/src/schema.ts）。
 *
 * 为什么必须有这一步：schema 里标了 `.volatile()` 的字段，宿主解析后交给插件的
 * **不是值而是引用对象**（要 `.get()` 才是当前值）。少了这层还原，
 * `cfg.vaultDir.trim()` 会抛 `TypeError: cfg.vaultDir.trim is not a function`
 * ——插件整个 fiber 挂掉、路由全没挂上（线上实测）。
 */
export function plainConfig(value) {
  if (isVolatileRef(value)) return plainConfig(value.get())
  if (Array.isArray(value)) return value.map(plainConfig)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, plainConfig(child)]))
  }
  return value
}

/**
 * 把未知服务收窄成新宿主的写入形状：`SettingsForms.mutate(ns, ops, revision?)`。
 *
 * 0.2.x 没有 `register`，但**有**写入口——设置页把「改了哪些字段」变成 path op，
 * 由宿主写入并持久化。少了这一步，插件自己的配置页就只能读：点保存会撞到
 * 「当前环境不支持写配置」（index.js 的 501 兜底）。这里探测该方法，有就接上。
 */
function hostMutate(settings) {
  if (settings === null || typeof settings !== 'object') return undefined
  const candidate = settings.mutate
  return typeof candidate === 'function' ? candidate.bind(settings) : undefined
}

/**
 * 在支持的宿主上注册插件的设置段，否则退化到 Loader 管理的行 config。
 *
 * @param settings - 注入的 `ctx.settings` 服务（宿主未合成时为 undefined）。
 * @param namespace - 设置命名空间 / Loader 行 id（此处为 `memory-eternal`）。
 * @param schema - 插件的 schemastery `Config`。
 * @param entryConfig - 宿主传入 `apply` 的 config。
 * @param liveConfig - 可选：读取当前行 config 的函数（新宿主用，返回最新值）。
 * @returns 与宿主版本无关的当前配置读取器。
 */
export function resolveSettingsScope(settings, namespace, schema, entryConfig, liveConfig) {
  const register = legacyRegister(settings)
  if (register !== undefined) {
    // 旧宿主：继续走注册后的 scope，编辑无需重启 fiber 即可见。
    const scope = register(namespace, schema, { base: entryConfig ?? {} })
    return {
      mode: 'scope',
      get: () => plainConfig(scope.get()),
      watch: (callback) => (typeof scope.watch === 'function' ? scope.watch(callback) : () => {}),
      describe: (options) => (typeof scope.describe === 'function' ? scope.describe(options) : []),
    }
  }
  // 新宿主：配置由 Loader 行驱动；行被编辑后宿主自行重新解析。
  const read = () => {
    if (typeof liveConfig === 'function') {
      try {
        const live = liveConfig()
        if (live !== undefined && live !== null) return live
      } catch { /* 读不到就用启动时的入参 */ }
    }
    return entryConfig ?? {}
  }
  const mutate = hostMutate(settings)
  const scope = {
    mode: 'entry',
    get: () => plainConfig(read()),
    // 新宿主不暴露配置变更回调：行编辑后宿主会重新解析（必要时由用户重启），
    // 这里返回一个空退订函数，保证插件里 `settings.watch(...)` 调用不抛错。
    watch: () => () => {},
    describe: () => [],
  }
  if (mutate !== undefined) {
    /**
     * 写入一个 patch（`{ key: value }`）→ 翻译成 path op 交给宿主持久化。
     *
     * 刻意**不传** expectedRevision：调用方（插件自己的配置页）拿不到宿主当前
     * revision，传 0 只会被宿主判成冲突。并发写由宿主的 last-write-wins 裁决，
     * 真冲突时宿主抛错，这里把它的冲突语义归一成 `SETTINGS_CONFLICT`，
     * 上层据此回 409 而不是 500。
     */
    scope.update = async (patch) => {
      const entries = Object.entries(patch ?? {})
      if (entries.length === 0) return
      const ops = entries.map(([key, value]) => ({ op: 'set', path: [key], value }))
      try {
        await mutate(namespace, ops)
      } catch (error) {
        const marker = String(error?.code ?? error?.message ?? '')
        if (/conflict|revision/i.test(marker)) {
          const wrapped = new Error(String(error?.message ?? error))
          wrapped.code = 'SETTINGS_CONFLICT'
          throw wrapped
        }
        throw error
      }
    }
  }
  // 没有 mutate（例如宿主未合成 settings 服务）时不定义 update：
  // 上层 `typeof settings.update === 'function'` 判假，回它那句诚实的
  // 「当前环境不支持写配置」，而不是假装保存成功。
  return scope
}
