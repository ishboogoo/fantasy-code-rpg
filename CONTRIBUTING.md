# Joining the Guild

Welcome, adventurer. Fantasy Code RPG is built in the open, and every kind of contributor is a party member we need: coders, game designers, pixel artists, chiptune composers, writers, and people who just try it and report what broke.

## Picking a quest

1. Browse [ROADMAP.md](ROADMAP.md) or issues labelled `quest:slime` (first PR), `quest:goblin`, `quest:orc`, `quest:dragon`.
2. Comment "I'll take this" on the issue. A maintainer assigns it, so two people don't fight the same monster.
3. Stuck for more than a few days? Say so. Handing a quest back is honourable.

## Setup

```bash
git clone https://github.com/<you>/fantasy-code-rpg && cd fantasy-code-rpg
npm install          # dev tools only (typescript); zero runtime deps
npm test             # node:test, runs .ts directly
npm run typecheck
npm run demo
node src/cli.ts play --demo   # the browser game
```

Node ≥ 22.18 runs TypeScript directly, so during development there's no build step. Keep TypeScript **erasable** (no enums, no parameter properties, no namespaces), so `node src/cli.ts` keeps working. The published package is compiled to plain JavaScript (`npm run build` → `dist/`), because Node won't run TypeScript from inside `node_modules`.

## House rules for code

- **`rules.ts`, `economy.ts` and `gate.ts` stay pure.** No I/O. Every balance change ships with a test that shows the intended effect.
- **Adapters enforce permissions.** Never rely on the prompt to stop a character. If a backend can't enforce something, say so in the adapter's `enforcement` string.
- **No self-grading.** Any change that lets a character influence its own verdict will be declined.
- **Deny by default.** Unknown tools, unknown adapters and missing config fail closed.
- **No runtime dependencies** in the core without discussion. Plugins and the web UI can have their own.

## Game design PRs

Changing a number in the rulebook? Include in the PR:
- what player behaviour it encourages,
- how it could be exploited (Goodhart is always watching),
- a `npm run demo` before/after excerpt or a test.

## Art, sound and writing

Designing heroes or monsters? Start with [docs/ART_GUIDE.md](docs/ART_GUIDE.md) and the **🧝 Hero design** / **👾 Enemy design** issue templates. Sketches and words are welcome; you don't need finished pixel art.

Original work only. Inspired by the era is great; ripped sprites, music or proprietary character names are not. Put assets under `assets/` with a note of the licence you're contributing them under (CC-BY-4.0 or CC0 preferred).

## Commit and PR style

- Small PRs. One monster per battle.
- Conventional-ish titles: `adapter(codex): verify sandbox flags`, `rules: diminishing XP for repeat slimes`.
- Fill in the PR template's "How was this judged?" section: which tests prove it works.

## How your pull request is reviewed

See [docs/MAINTAINING.md](docs/MAINTAINING.md): who reviews, what we check (safety first), and how releases happen. Changes to the Gatekeeper and its entry point (`src/cli.ts`), hooks, rules, the game server, adapters, hero import, workflows or `package.json` always need the maintainer's own approval.

## Code of conduct

Be the party member you'd want in a dungeon. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
