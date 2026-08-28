# CLAUDE.md — Project Conventions for new-api

@AGENTS.md

## Claude Code

- Follow the shared project instructions imported from `AGENTS.md`.
- **NEVER open a pull request against the upstream repository `https://github.com/QuantumNous/new-api`.** All PRs MUST target this fork (`chunfeng789/new-api`) only — always pass `--repo chunfeng789/new-api` to `gh pr create`, because it otherwise defaults to the upstream parent. See the **Pull requests** rules in `AGENTS.md`.