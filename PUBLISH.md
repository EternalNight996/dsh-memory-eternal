# 发布到插件市场（npm + GitHub）指南

参考 [dsh-ui-three-body](https://github.com/EternalNight996/dsh-ui-three-body) 的发布范式与 [dsh-market](https://github.com/dsh-market/dsh-market) 的收录机制整理。本插件已按该范式配置好，按下面顺序走即可。

---

## 0. 先看懂：插件是怎么被「发现」的

DSH 插件市场（`dshmarket`）不是人工审核制，而是**自动同步**两类来源：

1. **npm 包**：`keywords` 里带 `dsh-plugin` 的包（市场优先用 npm tarball 安装，快）。
2. **GitHub 仓库**：打了 `dsh-plugin` topic 的仓库（提供 README、截图、star 数、五维评分素材）。

所以「上传到插件市场」= ① 推 GitHub 并打 `dsh-plugin` topic + ② 发 npm。两条都做，收录与安装体验最好。

---

## 1. 配置核对

本插件 `package.json` 已具备市场收录所需字段：

- `name: dsh-memory-eternal`（npm 包名，全小写唯一）
- `main: index.js`（host 半边入口）
- `exports` 含 `./client`（client 半边，`dsh.client` 靠它自动挂载）与 `./cordis.patch.yml`（bundle 补丁层）
- `files` 白名单：`index.js`, `lib`, `assets`, `docs`, `cordis.patch.yml`, `README.md`, `PUBLISH.md`, `LICENSE`
- `keywords` 含 **`dsh-plugin`**（市场收录关键）+ `deepseek-harness`、`dsh` 等
- `dsh.client`：platform web + 显式 inject 列表
- `dsh.bundle.patch`：指向 `cordis.patch.yml`（host 行自动挂载）
- `scripts.prepublishOnly`：发布前自动重构建 client

## 2. 本地先验证（发布前必做）

```bash
npm i
npm test                 # 29 个单测全绿
npm run build            # 生成 lib/client.js

# 装进当前 profile 试跑
npx @deepseek-ai/dsh plugin --profile web add F:/absolute/path/to/dsh-memory-eternal
# 或（DSH profile 是 pnpm workspace，装/更新插件用 pnpm，勿用 npm install，否则 link: 报 EUNSUPPORTEDPROTOCOL）
#   cd ~/.dsh/profiles/web && pnpm add dsh-memory-eternal@latest
# 重启 dsh web → 设置 → 记忆：看到知识库页面
# 聊几轮 → ~/.dsh/memory-vault/03-Knowledge/ 出现自动沉淀的知识卡
```

## 3. 上传 GitHub

```bash
cd dsh-memory-eternal
git init
git add .
git commit -m "feat: 记忆核心（Memory Core）DSH 插件 v0.1.0 —— 对话自动沉淀 + 图形化知识库"

# 在 GitHub 网页上先建空仓库 dsh-memory-eternal，然后：
git remote add origin https://github.com/<你的用户名>/dsh-memory-eternal.git
git branch -M main
git push -u origin main
```

**关键一步**：在 GitHub 仓库页 → ⚙️ Settings → Topics，添加 `dsh-plugin`（再加 `deepseek-harness`、`memory`、`knowledge-graph` 等）。这是市场自动收录 GitHub 源的识别标志。

> README 里的截图放 `assets/screen/` 并在 README 引用（市场会自动从 README 提取截图）；头部可放一张 `assets/dsh-memory-eternal.gif` 动态演示（本仓库已压缩至 ~3MB 并置于 README 头部）。

## 4. 上传 npm

```bash
npm login          # 首次：输入 npm 账号（去 npmjs.com 注册）
npm publish        # 触发 prepublishOnly 自动 build，然后发布
```

发布成功后：

- npm 地址：`https://www.npmjs.com/package/dsh-memory-eternal`
- 用户可一条命令安装：`npx @deepseek-ai/dsh plugin --profile web add dsh-memory-eternal`

常见坑：

- **包名被占**：`npm publish` 报 `403 Forbidden` 通常是名字冲突，改个名字。
- **未构建就发布**：`prepublishOnly` 已兜底重构建 client，别删这行。
- **`.npmignore`**：本项目用 `files` 白名单，比 `.npmignore` 更省心，别两个都写。

## 5. 进入插件市场（收录）

发布 npm + 打 GitHub topic 后，市场 registry 会周期性同步。若想主动加速/确认收录，可到 [dsh-market](https://github.com/2BingLing/dsh-market) 或 [dsh-plugin-marketplace](https://github.com/AwesomeHou/dsh-plugin-marketplace) 的收录入口提交。

五维评分靠 README 质量：**用途一句话 + 真实截图 + 安装命令 + 目录结构 + 待办**（本插件 README 已按此结构写好）。

## 6. 更新版本

```bash
npm version patch        # 0.1.0 → 0.1.1（自动改 package.json + git tag）
npm publish              # 重新发布
git push --follow-tags   # 同步 tag 到 GitHub
```

---

## 一句话总览

```
本地验证 → GitHub 建仓打 dsh-plugin topic → npm login + npm publish → 市场自动收录
```
