# Changelog

All notable changes, newest first. Versions follow [Semantic Versioning](https://semver.org/); until 1.0, a minor version may change how saved guilds or commands work, and the notes will say how.

## [0.2.0] — first public release

### The game
- **Guild Town in the browser** (`fcrpg play`): Title, Guild Town, Guild Counter, Quest Board, War Room, Battlefield, Treasure Vault, Tavern, Inn, Library and Settings, in English and Japanese. `fcrpg play --demo` opens a practice guild with simulated heroes.
- **The quest loop**: the Clerk turns plain words into a quest with victory conditions (`fcrpg request`), the Scout and Planner prepare it read-only (`fcrpg plan`), you approve, the party fights, you Keep or Undo at the Treasure Vault, and a scribe writes lessons into the guild's lore.
- **Six quest types** (build, fix, improve, explore, maintain, write), each with its own default party, budget and kind of proof.
- **Formations**: Relay (heroes take turns), Pincer (two approaches in two copies; the better one wins) and Siege (a quest split into parts fought at once, then joined).
- **Import GitHub issues** as quests (`fcrpg import github`).

### Trust and safety
- **Private copies**: every battle runs in its own git worktree with a save point after each turn. Nothing reaches your folder until you Keep it.
- **One rulebook across CLIs**: the Gatekeeper checks every tool call through Claude Code, Codex and Gemini CLI hooks. A hero reaching one rank above its own pauses and asks you (allow once, deny, or hand to another hero); forbidden actions are critical failures.
- **No proof, no victory**: a hero can't finish while a check still fails.
- **Fair judging**: checks first, then up to three judges from different AI companies, authors hidden, a unanimous vote per condition; a split goes to you.

### The Council
- Decisions (quest type, who leads, is it risky, is the party stuck, which approach is better) go to the cheapest seat that's sure enough: rules, then win records, then a Seer hero you seat (asked three times, unanimous only), then a vote, then you. Every decision and its outcome is recorded.
- Risky quests wait for your nod and suggest a Pincer. Between turns, the Council can carry on, retreat, or call a stronger hero. The party stands down once every check passes.

### Known limits
- Codex and Gemini CLI support hasn't been tested on real installs yet.
- Some messages from the engine (warnings, Council reasons) are English only.

## [0.1.0] — not published
The playable core: rules, Chronicle, battle loop, judge, Gatekeeper, seven adapters and the terminal UI.
