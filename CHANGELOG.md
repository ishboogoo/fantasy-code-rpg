# Changelog

All notable changes, newest first. Versions follow [Semantic Versioning](https://semver.org/); until 1.0, a minor version may change how saved guilds or commands work, and the notes will say how.

## [0.2.6]

### Fixed
- **Safer card import:** only the plain text chunk the game writes is read from a card PNG (a compressed one could have expanded without limit), and oversized hero data is refused.
- **Proof goes to the right heroes:** in a Pincer only the approach you keep earns proof, and in a Siege a part that clashed, or changed nothing, earns none.
- `fcrpg art <hero> --off` works without an image argument.
- Recruiting from a card falls back to an available AI connection when the hero's old one isn't on this computer.

## [0.2.5]

### Added
- **Hero cards.** Click a hero in the Tavern to see their card: a shareable trading card with a big artwork window, rank frame, trust, wins by kind of quest, skills, and links to the real commits behind it all. SHARE CARD saves it as a PNG and copies it. `fcrpg card <hero>` shows it in the terminal and saves a `.hero.json`.
- **Card art.** Set your own artwork for a hero (SET CARD ART, or `fcrpg art <hero> <image>`). Community backgrounds and rank frames can ship in `assets/cards/` (see the art guide).
- **Skills.** After each battle the scribe may note up to two general working habits the heroes showed; they appear in the heroes' prompts as suggestions and travel with them.
- **Proof.** Keeping a battle records the commit, quest and repository on the heroes who did the work.
- **Travelling heroes.** The card PNG carries the hero inside it. RECRUIT FROM A CARD in the Tavern, or `fcrpg recruit --from <card.png|hero.json>`, brings that hero into your guild as a **veteran on probation**: level, title, career and skills come along; rank starts at 1 at most; their record elsewhere counts as a discounted head start (a quarter, at most 10 battles' worth) toward promotion. They run on your own AI connection. Shared files are read strictly and their text is shown as suggestions, never rules.

## [0.2.4]

### Fixed
- **Claude Code heroes on your plan can never bill API credits.** If `ANTHROPIC_API_KEY` is set on your computer, Claude Code could use it instead of your Claude plan. Heroes now run without it unless you recruited them with `--billing api`.

## [0.2.3]

### Changed
- **Guild Town arrows follow the map.** Left and Right move along a row of buildings; Up and Down jump to the nearest building in the other row. Tab and Shift+Tab still step through every building in order.

## [0.2.2]

### Added
- **Screenshots:** press **P** (or the 📷 button, top right) anywhere in the browser game to save the screen as a PNG and copy it, ready to share. The picture carries a small "Fantasy Code RPG" credit.

### Fixed
- **Windows support.** Victory-condition checks and guards now run through the system shell (cmd.exe on Windows); the game finds installed CLIs with `where`; npm-installed command wrappers (`codex.cmd`, `gemini.cmd`) are run through their script; hook commands use forward-slash paths; Windows file paths into the guild's records are still refused; Claude Code's PowerShell tool follows the same rules as Bash.

## [0.2.1]

### Added
- `fcrpg --version` (or `-v`) prints the installed version. ([#1](https://github.com/ishboogoo/fantasy-code-rpg/issues/1))

### Changed
- Releases now publish to npm from GitHub automatically, with a provenance badge showing which commit built each version.

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
