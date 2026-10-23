# Cross-reference: what other projects teach us

We read through the closest open-source projects (October 2026) for details Fantasy Code RPG must account for.
Each finding ends with what we're doing about it: ✅ done in v0.1, 🗺️ on the roadmap, ⚠️ a risk to manage.

---

## Execution runtimes

### Claw Orchestrator — MIT, TypeScript, ~600★
One interface over Claude Code, Codex, Antigravity, Cursor Agent, OpenCode and custom CLIs. Long-lived sessions, a JSONL cost ledger, an MCP server, Planner/Coder/Reviewer loops, multi-agent "councils".

| Detail | Lesson for Fantasy Code RPG |
|---|---|
| Ledger rows keep the engine's **self-reported result separate from the runtime's own verification** | Exactly our anti-cheat rule. ✅ `DONE:` lines are claims; only checks or a judge award HP damage |
| Each ledger row records engine, model, tokens, cost, duration | 🗺️ Extend `log.jsonl` to the same fields so battles are auditable and comparable across adapters |
| `maxBudgetUsd` is enforced **by the runtime on every engine**, not just one | ⚠️ We check overspend *after* a turn. 🗺️ Enforce in-flight: pass budget flags where CLIs support them, or route API characters through LiteLLM keys |
| `session_handoff` moves a live conversation to another engine | 🗺️ **Party swap** mid-battle (classic JRPG "switch member") — a stuck Fighter hands off to a Thief with full context |
| Acceptance contracts include a **diff policy** | 🗺️ Give enemies a **battlefield**: the file globs a battle may touch. Edits outside it = violation |
| Councils vote in isolated worktrees until they agree | 🗺️ A **multi-judge tribunal** for bosses: 2-of-3 Clerics must agree |

### ORCH — MIT, TypeScript
Formal task state machine (`todo → in_progress → review → done`, with `retrying` and `failed`), mandatory review gate, inter-agent messages and broadcasts, a shared context store, **git worktree isolation**, a headless daemon.

| Detail | Lesson |
|---|---|
| Git worktree per agent | ⚠️ **Biggest gap in v0.1.** All characters act in the same checkout, so parallel battles would collide. 🗺️ One worktree per character per battle, created at the save point; victory merges, defeat discards |
| Explicit `retrying` state with validated transitions | 🗺️ Replace `lurking/engaged/defeated/fled` with a proper state machine including **"enraged"** (retrying) and **"escaped"** (failed after N retries) |
| Mandatory review gate before `done` | ✅ Judge step. 🗺️ Make it mandatory for T3+ battles even when tests pass |
| Headless daemon for CI | 🗺️ `fcrpg serve`: watches an issue tracker and spawns **random encounters** |

### AgentFlow — Apache-2.0, TypeScript
Pipelines over Claude Code / Codex / Gemini CLI / Antigravity in worktrees, SQLite-backed shared context exposed as MCP tools, an interactive-questions tool.

| Detail | Lesson |
|---|---|
| `get_pipeline_context` / `set_pipeline_context` MCP tools | 🗺️ Reference design for the **Chronicle MCP server**: `lore_get`, `lore_add`, `scroll_read`, `scroll_append`, `party_status` |
| Interactive questions: an agent can pause and ask the human | 🗺️ **Dialogue box** event: battle pauses, a typewriter text box asks you, your answer goes into the scroll |
| Antigravity CLI emits **no token or cost metrics** | ⚠️ Not every CLI reports cost. ✅ Our MP model is already an estimate. 🗺️ Per-adapter estimators |
| Notes a Gemini CLI tier change for some consumer plans in mid-2026 | ⚠️ Subscription terms shift. MP sources must be config, never hard-coded |

---

## Game-flavoured agent tools

### kaits — MIT, Python
"The RPG for your AI agent team." Roles, levels, XP, promotion toasts, autonomy modes per agent **and per task**, budget caps by scope and period with alerts at 80%, lifecycle hooks that run mandatory steps regardless of agent discretion.

| Detail | Lesson |
|---|---|
| Autonomy set **per task** as well as per agent | 🗺️ Enemies can carry a **level seal**: "this dungeon allows T1 at most" (e.g. anything touching billing), or a **minimum tier** to enter |
| Budget alerts at a threshold | 🗺️ **Low-HP warning beep** when the treasury or a character's MP crosses 20% |
| Lifecycle hooks run mandatory steps | 🗺️ **Formation rules**: "a Cleric always follows a Fighter" enforced by the harness, not the prompt |
| XP without a published trust formula | ✅ Our differentiator: XP and reliability are separate, and promotion needs both |

### Lore — MIT
Gamified project management with campaigns, quests with ranks F→S, chapters, per-campaign MCP server, markdown "folios" with wiki links, and a "petitions" inbox.

| Detail | Lesson |
|---|---|
| Recommended MCP orientation flow: read campaign context first | 🗺️ Every battle prompt starts with the same orientation: lore → scroll → criteria. ✅ Already in `buildPrompt` |
| **Chapters** close and compute a chronicle | 🗺️ **End-of-chapter screen**: milestone recap, MVP, total gold, promotions — great for weekly reviews |
| Petitions inbox triaged into quests | 🗺️ **Ambush!** Characters can report new bugs they discover mid-battle; you approve them into the bestiary |
| Quest ranks F→S | We use enemy level + kind instead, because level drives XP math. Ranks could be a display layer |

### ClaudeArcade — MIT, Tauri/React
Character-sheet GUI for Claude Code configuration: helm = system prompt, main/offhand = MCP servers, rings = memory, spellbook = skills and slash commands, companions = subagents, trinkets = custom commands; multiple party members with loadouts.

| Detail | Lesson |
|---|---|
| Equipment slots map neatly onto agent configuration | 🗺️ Adopt **Equipment**, but gated by tier: an MCP server that can deploy is "heavy armour" a Novice can't equip |
| Saved "builds" | 🗺️ Loadouts per job: a Cleric's default spellbook is test and lint skills |

### Guild Hall — MIT (archived)
RPG dashboard for monitoring agents via gateway event hooks: pixel avatars, six stats on radar charts, evolution paths, activity heatmaps.

| Detail | Lesson |
|---|---|
| Monitoring-only, archived with core roadmap items unchecked | ⚠️ Pure dashboards stall. ✅ We shipped a playable engine first; UI comes after |
| Event hooks stream start/progress/end/error | ✅ Same pattern, via Claude Code hooks |

### GitClaw — GitHub Actions as runtime
Turns new issues into RPG quests with XP and celebrates merges.

| Detail | Lesson |
|---|---|
| Issues become quests automatically | 🗺️ Issue-tracker **encounter tables**: label `bug` → Goblin, `perf` → Wyvern, `epic` → Dragon |
| Free CI minutes as the budget | 🗺️ CI minutes as a third resource (**SP / stamina**) |

### vibe-kanban — very popular task board for coding agents
| Detail | Lesson |
|---|---|
| Huge adoption shows people want a **board** to watch many agents | 🗺️ The web UI's first screen should be the **world map / quest board**, not a stats page |

---

## Trust research

**Progressive autonomy pattern** (agentpatterns.ai): autonomy rises in stages from suggest-only to asynchronous delegation; exit criteria include approval rate, falling intervention rate and defect-escape rate; oversight shifts to sampling but is never removed; set rollback thresholds before incidents; apply per task type, not globally.

| Lesson | Status |
|---|---|
| Staged autonomy with exit criteria | ✅ Tiers + REL thresholds |
| Per task type, not global | ✅ REL per job line. 🗺️ Also per enemy kind (a Fighter great at Orcs may be bad at Liches) |
| Thresholds set *before* incidents | ✅ Curse rule is in the rulebook, not decided after the fact |
| Oversight never removed | 🗺️ **Audit sampling** at T4: the harness randomly sends 1 in N victories to a human judge |
| Kill switch | 🗺️ `fcrpg pause` — **"Stop" spell**: freezes all battles, drops everyone to T0 until you resume |

**LiteLLM proxy budgets**: per key/user/team, reset windows, multiple windows per key, pre-call budget reservation. Important caveat: budgets need Postgres, and **fail open** without it. ⚠️ If we use LiteLLM for Gold, `fcrpg doctor` must check budgets are really enforced.

---

## Claude Code's hook system

The hook reference lists events we can hook into. These give Fantasy Code RPG precision and feel:

| Hook event | Use |
|---|---|
| `PreToolUse` (can deny with a reason) | ✅ **The Gatekeeper.** Per-call tier enforcement, logged as violations |
| `Stop` / `SubagentStop` (exit 2 keeps the agent going) | 🗺️ **"The enemy still stands!"** If checks still fail, push the character back into the fight, up to the turn budget |
| `SubagentStart` | 🗺️ **Summon animation**, and deny summons below T4 |
| `PreCompact` | 🗺️ Auto **save point**: write the context summary into the scroll before it's compacted |
| `Notification` (`idle_prompt`, `permission_prompt`) | 🗺️ **"!" speech bubble** + chime when a character waits for you |
| `TaskCompleted` | 🗺️ Small XP tick and sound |
| `SessionStart` | 🗺️ Title-screen jingle + party status |
| Status line | ✅ `fcrpg statusline` HUD |

---

## Cross-cutting risks

1. ⚠️ **Provider terms.** Running subscription CLIs headlessly, in loops or on servers may conflict with some providers' terms. Users must check theirs. Never share one account's credentials across people.
2. ⚠️ **Flag drift.** CLIs change flags often. Every adapter mapping is marked `VERIFY` and needs a contract test that runs `--help`.
3. ⚠️ **Goodhart.** If XP can be farmed, agents (and users) will farm it. Countermeasures: diminishing XP for repeat Slimes, no self-grading, critical failures cost 3×.
4. ⚠️ **Prompt injection via the Chronicle.** Lore and scrolls are shared by every agent. A malicious file read into a scroll could instruct the next agent. 🗺️ Mark scroll text as data, and only T3+ characters may write to `lore.md`.
5. ⚠️ **Parallel battles.** Until worktrees land, run one battle at a time.
