# Roadmap — the World Map

Quests are sized like enemies. 🟢 Slimes are perfect first PRs.

## Act I — "Leaving the Village" (v0.1 ✅ shipped)

- ✅ Rules engine: tiers, XP, Wilson-bound reliability, promotions, curses
- ✅ Battle loop with save points, shared scroll, independent judge, regression guard
- ✅ The Gatekeeper: per-tool-call tier enforcement through Claude Code's `PreToolUse` hook
- ✅ Adapters: claude-code, codex, gemini-cli, anthropic-api, openai-compatible, shell, mock
- ✅ Terminal UI, status-line HUD, simulated demo campaign, 17 tests

## Act II — "The First Dungeon" (v0.2): make it safe to play for real

| Quest | Size | Notes |
|---|---|---|
| Verify Claude Code flags + add a `--help` contract test | 🟢 | Every `VERIFY` comment in `src/adapters/cli.ts` |
| Verify Codex sandbox flags | 🟢 | |
| Verify Gemini CLI approval-mode flags | 🟢 | |
| ✅ Git **worktree per battle**, save point per turn, `keep` / `undo` | 🐗 | Done in v0.2, including one copy per hero for Pincer and Siege |
| ✅ **Quest types** and proof per victory condition | 👺 | `src/quests.ts` |
| ✅ **The Council**, seats 1–2 (Law, Ledger) with decision records and outcomes | 🐗 | `src/council.ts`, `src/ledger.ts` |
| Council seat 3: **the Seer** adapter (Jev, Arch-Router, or a small model asked 3×) | 👺 | See docs/DESIGN_PLAN.md §8–9 |
| ✅ Council seat 4: **fair cross-company judge** (authors hidden, order rotated, unanimous vote per condition) and **Pincer** side-by-side comparison | 🐗 | ✅ **Siege**: a quest split into parts fought at once and joined (`savepoint split`, `--formation siege`) |
| ✅ **Clerk, Scout and Plan** (`request`, `answer`, `plan`, `approve`) and play styles | 🐗 | Next: import from GitHub Issues |
| Enemy state machine: lurking → engaged → review → defeated / enraged (retrying) / escaped | 👺 | See ORCH in docs/CROSS_REFERENCE.md |
| **Battlefield**: file globs a battle may touch; edits outside = violation | 👺 | Extend `gate.ts` |
| ✅ Stop hook: "The enemy still stands!" — no proof, no victory, in Claude Code, Codex and Gemini CLI | 👺 | Capped at 3 pushes per battle |
| In-flight budget enforcement | 👺 | CLI budget flags where available; LiteLLM keys for API characters |
| Richer ledger fields in `log.jsonl` (model, tokens, duration) | 🟢 | |
| `savepoint pause` — the **Stop spell** kill switch | 🟢 | Freezes battles, drops everyone to T0 |
| Diminishing XP for repeat Slimes (anti-grind) | 🟢 | Rules + test |

## Act III — "The Guild Hall" (v0.3): shared world

| Quest | Size | Notes |
|---|---|---|
| **Chronicle MCP server** (`lore_get`, `lore_add`, `scroll_read`, `scroll_append`, `party_status`) | 🐗 | Lets every MCP-capable CLI share context mid-battle |
| ✅ Codex and Gemini gatekeepers via their hook systems | 🐗 | `src/hooks.ts`. Verify on real installs (see VERIFY notes) |
| Runtime adapters: wrap Claw Orchestrator or ORCH | 🐗 | Inherit their engines and cost ledgers |
| ✅ Quests from GitHub issues (`import github`) | 👺 | Linear, Notion and others through MCP connectors |
| Bosses with phases (epic → subtasks) | 🐗 | Summoner (T4) splits them |
| Equipment: system prompts, MCP servers, skills as tier-gated gear | 🐗 | See ClaudeArcade notes |
| Audit sampling at T4 | 👺 | 1-in-N victories go to a human judge |
| Scroll injection defences | 👺 | Treat scroll text as data; T3+ to write lore |

## Act IV — "The Airship" (v1.0): the full 90s experience

The full design is in **[docs/UX_PLAN.md](docs/UX_PLAN.md)**; its §11 "launch slice" is the first milestone.

| Quest | Size | Notes |
|---|---|---|
| ✅ `savepoint play`: local web server + live game event stream (SSE) + first battle screen | 🐗 | Binds to 127.0.0.1 with a one-time token |
| Port the prototype Hero/Foe generators to `assets/` + a sprite-sheet compositor | 🐗 | Style rules enforced in code |
| ✅ Launch slice: Title, Guild Town, Guild Counter, Quest Board, War Room, live battle, Treasure Vault, Tavern, Inn, Library, Settings (EN/JA) | 🐲 | Wait mode included |
| ✅ Gatekeeper **allow once / deny / hand off** (Wait mode) in all three CLIs | 👺 | Logged, no reliability penalty. Verified on a real Claude Code 2.1.309 install: ask → allow → victory, ask → deny → retreat, Tier 1 writes without asking. Heroes ask for one rank up only |
| World Map from the repo tree, with fog of war from agent reads | 🐗 | |
| Atelier: AI-proposed parts + Style Gatekeeper + approval gallery | 🐲 | |
| Original chiptune SFX pack wired to hook events | 👺 | Composers wanted |
| Title screen, encounter wipes, damage numbers, victory fanfare via hooks | 👺 | Must never block the hook's decision |

## Side quests — mechanics from the classics (see docs/EXPERIENCE.md)

| Quest | Size | What it proves |
|---|---|---|
| 🏅 **Gym Badges**: effective tier = min(character tier, project badge cap) | 👺 | Project safety rails gate autonomy |
| 🎛️ **Tactics presets** (Show No Mercy … Don't Use Magic) on a status-line key | 👺 | One-key cost/risk policy |
| 🔍 `savepoint scan <id>` with raw counts | 🟢 | Trust in the numbers |
| ⏪ **Chariot rule**: retries reuse seed, every retry is a trial | 🟢 | No save-scumming |
| ❤️ **Rolling HP** grace countdown before automatic rollback | 🐗 | A window to intervene |
| 🎁 **Blue chests**: only verified artifacts leave throwaway runs | 🐗 | A trustworthy Chronicle |
| ⚡ **Dual/Triple Techs** from measured pair lift | 🐗 | Which combos earn their cost |
| ✨ **Glimmer** skill sparks at matched difficulty | 🐗 | Learning without grinding |
| 🏠 EarthBound **Drift** status | 🟢 | Context drift |
| 📊 Learned type chart for routing | 🐗 | Evidence-based routing |
| 🏰 Suikoden-style HQ that grows with your infrastructure | 🐲 | Infrastructure maturity |
| Typewriter dialogue boxes for agent questions | 👺 | |
| End-of-chapter recap screen | 👺 | |

Design ideas from classic RPGs are collected in **[docs/EXPERIENCE.md](docs/EXPERIENCE.md)** — many become quests here.
