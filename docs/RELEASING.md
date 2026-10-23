# Releasing Fantasy Code RPG

The package is `fantasy-code-rpg` on npm; it installs the `fcrpg` command.

## Before the first public release (once)

1. **Name check.** Search the official trademark databases for "Fantasy Code" in classes 9 (software) and 41 (games/entertainment):
   - Japan: [J-PlatPat](https://www.j-platpat.inpit.go.jp/) → 商標 → 簡易検索 → 「ファンタジーコード」 and "FANTASY CODE"
   - US: [USPTO Trademark Search](https://tmsearch.uspto.gov/)
   - EU: [EUIPO eSearch](https://euipo.europa.eu/eSearch/)
   - Anything live and close in those classes → talk to a trademark lawyer before launch, and pick another name if needed. Avoid naming or imitating other games' trademarks in marketing (titles, logos, signature monsters or items).
2. ✅ **Placeholders filled in:** GitHub owner `ishboogoo` in `package.json`, conduct contact in `CODE_OF_CONDUCT.md`, copyright holder Alex Ishiguro in `LICENSE`.
3. **GitHub repository.** Create an empty public repository named `fantasy-code-rpg`, then push:
   ```bash
   git remote add origin https://github.com/ishboogoo/fantasy-code-rpg.git
   git push -u origin main
   ```
   In **Settings**:
   - **General** → Features: turn on Issues and Discussions.
   - **Code security** → turn on Private vulnerability reporting (SECURITY.md points people there), Dependabot alerts and secret scanning.
   - **Branches** → add a rule for `main`: require a pull request and the CI check to pass.
   - **About** (the gear on the repo's front page): description, topics `ai-agents`, `claude-code`, `codex`, `gemini-cli`, `rpg`, and the cover image under Settings → General → Social preview (`assets/brand/cover.png`).
   - **Labels**: create `quest:slime`, `quest:goblin`, `quest:orc`, `quest:dragon` (CONTRIBUTING.md mentions them) and add a few starter issues labelled `quest:slime`.
4. **npm account.** Create an account at npmjs.com, turn on two-factor authentication, then on your computer run `npm login`.

## First publish (by hand, once)

npm only lets you set up automatic publishing for a package that already exists, so the first version goes out from your computer:

```bash
git clone https://github.com/ishboogoo/fantasy-code-rpg.git && cd fantasy-code-rpg
npm install
npm test
npm pack --dry-run          # check the file list: dist/, src/web/, assets/, README, LICENSE, CHANGELOG
npm publish --access public # asks for your 2FA code
git tag v0.2.0 && git push origin v0.2.0
```

Then create the release on GitHub (Releases → Draft a new release → tag `v0.2.0`, new tag on `main` → Publish). That makes the tag, and the **Release** workflow sees 0.2.0 is already on npm, skips publishing, and fills in the release notes from the changelog.

Finally, check it works the way a new player gets it, in a fresh folder:

```bash
npx fantasy-code-rpg@latest demo
npx fantasy-code-rpg@latest play --demo
```

## Turn on automatic publishing (once, right after the first publish)

On npmjs.com → your package → **Settings** → **Trusted Publisher** → GitHub Actions:
- Organization or user: `ishboogoo`
- Repository: `fantasy-code-rpg`
- Workflow filename: `release.yml`

Save. From now on, no npm token lives anywhere: GitHub proves to npm that the release workflow is publishing, and npm adds a provenance badge to each version. A new trusted publisher must be used within 2 days or it expires, so do the next release soon after, or re-save it later. Then, under the package's Settings, set publishing access to require 2FA and disallow tokens.

## Every release after that

Releases happen by themselves when a new version reaches `main`:

1. In a pull request, add a `## [x.y.z]` section at the top of `CHANGELOG.md` and bump the version with `npm version x.y.z --no-git-tag-version`.
2. Merge it once CI passes.

The **Release** workflow sees that `main` carries a version with no tag yet, runs the tests, publishes it to npm (with provenance, through trusted publishing), and creates the `vx.y.z` tag and GitHub release with the changelog section as notes. If the changelog has no section for the new version, it stops and publishes nothing.

You can still release by hand by creating a release with a new `v*` tag on GitHub; the workflow then publishes and fills in the notes.

Version numbers: until 1.0, bump the **minor** number (0.3.0) for anything that changes commands or saved guilds, and the **patch** number (0.2.1) for fixes.

## If something goes wrong

- **Bad version on npm:** `npm deprecate fantasy-code-rpg@x.y.z "Broken, use x.y.(z+1)"`, then publish a fix. Unpublishing is only possible within 72 hours and blocks that version number forever, so prefer deprecate.
- **Release workflow fails at publish:** check the trusted publisher settings match exactly (user, repository, `release.yml`).
- **Security report:** answer within 7 days (SECURITY.md promises that), fix in a private fork from the advisory, then release and publish the advisory.
