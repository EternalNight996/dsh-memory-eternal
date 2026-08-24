# 记忆核心（dsh-memory-eternal）

<p align="center">
  <img src="https://img.shields.io/badge/DeepSeek%20Harness-plugin-3B82F6" alt="DSH plugin" />
  <img src="https://img.shields.io/npm/v/dsh-memory-eternal" alt="npm version" />
  <img src="https://img.shields.io/github/stars/EternalNight996/dsh-memory-eternal?style=flat" alt="GitHub stars" />
  <img src="https://img.shields.io/github/license/EternalNight996/dsh-memory-eternal" alt="license" />
</p>

> 🧠 **给 DeepSeek Harness 装上「第二大脑」**：一款**自研独立**的 DSH 记忆插件，为任意 DeepSeek Harness 提供对话级长期记忆——对话结束后**自动**把值得长期复用的内容压缩成知识卡，写入本地 Markdown Vault（自研去重、自研 CJK 检索、可 git 管理）；设置页提供**图形化知识库**：统计概览、CJK 检索、知识卡网格、自研知识图谱。Agent 通过 `memory_recall` 工具按需召回历史上下文。**一条命令安装，零人工干预，不改 dsh 源码。**

---

<p align="center">
  <img src="assets/screen/dsh-memory-eternal.gif" width="880" alt="记忆核心 DSH 插件效果演示（动态）" />
  <br/>
  <em>记忆核心 · 对话自动沉淀 + 图形化知识库 + 增强知识图谱（动态演示）</em>
</p>

<p align="center">
  <img src="assets/screen/memory-settings.png" width="840" alt="设置 → 记忆：图形化知识库主界面（统计 + 检索 + 卡片/图谱 Tab + 分类）" />
  <br/>
  <em>设置 → 记忆：统计概览、CJK 检索、知识卡网格、按 kind 分类（「知识卡 / 知识图谱」Tab 一键切换）</em>
</p>

<p align="center">
  <img src="assets/screen/memory-popup.png" width="840" alt="侧边栏「记忆」按钮一键打开完整记忆库弹窗（含增强知识图谱）" />
  <br/>
  <em>侧边栏底部「记忆」按钮 → 一键打开<strong>完整记忆库弹窗</strong>：更开阔的查看体验 + 增强版知识图谱</em>
</p>

<p align="center">
  <img src="assets/screen/memory-sidebar.png" width="460" alt="侧边栏底部新增「记忆」入口，位于更新配置下方" />
  <br/>
  <em>侧边栏底部新增「记忆」入口（位于「设置 / 更新配置」下方），一键直达知识库</em>
</p>

---

## ✨ 为什么值得装

| 亮点 | 说明 |
| --- | --- |
| 🧬 **原创自研** | 去重 / CJK 检索 / 知识图谱 / 图形化界面均由本仓库**独立实现**；运行时**不依赖**任何第三方记忆框架，核心逻辑可在 `lib/` 逐行核对 |
| 🤖 **全自动沉淀** | 每轮对话结束自动触发（监听 `agent/turn-stopping`），模型判定「是否值得保存」并压缩成 300-800 字知识卡——**无需任何手动操作** |
| 📚 **本地 Markdown Vault** | 知识卡是带 frontmatter 的普通 `.md` 文件，默认落在 `~/.dsh/memory-vault`，可手动编辑、可 git 版本管理、可被任何工具读取，不锁进私有数据库 |
| 🚫 **智能去重** | 双层去重：**自研词法 Jaccard bigram**（0.62 阈值）+ **语义去重**（把已有卡片索引喂给模型，由模型决定「新建 vs 追加到已有卡」，对 LLM 改写免疫） |
| 🔍 **CJK 感知检索** | 中文整词 + 字符 bigram 命中，短查询「强化学习」「蒸馏」也能在长文里命中，无需全文搜索引擎 |
| 🕸 **知识图谱** | 卡片间的 `[[wikilink]]`、共享标签与**相似度关联**自动连线；Canvas 图谱支持**图例过滤、时间维着色、右键菜单、Shift 框选多选、导出/删除/合并**，交互全面 |
| 🧠 **自动召回** | 注入 system prompt 告知 Agent 它拥有记忆核心，并注册 `memory_recall` 工具——需要项目背景/历史决策/领域知识时自动检索 |
| 🔒 **本地优先** | 所有内容留在你的本机 Vault；不设遥测、不传云端。模型请求仍走你已配置好的 provider |
| ⚙️ **一键安装** | 与 `dsh-ui-three-body` 同款插件机制，`dsh plugin --profile web add dsh-memory-eternal` 即可 |

**适合**：想要让 DSH 记住项目背景与历史决策的人 / 想给对话沉淀可检索知识库的人 / Obsidian 式 Markdown Vault 爱好者 / 在意数据归属（本地文件 > 云端数据库）的人。

---

## 🚀 安装

```bash
# 已发布后（npm）—— 跨平台通用（无需 cd / 无需平台路径）
dsh plugin --profile web add dsh-memory-eternal

# 从 GitHub
dsh plugin --profile web add github:EternalNight996/dsh-memory-eternal

# 本地联调（link 本地目录，改代码即时生效）
dsh plugin --profile web add F:/MyApp/eternal/dsh-memory-eternal
```

> 提示：
> - `dsh` 为 DSH CLI（`npm i -g @deepseek-ai/dsh` 后可直接用，跨平台、无需 cd/平台路径）。
> - 要**官方最新**（避免 npmmirror 镜像滞后）：`npm_config_registry=https://registry.npmjs.org/ dsh plugin --profile web add dsh-memory-eternal`。
> - **DSH profile 是 pnpm workspace**（本地插件用 `link:`）：在 profile 目录用 `pnpm add` 装/更新，`cd ~/.dsh/profiles/web && pnpm add dsh-memory-eternal@latest`（bash/PowerShell）；`npm install` 会报 `EUNSUPPORTEDPROTOCOL`。

装完**重启 dsh web**：设置 → 记忆 出现知识库页面；侧边栏底部也会出现「记忆」按钮，一键打开完整记忆库弹窗。此后每轮对话自动沉淀知识卡。

### 🧭 插件发现 / 收录标准

本插件面向 DSH 插件生态，仓库已打 **GitHub `dsh-plugin` topic** 并按社区标准结构发布，可被以下机制**自动发现**（无需手动提交 PR）：

| 机制 | 收录方式 | 状态 |
| --- | --- | --- |
| **dsh-marketplace**（ouyangyipeng） | 实时读取 **GitHub `topic:dsh-plugin`** 的社区仓库，有该 topic 即进入 `设置 → 插件 → Marketplace` | ✅（topic 已打） |
| **dsh-find-plugin**（awesome-dsh-plugin） | 会话内按 `topic:dsh-plugin` + 星数实时搜索 | ✅ |
| **dsh-plugin-marketplace**（YELEBAI） | 每 2 小时扫描 `topic:dsh-plugin`，静态验证 manifest/patch/入口/npm tarball 后写入中心 Registry；无需人工申请 | ✅（已声明 `dsh.marketplace` 元数据辅助分类/一键安装） |

> dsh-plugin-marketplace 会读取 `package.json#dsh.marketplace`（`profiles:["web"]`、`requiresBuildApproval:false`、`manualSteps:false`）来给插件归类并开放一键安装。两个市场均为**自动扫描**，非发布动作；插件结构通过验证即被收录。

---

## 🧠 自动沉淀（零人工干预）

对话每轮结束 → 插件提取增量消息 → 调用当前模型压缩 → 双层去重 → 写入 Vault：

```
你的对话
   │
   ▼
agent/turn-stopping ──► 提取本轮 user/assistant 消息
   │
   ▼
LLM 判定（值得保存？）──否──► 丢弃
   │是
   ▼
语义去重（喂给模型已有卡片索引）
   ├─ 同一主题 ──► append_to：追加「更新记录」到已有卡（不建重复卡）
   └─ 新主题 ────► 写新知识卡到 02-08 对应目录
```

知识卡格式（frontmatter + markdown 正文）：

```markdown
---
kind: knowledge
title: 数据库索引原理与B+树加速机制
tags: [数据库, 索引, B+树, 查询优化]
created: 2026-08-21T12:01:51.636Z
updated: 2026-08-21T12:01:51.636Z
source: session:session-xxxx
---
# 数据库索引原理与B+树加速机制

## 核心定义
- 索引是数据库为加速查找而额外维护的数据结构...
```

Vault 目录结构：

```
~/.dsh/memory-vault/
├── 00-System/          # 系统（未来扩展：Active-Context 等）
├── 02-Projects/        # 项目背景 / 进度
├── 03-Knowledge/       # 通用知识 / 技术方案 / 设计决策（默认）
├── 04-Content/         # 内容素材 / 资料
├── 05-Prompts/         # 提示词 / 工作流
├── 06-Business/        # 业务 / 商业
├── 07-Tools/           # 工具链 / CLI / 配置 / 环境坑
└── 08-Mistakes/        # 教训：错误 / 反模式 / 踩坑 /「别这么做」
```

## 🕸 图形化知识库（设置 → 记忆 + 侧边栏「记忆」入口）

- **双入口**：设置 → 记忆 页 + 侧边栏底部「记忆」按钮（一键打开完整记忆库弹窗）
- **统计概览**：总卡数、近 7 天新增、标签数、知识卡数
- **检索**：中文片段即时搜索（280ms 防抖）
- **知识卡网格**：kind 筛选（全部/项目/知识/内容/提示词/业务/工具/教训），点击卡片阅读全文（frontmatter 一并展示）
- **知识图谱（增强版）**：**多环径向 / 力导向**混合布局（按 kind 分扇区、枢纽在内圈、环间距不重叠，数量大也不乱）；节点 = 知识卡（按 kind 渐变+发光着色、按连接数自动放大）；连线 = `[[wikilink]]`、共享标签或**相似度关联**（曲线渐变，只保留**高影响力主干边**避免毛球）；**默认只显示枢纽标签**、放大后全量显示；**几千节点不卡**；**滚轮缩放、按住左键拖动画布**、**左键凸显关联节点并淡化无关节点**、悬停高亮

### 🕸 图谱交互速览

| 操作 | 效果 |
| --- | --- |
| 左键点击节点 | 凸显该节点及关联（淡化无关） |
| **右键节点** | 弹出菜单：打开卡片 / 凸显关联 / 复制名称 / **删除** |
| **Shift + 拖拽** | 方形**框选多节点** → 浮出「导出选中 / 删除选中 / **合并** / 清空」 |
| 滚轮 | 以光标为中心缩放 |
| 左键拖空白 | 平移画布 |
| 点图例 | **按 kind 过滤**（再点取消） |
| **时间维** 开关 | 节点按最后更新时间着色：3 天内绿 / 2 周内琥珀 / 1 月内橙 / 更早灰蓝 |
| 搜索框 | 标题 + 类型名匹配，无结果有提示 |
| **导出** | 一键导出 PNG（预览弹窗：下载 / **另存为** / 复制 / 全屏） |

### 📇 知识卡管理

- 卡片列表搜索命中，标题与摘要**关键词高亮**（`<mark>`）
- 3 天内更新的卡自动标「**新**」角标；排序支持 最近 / 标题 / 热点
- 打开长卡**默认折叠**，可「展开全部 / 收起」
- 卡片行右下角「✕」**删除记忆**（确认后删），阅读器内亦可删除
- 列表**无限滚动懒加载**（滚动到底自动加载下一批）
- 自定义**滚动条**配色，明暗主题都清晰可见
- 阅读全文走**轻量 Markdown 渲染**（标题/加粗/列表/代码块/引用/安全链接，先转义再白名单）
- 记忆库工具栏：**导入 / 导出 MD / 导出 JSON / 刷新**（导出可选**自选位置**另存为，或默认下载）
- 所有操作**顶部醒目 toast** 反馈：✓ 绿 = 成功、✕ 红 = 失败，并显示导出位置 / 文件名
- 导出分两类：**知识卡片**（MD/JSON）与**知识图谱**（PNG），均可选**另存为**自定位置

## 🔧 设置

| 设置项 | 默认 | 说明 |
| --- | --- | --- |
| 启用 | 开 | 总开关 |
| 自动沉淀 | 开 | 每轮对话结束自动捕获 |
| 自动召回 | 开 | 注入 system prompt + `memory_recall` 工具 |
| 记忆库目录 | 空 | 留空 = `~/.dsh/memory-vault`；可指向任意目录（如 Obsidian Vault） |
| 去重阈值 | 0.62 | 词法去重 Jaccard 相似度阈值（自研默认值） |
| 捕获最小长度 | 200 | 少于该字符数的对话不触发捕获 |
| 日配额 | 60 | 每天最多自动写卡数，防止烧 token |

## 🛠 开发 / 构建 / 测试

```bash
npm i
npm test        # 29 个单元测试：vault 去重/检索/图谱 + capture 管线 + API 形状
npm run build   # 打包 client（改 src/client 后需要；改 index.js / lib 无需构建）
```

目录结构：

```
dsh-memory-eternal/
├── index.js             # host 半边：设置 + turn-stopping 钩子 + 工具 + JSON API
├── lib/
│   ├── vault.js         # Markdown Vault 存储层（frontmatter/去重/检索/图谱，纯 Node 可单测）
│   └── capture.js       # 自动沉淀管线（LLM 压缩 + 语义去重）
├── src/client/index.tsx # client 半边：设置页 + 侧边栏「记忆」按钮 + 完整记忆库弹窗（统计/搜索/卡片/图谱）
├── build.mjs            # esbuild 打包 client → lib/client.js
├── cordis.patch.yml     # bundle 补丁层（自动挂载 host 行）
└── tests/               # node:test 单测
```

## 🗺 Roadmap / 待办

- [x] 对话自动沉淀（turn-stopping 钩子 + LLM 压缩 + 双层去重）
- [x] CJK 感知检索 + 本地 Markdown Vault（02-08 分类 + frontmatter）
- [x] `memory_recall` 自动召回工具 + system prompt 分段
- [x] 图形化知识库：统计 / 检索 / 知识卡网格
- [x] 侧边栏「记忆」按钮 + 完整记忆库弹窗
- [x] 增强知识图谱：力导向/径向布局、滚轮缩放、左键拖拽、右键凸显关联、大规模抗压
- [x] 图谱交互增强：图例过滤、时间维着色、右键菜单、Shift 框选多选（导出/删除/合并）
- [x] 知识卡管理：Markdown 渲染、长卡折叠、新卡角标、搜索高亮、最近/标题/热点排序
- [x] 记忆库导出/导入（MD/JSON 备份，异地可迁移）
- [x] 知识卡删除 + 无限滚动懒加载 + 自定义滚动条
- [x] 导出可选默认下载 / 自选位置另存为（卡片 MD/JSON 与图谱 PNG）
- [ ] 每日记忆回顾 + 用量统计
- [ ] 多语言模板与自定义去重规则
- [ ] 卡片拖拽归类 / 批量合并更智能（按相似度预分组）
- [ ] Market 收录：dsh-marketplace / dsh-plugin-marketplace（待社区审核）

## 📦 发布记录

- **v0.4.2**（已发布）：修复 GitHub/npm 顶部产品演示 GIF 无法显示——压缩至 GitHub README 10MB 渲染阈值以下（8MB）。
- **v0.4.1**（已发布）：**Marketplace 收录标准**落地——声明 `package.json#dsh.marketplace`（`profiles:["web"]` 等），README 收录规则表对齐 dsh-marketplace / dsh-find-plugin / dsh-plugin-marketplace 的**自动扫描**机制；产品展示头部 GIF（`assets/screen/dsh-memory-eternal.gif`）置顶。
- **v0.4.0**（已发布）：图谱交互全面增强——**图例过滤**、**时间维着色**、**右键菜单**、**Shift 框选多选**、**单删/批量删除**、**多卡合并**、**一键导出 PNG**（预览：下载/另存为/复制/全屏）；知识卡——**Markdown 渲染**、**长卡折叠**、**新卡角标**、**搜索命中高亮**、**卡片行删除**、**无限滚动懒加载**、最近/标题/热点排序、自定义滚动条；**相似度关联建议**（similar 边）；**记忆库导出/导入**（MD/JSON 备份，导出可选**自选位置**）；操作**顶部醒目绿/红 toast**（反馈结果 + 导出位置/文件名）；默认视图与节点调大。
- **v0.3.0**：知识图谱**科学布局**升级——多环径向/力导向混合布局（按 kind 分扇区、枢纽在内圈、环间距不重叠，数量大也不乱）；只保留**高影响力主干边**（避免毛球）；默认只显示**枢纽标签**、放大后全量；大图关闭节点发光提升性能。
- **v0.2.9**：修复 **GitHub 源安装无法启动**——提交 `lib/client.js`（此前被忽略未入库，GitHub 拉取的包缺客户端 bundle，导致 DSH 启动失败）。
- **v0.2.8**：安装说明去掉 `npx` 前缀，只保留跨平台 `dsh plugin --profile web add`。
- **v0.2.7**：安装说明跨平台化——主推 `dsh plugin --profile web add`（无需 cd/平台路径），注明官方 registry（避免 npmmirror 滞后）与 pnpm 备选。
- **v0.2.6**：安装/更新说明补充——DSH profile 为 pnpm workspace，用 `pnpm add dsh-memory-eternal@latest`（勿用 `npm install`，会因 `link:` 报 `EUNSUPPORTEDPROTOCOL`）。
- **v0.2.5**：安装方式统一为 `dsh plugin --profile web add`（README 标注 npx 备选写法）。
- **v0.2.4**：知识库分类扩展——新增「工具 Tools」(07) 与「教训 Mistakes」(08) 两类（错误/反模式/踩坑/debug 教训），前端筛选、图谱着色、自动捕获提示词同步更新。
- **v0.2.3**：放宽兼容性——`@deepseek-ai/dsh-tools` / `dsh-llm` peer 依赖改为 `>=0.1.0-rc.2 <0.2.0`，跨整个 `0.1.x` 系列均兼容（大多数 DSH 版本可直接安装）。
- **v0.2.2**：放宽 `@deepseek-ai/dsh-tools` / `dsh-llm` peer 依赖至 `^0.1.0-rc.7`，同时兼容旧版与新版 DSH。
- **v0.2.1**：更新 `@deepseek-ai/dsh-tools` / `dsh-llm` peer 依赖至 `^0.1.1-rc.2`（对齐当前 DSH 运行时）。
- **v0.2.0**：新增侧边栏「记忆」入口 + 完整记忆库弹窗；增强知识图谱（力导向/径向布局、滚轮缩放、左键拖拽平移、左键凸显关联/右键打开卡片、大规模抗压：节点/连线上限 + 标签节流 + O(n) 径向布局）；README 头部动态演示 GIF。
- **v0.1.0**：首个可用版本。对话自动沉淀（turn-stopping 钩子 + LLM 压缩 + 双层去重）、`memory_recall` 工具、system prompt 召回段、Markdown Vault（02-08 分类 + frontmatter）、CJK 检索、自研知识图谱、设置页图形化知识库。

## 📄 License

MIT

---

> 让 DSH 拥有第二大脑：**对话自动沉淀，知识随手可查。** 🧠
