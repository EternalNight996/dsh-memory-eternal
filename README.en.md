# 🧠 dsh-memory-eternal — A "second brain" for your AI

<p align="center">
  <img src="https://img.shields.io/badge/DeepSeek%20Harness-plugin-3B82F6" alt="DSH plugin" />
  <img src="https://img.shields.io/npm/v/dsh-memory-eternal" alt="npm version" />
  <img src="https://img.shields.io/github/stars/EternalNight996/dsh-memory-eternal?style=flat" alt="GitHub stars" />
  <img src="https://img.shields.io/github/license/EternalNight996/dsh-memory-eternal" alt="license" />
  <a href="https://dsh.market/"><img src="https://raw.githubusercontent.com/2BingLing/dsh-market/master/assets/readme/badge-listed.svg" alt="DSH Market listed" /></a>
</p>

> **Auto-captures knowledge after every conversation and survives across sessions; recall fetches only the relevant chunks — saves tokens, less noise.**
> Fully self-built, zero third-party memory framework, no DSH source changes, one vault shared by every Agent, plain Markdown & git-manageable.

<p align="center"><strong>⭐ Star it if you like it!</strong> <br/><sub>DSH one-liner: <code>dsh plugin --profile web add dsh-memory-eternal</code></sub></p>

<p align="center">
  <img src="https://raw.githubusercontent.com/EternalNight996/dsh-memory-eternal/main/assets/screen/dsh-memory-eternal.gif" width="880" alt="Auto-capture + visual library + knowledge graph (demo)" />
</p>

---

## 🚀 Get Started in 5 Minutes

### 🟦 DeepSeek Harness (DSH) — focus

**Install** (one command):

```bash
# The profile is a pnpm workspace — update with pnpm (`npm install` throws EUNSUPPORTEDPROTOCOL)
cd ~/.dsh/profiles/web && pnpm add dsh-memory-eternal@latest
```

After **restarting dsh web**, three things are live immediately:

| Effect | Where |
|---|---|
| Auto-capture of knowledge cards | Happens every turn, no action needed |
| `memory_recall` tool | Agent calls it automatically when it needs history |
| Visual UI | Sidebar bottom `Memory` button / Settings → Memory |

**The sidebar now has 2 entries**: `Memory` (browse the vault) and `⚙ Config` (edit settings + see each Agent's mount status).

**Edit config**: Sidebar `⚙ Config` → DSH memory config (dedup threshold / recall limit etc.) + self-hosting (web port / keep-alive mode / watchdog etc.) — just edit and hit save. `autoWebMode` / `watchdogAutoSpawn` changes require a DSH restart to take effect.

### 🟨 Claude Code

```bash
npm i -g dsh-memory-eternal     # installs CLI + MCP (auto-writes ~/.claude.json + SessionEnd hook)
```

Ready after install: say "recall 数据库选型" in a session → auto-retrieves memory; on session end / before context compaction → auto-captures.

### 🟧 Codex CLI / Cursor

```bash
npm i -g dsh-memory-eternal     # auto-writes Codex config.toml / Cursor mcp.json
```

Restart the tool → MCP is in the list; just use: `用 memory_recall 查一下项目历史决策`.

### 🟩 Browser (no Agent needed)

```bash
dsh-memory open    # starts web + opens browser (default http://127.0.0.1:7999)
```

Stats / search / card grid (add-edit-merge-import-export) / knowledge graph — all here. Same UI as the DSH embed; data stays in sync.

> **zcode (Zhipu)**: no native MCP; bridge via [zcode-open-bridge](https://github.com/tizerluo/zcode-open-bridge) or use the CLI directly.

---

## 📖 Command Reference

```bash
dsh-memory recall "database selection"   # retrieve
dsh-memory capture "important note..."   # manual capture (- reads stdin)
dsh-memory sweep ~/.claude/projects      # mine existing sessions
dsh-memory setup [--dry-run]             # re-run / preview auto-mount (idempotent)
dsh-memory mcp                           # MCP stdio (mount to any MCP client)
dsh-memory serve [--port 7999]           # run web in foreground
dsh-memory open                          # ensure web alive + open browser
dsh-memory watchdog [--port 7799]        # watchdog keep-alive (standalone process)
```

When not running on DSH, the `dsh-memory` command comes from `npm i -g`.

---

## ⚙️ Self-hosting (plain words)

Three concepts, don't mix them:

- **How the web server stays alive** (`autoWebMode`) → `init`=pull once at DSH start (default); `interval`=DSH in-process timer probes & auto-restarts (0 extra memory); `manual`=fully manual, only from `dsh-memory open`.
- **Watchdog process** (`watchdogAutoSpawn`, default on) → a **standalone** node process that can pull web up even after DSH exits (~+47 MB RAM). Only turn on for 7×24 keep-alive.
- **Auto-mount MCP** (`autoMcpSetup`, default off) → whether to auto-write MCP into Claude Code/Codex/Cursor config. Off = don't touch your machine config; run `dsh-memory setup` manually when needed.

**Change these**: Sidebar `⚙ Config` → edit the table and save; or edit Settings → Memory directly.

**MCP is a protocol, not a resident service**: the agent spawns it per session and exits when done — no "auto-start on boot" concept.

### Three deployment intensities

| Scenario | Config | Memory |
|---|---|---|
| Personal dev (default) | `autoWebMode=init` + `watchdogAutoSpawn=off` | web 47 MB |
| Resident 7×24 | `watchdogAutoSpawn=on` | web + watchdog 47+47 MB |
| True boot auto-start (no DSH) | Windows Task Scheduler runs `dsh-memory watchdog --port 7799 --interval 5000 --max-restart 10` | same |

---

## 🔧 Common Settings

| Setting | Default | Notes |
|---|---|---|
| Auto capture | on | auto-harvest after each turn |
| Auto recall | on | injects system prompt + `memory_recall` tool |
| Dedup threshold | 0.62 | similar-card judgment (higher = stricter) |
| Min capture chars | 200 | below this, no capture |
| Daily quota | 60 | max auto cards/day, avoids burning tokens |
| Recall limit | 5 | how many cards per recall |
| Vault dir | `~/.dsh/memory-vault` | plain Markdown, can point to an Obsidian Vault |
| autoWebMode | `init` | init / interval / manual |
| watchdogAutoSpawn | on | standalone watchdog process (+47 MB) |
| autoMcpSetup | off | auto-mount MCP to local Agents |
| **Distill cards** | on | **Cost**: off = raw cards only, zero LLM (cheapest) |
| **Dedup feeds LLM** | on | **Cost**: off = pure lexical dedup (saves a pre-distill LLM call) |
| **Distill output cap** | 900 | **Cost**: tokens per distill, higher = better but pricier |
| **Recall min score** | 2 | **Cost**: higher = fewer, sharper, cheaper recalls |

> 💰 **To save money**: turn `Distill cards` off (or use raw cards), lower `Distill output cap`, raise `Recall min score`. All in Sidebar `⚙ Config` → Cost control.

---

## 🧬 Why Fully Self-built

Most memory solutions lean on third-party frameworks / spin up an MCP service / lock memory in a private store. This plugin builds the skeleton itself — **zero third-party runtime deps**, logic readable line by line:

| Module | Self-built | Replaces |
|---|---|---|
| Dedup | lexical Jaccard bigram (0.62) + semantic dedup | duplicate-card prevention |
| Retrieval | CJK-aware: Chinese whole-word + char bigram | no full-text search engine needed |
| Graph | force-directed + `[[wikilink]]`/shared-tag edges | see knowledge links at a glance |
| Storage | plain `.md` with frontmatter | not locked in, readable, git-able, any tool can read |

> Same direction as popular projects (summarize→store→recall), but positioned differently: **local, self-built, zero-dep, readable & controllable**. If you already use mem0/Zep etc., just layer this as a "local persistent memory base".

---

## 🛠 Development / Test

```bash
npm i
npm test        # unit tests: vault dedup/retrieval/graph + capture pipeline + API shapes
npm run build   # builds lib/client.js (DSH embed) + web/app.js (standalone web bundle)
```

---

## 📄 License

MIT

---

> **Make your AI truly remember: dialogue auto-captured, knowledge at your fingertips.** ⭐ Star it if you like, Let's make AI not forget.
>
> 中文 README: [README.md](README.md)
