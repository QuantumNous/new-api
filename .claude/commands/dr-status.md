Report the current DeepRouter project status. Do the following steps in order:

1. Run `git log --oneline -8` to show recent commits.
2. Run `git branch` to list local branches and note any active feature/fix branches.
3. Run `git status --short` to show any unstaged or uncommitted changes.
4. Read `AIRBOTIX.md` (the "What we customise" table) to get the Airbotix-specific package status.
5. Read `PLAN.md` if it exists, and note the current phase.

Then produce a concise report in this format:

---
## DeepRouter Status — [today's date]

### Recent commits (last 8)
[list]

### Active branches
[list any non-main branches]

### Uncommitted changes
[list or "none"]

### Sprint 1 ticket status (from memory + code)
| Ticket | Title | Status |
|--------|-------|--------|
| DR-6   | internal/billing webhook dispatcher | ✅ Done |
| DR-7   | internal/kids hard constraints | ✅ Done |
| DR-8   | internal/policy decision engine | ✅ Done |
| DR-9   | e2e: same endpoint, different key → different policy | 🟡 PR open, fix incomplete (claude/gemini/responses handlers still have ordering bug) |
| DR-13  | Quota check RPM/TPM + staging deploy | ⏳ Not started |

### Open PRs / branches
[describe any open branches/PRs]

### What needs doing next
[top 1-2 items]
---

Be specific and honest. Do not mark anything Done if it has known gaps.
