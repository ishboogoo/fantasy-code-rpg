# Bringing the 90s RPG to agentic coding

A theme is just labels. An *experience* is when the game's rules change how you work. Every idea here passes one test:

> **Does this mechanic measure or enforce something real?** If it's only decoration, it goes in the presentation layer and must never slow work down.

---

## Part 1 — Mechanics borrowed from the classics

Researched across 28 mechanics from roughly 1986–2002 (plus one later remake). Sources are listed at the end.

### The six strongest ideas

#### 1. ✨ Glimmer — skills are learned only at the edge of ability
*From Romancing SaGa 2,* where new techniques spark mid-battle more often when the enemy is a good match for the fighter, and never against trivial foes.

**In SAVEPOINT:** when a battle is won, the harness rolls a *spark* whose chance depends on the gap between the enemy's difficulty and the character's tier. It peaks when they match and is zero when the enemy is far too easy. A spark distils the winning approach into a candidate skill in the Chronicle's **Dojo**. The skill becomes real only after *another* character wins with it.

**Why it matters:** agents learn from challenging work, and farming easy tasks produces nothing. It's an anti-grind rule and a skill library in one.

#### 2. ⚡ Dual & Triple Techs — combos that prove they're worth it
*From Chrono Trigger,* where specific party members together unlock combo attacks.

**In SAVEPOINT:** every pairing is logged (Codex implements + Claude reviews, Mage plans + Fighter builds + Cleric tests). A pairing becomes a named **Tech** only when its reliability bound clearly beats the best single member's. Techs appear in the battle menu only when everyone is available and has MP or Gold.

**Why it matters:** multi-agent setups cost more. This proves which combinations actually earn their cost, and quietly drops those that don't.

#### 3. 🎛️ Tactics — one-key orchestration policy
*From Dragon Quest IV,* where you steer AI party members with presets instead of micromanaging them.

| Preset | Policy |
|---|---|
| ⚔️ Show No Mercy | Strongest models, max parallelism, spend Gold freely |
| 🧠 Fight Wisely | Default router |
| 💧 Save MP | Use subscription quota before API Gold |
| ✚ Focus on Healing | Red CI and failing tests before any new feature |
| 🚫 Don't Use Magic | No network, no paid models |
| 🎲 Mix It Up | Small exploration budget to try new routes |

Pair it with DQ's **enemy awareness**: what works against each enemy kind is shared by the party and remembered, then reset when a big change lands in that module, because the monster has changed form.

#### 4. ❤️ Rolling HP — a countdown before damage lands
*From EarthBound,* where damage drains HP gradually so you can heal before a character falls.

**In SAVEPOINT:** a run of tool failures, a spend spike, or an edit to a protected path starts a visible countdown on the status line. A Cleric or you can "heal" by approving or fixing. At zero, the harness reverts to the save point and blocks the next action.

**Why it matters:** no silent failure and no abrupt kill. There's always a window to step in.

#### 5. 🎁 Blue Chests — throwaway runs, gated memories
*From Lufia II's Ancient Cave,* where everything resets on exit except rare blue-chest items.

**In SAVEPOINT:** scouting runs happen in a disposable worktree. When they end, only "blue-chest" artifacts are offered to the Chronicle: a regression test, a confirmed root cause, a reusable command. Each must pass a check first (e.g. the test fails on main and passes with the fix). Everything else is discarded.

**Why it matters:** shared memory's biggest risks are junk and poisoning. This keeps the Chronicle trustworthy.

#### 6. 🏅 Gym Badges — the project earns trust too
*From the first Pokémon games,* where traded creatures above a level set by your badges won't obey.

**In SAVEPOINT:** `effective tier = min(character tier, project badge cap)`. The repository earns badges:

| Badge | Earned by |
|---|---|
| 🪨 Stone | CI exists |
| 💧 Cascade | Test coverage above a threshold |
| ⚡ Thunder | Branch protection is on |
| 🔒 Vault | Secret scanning enabled |
| 🏰 Castle | A staging environment |

A T4 Hero in a repo with no tests acts as T1. Autonomy depends on the agent's record **and** the project's safety rails, which is how risk is really shared.

### More mechanics worth building

| From | Mechanic | SAVEPOINT version | What it measures | Size |
|---|---|---|---|---|
| FF IV/VI | Active Time Battle gauge | Each character's ATB bar fills with throughput and rate-limit headroom; the orchestrator dispatches to whoever is ready. **Wait mode** pauses everything while you decide. | Fair dispatch, idle agents, rate limits | M |
| FF V | Job mastery, carried abilities | Master a job → its best habit (e.g. "run tests before claiming done") becomes a passive in every job | Good behaviour transferring across roles | M |
| FF Tactics | Job prerequisites, shared JP | Mage requires Cleric Lv 2. Others in the same job get a small share of a peer's verified XP | Ordered growth, shared learning | M |
| Chrono Trigger | New Game+ | Re-run a finished milestone on a fresh branch with the Chronicle but no budget; compare cost and time | Whether accumulated knowledge really helps | M |
| Chrono Trigger | Multiple endings | Project close-out "ending card" scored on cost, defects, tests, human interventions | Whole-project outcome | S |
| Dragon Quest | Church revival, lose half your gold | Defeat keeps learning but forfeits the battle's unspent budget; a **bank** reserve can't be burned | Soft failure cost | S |
| Dragon Quest | Metal Slime | Rare flaky bugs worth huge XP, but only with a reproduction **and** a fix | Rewards work people avoid | S |
| Suikoden | 108 Stars & a growing HQ | The HQ screen gains buildings as you add capabilities: CI = Armory, evals = Dojo, MCP servers = Shops | Infrastructure maturity | M |
| Suikoden | War battles | Large migrations fought on several fronts (types, tests, perf), each with its own squad | Coordinating big refactors | L |
| Pokémon | Type chart | Learned character × enemy-kind effectiveness matrix (×2, ×½, ×0) | Evidence-based routing | M |
| Pokémon | Evolution | A config upgrade (bigger model, more tools) only after reliability earns it | Not paying for unearned capability | S |
| Pokémon | PC boxes | Active party limited by concurrency; benched characters keep their stats and config | Concurrency, reproducibility | S |
| Ogre Battle | Alignment | Beating enemies far below your tier lowers **Reputation** | Discourages farming | S |
| Tactics Ogre | Loyalty | A morale flag when a character is repeatedly reassigned or aborted. It actually measures *your* orchestration | Orchestrator thrash | M |
| Tactics Ogre (remake) | Chariot rewind | Rewinding to a save reuses the same seed and context, and **every retry counts as a trial** | Stops save-scumming inflating trust | M |
| EarthBound | Homesickness | **Drift**: too many turns without re-reading the spec; cured by re-reading it or asking you | Context drift | S |
| Lufia II | IP gauge | A frustration meter fills on failures; when full, one escalation to a stronger model | Escalation tied to real difficulty | S |
| FF VII | Materia | Skills and MCP servers socket into characters, showing their context-token cost as a stat penalty; they level only on verified wins | Value vs. token cost of each tool | M |
| FF VIII | Draw / Junction | Draw reusable tests and snippets from a well-tested repo into a Chronicle stock | Reuse | M |
| Star Ocean, Persona | Affection, bonds | Pairwise **bond** = joint success rate; strong bonds unlock Techs | Pair coordination | S |
| Baldur's Gate | Real-time with pause | Auto-pause on triggers (cost spike, protected path) | Human interrupts | M |
| Fallout | Perks | Every few levels, *you* pick a perk for a character | Scarce, deliberate upgrades | S |
| Final Fantasy | Scan / Libra | `savepoint scan <id>` shows every stat **with raw counts** | Trust in the numbers | S |

---

## Part 2 — The feel: presentation mapped to real events

Claude Code exposes hook events. Several can **block**, which means the game's framing can enforce rules, not just decorate them.

| Hook event | RPG moment | What happens |
|---|---|---|
| `SessionStart` | Title screen → CONTINUE? | Typewriter recap from the Chronicle; party roster with tier, MP, Gold |
| `UserPromptSubmit` | Quest accepted | Short jingle; quest card with enemy HP |
| `PreToolUse` | Encounter / command | ✅ The Gatekeeper. Risky tools get a screen-wipe "boss" transition; denials say *"That won't work here!"* |
| `PermissionRequest` | Ring menu | Compact Allow / Deny / Always choice |
| `PostToolUse` / `PostToolUseFailure` | Damage numbers / MISS | A test passing shows a green `-1 HP`; failures play a dull thud |
| `PostToolBatch` | End of round | ATB bars refresh |
| `Notification` | "!" speech bubble + chime | A party member is waiting for you |
| `SubagentStart` / `SubagentStop` | "*Name* joined the party!" / returns with loot | Pixel portrait, then a diff summary |
| `TaskCompleted` (can block) | Enemy defeated | Fanfare and XP screen **only if checks pass**, otherwise "It's still standing!" |
| `Stop` (can block) | Fleeing mid-battle | Blocked while enemy HP > 0, within the turn budget |
| `PreCompact` / `PostCompact` | Save crystal | Sparkle; checkpoint written to the scroll |
| `StopFailure` | GAME OVER → CONTINUE? | Offer to retry from the last save point |
| `WorktreeCreate` / `CwdChanged` | Enter dungeon / overworld | Location banner |
| `SessionEnd` | The Inn | MP refill countdown and the day's ending card |

**Status line target:**
```
[ATB ▓▓▓░] Aria·Knight T2 │ 👺 bug-42 ■■■□□ │ MP 62% ⟳3h │ 💰4.10G │ 🧠 Fight Wisely
```

### Presentation rules

- **Never block work for ceremony.** Animations and sound run asynchronously, off the hook's decision path. Typewriter text is skippable with any key. Use ATB-style **Active/Wait** modes.
- Box-drawing borders and 16-colour ANSI. Respect `NO_COLOR`. Offer `--quiet`.
- Sound: the terminal bell by default; optional original square-wave cues generated at runtime (e.g. a rising four-note arpeggio for victory).
- **Original art and music only.** Inspired by the era, never copied from it: no ripped sprites, tracks, or proprietary character names.

---

## Part 3 — Pitfalls, and what classic games teach about them

| Pitfall | Countermeasure |
|---|---|
| **Reward hacking:** an agent "lowers HP" by editing the acceptance criteria or tests | Criteria are locked at quest start (stored in `.savepoint/`, which the Gatekeeper protects); test files can be owned by the Cleric role; XP only from an independent judge |
| **Grinding / farming Metal Slimes** | Difficulty scales with tier (FF VIII), zero Glimmer chance on easy foes (SaGa), Reputation loss for beating weaker enemies (Ogre Battle) |
| **Save-scumming:** retrying until you get lucky | Chariot rule: every retry is a trial in the reliability bound, and replays reuse the same seed |
| **Stale stats** after a model update | Time-weighted trials; reset when the model version changes (DQ's "phase change") |
| **Punishment that kills exploration** | Dragon Quest's rule: failure costs gold, never learning. Curses are curable through a defined sidequest of N supervised wins |
| **Ceremony fatigue** | Everything skippable, nothing blocking, Active/Wait modes |
| **Stats nobody trusts** | Every number is inspectable with raw counts (Scan). A Pokédex-style bestiary shows *seen* vs. *defeated* per enemy kind |

---

## Sources

Final Fantasy IV ATB — [Wikipedia](https://en.wikipedia.org/wiki/Active_Time_Battle) ·
Final Fantasy V — [Wikipedia](https://en.wikipedia.org/wiki/Final_Fantasy_V), [StrategyWiki jobs](https://strategywiki.org/wiki/Final_Fantasy_V/Jobs) ·
FF Tactics — [jobs](https://finalfantasy.fandom.com/wiki/Final_Fantasy_Tactics_jobs), [JP guide](https://ftp.cavesofnarshe.com/fft/newbie-guide.php) ·
Chrono Trigger — [Wikipedia](https://en.wikipedia.org/wiki/Chrono_Trigger), [Techs](https://chronotrigger.wiki.gg/wiki/Techs) ·
Dragon Quest — [AI/Tactics](https://dragon-quest.org/wiki/Artificial_Intelligence), [half-gold rule](https://automaton-media.com/en/news/dragon-quest-creator-yuji-horii-finally-reveals-why-you-lose-half-your-money-when-you-die-in-the-games/), [Metal Slimes](https://dragon-quest.org/wiki/Liquid_Metal_Slime) ·
Suikoden — [Wikipedia](https://en.wikipedia.org/wiki/Suikoden_(video_game)), [army battles](https://suikoden.fandom.com/wiki/Army_Battle_(S2)), [HQ](https://gensopedia.org/w/New_State_Army_Headquarters) ·
Pokémon — [types](https://pokemondb.net/type/old), [storage](https://bulbapedia.bulbagarden.net/wiki/Pok%C3%A9mon_Storage_System), [obedience](https://bulbapedia.bulbagarden.net/wiki/Outsider), [Pokédex](https://bulbapedia.bulbagarden.net/wiki/Pokedex) ·
Ogre Battle — [stats](https://ogrebattlesaga.fandom.com/wiki/Statistics), [loyalty](https://www.gamepressure.com/S013-amp.asp?ID=19617), [chariot analysis](https://www.gamedeveloper.com/business/what-s-old-is-new-again-a-tactics-ogre-let-us-cling-together-analysis) ·
Romancing SaGa — [Glimmer](https://saga.fandom.com/wiki/Glimmer) ·
EarthBound — [homesickness](https://gangles.ca/2008/06/26/earthbound-long-distance-love), [rolling HP](https://www.gfinityesports.com/article/i-want-that-visceral-panic-again-why-earthbounds-rolling-hp-mechanic-deserves-a-revisit) ·
Secret of Mana — [Wikipedia](https://en.wikipedia.org/wiki/Secret_of_Mana) ·
Lufia II — [Wikipedia](https://en.wikipedia.org/wiki/Lufia_II:_Rise_of_the_Sinistrals) ·
FF VII — [Materia](https://giantbomb.com/wiki/Objects/Materia), [Limit Break](https://giantbomb.com/wiki/Concepts/Limit_Break) ·
FF VIII — [Wikipedia-style wiki](https://finalfantasy.fandom.com/wiki/Final_Fantasy_VIII) ·
Scan/Libra — [wiki](https://finalfantasy.fandom.com/wiki/Scan_(ability)) ·
Star Ocean — [Private Actions](https://www.rpgsite.net/feature/15015-star-ocean-the-second-story-r-private-actions-guide-where-to-find-them) ·
Persona — [Confidants](https://megatenwiki.com/wiki/Confidant) ·
Baldur's Gate II — [Wikipedia](https://en.wikipedia.org/wiki/Baldur%27s_Gate_II:_Shadows_of_Amn) ·
Fallout — [Fallout](https://en.wikipedia.org/wiki/Fallout_(video_game)), [Fallout 2](https://en.wikipedia.org/wiki/Fallout_2) ·
Claude Code hooks — [docs](https://code.claude.com/docs/en/hooks)

*Some game details come from fan wikis rather than primary sources. The Tactics Ogre chariot is from the 2010 remake.*
