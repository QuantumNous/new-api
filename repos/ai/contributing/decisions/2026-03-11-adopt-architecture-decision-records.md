---
status: accepted
date: 2026-03-11
decision-makers:
---

# Adopt architecture decision records

## Context and Problem Statement

Architecture decisions in this project are made implicitly — through code, conversations, and tribal knowledge. When a new contributor (human or AI agent) joins the codebase, there is no record of _why_ things are built the way they are. This makes it hard to:

- Understand whether a pattern is intentional or accidental
- Know if a past decision still applies or has been superseded
- Avoid relitigating decisions that were already carefully considered

We need a lightweight, version-controlled way to capture decisions where the code lives.

## Decision

Adopt Architecture Decision Records (ADRs) using the MADR 4.0 format, stored in `contributing/decisions/`.

Conventions:

- One ADR per file, named `YYYY-MM-DD-title-with-dashes.md`
- New ADRs start as `proposed`, move to `accepted` or `rejected`
- Superseded ADRs link to their replacement
- ADRs are written to be self-contained — a coding agent should be able to read one and implement the decision without further context

## Consequences

- Good, because decisions are discoverable and version-controlled alongside the code
- Good, because new contributors (human or agent) can understand the "why" behind architecture choices
- Good, because the team builds a shared decision log that prevents relitigating settled questions
- Bad, because writing ADRs takes time — though a good ADR saves more time than it costs
- Neutral, because ADRs require periodic review to mark outdated decisions as deprecated or superseded

## Alternatives Considered

- No formal records: Continue making decisions in conversations and code comments. Rejected because context is lost and decisions get relitigated.
- Wiki or Notion pages: Capture decisions outside the repo. Rejected because they drift out of sync with the code and are not version-controlled.
- Lightweight RFCs: More heavyweight process with formal review cycles. Rejected as overkill for most decisions — ADRs can scale up to RFC-level detail when needed.

## More Information

- MADR: <https://adr.github.io/madr/>
- Michael Nygard, "Documenting Architecture Decisions": <https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions>
