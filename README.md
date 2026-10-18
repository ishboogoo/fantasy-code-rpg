# 💾 SAVEPOINT

**A 90s-RPG harness for AI agent teams. Agents earn autonomy by proving they're reliable.**

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

## Play for real

```bash
cd your-project
savepoint init
savepoint recruit Aria --adapter claude-code --job fighter --mp 200 --refill 5
savepoint recruit Cass --adapter anthropic-api --job cleric --billing api
savepoint fund 5                                  # 5 G = $5 of API budget
savepoint lore "We use pnpm. Never edit /legacy."

savepoint spawn bug-42 --name "Login crashes on empty email" --kind goblin --level 3 \
  --criteria "fix: empty email shows a validation error" \
  --criteria "test: a regression test covers it" \
  --check "test=pnpm test -- login" --guard "pnpm test"

savepoint battle bug-42 --party aria --judge cass
```

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
| Save point | git checkpoint before every battle |

Full rules: **[docs/WORLD.md](docs/WORLD.md)** · How it is built: **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** · Lessons from other projects: **[docs/CROSS_REFERENCE.md](docs/CROSS_REFERENCE.md)** · The 90s feel: **[docs/EXPERIENCE.md](docs/EXPERIENCE.md)**

## Three rules that make this more than a skin

1. **No self-grading.** A character never judges its own battle. Tests, CI, another character, or a human do.
2. **Permissions are enforced by adapters**, through each CLI's own sandbox and tool-allowlist flags. A prompt saying "please don't" isn't a permission system.
3. **Trust is per job.** A great Fighter isn't automatically a trustworthy Cleric.

## Status

**v0.1 — playable core.** Rules engine, Chronicle, battle loop, judge, the Gatekeeper (per-tool-call tier enforcement via Claude Code hooks), 7 adapters, terminal UI + status-line HUD, 17 tests.
CLI flag mappings for Claude Code / Codex / Gemini CLI are marked `VERIFY` and need community testing.

## Join the guild

This is built in the open and needs heroes. See **[ROADMAP.md](ROADMAP.md)** for quests sized from 🟢 Slime (first PR) to 🐲 Dragon, and **[CONTRIBUTING.md](CONTRIBUTING.md)** for how to claim one.

Wanted most: CLI adapter testers, a pixel-art web UI, an MCP server for the Chronicle, and game designers to balance the numbers.

## License

MIT
