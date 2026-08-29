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

**Install** (dsh-desktop via DSH CLI, one command):

```bash
# dsh-desktop (recommended): install via DSH CLI into the profile
dsh plugin --profile web add dsh-memory-eternal

# or update directly in the profile (pnpm workspace). Use pnpm — `npm install` throws EUNSUPPORTEDPROTOCOL
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

## ⚙️ Memory Config (plain words)

> All settings live in the **left sidebar "Memory Config"** (or Settings → Memory top) — edit and hit "Save". Here's the full page:

<p align="center">
  <img src="https://raw.githubusercontent.com/EternalNight996/dsh-memory-eternal/main/assets/screen/memory-config.png" width="880" alt="Memory config page" />
</p>

### 1. Most used

| Setting | Default | In plain words |
|---|---|---|
| Auto capture | on | auto-store useful content as cards after each turn |
| Auto recall | on | AI auto-queries memory when it needs history |
| Vault dir | `~/.dsh/memory-vault` | where memory lives, plain Markdown & git-able |

### 2. Save money (important)

| Setting | Default | In plain words |
|---|---|---|
| **Distill cards** | on | **compress** a conversation into a sharp card (calls AI, costs money). **Off = store raw text, zero cost** |
| **Dedup feeds AI** | on | judge if new content is a duplicate (calls AI). **Off = simple dedup**, saves one AI call |
| Distill output cap | 900 | max chars per compress, bigger = sharper but pricier |
| Recall min score | 2 | how "close" a match must be to return; bigger = sharper but leaks more (cheaper) |
| Min capture chars | 200 | too-short chats aren't stored (avoids small-talk waste) |
| Daily quota | 60 | max cards per day, prevents AI burning money |

### 3. How the service runs

| Setting | Default | In plain words |
|---|---|---|
| Keep-alive `autoWebMode` | init | `init`=open web once at DSH start; `interval`=periodically check & restart if dead; `manual`=fully manual |
| Watchdog `watchdogAutoSpawn` | on | a **standalone process** keeps web alive (+47 MB). Personal use can turn off |
| Auto-mount MCP `autoMcpSetup` | off | **lets Claude Code / Codex / Cursor use your memory**. On = auto-configures them; Off = never touches your config, run `dsh-memory setup` manually |

> 💰 **To save money**: turn `Distill cards` off, lower `Distill output cap`, raise `Recall min score`.

### 🎯 One-click presets

Top of the config page: **🟢 A Light / 💰 B Budget / ⭐ C Premium** — click to fill, then Save:

| Plan | Scenario | Keep-alive | Watchdog | Distill | Distill cap | Recall min | Memory | LLM cost |
|---|---|---|---|---|---|---|---|---|
| 🟢 **A Light** | Personal dev (default) | init | off | on | 900 | 2 | ~47 MB | normal |
| 💰 **B Budget** | Tight budget / many Agents | init | off | **off** | 500 | 3 | ~47 MB | **~0** |
| ⭐ **C Premium** | Long projects / teams | interval | **on** | on | 1200 | 1 | ~94 MB | high |

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
