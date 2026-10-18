# Merge preflight (read-only, 2026-10-17)

- Current worktree: `par` / `be09fdb01`; untracked `.pi/review-artifacts-be09fdb01.md` belongs to prior work and must not be staged.
- Target starting point: `origin/feat/partner-oauth` / `a1342d5bb`; this branch is checked out in `/Users/lyh_god/GolandProjects/desktop-api-v2`. User approved deriving a separate branch in the current worktree, not changing that worktree.
- Source: `upstream` tag `v1.0.0-rc.44` / `633b4c5b1`; `origin` has no matching ref. Tag fetched without touching working files.
- Shared merge base `0aec08fee`; `git diff --stat HEAD...v1.0.0-rc.44` from `par` showed 651 files changed on upstream side.
- `git merge-tree --write-tree origin/feat/partner-oauth v1.0.0-rc.44` reports 53 content conflicts. Clusters: `AGENTS.md`; authentication/OAuth and user/session files; audit, logging, model migration, billing/top-up/subscription; translations (Go YAML + seven frontend JSON + static keys); frontend security/usage logs/theme. Conflict list can be reproduced with `git merge-tree --write-tree origin/feat/partner-oauth v1.0.0-rc.44 2>&1 | rg '^CONFLICT'`.
- The upstream tag merge is not a cherry-pick or branch update: use a true two-parent merge commit, preserving fork-specific behavior and protected project identities. Keep upstream additions when compatible.
- `AGENTS.md` requires `make test` after upstream merge. Conflict resolution affecting pricing/quota requires `.agents/rules/billing.md` (read during planning), authentication requires OWASP and relevant backend specs; frontend i18n follows `.agents/skills/i18n-translate/SKILL.md`.
- No checkout, merge, conflict resolution, or commit has been attempted in this planning step.
