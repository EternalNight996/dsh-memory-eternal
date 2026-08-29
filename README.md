# 🧠 dsh-memory-eternal — 给 AI 装「第二大脑」

<p align="center">
  <img src="https://img.shields.io/badge/DeepSeek%20Harness-plugin-3B82F6" alt="DSH plugin" />
  <img src="https://img.shields.io/npm/v/dsh-memory-eternal" alt="npm version" />
  <img src="https://img.shields.io/github/stars/EternalNight996/dsh-memory-eternal?style=flat" alt="GitHub stars" />
  <img src="https://img.shields.io/github/license/EternalNight996/dsh-memory-eternal" alt="license" />
  <a href="https://dsh.market/"><img src="https://raw.githubusercontent.com/2BingLing/dsh-market/master/assets/readme/badge-listed-zh.svg" alt="DSH Market 收录" /></a>
</p>

> **对话结束自动沉淀，跨会话不失忆；召回只取相关小块，省 token 少噪音。**
> 全自研、零第三方记忆框架、不改 DSH 源码、一个记忆库所有 Agent 共享，纯 Markdown 可 git 管理。

<p align="center"><strong>⭐ 觉得好用就点个 Star</strong>！ <br/><sub>DSH 一条命令：<code>dsh plugin --profile web add dsh-memory-eternal</code></sub></p>

<p align="center">
  <img src="https://raw.githubusercontent.com/EternalNight996/dsh-memory-eternal/main/assets/screen/dsh-memory-eternal.gif" width="880" alt="对话自动沉淀 + 图形化知识库 + 知识图谱（演示）" />
</p>

---

## 🚀 五分钟上手

### 🟦 DeepSeek Harness（DSH）—— 重点

**装**（一条命令）：

```bash
# profile 是 pnpm workspace，用 pnpm 更新（npm install 会报 EUNSUPPORTEDPROTOCOL）
cd ~/.dsh/profiles/web && pnpm add dsh-memory-eternal@latest
```

**重启 dsh web** 后，三样东西立即生效：

| 效果 | 在哪看 |
|---|---|
| 自动沉淀知识卡 | 每轮对话结束自动发生，无需操作 |
| `memory_recall` 工具 | Agent 需要历史时自动调用 |
| 图形化界面 | 侧边栏底部「记忆」按钮 / 设置 → 记忆 |

**侧边栏现在有 2 个入口**：`记忆`（看库）和`⚙ 配置`（改配置 + 看各 Agent 挂载状态）。

**改配置**：左侧栏 `⚙ 配置` → DSH 记忆配置（去重阈值/召回条数等）+ 服务自管理（web 端口/保活模式/看门狗等）直接改，点保存即写入。`autoWebMode`/`watchdogAutoSpawn` 的改动需要重启 DSH 才生效。

### 🟨 Claude Code

```bash
npm i -g dsh-memory-eternal     # 装 CLI + MCP（自动写入 ~/.claude.json + SessionEnd hook）
```

装完即用：会话里说「recall 一下数据库选型」→ 自动检索记忆；会话结束/上下文压缩前 → 自动沉淀入库。

### 🟧 Codex CLI / Cursor

```bash
npm i -g dsh-memory-eternal     # 装完自动写 Codex config.toml / Cursor mcp.json
```

重启工具 → MCP 已在列表，会话里直接：`用 memory_recall 查一下项目历史决策`。

### 🟩 浏览器（不依赖任何 Agent）

```bash
dsh-memory open    # 起 web + 开浏览器（默认 http://127.0.0.1:7999）
```

统计 / 搜索 / 知识卡（增删改合并导入导出）/ 知识图谱，全在此。与 DSH 内嵌页同一份 UI，数据同步。

> **zcode（智谱）**：暂无原生 MCP，经社区 [zcode-open-bridge](https://github.com/tizerluo/zcode-open-bridge) 转 MCP 或用 CLI。

---

## 📖 命令速查

```bash
dsh-memory recall "数据库选型"       # 检索
dsh-memory capture "重要结论..."     # 手动沉淀（- 读 stdin）
dsh-memory sweep ~/.claude/projects  # 挖掘已有会话记录
dsh-memory setup [--dry-run]         # 重跑/预览自动挂载（幂等）
dsh-memory mcp                       # MCP stdio（挂任意 MCP 客户端）
dsh-memory serve [--port 7999]       # 前台跑 web
dsh-memory open                      # ensure web 存活 + 开浏览器
dsh-memory watchdog [--port 7799]    # 看门狗保活 web（独立进程）
```

单独装（不发 DSH）时 `dsh-memory` 命令来自 `npm i -g`。

---

## ⚙️ 服务自管理（白话）

**三个概念**，别搞混：

- **web server 怎么保活**（`autoWebMode`）→ `init`=DSH 启动时拉一次（默认）；`interval`=DSH 进程内定时探活自动拉起（0 额外内存）；`manual`=全手动只从 `dsh-memory open` 起。
- **看门狗进程**（`watchdogAutoSpawn`，默认开）→ 一个**独立** node 进程，DSH 退出了它也能拉起 web（约 +47 MB 内存）。只在要 7×24 保活时开。
- **自动挂载 MCP**（`autoMcpSetup`，默认关）→ 是否自动把 MCP 写进 Claude Code/Codex/Cursor 配置。关 = 不碰你本机配置文件，需要时手动 `dsh-memory setup`。

**改这些**：左侧栏 `⚙ 配置` → 表格里改，点保存；或直接编辑 设置 → 记忆。

**MCP 是协议不是常驻服务**：agent 开会话才 spawn，用完即退，没有「开机自启」一说。

### 三种部署强度

| 场景 | 配置 | 内存 |
|---|---|---|
| 个人开发（默认） | `autoWebMode=init` + `watchdogAutoSpawn=off` | web 47 MB |
| 常驻 7×24 | `watchdogAutoSpawn=on` | web + watchdog 47+47 MB |
| 真正开机自启（无 DSH） | Windows 计划任务跑 `dsh-memory watchdog --port 7799 --interval 5000 --max-restart 10` | 同上 |

---

## 🔧 常用配置

| 设置项 | 默认 | 说明 |
|---|---|---|
| 自动沉淀 | 开 | 每轮结束自动捕获 |
| 自动召回 | 开 | 注入 system prompt + `memory_recall` 工具 |
| 去重阈值 | 0.62 | 相似卡判定（越高越严格） |
| 捕获最小长度 | 200 | 短于该长度不触发捕获 |
| 日配额 | 60 | 每天最多自动写卡数，防烧 token |
| 召回条数 | 5 | 一次召回返回几张 |
| 记忆库目录 | `~/.dsh/memory-vault` | 纯 Markdown，可指向 Obsidian Vault |
| autoWebMode | `init` | init / interval / manual |
| watchdogAutoSpawn | 开 | 独立看门狗进程（+47 MB） |
| autoMcpSetup | 关 | 自动挂 MCP 到本机 Agent |
| **蒸馏知识卡** | 开 | **成本**：关=只存原文卡，零 LLM 消耗（最省钱） |
| **语义去重喂 LLM** | 开 | **成本**：关=纯词法去重（省一次蒸馏前 LLM 调用） |
| **蒸馏输出上限** | 900 | **成本**：单次蒸馏 token 上限，越高越准越贵 |
| **召回相关性阈值** | 2 | **成本**：越高召回越少越精越省 |

> 💰 **想省钱**：把 `蒸馏知识卡` 关掉（或用原文卡），调低 `蒸馏输出上限`、调高 `召回相关性阈值`。全部在 左侧栏 `⚙ 配置` → 成本控制 里调。

---

## 🧬 为什么全自研

市面上记忆方案多，但大多依赖第三方框架 / 动不动起 MCP 服务 / 记忆锁私有库。本插件把骨架自己搭，**零第三方运行时依赖**，逻辑逐行可读：

| 模块 | 自研实现 | 替代什么 |
|---|---|---|
| 去重 | 词法 Jaccard bigram（0.62）+ 语义去重 | 防重复卡 |
| 检索 | CJK 感知：中文整词 + 字符 bigram | 无需全文搜索引擎 |
| 图谱 | 力导向 + `[[wikilink]]`/共享标签连边 | 知识关联一眼看清 |
| 存储 | 带 frontmatter 的普通 `.md` | 不锁库、可读、可 git、可被任意工具读 |

> 与热门项目同向（总结→存储→按需召回），但定位不同：**本地、自研、零依赖、可读可控**。如果你已在用 mem0/Zep 等，也能把它当「本地持久记忆底座」叠加使用。

---

## 🛠 开发 / 测试

```bash
npm i
npm test        # 单元测试：vault 去重/检索/图谱 + capture 管线 + API 形状
npm run build   # 构建 lib/client.js（DSH 内嵌）+ web/app.js（独立 web bundle）
```

---

## 📄 License

MIT

---

> **让 AI 真正记住你：对话自动沉淀，知识随手可查。** ⭐ 觉得有用就点个 Star，Let's make AI not forget.
>
> English README: [README.en.md](README.en.md)
