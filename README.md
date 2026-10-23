# Fantasy Code RPG

![Fantasy Code RPG key art](assets/brand/cover.png)

**A 90s-RPG harness for AI agent teams. Agents earn autonomy by proving they're reliable.**

The game is *Fantasy Code RPG*; its engine and command-line tool are called `savepoint`.

```
╔═ PARTY ══════════════════════════════════════════════════════╗
║ Aria       Lv 7 T1 Fighter      REL 0.74 claude-code         ║
║   EXP ████░░░░░░░░ 545/1660                                  ║
║   may: read, write                                           ║
║ Bram       Lv 6 T0 Novice       REL 0.39 codex               ║
║   may: read                                                  ║
║ Cass       Lv 4 T1 Cleric       REL 0.81 anthropic-api       ║
║                                                              ║
║ 💰 Treasury: 97.97 G                                         ║
╚══════════════════════════════════════════════════════════════╝
```

You recruit AI agents (Claude Code, Codex, Gemini CLI, any API model) into a party.
Tasks are enemies. Acceptance criteria are their HP. Every agent starts as a **Novice** that can only read and suggest.
Win battles reliably and you're **promoted**: first you may write files, then run tests, then open PRs, then lead a party yourself.
Get sloppy and you're **cursed** back down a tier.

Under the 16-bit paint, SAVEPOINT is a **progressive-trust permission system**: autonomy is earned from a measured track record, and the harness, not the prompt, enforces it.

## Try it in 10 seconds

```bash
git clone https://github.com/<you>/savepoint && cd savepoint
node src/cli.ts demo          # Node ≥ 22.18, zero runtime dependencies
```

The demo runs 40 simulated battles. One fighter is reliable, one is sloppy, and a cleric judges them. Watch who gets promoted.

## See it in your browser

```bash
node src/cli.ts play --demo   # a practice guild with simulated heroes; open the link it prints
```

Walk around Guild Town, ask the Clerk for a quest, plan it in the War Room, send the party out, and keep or undo the result at the Treasure Vault. English and Japanese.

![Guild Town](assets/brand/town.png)
![The battle screen](assets/brand/battle.png)

## Play for real

```bash
cd your-project
savepoint init
savepoint recruit Aria --adapter claude-code --job fighter --mp 200 --refill 5
savepoint recruit Cass --adapter anthropic-api --job cleric --billing api
savepoint fund 5                                  # 5 G = $5 of API budget
savepoint lore "We use pnpm. Never edit /legacy."

savepoint request "Login crashes when the email field is empty"   # the Clerk writes the quest
savepoint import github --label bug  # or bring in open GitHub issues as quests
savepoint plan q1                 # War Room: read-only scouting report and plan (automatic in Story mode)
savepoint battle q1

# Or write a quest by hand:
savepoint spawn bug-42 --name "Login crashes on empty email" --kind goblin --level 3 \
  --criteria "fix: empty email shows a validation error" \
  --criteria "test: a regression test covers it" \
  --check "test=pnpm test -- login" --guard "pnpm test"

savepoint suggest bug-42          # the recommended party, with reasons
savepoint battle bug-42           # no --party: the Council picks the lead; swap anyone with --party
savepoint keep <battle-id>        # Treasure Vault: bring the changes into your project
savepoint undo <battle-id>        # …or throw them away (counts as a loss for the party)
savepoint council                 # how each Council seat has decided, and how often it was right
```

Every battle runs in **its own copy of your project** (a git worktree), with a save point after each hero's turn. Nothing touches your folder until you choose Keep.

## The world in one table

| Game | Reality |
|---|---|
| Character | An agent: one model behind one CLI or API |
| Job class | Role: ⚔️ Fighter (build) · 🔮 Mage (design) · ✚ Cleric (review/test) · 🗡️ Thief (debug) · 🎵 Bard (docs) |
| Tier T0→T4 | Permissions: read → write → run commands → network/PRs → merge/recruit |
| Enemy / HP | A task / its acceptance criteria |
| XP | Work done, weighted by correctness, quality, cost and speed |
| REL | Wilson lower bound of success rate. Drives promotion. Luck can't fake it |
| Gold / MP | API dollars / subscription CLI quota that refills at the Inn |
| The Chronicle | Shared context every CLI and API character reads and writes |
| Save point | A commit after every hero's turn, in the battle's own copy of the project |
| Quest type | Build · Fix · Improve · Explore · Maintain · Write: sets the party, budget and what counts as proof |
| The Council | How every decision is made: rules → win records → a cheap fast model → a vote across AI companies → you |

Design plan: **[docs/DESIGN_PLAN.md](docs/DESIGN_PLAN.md)** · Decisions: **[docs/DECISIONS.md](docs/DECISIONS.md)** · Full rules: **[docs/WORLD.md](docs/WORLD.md)** · How it is built: **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** · Lessons from other projects: **[docs/CROSS_REFERENCE.md](docs/CROSS_REFERENCE.md)** · The 90s feel: **[docs/EXPERIENCE.md](docs/EXPERIENCE.md)** · UX plan: **[docs/UX_PLAN.md](docs/UX_PLAN.md)**

## Three rules that make this more than a skin

1. **No self-grading.** A character never judges its own battle. Tests, CI, another character, or a human do.
2. **Permissions are enforced by adapters**, through each CLI's own sandbox and tool-allowlist flags. A prompt saying "please don't" isn't a permission system.
3. **Trust is per job.** A great Fighter isn't automatically a trustworthy Cleric.

## Status

**v0.2 in progress.** Playable core (rules, Chronicle, battle loop, judge, Gatekeeper, 7 adapters, terminal UI) plus the Guild Counter (the Clerk writes quests), the War Room (scout and plan), play styles, quest types, the Council's first two seats, fair cross-company judging, recommended parties, and battles in private copies with save points, Keep and Undo. one Gatekeeper enforced across Claude Code, Codex and Gemini CLI, a "no proof, no victory" stop hook, GitHub Issues import, and the launch scenes in the browser (`savepoint play`). 44 tests.
CLI flag mappings for Claude Code / Codex / Gemini CLI are marked `VERIFY` and need community testing.

## Join the guild

This is built in the open and needs heroes. See **[ROADMAP.md](ROADMAP.md)** for quests sized from 🟢 Slime (first PR) to 🐲 Dragon, and **[CONTRIBUTING.md](CONTRIBUTING.md)** for how to claim one.

Wanted most: CLI adapter testers, a pixel-art web UI, an MCP server for the Chronicle, and game designers to balance the numbers.

## License

MIT
