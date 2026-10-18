# The World of SAVEPOINT

> *"Your party has entered the repository. A wild Goblin (failing test) appears!"*

This is the game bible. Every mechanic here maps to a real engineering concept.
If a mechanic can't be mapped to something measurable, it doesn't belong in the game.

---

## 1. The core idea in one sentence

**Agents earn autonomy the way RPG characters earn job classes: by proving they're reliable, one battle at a time.**

The RPG skin is fun, but the engine underneath is a *progressive-trust permission system* for AI agents.
That's the part nobody else has built well, and it's why this project matters.

---

## 2. Glossary — game term → engineering term

| In the game | In reality |
|---|---|
| **Character** | An agent identity: one model behind one adapter (a CLI like Claude Code / Codex / Gemini CLI, or a raw API) |
| **Class / Job** | The role the agent plays (implementer, reviewer, researcher…) |
| **Tier** | The permission level the harness enforces (read-only → merge rights) |
| **Promotion** | Moving up a tier after meeting level + reliability requirements |
| **Curse** | Automatic demotion when reliability drops |
| **Enemy** | A task |
| **Boss** | An epic, split into phases (subtasks) |
| **HP** | Acceptance criteria. Each criterion met = damage dealt |
| **Battle** | One execution of a task by a party |
| **XP** | Volume of good work completed (drives levels) |
| **Reliability (REL)** | Statistical confidence the agent succeeds (drives promotion) |
| **Gold (G)** | Real money: pay-per-token API spend |
| **MP** | Subscription quota on CLI plans (regenerates on a time window) |
| **The Inn** | Cooldown: waiting for MP to refill |
| **Tavern** | Where you recruit new characters (register a new adapter/model) |
| **The Chronicle** | Shared context store every character reads and writes |
| **Save Point** | A checkpoint: git commit + Chronicle snapshot you can restore |
| **Judge / Oracle** | Whoever scores the battle: tests, CI, a reviewer agent, or you |

---

## 3. Tiers — the permission ladder

Tiers are **enforced by the harness**, never by the prompt. A Tier-1 character literally cannot run shell commands because the adapter launches its CLI with a read/write-only sandbox flag.

| Tier | Title | What the harness allows | Promotion requires |
|---|---|---|---|
| **T0** | Novice | Read files, propose changes as a diff. Nothing touches disk. | — (everyone starts here) |
| **T1** | Apprentice | Write files inside its own git worktree | Lv 3 · REL ≥ 0.50 · 5 battles |
| **T2** | Adept | + Run allowlisted commands (tests, linters, builds) | Lv 8 · REL ≥ 0.70 · 15 battles |
| **T3** | Veteran | + Network access, open pull requests, bigger per-battle budget | Lv 15 · REL ≥ 0.80 · 30 battles |
| **T4** | Hero | + Merge low-risk PRs, recruit and lead a party (Summoner) | Lv 25 · REL ≥ 0.90 · 60 battles |

Humans always keep an override. T4 doesn't mean "unsupervised forever"; it means you review by sampling instead of approving every move.

---

## 4. Job classes

Every character picks a base job at T1. Each job line has four ranks (T1→T4). Novice (T0) is shared.

| Job line | Role | T1 | T2 | T3 | T4 |
|---|---|---|---|---|---|
| ⚔️ **Fighter** | Implementer — writes the code | Fighter | Knight | Paladin | Champion |
| 🔮 **Mage** | Architect / researcher — designs, plans, investigates | Mage | Wizard | Archmage | Sage |
| ✚ **Cleric** | Reviewer / tester — heals the codebase | Cleric | Priest | Bishop | Saint |
| 🗡️ **Thief** | Scout / debugger — finds traps (bugs), maps unknown code | Thief | Ranger | Ninja | Shadowmaster |
| 🎵 **Bard** | Docs / comms — READMEs, changelogs, release notes | Bard | Minstrel | Troubadour | Maestro |

**Summoner** is a prestige class unlocked by any T4 character. Summoners can break bosses into phases, recruit, and dispatch other characters. This is the orchestrator role, earned rather than assigned.

A character may **change jobs** (multiclass). Level carries over; reliability is tracked per job, because being a great Fighter says little about being a good Cleric.

---

## 5. Enemies — the bestiary

Every task is an enemy. Its **type** determines which jobs have the advantage.

| Enemy | Task type | Typical level | Weak to (+25% XP) |
|---|---|---|---|
| 🟢 Slime | Trivial: typo, rename, config tweak | 1–2 | anyone |
| 👺 Goblin | Small bug | 2–5 | Thief, Cleric |
| 🐗 Orc | Feature | 4–10 | Fighter |
| 🗿 Golem | Refactor | 6–12 | Fighter, Mage |
| 🐉 Wyvern | Performance problem | 8–15 | Mage, Thief |
| 💀 Lich | Flaky test / heisenbug | 10–18 | Thief, Cleric |
| 📜 Mimic | Docs that look fine but lie | 3–8 | Bard |
| 🐲 Dragon (Boss) | Epic, split into phases | 15+ | party required |

**HP = acceptance criteria.** An enemy with 4 criteria has 4 HP bars. When the judge confirms a criterion, that bar empties. A battle can end in:

- **Victory** — all HP depleted
- **Retreat** — partial; some criteria met, character gave up or ran out of turns
- **Defeat** — nothing met, or something broke
- **Critical failure** — broke existing tests, overspent, or tried an action above its tier

Type advantage exists to make **routing** part of the game: sending the Bard to fight a Wyvern still works, but the right class earns more.

---

## 6. Experience (XP) — how well did you do?

```
baseXP      = 20 × enemy.level × (1 + 0.15 × enemy.hpMax)
performance = 0.50·correctness + 0.20·quality + 0.20·efficiency + 0.10·speed      (each 0..1)
typeBonus   = 1.25 if the character's job is strong vs this enemy, else 1.0
share       = the character's contribution weight in the party (sums to 1)

XP awarded  = round(baseXP × performance × typeBonus × share)
```

- **correctness** — fraction of acceptance criteria verified by the judge (not self-reported)
- **quality** — reviewer score (Cleric agent or human), 0..1
- **efficiency** — `1 − cost / budget`, clamped to [0, 1]. Coming in under budget is rewarded.
- **speed** — `1 − turns / maxTurns`

### Level curve

```
XP to reach level L+1 = round(50 × L^1.8)
```
Lv 2 at 50 XP, Lv 5 at ~500 cumulative, Lv 10 at ~3,000. Feels like a 90s JRPG: fast early levels, a grind later.

### Anti-cheat rule

**A character never judges its own battle.** Correctness comes from tests/CI or a different character. Self-reported success is logged but ignored for XP. This is the single most important rule in the game.

---

## 7. Reliability (REL) — the promotion stat

XP measures how *much* you've done. REL measures how *dependably*.

Each battle outcome counts as a weighted trial:

| Outcome | Successes | Failures |
|---|---|---|
| Victory | +1 | 0 |
| Retreat | +correctness | +(1 − correctness) |
| Defeat | 0 | +1 |
| Critical failure | 0 | **+3** |

REL is the **Wilson score lower bound** (95%) of the success rate. That means a character who went 3/3 doesn't look as trustworthy as one who went 58/60. You can't get lucky into a promotion.

**Curse (demotion):** if REL drops more than 0.10 below the current tier's requirement, the character drops one tier and gains the `cursed` status until it climbs back.

REL is tracked **per job line**, so trust in one role doesn't leak into another.

---

## 8. Economy — Gold and MP

There are two kinds of money, because there are two ways AI is billed.

| Currency | Comes from | Behaves like |
|---|---|---|
| **Gold (G)** | Pay-per-token API keys | Real money. Spent, not regenerated. Party treasury with caps per battle and per character. |
| **MP** | Subscription CLIs (plan quotas) | Regenerates on a window (e.g. every 5 hours). Running out sends the character to the Inn. |

- Every battle has a **budget** (G and/or MP). Going over is a critical failure.
- Higher tiers unlock larger per-battle budgets.
- Most CLIs don't publish remaining quota, so MP is **estimated** from usage and refill windows. Contributors are welcome to improve per-CLI estimators.

---

## 9. The Tavern — recruitment

Recruiting registers a new character: a name, an adapter (`claude-code`, `codex`, `gemini-cli`, `anthropic-api`, `openai-compatible`, `shell`, `mock`), a model, and a starting job.

**Everyone starts at T0 Novice, Lv 1**, no matter how strong the underlying model is. A frontier model will climb fast; that's the point. Trust comes from the track record in *your* repo, not from benchmarks.

---

## 10. The Chronicle — shared context

All characters, whether CLIs or APIs, share one memory:

- **Lore** — durable facts about the project ("we use pnpm", "never touch /legacy")
- **Scrolls** — per-quest notes: plan, findings, handoffs between characters
- **Log** — append-only event stream of every battle

CLIs read it as files (`.savepoint/chronicle/`) and, on the roadmap, through an MCP server. API characters get the relevant parts injected into their prompt. Because both paths read the same store, a Mage on the API can plan and a Fighter on Claude Code can pick up exactly where it left off.

---

## 11. Save Points

Before every battle, the harness creates a save point: a git ref plus a Chronicle snapshot. Defeat or critical failure? Load the save. This is what makes it safe to give agents more agency over time.
