# Architecture Decision Records (ADR)

This directory holds one-page records of architectural decisions we've made for DeepRouter + smart-router. Each ADR explains **why** we chose a path, not **how** the code currently works (that's in `ARCHITECTURE.md`, `CLAUDE.md`, and per-package READMEs).

Read an ADR when:
- You're about to revisit a decision ("why did we do it this way?").
- You want to know what alternatives were ruled out and on what grounds.
- You're an LLM trying to give the user a reasoned recommendation that doesn't accidentally undo a load-bearing decision.

## Index

| # | Title | Status | Affects |
|---|---|---|---|
| [0001](./0001-license-process-boundary.md) | AGPL/Apache process boundary (two-repo split) | Accepted | both repos |
| [0002](./0002-two-layer-routing.md) | Two-layer routing: model vs channel | Accepted | both repos |
| [0003](./0003-sidecar-topology.md) | smart-router as per-instance sidecar | Accepted | both repos |
| [0004](./0004-channel-key-plaintext.md) | Channel API keys stored plaintext | Accepted (with future trigger) | deeprouter |
| [0005](./0005-triple-db-compatibility.md) | SQLite + MySQL + PostgreSQL compatibility is a hard constraint | Accepted (inherited) | deeprouter |
| [0006](./0006-internal-isolation.md) | Fork-specific code lives in `internal/` | Accepted | deeprouter |

## Template

Each ADR follows:

1. **Title + ID** (`NNNN-kebab-case-name`)
2. **Status** — Proposed / Accepted / Superseded / Deprecated
3. **Date** — when accepted
4. **Context** — what forced the decision (constraint, tension, options)
5. **Decision** — what we chose, in one paragraph
6. **Consequences** — good, bad, and neutral effects
7. **Alternatives considered** — what we ruled out and why
8. **Trigger to revisit** — what would make us reopen this

When updating an ADR, don't rewrite history. If a decision is changing, add a new ADR that supersedes the old one (and set the old one's status to "Superseded by NNNN").
