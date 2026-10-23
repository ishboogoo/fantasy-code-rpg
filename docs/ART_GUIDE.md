# Art and design guide

Fantasy Code RPG looks like a 1990s Japanese 16-bit RPG drawn inside green falling code: Matrix meets fantasy. Every hero, monster and building is pixel art drawn by code, in the files under `assets/generators/`. This guide is for anyone who wants to design a hero, a race, a job outfit or a monster.

**You don't need to draw pixel art to contribute.** A sketch, a mood board or a good paragraph is enough; a contributor (or the guild itself) turns accepted designs into the generator code.

## How to submit

1. Open an issue with the **🧝 Hero design** or **👾 Enemy design** template (New issue → pick the template). For card backgrounds and frames, use the Hero design template and choose "Something else".
2. Describe the idea, attach sketches or pixel art if you have them, and tick the rules.
3. The design is discussed in the issue. Accepted designs get a `quest` label so someone can build them, and you're credited in the README when they ship.

Loose ideas ("what if heroes had pets?") are welcome in Discussions.

## The rules

- **Original work only.** Inspired by the era is great. Copied or traced sprites, characters, logos, window skins or music from existing games, films or books are not, and neither is drawing "in the style of" a named living artist.
- **Folklore is fair game.** Monsters from public-domain myth and folklore (Hydra, Nurikabe, Kitsune…) are encouraged; a studio's modern version of one is not.
- **All characters are adults.** Glamorous 90s RPG styling is welcome; nothing sexually explicit.
- **Licence.** You license what you submit under CC-BY-4.0 (or CC0), so it can ship in the game with credit. The game's code stays MIT.

## Monsters stand for real problems

Every task is an enemy, and a good monster *feels* like the problem it stands for. The best ones come from real folklore whose legend matches the problem, so defeating the monster means doing the real fix.

| Monster | The problem it stands for | Status |
| --- | --- | --- |
| Slime | A trivial task: typo, rename, config tweak | In the game |
| Goblin | A small bug | In the game |
| Orc | A feature | In the game |
| Golem | A refactor | In the game |
| Wyvern | A performance problem | In the game |
| Lich | A flaky test | In the game |
| Mimic | Docs that look fine but lie | In the game |
| Dragon | An epic, fought in phases | In the game |
| Hydra | A bug that keeps coming back: fix it and add a test | Drawn, not yet a quest type |
| Nurikabe | Something blocking the work: find the root cause | Drawn, not yet a quest type |
| Kasa-obake | Old code that bites back | Drawn, not yet a quest type |
| Ouroboros | Going in circles | Drawn, not yet a quest type |
| Will-o'-the-wisp | A problem that only happens sometimes: reproduce it first | Idea |
| Kitsune | A bug disguised as a different bug | Idea |
| Chimera | One request that is really three: split it | Idea |
| Phoenix | Something that keeps crashing and restarting | Idea |
| Sphinx | Nobody said exactly what is wanted: only you can answer | Idea (already the name for a quest with open questions) |

Monsters face **left**, toward the party. Sizes: 32, 48, 64 or 96 px (a boss may be larger).

## Heroes

| Part | The rule |
| --- | --- |
| Battle sprite | 42 × 54 px, three-quarter view, poses: idle, attack, victory |
| Portrait | 64 × 64 px |
| Jobs | Fighter (builds), Mage (plans), Cleric (reviews and tests), Thief (scouts and debugs), Bard (writes docs). A new job must map to real coding work. |
| Ranks | Each job has a title per rank (Fighter → Knight → Paladin → Champion); outfits get grander with rank. Novices wear a plain grey-green tunic. |
| Races | Human, elf, dwarf, beastkin, lizardfolk, demonkin, automaton, fae |
| Builds | Feminine, masculine |

## Look and palette

- Screen 384 × 216, scaled up in whole numbers only.
- Light from the top left, 2–4 shades per surface, coloured (not black) outlines.
- The code-green window skin is the default; a classic blue skin is a setting.
- Use the palette below: 13 ramps of 4 shades, darkest first. Source of truth: `assets/style/style.json`.

| Ramp | Shades |
| --- | --- |
| ink | `#08081c` `#1a1428` `#3a3450` `#6a6488` |
| night | `#0a1148` `#142070` `#2a3c9c` `#6a80e0` |
| steel | `#6c7890` `#a8b4c8` `#e0e8f0` `#ffffff` |
| ember | `#9a2a20` `#e05a38` `#ff9a70` `#ffd0b0` |
| forest | `#2c5020` `#4c8038` `#80b060` `#c8e8a0` |
| gold | `#9a7018` `#e0b040` `#ffe090` `#fff6d0` |
| ocean | `#2458a8` `#4890e0` `#90d0ff` `#d8f0ff` |
| arcane | `#2a1e44` `#5a38a0` `#9a68e0` `#d0a8ff` |
| earth | `#4a2a18` `#6c4028` `#a07848` `#c8a070` |
| skin | `#c07850` `#f0b088` `#ffd8b8` `#fff0e0` |
| umber | `#6c4428` `#a06840` `#c89068` `#e8b890` |
| rose | `#a03860` `#e06088` `#ff90b0` `#ffd0e0` |
| code | `#0a3a1e` `#1f8a3c` `#7dff9a` `#e8ffe8` |

## Card art

Every hero has a **hero card**: a 600 × 840 trading card that players share to show off their hero and that other players recruit the hero from. Its big artwork window is the best place for community art.

| Piece | Size | Where it goes | What it is |
| --- | --- | --- | --- |
| Background | 540 × 360 (or larger, same 3:2 shape) | `assets/cards/` + `"backgrounds"` in `manifest.json`, keyed by job (`fighter`, `mage`, `cleric`, `thief`, `bard`) or `default` | The scene behind the hero's sprite |
| Rank frame | 600 × 840, transparent where the art and text go | `assets/cards/` + `"frames"` in `manifest.json`, keyed by rank: `novice`, `bronze`, `silver`, `gold`, `mythic` | The border, a grander one per rank |
| Hero art | Any size, 3:2 works best | Set by the player (Tavern → hero → SET CARD ART, or `fcrpg art <hero> <image>`) | A player's own artwork for their hero. Stays on their computer. |

Layout to respect in a frame: the art window is the box from (30, 96) to (570, 456); the name sits above it, and the stats, skills and credit line below. PNG only. Add your credit to `"credits"` in the manifest when you open the pull request.

```json
{
  "backgrounds": { "mage": "bg-mage-starfall.png", "default": "bg-guild-hall.png" },
  "frames": { "gold": "frame-gold-filigree.png" },
  "credits": ["bg-mage-starfall.png: Starfall Library by @yourname (CC-BY-4.0)"]
}
```

## From design to game (for builders)

- Heroes are drawn by `assets/generators/hero.cjs` (job, race, build, rank → pixels); portraits by `portrait.cjs`; monsters by `foe.cjs`, one `if (kind === '…')` block each.
- A new monster that becomes a quest type also needs an entry in `EnemyKind` (`src/types.ts`), its weaknesses in `WEAKNESS` (`src/rules.ts`) and, if it fits one, a quest type's `kinds` (`src/quests.ts`).
- Preview your work with `fcrpg play --demo`, and press **P** in the game for a screenshot to post in the issue.

---

## 日本語：デザインの募集

ギルドの仲間（キャラクター・種族・職業の衣装）や、モンスターのデザインを募集しています。ドット絵が描けなくても大丈夫です。スケッチや文章だけでも歓迎します。

- **カードの絵：** ヒーローカード（600×840）の背景（540×360、職業ごと）とランクの枠（600×840、透明な窓つき）も募集しています。
- **応募方法：** Issue を作成し、「🧝 Hero design」または「👾 Enemy design」のテンプレートを選んでください。
- **モンスターは実際の問題を表します。** スライムは誤字、ゴブリンは小さなバグ、リッチはときどき失敗するテスト。民話や神話（ぬりかべ、狐、ヒュドラなど）の伝承が、プログラミングの問題とぴったり重なるものが理想です。
- **ルール：** オリジナル作品のみ（既存のゲーム・キャラクター・ロゴの模写は不可）。登場人物はすべて大人で、性的に露骨な表現は不可。投稿したデザインは CC-BY-4.0（または CC0）で提供し、採用時にはクレジットを記載します。
