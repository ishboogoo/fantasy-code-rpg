# Maintaining Fantasy Code RPG

How contributions are checked, merged and released, and what keeps faulty or malicious changes out. The maintainer is Alex (@ishboogoo); an assistant (Claude) does first-pass reviews and replies to contributors, and every merge is a person's decision.

## Who does what

| Step | Who |
| --- | --- |
| Welcome and thank contributors, list needed changes kindly | The assistant (comments end with "Posted by Alex's assistant, Claude") |
| Review code against its issue, the rules below and safety | The assistant, plus the Codex review bot |
| Approve test runs for outside contributors | Alex |
| Creative yes/no on designs | Alex |
| Merge | Alex |
| Release | Automatic, when a merged pull request bumps the version |

A scheduled check runs twice a day (08:33 and 17:33 Japan time). It finds new pull requests, design submissions and bug reports, posts a friendly reply, and sends Alex a verdict and the next step. It only comments; it never merges, closes or labels.

## A code contribution, step by step

1. The contributor opens a pull request that says which issue it closes ("Closes #2").
2. Alex approves the test run (required for every outside contributor).
3. Checks run: tests on Node 22 and 24, the packed release installed and played, and the Codex review.
4. First-pass review, in this order:
   - **Safety.** Changes to the Gatekeeper (including its entry point in `src/cli.ts`), hooks, rules, the game server, adapters, hero import, instances, workflows or `package.json` get the strictest look: could a hero act above its rank, could secrets leak, could a release be hijacked, is a dependency added? These files are code-owned, so they also need Alex's own approval.
   - **Scope.** It does what the issue asks and nothing unrelated; no conflict with `main`.
   - **Quality.** Tests for new behaviour; zero runtime dependencies; erasable TypeScript; plain words in the interface, in English and Japanese.
5. The assistant comments with the changes needed, or says it's ready for Alex.
6. Alex merges with **Squash and merge**, after the Codex review has finished.

**Rule of thumb:** never merge what you don't understand. Ask for a plain-language summary; anything that touches safety waits until both reviewers agree.

## A design contribution

1. A 🧝 Hero design or 👾 Enemy design issue comes in (see [ART_GUIDE.md](ART_GUIDE.md)).
2. Check the rules: original or public-domain folklore; adults only and nothing explicit; licence ticked (CC-BY-4.0 or CC0). Art files are PNG only (no SVG, which can carry code).
3. Alex decides. Accepted designs get a quest issue so someone can build them; the builder's pull request adds the credit to the README or `assets/cards/manifest.json`.

## Safeguards in place

- `main` changes only through pull requests with passing checks (repository ruleset).
- Outside contributors' test runs wait for approval; test runs can only read the repository.
- GitHub Actions are pinned to exact commits; Dependabot proposes updates as pull requests.
- Code owners: the sensitive files listed in `.github/CODEOWNERS` need Alex's approval.
- Releases publish to npm only from `main` or a matching version tag, through trusted publishing: no npm token exists anywhere, and every version carries provenance. npm publishing requires two-factor authentication and refuses tokens.
- No runtime dependencies, so nothing can arrive through a third-party package.
- Shared hero files are parsed strictly, their text is shown to heroes as suggestions, and the Gatekeeper limits what any hero can do whatever its prompt says.
- Security reports arrive privately (Security → Report a vulnerability); answer within 7 days.

## Releasing

Merging a pull request that bumps the version in `package.json` and adds its section to `CHANGELOG.md` releases it: tests, npm publish, tag and GitHub release happen automatically. Details: [RELEASING.md](RELEASING.md).
