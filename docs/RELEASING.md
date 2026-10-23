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

Pushing the tag runs the **Release** workflow: it sees 0.2.0 is already on npm, skips publishing, and creates the GitHub release from the changelog.

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

1. Update `CHANGELOG.md`: a new `## [x.y.z]` section at the top.
2. Bump the version without tagging: `npm version x.y.z --no-git-tag-version`.
3. Commit, open a pull request, and merge it once CI passes.
4. Tag the merged commit and push the tag:
   ```bash
   git checkout main && git pull
   git tag vx.y.z && git push origin vx.y.z
   ```
5. The **Release** workflow runs the tests, checks that the tag matches `package.json`, publishes to npm and creates the GitHub release from the changelog section.

Version numbers: until 1.0, bump the **minor** number (0.3.0) for anything that changes commands or saved guilds, and the **patch** number (0.2.1) for fixes.

## If something goes wrong

- **Bad version on npm:** `npm deprecate fantasy-code-rpg@x.y.z "Broken, use x.y.(z+1)"`, then publish a fix. Unpublishing is only possible within 72 hours and blocks that version number forever, so prefer deprecate.
- **Release workflow fails at publish:** check the trusted publisher settings match exactly (user, repository, `release.yml`).
- **Security report:** answer within 7 days (SECURITY.md promises that), fix in a private fork from the advisory, then release and publish the advisory.
