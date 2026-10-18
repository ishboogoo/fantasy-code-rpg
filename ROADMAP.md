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
| Git **worktree per character per battle** | 🐗 | Biggest safety gap. Victory merges, defeat discards |
| Enemy state machine: lurking → engaged → review → defeated / enraged (retrying) / escaped | 👺 | See ORCH in docs/CROSS_REFERENCE.md |
| **Battlefield**: file globs a battle may touch; edits outside = violation | 👺 | Extend `gate.ts` |
| `Stop` hook: "The enemy still stands!" — keep fighting while checks fail | 👺 | Turn-budget capped |
| In-flight budget enforcement | 👺 | CLI budget flags where available; LiteLLM keys for API characters |
| Richer ledger fields in `log.jsonl` (model, tokens, duration) | 🟢 | |
| `savepoint pause` — the **Stop spell** kill switch | 🟢 | Freezes battles, drops everyone to T0 |
| Diminishing XP for repeat Slimes (anti-grind) | 🟢 | Rules + test |

## Act III — "The Guild Hall" (v0.3): shared world

| Quest | Size | Notes |
|---|---|---|
| **Chronicle MCP server** (`lore_get`, `lore_add`, `scroll_read`, `scroll_append`, `party_status`) | 🐗 | Lets every MCP-capable CLI share context mid-battle |
| Codex and Gemini gatekeepers via their hook systems | 🐗 | Reuse `classify()` |
| Runtime adapters: wrap Claw Orchestrator or ORCH | 🐗 | Inherit their engines and cost ledgers |
| Encounter tables from GitHub/Linear issues | 👺 | `bug` → Goblin, `perf` → Wyvern, `epic` → Dragon |
| Bosses with phases (epic → subtasks) | 🐗 | Summoner (T4) splits them |
| Equipment: system prompts, MCP servers, skills as tier-gated gear | 🐗 | See ClaudeArcade notes |
| Audit sampling at T4 | 👺 | 1-in-N victories go to a human judge |
| Scroll injection defences | 👺 | Treat scroll text as data; T3+ to write lore |

## Act IV — "The Airship" (v1.0): the full 90s experience

| Quest | Size | Notes |
|---|---|---|
| Pixel-art web UI: world map, battle screen, party menu | 🐲 | Original art only |
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
