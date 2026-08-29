# 🧠 最强记忆大脑 dsh-memory-eternal — 给 DeepSeek Harness 装上「第二大脑」

<p align="center">
  <img src="https://img.shields.io/badge/DeepSeek%20Harness-plugin-3B82F6" alt="DSH plugin" />
  <img src="https://img.shields.io/npm/v/dsh-memory-eternal" alt="npm version" />
  <img src="https://img.shields.io/github/stars/EternalNight996/dsh-memory-eternal?style=flat" alt="GitHub stars" />
  <img src="https://img.shields.io/github/license/EternalNight996/dsh-memory-eternal" alt="license" />
  <img src="https://img.shields.io/badge/自研内核-CJK检索-10B981" alt="self-built" />
  <a href="https://dsh.market/"><img src="https://raw.githubusercontent.com/2BingLing/dsh-market/master/assets/readme/badge-listed-zh.svg" alt="DSH Market 收录" /></a>
</p>

> **对话结束自动沉淀，跨会话真实不失忆；召回只取相关小块，省 token、少噪音。**
> 全自研、零第三方记忆框架、不改 DSH 源码、一条命令安装——为你装一个「自己说了算」的、可 git 管理的本地记忆库。

<p align="center"><strong>⭐ 觉得好用就点个 Star</strong>，让更多被「AI 总忘事」困扰的人用上它。<br/><sub>一条命令：<code>dsh plugin --profile web add dsh-memory-eternal</code></sub></p>

---

<p align="center">
  <img src="https://raw.githubusercontent.com/EternalNight996/dsh-memory-eternal/main/assets/screen/dsh-memory-eternal.gif" width="880" alt="记忆核心 · 对话自动沉淀 + 图形化知识库 + 增强知识图谱（动态演示）" />
  <br/><em>对话自动沉淀 · 图形化知识库 · 交互式知识图谱（动态演示）</em>
</p>

---

## 🔥 先看痛点：AI 助手为什么「总让人失望」？

| # | 痛点（每个用 AGENT 的人都遇到过） | 没有记忆的后果 |
|---|---|---|
| 1 | **长对话就忘事** | 聊到第 10 轮，前面定的方案、改的口径全忘了，反复重来 |
| 2 | **跨会话失忆** | 换新会话 = 白纸一张，项目背景要重新讲一遍 |
| 3 | **长会话 token 暴涨** | 上下文越来越长，越聊越贵、越聊越慢，甚至爆窗 |
| 4 | **存了却找不到** | 就算有笔记，也搜不到、管不好，等于没存 |
| 5 | **数据被锁死** | 记忆存在私有库里，改不了、导不出、不敢用 |

> 这不是你的错觉，是**绝大多数 AI 产品共通的硬伤**。而解法，正是 Agent 记忆——**总结 → 存储 → 按需召回**。

---

## 🚀 装上它之后：五道痛点逐一被解决

| 痛点 | 装上记忆核心后 | 靠什么实现 |
|---|---|---|
| ① 长对话忘事 | 保留「最近原文」，旧轮次自动总结成卡 | 自动沉淀 + 语义去重 |
| ② 跨会话失忆 | 新会话也能召回旧决策/方案 | `memory_recall` 按需召回 |
| ③ 长会话 token | **只召回相关小块**，不每轮全量塞 | 相关性阈值 + 片段截断 + 沉淀预筛 |
| ④ 存了找不到 | 中文整词+bigram 检索 + 可视化图谱 | CJK 感知检索 + 知识图谱 |
| ⑤ 数据被锁死 | 纯 Markdown，可读可改可 git 托管 | 本地 Markdown Vault |

```mermaid
flowchart LR
  A["对话每一轮"] --> B{"turn-stopping<br/>有没有可复用信号?"}
  B -- "无 → 跳过(省LLM)" --> X["❌ 不调模型"]
  B -- "有" --> C["LLM 压缩成知识卡"]
  C --> D{"去重核对"}
  D -- "同一主题" --> E["追加更新到已有卡"]
  D -- "新主题" --> F["写入 02-08 分类目录"]
  F & E --> G["本地 Markdown Vault"]
  G --> H["memory_recall 按需召回"]
  H --> I["AI 下次不再失忆"]
```

---

## 🧬 核心内核设计：为什么要「全自研」

市面上记忆方案很多，但大多**依赖第三方框架 / 动不动就起一个 MCP 服务 / 把记忆锁进私有库**。本插件把「记忆骨架」整个自己搭出来，**零第三方运行时依赖**，逻辑能逐行看懂：

| 模块 | 自研实现 | 替代什么 |
|---|---|---|
| **去重** | 词法 Jaccard bigram（0.62）+ **语义去重**（把已有卡索引喂模型，让它决定「新建 vs 追加」） | 防重复、防 LLM 改写导致的垃圾卡 |
| **检索** | CJK 感知：中文整词 + 字符 bigram 命中 | 无需全文搜索引擎，短查询也能命中长文 |
| **图谱** | 力导向/径向布局 + `[[wikilink]]`/共享标签/相似度连边 | 让「知识之间怎么关联」一眼看清 |
| **存储** | 带 frontmatter 的普通 `.md`，落盘 `~/.dsh/memory-vault` | 不锁库、可读、可 git、可被任意工具读 |

> **与其他热门记忆项目的思路同向（总结→存储→按需召回），但定位不同。** 参考同类热门思路，本插件主打「**本地、自研、零依赖、可读可控**」：

| 热门项目 | 定位 | 本插件的差异 |
|---|---|---|
| [agentmemory](https://github.com/rohitg00/agentmemory) | 通用 Agent 记忆服务 | 本插件是 **DSH 原生插件**，不另起服务，直接进设置/侧边栏 |
| [mem0](https://github.com/mem0ai/mem0) | 记忆层（常配 MCP） | 本插件**无 MCP 依赖**，离线可跑，走本地 `memory_recall` 工具 |
| [MemGPT / Letta](https://github.com/letta-ai/letta) | 上下文内存管理 | 本插件承载「**持久记忆**」这一层；会话内实时压缩属 harness 层 |
| **[Zep](https://github.com/getzep/zep)** | 时间/图记忆 | 本插件零外部服务，图谱/检索纯本地 |

> 如果你已在用其中某一层，也完全能把本插件当「**本地持久记忆底座**」叠加使用——它只消费你已配置好的 provider，不抢模型、不改你的习惯。

---

## ✨ 功能总览（交互全在这里）

<details>
<summary><b>📇 知识卡：存得进、找得到、管得了</b></summary>

- **全自动沉淀**：每轮结束自动判定+压缩成 300-800 字知识卡，无需手动保存
- **双层去重**：Jaccard 词法 + 语义追加，不堆重复卡
- **`.md` 全文**：frontmatter 里带 `kind/title/tags/created/updated`，就是普通 Markdown
- **Markdown 渲染**、**长卡折叠**、**新卡「新」角标**、**搜索命中高亮**、**卡片行删除**
- **无限滚动懒加载**、自定义**滚动条**配色
- 排序：**最近 / 标题 / 热点（按连接数）**

</details>

<details>
<summary><b>🕸 知识图谱：秒级看懂「知识之间的关系」</b></summary>

- **力导向/径向混合布局**：按 kind 分扇区、枢纽在内圈、环间距不重叠，数量大也不乱；**几千节点不卡**
- 连线 = `[[wikilink]]` / 共享标签 / **相似度关联**；只保留**高影响力主干边**避免毛球
- 交互：**左键凸显关联**、**右键菜单**（打开/凸显/复制/删除）、**Shift 框选多选**（导出/删除/合并）、**图例过滤**、**时间维着色**（3天内绿/2周琥珀/1月橙/更早灰蓝）、**滚轮缩放**、**导图 PNG**（下载/另存为/复制/全屏）

</details>

<details>
<summary><b>💾 备份与控制：数据永远是你的</b></summary>

- 记忆库**导出 MD / JSON**、**导入**（自动去重）
- 导出可选**默认下载**或**自选位置**另存为
- 所有操作**顶部醒目 toast**：✓ 绿 = 成功、✕ 红 = 失败，并显示导出位置/文件名
- 可指向任意目录（如 Obsidian Vault）
</details>

<p align="center">
  <img src="https://raw.githubusercontent.com/EternalNight996/dsh-memory-eternal/main/assets/screen/memory-settings.png" width="840" alt="设置 → 记忆：统计 + 检索 + 卡片/图谱 Tab" />
  <br/><em>设置 → 记忆：统计概览、CJK 检索、知识卡网格、按 kind 分类</em>
</p>
<p align="center">
  <img src="https://raw.githubusercontent.com/EternalNight996/dsh-memory-eternal/main/assets/screen/memory-popup.png" width="840" alt="侧边栏「记忆」一键打开完整记忆库弹窗" />
  <br/><em>侧边栏底部「记忆」按钮 → 一键打开完整记忆库弹窗（含增强知识图谱）</em>
</p>

---

## 🚀 安装（一条命令）

```bash
# 已发布后（npm）—— 跨平台通用
dsh plugin --profile web add dsh-memory-eternal

# 从 GitHub
dsh plugin --profile web add github:EternalNight996/dsh-memory-eternal

# 本地联调（改代码即时生效）
dsh plugin --profile web add F:/MyApp/eternal/dsh-memory-eternal
```

> 提示：
> - `dsh` 为 DSH CLI（`npm i -g @deepseek-ai/dsh`）。
> - 要**官方最新**（避免 npmmirror 滞后）：`npm_config_registry=https://registry.npmjs.org/ dsh plugin --profile web add dsh-memory-eternal`。
> - **profile 是 pnpm workspace**：`cd ~/.dsh/profiles/web && pnpm add dsh-memory-eternal@latest`（`npm install` 会报 `EUNSUPPORTEDPROTOCOL`）。

装完**重启 dsh web**：设置 → 记忆 出现知识库（iframe 加载 Web 端）；侧边栏底部出现「记忆」按钮。此后每轮对话自动沉淀。

## 🌐 多宿主：装完即用（Claude Code / Codex / Cursor / 浏览器）

从 v0.5 起，本插件不再只属于 DSH——**一个记忆库，所有 Agent 共享**：

```
┌────────── 核心引擎（vault.js + capture.js，零耦合）──────────┐
│  ① DSH 原生插件        ② MCP server        ③ Web 端         │
│     自动沉淀+召回          stdio 零依赖        UI 唯一真源      │
│     UI=iframe 壳          Claude/Codex/      浏览器直接访问    │
│                           Cursor             DSH 渲染也走它   │
└──────────────────────────────────────────────────────────────┘
```

### 自动挂载（零手动）

插件激活时自动检测本机已装的 Agent，**幂等写入 MCP 配置**（改动前自动备份）：

- **Claude Code** → `~/.claude.json` 的 `mcpServers` + `~/.claude/settings.json` 的 SessionEnd hook（会话结束自动沉淀）
- **Codex CLI** → `~/.codex/config.toml` 的 `[mcp_servers.memory]`
- **Cursor** → `~/.cursor/mcp.json`

下次打开对应工具，`memory_recall` / `memory_capture` / `memory_stats` 三个工具直接可用。不想自动配置？设置里关 `autoMcpSetup`，或环境变量 `MEMORY_ETERNAL_SKIP_AUTO=1`。

### Web 端（默认常驻）

插件激活时自动拉起独立 Web server（detached 进程，不占 DSH 宿主），**UI 唯一真源**——DSH 内的设置页与浏览器访问的是同一份：

```bash
dsh-memory open            # 确保 Web 存活 + 浏览器打开（默认 http://127.0.0.1:7999）
dsh-memory serve --port 8080   # 前台跑 Web server
```

### CLI 速查

```bash
dsh-memory recall "数据库选型"      # 检索
dsh-memory capture "重要结论..."    # 手动沉淀
dsh-memory sweep ~/.claude/projects # 挖掘已有会话记录
dsh-memory watchdog --port 7799      # 看门狗保活 web server（独立进程，不依赖 DSH）
dsh-memory setup --dry-run          # 重跑自动挂载（幂等）
dsh-memory mcp                      # MCP stdio（挂给任意 MCP 客户端）
```

### 蒸馏 LLM（可选）

MCP / hooks / CLI 的自动蒸馏需要一个 OpenAI 兼容端点（DSH 内免配）：

```bash
export MEMORY_LLM_BASE_URL=https://api.deepseek.com   # 或 Ollama/vLLM/LM Studio
export MEMORY_LLM_KEY=sk-xxx
export MEMORY_LLM_MODEL=deepseek-chat
```

未配置时：recall 全功能；capture 降级为原文卡（不蒸馏）。

### 单一副本原则（防版本漂移）

MCP/hooks/CLI 全部指向 DSH profile 内那一份代码（`~/.dsh/profiles/web/node_modules/dsh-memory-eternal`）。**更新只需一条命令**：`cd ~/.dsh/profiles/web && pnpm add dsh-memory-eternal@latest`，DSH + MCP + Web 齐步走。纯 Claude Code 用户（无 DSH）可 `npm i -g dsh-memory-eternal`，独立副本独立库。卡格式带 `formatVersion` 守卫，跨版本只向后兼容读，多副本共存不会写坏库。

---

## 📖 使用

> **核心心智模型：一个库（`~/.dsh/memory-vault`，纯 Markdown + 可 git），一群 Agent（DSH / Claude / Codex / Cursor）自动记、随时忆，一个网页（`dsh-memory open`）看全局。**

### DSH 内使用（现状，0 步骤）

```bash
# 重启 dsh web 后生效新版插件
```

- **自动沉淀**：每轮对话结束自动把可复用内容蒸馏成知识卡，无需操作
- **`memory_recall` 工具**：Agent 在需要历史决策/项目背景时主动调用
- **可视化**：设置 → 记忆 或侧边栏底部「记忆」按钮 → 内嵌打开 Web 端（同一份 UI）
- **多 Vault**：设置里 `vaultProfiles` 命名分库 + `activeVault` 切换；跨库聚合检索 `?all=1`

### Claude Code 使用

装完即用——MCP 与 SessionEnd hook 都已自动挂载：

- 会话中说「recall 一下数据库选型」→ Claude 自动调 `memory_recall`
- 会话结束/上下文压缩前 → hook 自动蒸馏入库
- 想看记了什么：`dsh-memory open`

### Codex CLI / Cursor 使用

重启对应工具后，MCP 已在工具的 MCP 列表里，会话内直接：

```
用 memory_recall 查一下项目的历史决策
用 memory_stats 看库内有多少张卡
```

### Web 端使用

```bash
dsh-memory open              # 确保 Web 存活 + 浏览器打开（默认 http://127.0.0.1:7999）
dsh-memory serve --port 8080 # 自定义端口前台运行
```

打开后所见即所得：统计概览 / 中文片段检索 / 知识卡网格（删除/编辑/合并/导入导出）/ 增强知识图谱（力导向+时间维着色+右键菜单+框选+PNG 导出）。与 DSH 内嵌「记忆」页面渲染同一份 UI（单一真源），数据天然同步。

### CLI 速查

```bash
dsh-memory recall "数据库选型"      # 检索知识卡（输出 JSON）
dsh-memory capture "重要结论..."    # 手动沉淀（- 读 stdin）
dsh-memory sweep ~/.claude/projects # 挖掘已有会话记录
dsh-memory watchdog --port 7799      # 看门狗保活 web server（独立进程，不依赖 DSH）
dsh-memory setup --dry-run          # 预览自动挂载（幂等）
dsh-memory mcp                      # MCP stdio（手动挂任意 MCP 客户端）
dsh-memory serve --port 7999        # 前台 Web server
dsh-memory open                     # 确保 Web 存活 + 浏览器打开
```

### 蒸馏 LLM（可选）

MCP / hooks / CLI 的自动蒸馏需要一个 OpenAI 兼容端点（DSH 内免配——复用 dsh 的 llm）：

```bash
export MEMORY_LLM_BASE_URL=https://api.deepseek.com   # 或 Ollama/vLLM/LM Studio
export MEMORY_LLM_KEY=sk-xxx
export MEMORY_LLM_MODEL=deepseek-chat
```

未配置时：recall 全功能；capture 降级为原文卡（不蒸馏，仍可正常用）。

### zcode（智谱）说明

zcode 暂无原生 MCP 支持，可经社区 [zcode-open-bridge](https://github.com/tizerluo/zcode-open-bridge) 转 MCP 后挂载，或直接用 CLI（`dsh-memory capture / recall / sweep`）。

---

## 🔄 更新

**单副本原则**是更新能「一条命令搞定」的根基——所有入口都指向同一份代码。

```bash
# DSH 用户（最常见）：profile 里更新 → DSH + MCP + Web 齐步走
cd ~/.dsh/profiles/web
pnpm add dsh-memory-eternal@latest

# 纯 Claude Code / Cursor 用户（无 DSH）：全局包更新
npm i -g dsh-memory-eternal@latest
```

更新完后：
- **DSH 用户**：重启 dsh web（插件 reload）→ `autoMcpSetup` 自动幂等跳过（配置已是最新），`autoWeb` 进程已是新版
- **Claude/Codex/Cursor 用户**：重启对应工具，stdin MCP 进程由 agent 重 spawn → 加载新版

不会出现的版本漂移：所有 agent 入口指向同一份代码，不存在「DSH 是新版、Claude Code 是旧版」导致的格式/行为不一致。卡文件 `formatVersion` 字段是最后一道防线，跨版本只向后兼容读。

如果想从 GitHub 拉未发布版（dev/特性分支）：

```bash
# DSH 用户
cd ~/.dsh/profiles/web && pnpm add github:EternalNight996/dsh-memory-eternal

# 全局
npm i -g github:EternalNight996/dsh-memory-eternal
```

---

### 🧭 插件发现 / 收录标准

仓库已打 **GitHub `dsh-plugin` topic** 并符合社区标准结构，**自动被以下机制发现**（无需手动 PR）：

| 机制 | 收录方式 | 状态 |
|---|---|---|
| **dsh-marketplace**（ouyangyipeng） | 实时读 `topic:dsh-plugin` | ✅ topic 已打 |
| **dsh-find-plugin**（awesome-dsh-plugin） | 会话内按 topic+星数搜索 | ✅ |
| **dsh-plugin-marketplace**（YELEBAI） | 每 2h 自动扫描 + 静态验证进入 Registry | ✅ 已声明 `dsh.marketplace` 元数据 |
| **dsh-market**（2BingLing） | 提交 Issue | ✅ 已提 |
| **awesome-dsh-plugin** | 提交 PR | ✅ 已提 |

---

## 🔧 设置

| 设置项 | 默认 | 说明 |
|---|---|---|
| 启用 | 开 | 总开关 |
| 自动沉淀 | 开 | 每轮对话结束自动捕获 |
| 自动召回 | 开 | 注入 system prompt + `memory_recall` 工具 |
| 记忆库目录 | 空 | 留空 = `~/.dsh/memory-vault`；可指向任意目录（如 Obsidian Vault） |
| 去重阈值 | 0.62 | 词法去重 Jaccard 相似度阈值 |
| 捕获最小长度 | 200 | 少于该字符数不触发捕获 |
| 日配额 | 60 | 每天最多自动写卡数，防止烧 token |
| 记忆库目录 | 空 | 留空 = `~/.dsh/memory-vault`；可指向任意目录（如 Obsidian Vault） |
| vaultProfiles | [] | 多 Vault 配置：`[{name, path}]` 命名分库 |
| activeVault | '' | 当前激活的 Vault（对应 vaultProfiles 中的 name） |
| sessionBudgetChars | 80000 | 会话级 token 预算（字符数），供 harness 触发压缩 |
| recallEmbedding | '' | 语义召回 provider（空=零依赖 bigram + LLM 判定兜底） |
| autoMcpSetup | **关** | 激活时自动把 MCP 挂到本机已装的 Claude Code/Codex/Cursor（幂等+备份）。**默认关闭**——不碰外部配置，按需开启 |
| autoWeb | 开 | 激活时拉起 web server（默认 init 模式拉一次）。配 autoWebMode 调保活强度 |
| autoWebMode | `init` | web server 保活模式：`init`（启动时拉一次）/ `interval`（DSH 进程内周期保活）/ `manual`（不自动拉起，仅 `dsh-memory open` ensure-alive） |
| webPort | `7999` | web server 端口 |
| webCheckIntervalMs | `5000` | interval 模式的探活间隔（最小 1000） |
| webMaxRestart | `10` | interval 模式连续失败超过此次数后停止保活（让人工排查） |
| watchdogAutoSpawn | **关** | 是否 spawn 一个与 DSH 解耦的独立 watchdog 进程（额外 ~47 MB 常驻）。**默认关闭**——DSH 进程内 setInterval 已够用 |

---

## 🌐 服务自管理 · Self-hosting

**v0.5.7 引入配置化部署强度**——从「自动启用一切」改为「默认保守、用户显式升级强度」。

### 三种 web server 保活模式（autoWebMode）

| 模式 | 行为 | 适合 | 代价 |
|---|---|---|---|
| `init`（默认）| DSH 激活时拉一次；之后不管 | 常规用法（DSH 常开） | 47 MB web + 0 监控 |
| `interval` | DSH 进程内 `setInterval` 周期探活 + 自动拉起（web 死掉复活） | DSH 常开但 web 偶尔被外部 kill | 47 MB web + ~0 监控（DSH 进程内） |
| `manual` | 完全不自动拉起；只在 `dsh-memory open` 时 ensure-alive | 服务器/CI 想自己控制启停 | 47 MB web（手动起后） |

### 看门狗进程（watchdogAutoSpawn）

DSH 死了也能保活 web 时使用：

```bash
# 方式 1：UI 设置 → 服务自管理 → 开启 watchdogAutoSpawn
# DSH 重启后会自动 spawn 一个独立 node watchdog 进程

# 方式 2：手动跑（在另一个终端）
dsh-memory watchdog --port 7799 --interval 5000 --max-restart 10
```

**资源**：47 MB（独立 node 进程）/ 0 MB（DSH 进程内 setInterval）。**默认不 spawn**，需要 7×24 保活才开。

### MCP 自动挂载（autoMcpSetup）

**v0.5.7 起默认关闭**。需要时：
- 设置 → 记忆 → `autoMcpSetup = true` → 重启 DSH 自动写入各 agent 配置
- 或手动：`dsh-memory setup [--claude-only|--codex-only|--cursor-only] [--dry-run]`

### MCP 配置状态查询

Web UI 顶部「外部 Agent MCP 挂载状态」面板（`GET /memory-eternal/api/setup-status` 只读）：

- **claude-code**：检测 `~/.claude.json` 的 `mcpServers.memory` + `~/.claude/settings.json` 的 SessionEnd hook
- **codex**：检测 `~/.codex/config.toml` 的 `[mcp_servers.memory]` 段
- **cursor**：检测 `~/.cursor/mcp.json` 的 `mcpServers.memory`

每项返回：`installed` / `mcpConfigured` / `mcpMatchesCurrentNode`（检测 node 路径是否与当前一致）/ `hook`（仅 claude-code）。**node 路径不一致** = ⚠ 警告（之前在 dsh-desktop 环境 setup 过、现在换 node），提示重跑 `dsh-memory setup` 修复。

### 服务自管理 vs 7×24 部署

| 部署强度 | 配置 | 进程 | 开机自启 |
|---|---|---|---|
| 个人开发（默认）| `autoMcpSetup=false` + `autoWeb=true` + `autoWebMode=init` + `watchdogAutoSpawn=false` | web 47 MB | 否 |
| 常规 DSH 用户 | 加上 `autoWebMode=interval` | web 47 MB | 否 |
| 7×24 服务化 | + `watchdogAutoSpawn=true` | web 47 MB + watchdog 47 MB | DSH 启动时 spawn（**不是**开机自启——DSH 退出则失效） |
| 真正开机自启（无 DSH）| 跳过 DSH，走**系统级** watchdog：Windows Task Scheduler 计划任务跑 `dsh-memory watchdog --port 7799 --interval 5000 --max-restart 10` | web 47 MB + watchdog 47 MB | **是**（与 DSH 解耦）|

**关键事实**：**MCP server 不是 daemon**——它是 stdio 协议，agent 启动会话时 spawn、用完即退。**不存在「MCP 开机自启」**的概念。Claude Code / Codex CLI / Cursor 每次开会话就 spawn 一个 MCP 进程，session 结束就退出。

### 进程依赖关系

```
DSH 宿主 (Cordis 框架)
  ├─ host plugin: index.js  ← 自动沉淀 / memory_recall / JSON API / web-info
  ├─ (可选) autoWeb 拉起的 detached node web.js   ← detached, DSH 退出后仍活
  └─ (可选) watchdogAutoSpawn 拉起的 detached node watchdog.js  ← 同上
web server (lib/web.js)
  └─ (被 agent 按需 spawn) stdio MCP server 进程 ← 短生命周期
```

**所有「常驻」node 进程都依赖 Node 运行时**。**不依赖 Node** 的方案只有**系统级 watchdog**（Windows Task Scheduler 用 PowerShell 脚本）—— 但 web server 本身仍需 node。**Node 是硬依赖**。

---

## 🛠 开发 / 构建 / 测试

```bash
npm i
npm test        # 单元测试：vault 去重/检索/图谱 + capture 管线 + API 形状
npm run build   # 打包 client（改 src/client 后需要；改 index.js / lib 无需构建）
```

```
dsh-memory-eternal/
├── index.js             # host：设置 + turn-stopping 钩子 + 工具 + JSON API
├── lib/
│   ├── vault.js         # 存储层（frontmatter/去重/检索/图谱）
│   └── capture.js       # 自动沉淀管线（LLM 压缩 + 语义去重 + 预筛）
├── src/client/index.tsx # client：设置页 + 侧边栏「记忆」+ 完整记忆库弹窗
├── build.mjs            # esbuild 打包 client → lib/client.js
├── cordis.patch.yml     # bundle 补丁层（自动挂载 host 行）
└── tests/               # node:test 单测
```

---

## 🗺 Roadmap / 待办（记忆侧核心优化）

**已实现**：
- 自动沉淀 + 双层去重 + 日配额
- CJK 检索 + 图谱 + 召回工具
- 交互图谱（图例/时间维/框选/删除合并/导出）
- 知识卡管理（MD渲染/折叠/新角标/搜索高亮/无限滚动）
- 备份导入导出（MD/JSON）
- **沉淀预筛**（skip LLM）+ **召回相关性/截断**（v0.4.3）
- **注入体积可配置**（召回条数/摘要长度/是否带正文，设置项）
- **多 Vault / 多 Profile**（命名分库，当前激活一个）
- **每日回顾 + 用量统计**（今日新增/近7天/分类/今日沉淀清单）
- **整理建议**（相似卡对合并/陈旧卡，非破坏预览）
- **召回用户反馈**（`/feedback`，为相关性调优留数据）
- **会话预算**（`sessionBudgetChars` + `/budget`）
- **用量趋势图 + 笔记模板（4种）**（v0.4.25）
- **一键清理陈旧卡片** + **优化面板增强**（v0.4.25）
- **新建卡片 kind 下拉可读背景色**（v0.4.27）
- **图谱合并/删除即时联动整理建议**（v0.4.27）
- **一键合并相似按钮从图谱工具栏移到整理建议面板**（v0.4.26）
- **多宿主**：MCP server + CLI `dsh-memory` + Web 端常驻 + 自动挂载 Claude/Codex/Cursor + SessionEnd hook + `formatVersion` 守卫（v0.5.0）

**待办（核心功能优化）**：
- [x] ~~多 Vault / 多 Profile~~、~~注入体积可配置~~、~~每日回顾+用量~~、~~自动归档整理~~、~~召回用户反馈~~、~~会话级 token 预算~~（v0.4.5）
- [x] ~~批量智能合并~~（相似度预分组一键合并）、~~跨库聚合图谱/检索~~（vault 级）、~~语义召回升级~~（本地 bigram 语义加分，`recallEmbedding` 预留 embedding）、~~每日回顾定时生成~~（00-System/daily-*，30min 轮询幂等）（v0.4.6）
- [ ] **上下文压缩接入 harness**：记忆侧 `/compress` 已就绪，待 harness 在会话内调「召回替代 + 压缩旧轮」（需 harness 配合）
- [ ] 多 Vault 的**跨库合并/去重**（跨 profile 识别重复卡）
- [ ] 语义召回**接入外部 embedding provider**（当前为本地零依赖加分）
- [ ] 每日回顾**主动推送通道**（当前生成文件 + 手动查看，推送需 harness/通知渠道）
- [ ] **多宿主体验进一步收口**：zcode bridge 内置 / Codex sweep 增字段适配 / Web 端暗色主题微调

---

## 🆕 v0.5.x 改善项汇总 · Improvements in v0.5.x

> v0.5 是**多宿主化主版本**，自 v0.5.0 起本插件不再只属于 DSH——一个记忆库，所有 Agent 共享。下方按主题归纳 v0.5.0 → v0.5.6 的关键改进（中英对照）。
>
> **v0.5 is the multi-host milestone.** From v0.5.0 on, this plugin is no longer DSH-only — one memory vault shared by every Agent. The summary below groups v0.5.0 → v0.5.6 improvements by theme (Chinese / English side by side).

### 🧠 多宿主架构 · Multi-host architecture

| 中文 | English |
|---|---|
| **MCP server** 零依赖 stdio（`memory_recall` / `memory_capture` / `memory_stats` 三工具） | Zero-dep **MCP server** on stdio: `memory_recall` / `memory_capture` / `memory_stats` |
| **CLI 入口 `dsh-memory`** 7 子命令（recall / capture / serve / open / mcp / setup / sweep） | New **CLI `dsh-memory`** with 7 subcommands |
| **Web 端常驻** 独立进程，DSH 渲染走 iframe = 单一 UI 真源 | **Web UI** runs as detached process; DSH renders via iframe — single source of truth |
| **自动挂载** 插件激活即检测 Claude Code / Codex / Cursor，幂等 + 备份写入 MCP 配置 | **Auto-mount** to installed agents (Claude Code / Codex / Cursor), idempotent + auto backup |
| **Claude Code SessionEnd hook** 会话结束 / 压缩前自动沉淀（Windows 友好纯 node 脚本） | **Claude Code SessionEnd hook** auto-captures before session end / pre-compact |
| **卡格式 `formatVersion` 守卫** 多副本共存 / 版本漂移时只向后兼容读，不会写坏库 | **Card `formatVersion` guard** — backward-compatible reads survive cross-version drift |

### ⚡ 健壮性 · Robustness

| 中文 | English |
|---|---|
| **看门狗 `dsh-memory watchdog`** 独立进程保活 web server（不依赖 DSH 宿主），端口探活 + 失败自动拉起 + 重启计数 + SIGINT/SIGTERM 优雅退出。稳态内存 ~47 MB / CPU 接近 0 | **`dsh-memory watchdog`** standalone process keeps web alive — port probe + auto-restart + counter + graceful shutdown. Steady-state ~47 MB RAM / ~0% CPU |
| **`autoMcpSetup` 默认改 false + `autoWebMode` 三档（init/interval/manual）+ `watchdogAutoSpawn` 默认 false** ——v0.5.7 起部署强度配置化，默认最保守，零外部副作用；显式开启才动外部配置 / spawn watchdog | **`autoMcpSetup` defaults to false + `autoWebMode` (init/interval/manual) + `watchdogAutoSpawn` defaults to false** — v0.5.7 makes deployment intensity configurable, conservative defaults, no external side effects unless explicitly enabled |
| **`GET /memory-eternal/api/setup-status`** 只读查询各 agent MCP 配置 + hook + node 路径一致性；Web UI 顶部面板一图看清三个 agent 状态 | **`GET /memory-eternal/api/setup-status`** — read-only check of each agent's MCP config + hook + node path consistency; Web UI panel shows all three agents at a glance |
| **OpenAI 兼容 LLM 适配器** 自动蒸馏用外部端点可配（DeepSeek / Ollama / vLLM / LM Studio），无配置时降级为原文卡 | **OpenAI-compatible LLM adapter** for distillation — works with DeepSeek / Ollama / vLLM / LM Studio; graceful fallback to raw cards when unconfigured |
| **降级路径捕获** 独立进程（无 DSH 环境）import `@deepseek-ai/dsh-llm` 失败时本地 fallback shim | **DSH-free fallback shim** — independent processes no longer require `@deepseek-ai/dsh-llm` |
| **`api.js` 抽层** DSH 与独立 web server 共用同一份 API 实现 | **`api.js` extracted** — DSH and standalone web server share the exact same API layer |

### 🛠 整理与工具 · Optimization & tooling

| 中文 | English |
|---|---|
| **「⚡ 一键优化」按钮** 整理建议面板顶部新增，可选 checkbox「同时清理陈旧卡」，调 `POST /memory-eternal/api/optimize-execute` | **"⚡ One-click optimize" button** on the Organize panel — optional "Also clean stale" checkbox, calls new `POST /memory-eternal/api/optimize-execute` |
| **记忆窗口控制条** 侧边栏「记忆」浮窗右上角新增全屏切换 + 关闭 × 按钮（半透明背景 + blur） | **Window controls** in DSH sidebar memory popup — fullscreen toggle + close × in top-right (translucent + blur) |
| **CLI stdin 流式读修复** Windows cmd 重定向下 `fs.readFileSync(0)` 偶发空字符串，已改为 data/end 流式收集 + readableEnded 兜底 | **CLI stdin stream fix** — replaces unreliable `fs.readFileSync(0)` on Windows with data/end + readableEnded fallback |

### 🩺 质量 · Quality

- **40/40 单元测试全绿**（vault 19 + capture 13 + api 8）/ **All 40 unit tests green**（vault 19 + capture 13 + api 8）
- **`npm publish` 一键化**：commit → tag → npm → 双端 push → gh release 全自动 / **One-button publish**: commit → tag → npm → push to GitHub + Gitee → gh release
- **DSH Market 收录徽章** README 顶部，按官方 issue 反馈挂上 / **DSH Market listing badge** on README top, per official issue guidance

### 🐛 v0.5.x bugfixes

| 版本 | 修复 | Version | Fix |
|---|---|---|---|
| v0.5.1 | `positional()` 修正 —— 任意 `--flag` 都跳过下一项 | v0.5.1 | `positional()` fix — any `--flag` skips next token |
| v0.5.2 | capture stdin `fs.readFileSync(0)` → 流式读 | v0.5.2 | stdin `fs.readFileSync(0)` → stream reader |
| v0.5.3 | capture stdin 流式读 Windows 重定向下偶发空 → `readableEnded` + setTimeout 兜底 | v0.5.3 | stdin stream Windows redirect edge case → `readableEnded` + setTimeout fallback |

---

## 📦 发布记录

- **v0.5.7**：**服务自管理配置化**——`autoMcpSetup` 默认改 false（不碰外部配置）；新增 `autoWebMode`（init/interval/manual）+ `webPort`/`webCheckIntervalMs`/`webMaxRestart`/`watchdogAutoSpawn` 字段；index.js 按模式分层启停（init 拉一次 / interval DSH 进程内 setInterval / manual 仅 ensure）；新增 `GET /memory-eternal/api/setup-status` 只读路由；Web UI 顶部加「外部 Agent MCP 挂载状态」面板（claude-code/Codex/Cursor 配置 + hook + node 路径一致性）。
- **v0.5.5**：`dsh-memory watchdog` 子命令 + `lib/watchdog.js`（独立保活 web server，端到端验证：杀 web 子进程 4s 后 watchdog 自动复活）
- **v0.5.4**：README 顶部新增 DSH Market 收录徽章（按 [Issue #76](https://github.com/2BingLing/dsh-market/issues/76) 官方建议）
- **v0.5.3**：capture stdin 改回流式 data/end + `readableEnded` 兜底（Node 22/24 Windows cmd 重定向下 `fs.readFileSync(0)` 偶发空字符串）
- **v0.5.2**：capture stdin `fs.readFileSync(0)` 同步读修复
- **v0.5.1**：`positional()` 修正——所有 `--flag` 都跳过下一项，避免 stdin 路径下 `--source` 的 value 被误当作位置参数
- **v0.5.0**：**多宿主化**——MCP server 零依赖 stdio（3 工具：recall/capture/stats），CLI 入口 `dsh-memory`（recall/capture/serve/open/mcp/setup/sweep），Web 端常驻（DSH 渲染走 iframe = 单一 UI 真源），自动挂载到 Claude Code/Codex/Cursor（幂等+备份），Claude Code SessionEnd hook 自动沉淀，卡格式 `formatVersion` 守卫，DSH 用户 / Claude Code 用户均「一条命令安装即用」。`api.js` 抽层 + `capture-run.js` 独立沉淀管线复用。
- **v0.4.28**：侧边栏底部「记忆」按钮**独占一行**——不再与「主题」等 footer 按钮挤在同一行（`flex-wrap` 同时命中直接包含与中间隔 wrapper 两种情况）。
- **v0.4.27**：新建卡片 kind 下拉可读背景色；图谱合并/删除节点后**即时联动整理建议**面板刷新。
- **v0.4.26**：一键合并相似按钮从图谱工具栏移到整理建议面板，操作路径更直观。
- **v0.4.25**：**用量趋势图**（近7天柱状图）；**笔记模板**（4种：需求/决策/接口/复盘）；**一键清理陈旧卡片**；优化面板增强 + `mergeCards` 修复。
- **v0.4.24**：preview 清理 + `.gitignore` 完善；README 设置文档补充；瘦身确认打包。
- **v0.4.23**：项目瘦身——README 图片改 GitHub raw 链接，`files` 白名单移除 assets/docs/PUBLISH，npm 包从 ~10MB 降至 **50 KB**（99.5% 缩减）；`/budget` 路由 500 防御降级 + fetchAll 容错；跨库聚合路由 try/catch 安全回退。
- **v0.4.22**：每日回顾简报「查看/收起」toggle（并入用量面板）、去掉左侧栏第 5 项。
- **v0.4.21**：筛选按钮移到搜索框右边；`mergeCards` 抽取到 vault.js + 单元测试覆盖。
- **v0.4.6**：记忆侧优化**收官**——**批量智能合并**、**跨库聚合图谱/检索**、**语义召回升级**、**每日回顾定时生成**、**今日简报**。
- **v0.4.5**：记忆侧**核心功能优化**——**注入体积可配置**、**多 Vault/多 Profile**、**每日回顾+用量统计**、**自动归档整理建议**（非破坏预览）、**召回用户反馈**、**会话级 token 预算**、**上下文压缩接口**（`/compress`）。
- **v0.4.3**：记忆侧**省 token/提质量**——沉淀预筛（无可复用信号直接跳过、不触发 LLM）；召回按 `minScore` 过滤弱命中、注入片段截断到 130 字。
- **v0.4.2**：修复 GitHub/npm 顶部演示 GIF 无法显示（压缩至 README 10MB 阈值以下，8MB）。
- **v0.4.1**：Marketplace 收录标准落地（`dsh.marketplace` 元数据 + 自动扫描规则说明）。
- **v0.4.0**：图谱交互全面增强（图例过滤/时间维/右键菜单/框选/删除合并/导出PNG另存自选位置）+ 知识卡增强（MD渲染/长卡折叠/新角标/搜索高亮/删除/无限滚动）+ 相似度关联 + 导入导出 + 顶部绿红 toast。
- **v0.3.0**：知识图谱科学布局（多环径向/主干边/默认仅枢纽标签/大图关发光）。
- **v0.2.x**：GitHub 源安装修复、安装说明跨平台化/去 npx、分类扩展（工具/教训）、peer 依赖放宽。
- **v0.1.0**：首个可用版本（自动沉淀 + 召回工具 + Markdown Vault + CJK 检索 + 图谱 + 设置页）。

---

## 📜 Git 历史（近 30 条）

| Commit | 描述 |
|--------|------|
| `b6aee65` | fix(v0.4.27): 新建卡片kind下拉可读背景色/图谱合并删除即时联动整理建议 |
| `60c7271` | fix(v0.4.26): 一键合并相似按钮从图谱工具栏移到整理建议面板 |
| `93ce8f5` | v0.4.25: 用量趋势图/笔记模板(4种)/一键清理陈旧/优化面板增强/mergeCards修复 |
| `b5d326a` | v0.4.24: preview清理/.gitignore + README设置文档补充 + 瘦身确认打包 |
| `1c16e1b` | chore(v0.4.23): 项目瘦身——README图片改GitHub raw链接，files白名单移除assets/docs/PUBLISH |
| `a0d75f0` | refactor(v0.4.22): 每日回顾简报回收/并入用量统计(查看/收起)/去掉左栏第5项 |
| `4d8d91d` | feat(v0.4.21): 筛选按钮移到搜索框右边/mergeCards 抽取+测试覆盖 |
| `f88f4d3` | refactor(v0.4.20): 去重——每日回顾移除重复今日卡片列表仅保留简报;标签筛选并入左下角筛选下拉 |
| `d879ed4` | fix(v0.4.19): 知识图谱筛选下拉化+加载中持久化修复(/graph ok:false设error) |
| `c503e96` | fix(v0.4.18): /budget 500防御降级+fetchAll容错budget不再阻断用量/整理面板 |
| `904abd9` | feat(v0.4.17): 用量加载失败红色提示+重试/左侧栏加今日简报独立视图 |
| `e522979` | test(v0.4.16): 补API形状测试——stats/optimizeCandidates/cross-vault(graphAll+searchAll) |
| `f30762c` | test(v0.4.16): 补单元测试——stats/optimizeCandidates/语义检索+反馈/跨库聚合/每日简报/compressExcerpt |
| `e379a9d` | feat(v0.4.16): 召回反馈反哺排序+图谱标签过滤/标签云+卡片读者有用/无关反馈 |
| `43b0efb` | feat(v0.4.15): 图谱搜索节点定位——输入命中即居中放大并选中 |
| `54d0c88` | fix(v0.4.14): 用量/整理加载失败显性提示+图谱右键合并按钮 |
| `b28a07b` | feat(v0.4.13): 去掉统一管理/左侧栏改为独立功能项(卡片/图谱/用量/整理) |
| `783af40` | feat(v0.4.12): 管理改左侧栏第三视图内嵌渲染/收缩图标换/图谱搜索同卡片样式 |
| `4428b77` | feat(v0.4.11): 管理入左侧栏/卡片与图谱输入框独立分开切换 |
| `7db1e93` | feat(v0.4.10): 左侧栏美化——分栏分隔线/收缩按钮/标签按钮 |
| `51b39ec` | fix(v0.4.9): UI——卡片/图谱切换改固定左侧栏+选中色可读/图谱展示全部去滚动条 |
| `ac7b318` | feat(v0.4.8): UI增强——卡片/图谱切按钮移顶端栏凸显/去掉无效自选位置 |
| `887d1a5` | fix(v0.4.7): 管理面板TDZ崩溃——fetchAll提升为函数声明，修正useEffect依赖 |
| `faf1e7c` | fix(v0.4.6): 修复i18n对象闭合导致的esbuild构建失败 |
| `9d5ac70` | feat(v0.4.6): 记忆侧收官——批量智能合并/跨库聚合/语义召回加分/每日回顾定时生成 |
| `7951eee` | feat(v0.4.5): 记忆侧核心优化——注入可配置/多Vault/每日回顾统计/整理建议/召回反馈 |
| `0275444` | docs(v0.4.4): 重构README为热产品——痛点Before/After+内核设计+权威类比 |
| `f32a746` | feat(v0.4.3): 记忆侧省token/提质量——沉淀预筛+召回相关性minScore+片段截断 |
| `ee11948` | fix(v0.4.2): 压缩产品演示GIF至README 10MB阈值下（12MB→8MB） |
| `29d5c85` | feat(v0.4.1): Marketplace收录标准（dsh.marketplace元数据+自动扫描规则说明） |

> 完整历史：`git log --oneline` 或访问 [GitHub Commits](https://github.com/EternalNight996/dsh-memory-eternal/commits/main)

---

## 📄 License

MIT

---

> **让 DSH 真正记住你：对话自动沉淀，知识随手可查。**　⭐ 觉得有用就点个 Star，Let's make AI not forget.
