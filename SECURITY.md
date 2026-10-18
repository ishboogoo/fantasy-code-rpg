# Security

SAVEPOINT runs AI agents that can edit files and execute commands. Security bugs here matter.

## Report privately

Please **don't** open a public issue for vulnerabilities. Use GitHub's "Report a vulnerability" (private security advisory) on this repository. We aim to reply within 7 days.

## What counts

- Any way a character can act above its tier (Gatekeeper bypass, adapter flag mistakes)
- Any way a character can influence its own verdict, XP or reliability
- Prompt injection through the Chronicle (lore, scrolls) that makes another character misbehave
- Secrets leaking into `.savepoint/` files, logs or prompts
- Budget enforcement that fails open

## Safe-use reminders

- Start every character at T0 and let it earn trust in a repo you can afford to break.
- Keep `.savepoint/` out of git (it's in `.gitignore`), since scrolls may contain code and output.
- Check your AI providers' terms before running their CLIs headlessly or on a server.
