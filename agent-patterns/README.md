# Agent Pattern Notes

This directory stores small, evidence-backed notes distilled from project code plus the version-pinned upstream source under `repos/`. The goal is to avoid repeatedly rediscovering library behavior and to keep generated code aligned with real implementations and tests.

## Workflow

1. Read the applicable `AGENTS.md`, the project call sites, and the nearest project tests.
2. Locate the matching dependency and ref in `repos/README.md`.
3. Read the relevant upstream implementation and at least one corresponding test or maintained example. Trace lifecycle, error, cleanup, and boundary behavior instead of stopping at the public type signature.
4. Search this directory for an existing note. Update it when the evidence changed; otherwise add a narrowly named Markdown file.
5. Implement in application directories only. Adapt the upstream idiom to project rules rather than copying it blindly.
6. Run focused project tests and the required package checks. Record stable verification commands in the note when they are useful for future work.

## Required Note Shape

```md
# <Focused pattern>

- Scope: <where this applies in new-api>
- Dependency refs: <package version or subtree ref>
- Project evidence: <exact paths>
- Upstream implementation: <exact repos/... paths>
- Upstream tests/examples: <exact repos/... paths>

## Observed pattern
<behavior and lifecycle, in concise prose or a small example>

## Project adaptation
<rules, wrappers, or constraints specific to this project>

## Avoid
<known incorrect or misleading alternatives>

## Verification
<focused commands and observable assertions>
```

Use exact relative paths so another agent can verify the claim. Prefer paraphrase over copied source, and split notes by stable behavior rather than by a one-off task or ticket.

## Initial Notes

- `backend-library-boundaries.md` covers Gin, GORM, Redis, WebAuthn, and Testify integration boundaries.
- `default-frontend-library-boundaries.md` covers Base UI, React Query, React Hook Form/Zod, Zustand, and react-i18next behavior used by `web/`.
