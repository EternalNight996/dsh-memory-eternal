/**
 * 插件的 Config schema（独立成模块，便于单测：不依赖宿主服务）。
 *
 * 为什么字段要分「可热改」和「启动期」：
 * DSH 0.2.x 的设置服务只允许写 **volatile** 字段（`SettingsForms.update/mutate`
 * 会对着 schema 调 `volatileForm()`，返回 undefined 就抛
 * `Plugin entry "X" has no volatile fields`；字段不在 volatile 子树下就抛
 * `Config field "y" is not volatile`）。标了 `.volatile()` 的字段 = 改了立刻生效、
 * 不需要重挂插件；没标的只能改 profile 的 patch 行再重启。
 *
 * 所以这里按「运行时真的每次都重新读」来划线：
 * - 沉淀 / 召回 / 去重 / 审核 / 回收 / 库位置：每次调用都经 `settings.get()` 现读 → 立刻生效
 * - web server（端口、保活模式、看门狗）与 MCP 自动挂载：只在 apply 阶段读一次 → 需要重启
 *
 * 注意：**两类字段都标了 `.volatile()`**。volatile 只表示「宿主允许把它写进配置行、
 * 不必重挂插件」；设置页常把整份表单一起提交，只要有字段不 volatile，整次保存就会
 * 被宿主整批驳回（`is not volatile`），用户真正改的那些热改字段也一起白改。
 * 「改了要不要重启」这件事由插件用 `BOOT_ONLY_FIELDS` 单独标注并回给用户，
 * 与宿主能不能写解耦。
 *
 * `.volatile()` 是「有则用」：老宿主 / 老 schemastery 没这个方法时原样返回，
 * 插件照旧能在 0.1.x 上起来（设置页会退回只读，见 lib/settings-scope.js）。
 * @module dsh-memory-eternal/config-schema
 */

/** 标记一个字段可热改；宿主不支持时原样返回。 */
const vol = (field) => (typeof field?.volatile === 'function' ? field.volatile() : field)

/**
 * 构造 Config。
 * @param z - `@deepseek-ai/schemastery` 的默认导出（由调用方注入，便于测试）
 */
export function buildConfig(z) {
  return z.object({
    enabled: vol(z.boolean().default(true)),
    autoCapture: vol(z.boolean().default(true)),
    autoRecall: vol(z.boolean().default(true)),
    vaultDir: vol(z.string().default('')),
    dedupThreshold: vol(z.number().min(0).max(1).default(0.62)),
    captureMinChars: vol(z.number().default(200)),
    captureCooldownMs: vol(z.number().default(5 * 60 * 1000)),
    maxCardsPerDay: vol(z.number().default(60)),
    // 成本控制（v0.6.2）：让用户精控 LLM token / 蒸馏调用 / 召回注入量
    // 蒸馏：true=LLM 压缩成知识卡；false=只存原文卡，零 LLM 消耗（最大省钱）
    distillEnabled: vol(z.boolean().default(true)),
    // 语义去重：true=把已有卡索引喂 LLM 决定「新建 vs 追加」；false=纯词法去重（省一次蒸馏前的 LLM 调用）
    dedupByLLM: vol(z.boolean().default(true)),
    // 蒸馏单次输出上限（token），越高越准越贵
    captureMaxTokens: vol(z.number().min(100).max(4000).default(900)),
    // 诊断：把自动沉淀每次跳过的原因打到宿主控制台（默认关，避免噪声）。
    // 排查「库里一直没卡」时打开它——快速跳过会以 [memory-eternal] capture: 开头出现。
    captureDebug: vol(z.boolean().default(false)),
    // 兜底：解析不出模型路由（宿主只暴露可配置 provider 目录等）时，仍落一张原文卡，
    // 而不是静默放弃。默认关，保持与原行为一致。
    captureFallbackToRaw: vol(z.boolean().default(false)),
    // 召回相关性阈值（minScore），越高召回越少越精越省
    recallMinScore: vol(z.number().min(0).max(50).default(2)),
    // 注入体积可配置（召回）
    recallLimit: vol(z.number().min(1).max(20).default(5)),
    recallSummaryLen: vol(z.number().min(40).max(400).default(130)),
    recallIncludeBody: vol(z.boolean().default(false)),
    // 多 Vault / 多 Profile：命名分库，当前激活一个
    vaultProfiles: vol(z.array(z.object({ name: z.string(), path: z.string() })).default([])),
    activeVault: vol(z.string().default('')),
    // 语义召回（可选 embedding provider，默认空=零依赖 bigram + LLM 判定兜底）
    recallEmbedding: vol(z.string().default('')),
    // 会话级 token 预算（字符），供 harness 触发压缩/轮换；记忆侧提供估算与阈值
    sessionBudgetChars: vol(z.number().default(80000)),
    // 回收站保留天数：软删卡超过此天数自动永久删除（默认 30）
    recycleRetentionDays: vol(z.number().min(1).max(3650).default(30)),
    // 自动审核配置
    //   auditMode: 'all'=全部要审(默认) | 'none'=全部免审直接入库
    //   auditExemptAgents: 免审的智能体名列表（如 codex / claude-code / 本地 DSH）
    //   auditExemptKinds: 免审的知识类型列表（如 tool / mistake）
    // 命中任一免审条件 → 新卡直接 approved 入库，否则进 pending 待审
    auditMode: vol(z.union([z.const('all'), z.const('none')]).default('all')),
    auditExemptAgents: vol(z.array(z.string()).default([])),
    auditExemptKinds: vol(z.array(z.string()).default([])),
    // 多宿主：激活时自动把 MCP 挂载到本机已装的 Claude Code/Codex/Cursor（幂等，
    // MEMORY_ETERNAL_SKIP_AUTO=1 可完全禁用）。**默认 false**——不碰外部配置，需要时显式开启。
    // 以下 7 个字段只在 apply 阶段读一次：标 volatile 是为了「设置页能存下来」，
    // 能不能立刻生效另算（BOOT_ONLY_FIELDS 会回给用户，提示需重启 DSH）。
    autoMcpSetup: vol(z.boolean().default(false)),
    autoWeb: vol(z.boolean().default(true)),
    // web server 保活模式：
    //   init    = DSH 激活时拉起一次（默认；最低开销，DSH 死后 web 仍活但无人看守）
    //   interval= DSH 进程内 setInterval 周期探活+自动拉起（额外 0 内存；DSH 死则停保活）
    //   manual  = 完全不自动拉起；只在 `dsh-memory open` 时 ensure-alive（最保守）
    autoWebMode: vol(z.union([z.const('init'), z.const('interval'), z.const('manual')]).default('init')),
    webPort: vol(z.number().min(1).max(65535).default(7999)),
    webCheckIntervalMs: vol(z.number().min(1000).max(600000).default(5000)),
    webMaxRestart: vol(z.number().min(1).max(1000).default(10)),
    // 是否 spawn 独立 watchdog 进程（与 DSH 解耦，7×24 保活；额外 ~47 MB 常驻）
    // **v0.6.0 起默认 true**——DSH 进程内 setInterval 在 DSH 退出后失效；
    // 常驻 web 场景需要独立 watchdog；代价是 ~47 MB 额外常驻内存。
    watchdogAutoSpawn: vol(z.boolean().default(true)),
  })
}

/** 只在 apply / 启动阶段读一次、改了要重启 DSH 才生效的字段（供提示与测试断言用）。 */
export const BOOT_ONLY_FIELDS = ['autoMcpSetup', 'autoWeb', 'autoWebMode', 'webPort', 'webCheckIntervalMs', 'webMaxRestart', 'watchdogAutoSpawn']

/**
 * 把一次保存拆成「写下去的」和「其中哪些要重启才生效」。
 *
 * 为什么必须在插件侧拆：设置页把整份表单一起提交（含端口 / 保活 / 看门狗这些启动期字段）。
 * 现在两类字段都标了 volatile，宿主都会接受；但插件必须诚实区分——写下去 ≠ 立刻生效，
 * 启动期字段只有重启 DSH 后才由 apply 重新读取。
 *
 * @returns {{ live: Record<string, unknown>, needsRestart: string[], unknown: string[] }}
 */
export function partitionPatch(Config, patch) {
  const live = {}
  const needsRestart = []
  const unknown = []
  const allowed = new Set(Object.keys(Config?.dict ?? {}))
  for (const [key, value] of Object.entries(patch ?? {})) {
    if (!allowed.has(key)) { unknown.push(key); continue }
    live[key] = value
    if (BOOT_ONLY_FIELDS.includes(key)) needsRestart.push(key)
  }
  return { live, needsRestart, unknown }
}

