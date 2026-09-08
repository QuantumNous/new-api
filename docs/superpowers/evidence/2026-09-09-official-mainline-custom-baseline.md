# Official Mainline / Custom Integration Baseline

> Captured on 2026-09-09 in `codex/official-mainline-custom-integration`.
> This is a read-only baseline record; no production system or database was touched.

## Repository state

| Item | Value |
| --- | --- |
| Integration branch | `codex/official-mainline-custom-integration` |
| Pre-task capture `HEAD` | `16634abb86e78e0d7d45fa6ac1fd91dae78803a5` |
| `upstream/main` | `9bf328d9749751757d5d6b74088d514813a618bd` |
| Common merge base (`custom` / `upstream/main`) | `8739c05c0e2aa96d69faec3b9f76b4d2c7f66108` |
| Pre-task worktree status | Clean, branch was ahead of `upstream/main` by the Task 1 planning commit |

The integration branch is based on the official `upstream/main` commit. The
existing `custom` worktree was not modified by this task.

## Pre-task baseline commands and results

The requested status, revision, whitespace, and untracked-file checks were run
from this worktree:

```text
git status --short --branch
## codex/official-mainline-custom-integration...upstream/main [ahead 1]

git diff --check
(no output)

git ls-files --others --exclude-standard
(no output; there are no untracked files)
```

The exact raw command outputs were also saved during capture as:

```text
/tmp/new-api-status.txt
/tmp/new-api-head.txt
/tmp/new-api-upstream.txt
/tmp/new-api-diff-check.txt
/tmp/new-api-untracked.txt
/tmp/new-api-base.txt
/tmp/new-api-divergence.txt
/tmp/new-api-shortstat.txt
/tmp/new-api-merge-tree.txt
```

## Final evidence state

The evidence commit itself advanced the integration branch. A final
post-commit check confirms the repository state below:

| Item | Value |
| --- | --- |
| Final `HEAD` | `c47d5cfca` (`docs: record official mainline custom baseline`) |
| Final worktree status | Clean, branch is ahead of `upstream/main` by 2 commits |

```text
git status --short --branch
## codex/official-mainline-custom-integration...upstream/main [ahead 2]
```

## Custom versus official divergence

```text
git rev-list --left-right --count custom...upstream/main
80 244

git diff --shortstat custom..upstream/main
2804 files changed, 203344 insertions(+), 219142 deletions(-)
```

The three-way merge simulation reports 59 potential conflicts:

| Conflict class | Count |
| --- | ---: |
| Content | 35 |
| Modify/delete | 14 |
| File location | 10 |
| Total | 59 |

The plan's earlier estimate was 79/244 and approximately 2,802 files. The
captured repository state is authoritative for subsequent gates and records the
observed 80/244 and 2,804 values.

## Build snapshot checklist

| Check | Baseline observation | Gate status |
| --- | --- | --- |
| Go toolchain | `go version go1.25.5 darwin/arm64` | Recorded; build/test belongs to Task 2 |
| Frontend toolchain | `bun 1.3.6` | Recorded; build belongs to Task 2 |
| Backend build entrypoint | `go run main.go` (`Makefile:start-api`) | Located |
| Frontend build entrypoint | `cd web && bun install --frozen-lockfile && bun run build` (`Makefile:build-web`) | Located |
| Full test entrypoint | `make test` (root module and `relaykit`) | Located; execution belongs to Task 2 |

## Database snapshot checklist

| Database | Repository fixture/entrypoint observed | Baseline status |
| --- | --- | --- |
| SQLite | `DEV_SQLITE_PATH` / `one-api.db`; GORM migration code under `model/` | Not executed in Task 1 |
| MySQL >= 5.7.8 | Database support is declared by project conventions; no running fixture was present | Not executed in Task 1 |
| PostgreSQL >= 9.6 | `docker-compose.dev.yml` PostgreSQL service (`new-api`, user `root`) | Not executed in Task 1 |

Task 1 deliberately records the fixtures and entrypoints without starting
services, writing schemas, or substituting a developer machine database. Task 2
must run explicit SQLite, MySQL, and PostgreSQL initialization/AutoMigrate
fixtures and record schema results before the official runtime baseline is
accepted.

## Scope and concerns

- The branch and planning/specification files pre-existed this evidence commit;
  only this evidence file is new in Task 1.
- The observed divergence counts differ slightly from the plan's estimate;
  downstream conflict acceptance must use the captured values above.
- No production deployment, production database write, or customer data access
  occurred.

Task 11 integration validation (2026-09-09) is recorded in
`2026-09-09-official-mainline-custom-validation.md`; database and staging
gates remain open where no local services or DSNs were available.
