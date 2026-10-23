# UX Plan — playing Fantasy Code RPG

> **Updated 2026-10-23:** the quest loop, scenes, menus, Council and allies now live in [DESIGN_PLAN.md](DESIGN_PLAN.md), and every decision is logged in [DECISIONS.md](DECISIONS.md). Where they differ, those win. This file still holds the detailed art, sound, accessibility and generator rules.

> **North star:** it should get real work done better than any single AI app, and it should feel like booting up a 16-bit RPG you loved.

Two rules settle every disagreement:

1. **Every pixel does a job.** Each sprite, bar, animation and unlock shows or changes something real.
2. **The game never slows the work.** Agents never wait for an animation. Every effect can be skipped.

---

## 1. Decisions

| Question | Decision | Why |
|---|---|---|
| Where do you play? | **Browser first**, at `localhost`, via `fcrpg play`. The terminal stays as the engine, the CLI and the Claude Code status bar. | Real pixel art, music and animation need a browser. It also shows diffs and approve buttons far better than a terminal. Nothing goes online. |
| Which 90s flavour? | **16-bit console RPG**, plus two PC-RPG pieces: **pause-and-command** and a **scrolling combat log**. | The most nostalgic era, and its stacked windows and party panels match orchestration. The log doubles as an audit trail. |
| How do you play? | **Watch and step in.** Agents act on their own under a Tactics preset; you act at real decision points. **Wait mode** pauses battles while a decision is yours. | Choosing every turn would be slower than one AI app. Over time promotions mean you're asked less. That *is* the progression. |
| Art | **Generated within an approved style**, so every character and enemy is unique and reflects real data. | Infinite variety, consistent look, no licensing risk. |
| Exploration | **The world map is your codebase.** Unlocks come from real milestones, never from grinding. | Exploring means understanding your project. |
| Language | **English and Japanese from day one.** | The pixel font below covers both. |

---

## 2. Screen map

```
TITLE ─▶ GUILD TOWN (hub) ─┬─▶ QUEST BOARD ─▶ FORM PARTY ─▶ BATTLE ─▶ VICTORY / RETREAT ─▶ LOOT REVIEW
                           ├─▶ TAVERN (recruit, appearance)
                           ├─▶ INN (MP refill, rest timers)
                           ├─▶ GUILD HALL (promotions, job tree, Techs)
                           ├─▶ LIBRARY (the Chronicle: lore & scrolls)
                           ├─▶ BESTIARY
                           ├─▶ ATELIER (approve generated art)
                           ├─▶ TREASURY (Gold, budgets, ledger)
                           └─▶ WORLD MAP (your codebase) ─▶ DUNGEON (a module) ─▶ encounters
   Anywhere: [Esc] MENU — Party · Status · Tactics · Save · Config
```

| Screen | What you see | What's real behind it |
|---|---|---|
| **Title** | Logo, starfield, NEW GAME / CONTINUE / CONFIG. CONTINUE shows a recap in a text box. | `init`, or load `world.json` + a Chronicle summary |
| **Guild Town** | A small walkable town. Buildings appear as you unlock them (§6). | The hub. Each building is a feature. |
| **Quest Board** | Wanted posters, one per enemy: sprite, level, HP, reward, suggested party. | The task queue, imported from issues or spawned by hand |
| **Form Party** | Drag up to 4 members into formation. Shows type advantage, MP and Gold cost estimates. | Routing, budget, formation rules (e.g. a Cleric must follow a Fighter) |
| **Battle** | Side view: party on the right, enemy on the left. ATB bars, combat log, command window. | A live battle. Each agent tool call becomes an action (§4) |
| **Victory / Retreat** | Fanfare, XP tally, level-ups, promotion banner, items found. | Judge verdict, rewards, tier changes |
| **Loot Review** | A treasure chest that opens into the **diff**, with Accept / Another review / Reject. | Code review and merge decisions. **Rejecting rolls back and counts as a loss:** your verdict outranks the judge's |
| **Tavern** | Recruit new characters. Portrait preview with a re-roll button. | `recruit` + appearance generation |
| **Inn** | Beds with sleeping characters and refill timers. | MP (subscription quota) windows |
| **Guild Hall** | Job tree, promotion trials, unlocked Techs, the Summoner's chair. | Tiers, reliability, combo stats |
| **Library** | Bookshelves of lore and scrolls. | The Chronicle |
| **Bestiary** | Every enemy variant seen, with defeat counts and who beat it. | Task-type statistics |
| **Atelier** | A gallery of AI-generated sprite parts waiting for your approval. | The art pipeline (§5) |
| **Treasury** | Coin chests per budget, a ledger book. | Spend tracking |
| **World Map** | Your repo as an overworld: regions, dungeons, fog of war. | Codebase structure and agent knowledge |
| **Status (Scan)** | A full character sheet with raw numbers behind every stat. | Trust you can verify |

---

## 3. Controls and the play loop

- **Keyboard first:** arrow keys / WASD to move the cursor, **Z/Enter** confirm, **X/Esc** back, **Space** toggles Wait/Active, **Tab** cycles party members.
- **Mouse and touch** work everywhere too.
- **Gamepad** works as a bonus (browsers support it natively).

**The loop:** check the Quest Board → form a party → start the battle → watch, and step in when something comes up → collect loot → review the diff → repeat. Several battles can run at once (once worktrees land), each in its own window you can switch between, like a split-party chapter.

**When you're asked to step in (Wait mode pauses that battle):**

| Moment | In the game | Real action |
|---|---|---|
| The Gatekeeper flags an action | ⚠️ "Rook wants to **RUN A COMMAND**. Allow once?" | Allow once (logged, no penalty), deny, or hand it to a character who's allowed |
| An agent asks you something | Dialogue box with a portrait and typewriter text | Answer goes into the scroll |
| An agent is stuck | ATB bar turns grey; **SWAP** appears | Hand off to another character |
| Budget nearly spent | Low-HP alarm beep | Top up or retreat |
| Battle over | Treasure chest | Review and accept the diff |

You can also act anytime: **PAUSE** everything, **RETREAT** (roll back to the save point), change the **Tactics** preset, or use an **ITEM**, which hands lore or a hint to the party.

---

## 4. Turning real work into battle animation

Agent battles take minutes. 90s battles are quick turns. The fix: **every tool call is a visible action**, streamed live from the hooks we already use.

| Real event | On screen |
|---|---|
| `Read`, `Grep`, `Glob` | "Aria uses **SCAN** on auth.ts." Brief shimmer over the enemy |
| `Edit`, `Write` | "Aria casts **FORGE** on login.ts!" Sword slash, file name in a small banner |
| `Bash` running tests | "Aria uses **TRIAL**: npm test." Dice-roll spinner, then the result |
| A criterion's check passes | Big damage number, **-1 HP**, enemy flashes |
| A check fails | "MISS!" and a dull thud |
| Gatekeeper denial | Shield clang: "**The Gatekeeper blocks you!**" |
| Sub-agent spawned | Summon circle: "*Name* joined the battle!" |
| Context compaction | Save crystal sparkle |
| Cost per call | Tiny gold coins fly to the Treasury counter |
| Agent idle / waiting for you | "!" speech bubble above its head + chime |
| Judge verdict | The Cleric raises a staff. Light (pass) or darkness (fail) |

At **Battle speed: Fast**, effects shrink to quick flashes. **Skip** shows only the log. The log always has the full detail: file, command, cost.

---

## 5. The approved aesthetic — the Style Bible

Everything generated or contributed must pass these rules. They live as machine-checkable data in `assets/style/style.json`, plus a Design System artifact for humans.

| Rule | Value |
|---|---|
| Internal canvas | **384 × 216** pixels (16:9), scaled up by whole numbers only, never blurry |
| Tiles | 16 × 16 |
| Character battle sprites | 24 × 32, 3–4 frames per animation (idle, act, hit, victory, KO) |
| Portraits | 48 × 48 |
| Enemy sprites | 32 × 32 (small), 48 × 48 (medium), 64 × 64 (large), 96 × 96 (boss) |
| Palette | **48 fixed colours** in 12 named ramps of 4 (Ink, Night, Steel, Ember, Forest, Gold, Ocean, Arcane, Earth, Skin, Umber, Rose), dark → light, plus transparent |
| Outlines | 1-pixel, a darker shade of the fill colour, never pure black (except the darkest ramp) |
| Lighting | From top-left, 2–3 shade steps per surface, limited dithering |
| UI windows | Deep-blue vertical gradient, 2-pixel light border with rounded corners, a slight inner shadow. Our own window skin, not copied from any game |
| Font | **DotGothic16** (open licence, covers English and Japanese), at 8 px or 16 px |
| Cursor | Hand pointer ▶, bobbing 1 pixel |
| Motion | Steps of 1–2 pixels, sprite frames at 6–12 fps, screen transitions ≤ 400 ms |
| Sound | Original chiptune: square, triangle and noise channels, generated in the browser |

**Originality:** inspired by the era, never copying it. No sprites, music, window skins or characters taken from existing games.

---

## 6. Generated characters and enemies — the Atelier

Three layers, from safest to most creative:

### Layer 1 — Procedural parts kit (default, offline, free, deterministic)

Sprites are assembled from a library of hand-made parts. The parts are chosen by a seed (from the character's or enemy's id), so **the same character looks identical on every machine** and nothing needs an internet connection.

**Characters** are built like a paper doll: body → outfit (by job) → hair → face → accessories (by tier) → palette swap.

| Real data | Visible as |
|---|---|
| Job | Outfit silhouette: Fighter armour, Mage robe, Cleric vestments, Thief hood, Bard cape |
| Tier | Outfit upgrades at each promotion: cloth, then leather, then plate and cape, then crown or halo for T4 |
| Adapter (Claude Code, Codex, Gemini, API…) | An "element" colour accent and a small crest. Original symbols, no brand logos |
| Reliability | Posture and glow: a steady aura above 0.8 |
| Cursed | Purple tint, a dark wisp |
| Resting (no MP) | Sleep animation, a "Zz" bubble |
| Level | Small badge number on the portrait |

**Enemies** start from a template per kind (Slime, Goblin, Orc…). Real task data then picks the variant:

| Real data | Visible as |
|---|---|
| Enemy level | Size class, horns, and armour layers |
| Number of criteria | Visible HP segments, and extra limbs or heads for many criteria |
| Where in the codebase | Biome palette: e.g. `/api` volcanic red, `/ui` forest green, `/legacy` ancient stone |
| Flaky or intermittent | Translucent, flickers between frames |
| Failed before | **Elite** variant with a red crown and scars, one per failed attempt |
| Has a regression guard | A shield on its arm |
| Security-labelled | Spiked, with a dark aura |
| Name | Generated from the task title + kind, e.g. "Null-Pointer Goblin", "Flaky Lich of `/payments`" |

You can re-roll a character's look at the Tavern for free. Approved looks are saved in `world.json`.

### Layer 2 — AI-proposed parts (the project grows its own art)

On a schedule or on request, an **Artisan** character (a Bard specialism) proposes **new parts**: a new goblin helmet, a new hairstyle, a new biome palette. Parts are drawn as small pixel grids (JSON), not as freeform images, so they can be checked exactly.

Every proposal goes through:

1. **The Style Gatekeeper (automatic):** size, palette, outline rule, shading steps, silhouette readability at 1×, contrast, no text or logos, not too similar to existing parts.
2. **You, in the Atelier:** a gallery of new parts shown in context (on a sprite, in battle). **Approve**, **Reject**, or **Ask for a revision**.
3. Approved parts join the kit, and new characters and enemies start using them.

Like everything else, this earns trust: an Artisan with a good approval record gets more freedom (e.g. its palettes no longer need review).

### Layer 3 — Community style packs

Contributors submit packs of parts as pull requests. CI runs the same Style Gatekeeper, and maintainers approve. Packs carry an open art licence (CC-BY-4.0 or CC0).

> **Guardrail:** generated or contributed art must not imitate existing characters, logos or game art. The automatic checks can't detect that alone, so human review in the Atelier and on PRs is required.

---

## 7. Exploration and unlocks

**Rule:** unlocks come from real progress and healthy engineering habits, never from repetition. Core features are never locked away; unlocks add places, options, and cosmetics.

### The World Map is your codebase

- **Regions** are top-level folders, and each gets a biome. **Dungeons** are modules; their floors are folder depth.
- **Fog of war** lifts as agents read and change files. A fogged region means "no agent has learned this part of the code yet". Sending a **Thief** to scout it builds real knowledge into the Chronicle.
- **Enemies appear where the work is:** open issues and failing tests for a module show up in its region.
- **Danger level** of a region comes from real signals: change frequency, failure history, and missing tests.
- **Ancient Ruins:** old, untouched, untested code. Exploring it is risky, so rewards are higher.

### Things to unlock

| Unlock | Real trigger | Why it's a healthy incentive |
|---|---|---|
| 🏰 New town buildings (Armory, Dojo, Shops) | Real infrastructure: CI → Armory, evals → Dojo, MCP servers → Shops | Rewards a safer, stronger setup |
| 🏅 Badges (Stone, Cascade, Thunder…) | CI, test coverage, branch protection, secret scanning | Raise the autonomy cap (Gym Badges) |
| 🧭 New regions on the map | First scouting run into that folder | Builds project knowledge |
| ⚔️ Advanced jobs, Summoner | Promotions and job mastery | Earned trust |
| ⚡ Combo Techs | A pair proves it beats either member alone | Finds combinations that actually help |
| ✨ Skills (Glimmer) | A win at matched difficulty, confirmed by a second character | Learning without grinding |
| 📖 Bestiary entries | First encounter with each enemy variant | Shows which kinds of task you face |
| 💎 Rare enemies (Metal Slime) | A flaky bug, reproduced and fixed | Rewards work people avoid |
| 🎵 Music tracks, window skins, portrait accessories | Chapter milestones (e.g. a release shipped) | Cosmetic only, so nothing to exploit |
| 🏁 Chapter endings | Closing a milestone, scored on cost, defects, tests, human interventions | A real retrospective |
| 🔁 New Game+ | Re-running a milestone with your accumulated Chronicle | Measures whether learning paid off |

---

## 8. Sound

- **Effects on, music off** by default (it's a work tool). One key toggles each.
- **Everything original**, synthesised in the browser with square, triangle and noise waves, so no audio files to licence.
- A short motif per region; a battle loop; a 4-note victory fanfare; a promotion jingle; a soft chime when someone needs you.

---

## 9. Accessibility

- **Reduce motion:** no screen shake, flashes or transitions.
- **Status is never colour-only:** shapes and icons accompany every colour (e.g. cursed = tint **and** wisp icon).
- **Fully playable by keyboard.** The combat log is plain text, so screen readers can follow it.
- Text size options (1×, 2× pixel scale for text).
- Terminal: respects `NO_COLOR`, plus a `--quiet` mode.

---

## 10. What this means for the code

```
Agents (CLIs / APIs) ──hooks──▶ Engine (Node, existing) ──events──▶ Web client (browser)
                                    │                                   ▲
                                    └──── world.json, Chronicle ────────┘ commands (approve, swap, retreat…)
```

- The engine emits a stream of **game events** (`action`, `damage`, `miss`, `blocked`, `summon`, `verdict`, `levelUp`, `promotion`, `askHuman`…), served over a local WebSocket.
- `fcrpg play` binds to `127.0.0.1` only, with a one-time token in the URL.
- **Web client:** TypeScript with a Canvas 2D renderer for sprites and maps, and real HTML for menus and text, which keeps them accessible and translatable. No heavy game engine is needed at 384 × 216.
- **Art pipeline:** `assets/parts/*.json` (pixel grids) + `style.json` → sprite compositor → cached PNG sprite sheets.
- The same event stream feeds the terminal UI and the Claude Code status bar.

---

## 11. Launch slice — what must exist before publishing

The first GIF people see should already feel like a game.

1. Title screen with CONTINUE recap
2. Guild Town with three buildings: Quest Board, Tavern, Inn
3. Generated portraits and battle sprites for all 5 jobs × 5 tiers, and 4 enemy kinds (Slime, Goblin, Orc, Lich) with data-driven variants
4. One live battle screen, driven by real Claude Code tool calls
5. Victory screen + Loot Review (diff with Accept/Reject)
6. Sound effects (no music yet)
7. English and Japanese text

Everything else (World Map, Atelier, Bestiary, Guild Hall, music, community packs) becomes roadmap quests for contributors.

---

## 12. Mockups

All key screens are mocked up on the Fantasy Code RPG design canvas: title, Guild Town, Quest Board, battle, Wait-mode decision, Victory + Loot Review, World Map, plus the character generator, enemy generator and Style Bible boards. Every sprite there is drawn live by two prototype generators (heroes and foes) that follow this plan's rules, including the automatic outline pass.

## 13. Open questions

- **Final name and logo.** Check availability before art is made around it.
- **Default party size:** 4, like most 16-bit RPGs?
- **Portrait style:** more realistic or more chibi/cute?
- **Who draws the first parts kit?** You, a commissioned pixel artist, or AI-proposed parts curated by you. The Layer 1 kit sets the style everything else follows, so it deserves the most care.
