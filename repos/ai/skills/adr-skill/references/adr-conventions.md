# ADR Conventions (Reference)

## Directory

If the repo already has an ADR directory, keep it.

If the repo has no ADR directory, choose based on project size:

- **`docs/decisions/`** — MADR default, recommended for projects with existing `docs/` structure.
- **`adr/`** — simpler alternative for smaller repos.

Detection order (used by scripts): `contributing/decisions/`, `docs/decisions/`, `adr/`, `docs/adr/`, `docs/adrs/`, `decisions/`.

## Filename Conventions

Pattern: `YYYY-MM-DD-title-with-dashes.md`

- `YYYY-MM-DD` is the ADR creation date (matches the `date` frontmatter field).
- Title uses lowercase, dashes, present-tense imperative verb phrase.
- Examples: `2025-06-15-choose-database.md`, `2025-07-01-adopt-adrs.md`
- Multiple ADRs on the same date are fine — the slug suffix disambiguates them.

If a repo already uses slug-only filenames (no date prefix), follow that convention.

## Minimal Sections

At minimum, every ADR must clearly include:

1. **Context**: why the decision exists now, what constraints/drivers apply.
2. **Decision**: what is chosen.
3. **Consequences**: what becomes easier/harder, risks, costs, follow-ups.

For agent-first ADRs, also ensure:

- Constraints are explicit and measurable
- Non-goals are stated
- Follow-up tasks are identified

## Status Values

Track status in YAML front matter:

```yaml
---
status: proposed
date: 2025-06-15
decision-makers: Alice, Bob
---
```

Common statuses:

| Status                        | Meaning                                                       |
| ----------------------------- | ------------------------------------------------------------- |
| `proposed`                    | Under discussion, not yet decided                             |
| `accepted`                    | Decision is active and should be followed                     |
| `rejected`                    | Considered but explicitly not adopted                         |
| `deprecated`                  | Was accepted but no longer applies — explain replacement path |
| `superseded by [title](link)` | Replaced by a newer ADR — always link both ways               |

## YAML Front Matter Fields

| Field             | Required | Description                                              |
| ----------------- | -------- | -------------------------------------------------------- |
| `status`          | Yes      | Current lifecycle state                                  |
| `date`            | Yes      | Date of last status change (YYYY-MM-DD)                  |
| `decision-makers` | Yes      | People who own the decision                              |
| `consulted`       | No       | Subject-matter experts consulted (two-way communication) |
| `informed`        | No       | Stakeholders kept up-to-date (one-way communication)     |

The `consulted` and `informed` fields follow the RACI model and are useful for audit trails in larger teams.

## Mutability

- Prefer appending new information with a date stamp over rewriting existing content.
- If a decision is replaced, create a new ADR and explicitly supersede the old one.
- Status changes and after-action notes are fine to edit in-place.

## Categories (Large Projects)

For repos accumulating many ADRs, use subdirectories:

```
contributing/decisions/   # or docs/decisions/
  backend/
    2025-06-15-use-postgres.md
  frontend/
    2025-06-20-use-react.md
  infrastructure/
    2025-07-01-use-terraform.md
```

Date prefixes are local to each category. Choose a categorization scheme early (by architectural layer, by domain, by team) and document it in the index.

Alternative: use tags or a flat structure with a searchable index. Subdirectories are simpler and work with all tools.
