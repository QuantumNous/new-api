---
status: '{proposed | accepted | rejected | deprecated | superseded by [title](YYYY-MM-DD-title.md)}'
date: { YYYY-MM-DD }
decision-makers: '{list everyone who owns the decision}'
consulted: '{list everyone whose expertise was sought — two-way communication}'
informed: '{list everyone kept up-to-date — one-way communication}'
---

# {short title, representative of solved problem and found solution}

## Context and Problem Statement

{Describe the context and problem statement. Frame it as a question when possible. Link to relevant issues, tickets, or prior ADRs. Include enough background that someone (or an agent) encountering this for the first time can understand why this decision exists without asking follow-up questions.}

<!-- Optional — remove if not needed -->

## Decision Drivers

- {decision driver 1, e.g., a constraint, requirement, or force}
- {decision driver 2}
- …

## Considered Options

- {title of option 1}
- {title of option 2}
- {title of option 3}
- …

## Decision Outcome

Chosen option: "{title of option 1}", because {justification — reference drivers and tradeoffs}.

### Consequences

- Good, because {positive consequence}
- Bad, because {negative consequence}
- Neutral, because {consequence that is neither positive nor negative}
- …

## Implementation Plan

{This section tells an agent exactly what to do to implement this decision. Be specific — an agent should be able to start coding from this without asking follow-up questions.}

- **Affected paths**: {list files and directories that need to change, e.g., `src/db/`, `src/config/database.ts`, `tests/integration/`}
- **Dependencies**: {packages to add/remove/update, e.g., "add `better-sqlite3@11.x`, remove `pg-mem`"}
- **Patterns to follow**: {reference existing code patterns, e.g., "follow the repository pattern in `src/db/repositories/`"}
- **Patterns to avoid**: {what NOT to do, e.g., "do not use raw SQL outside the data-access layer"}
- **Configuration**: {env vars, config files, feature flags to add/change}
- **Migration steps**: {if replacing something, what's the migration path? Can it be done incrementally?}

### Verification

{Checkboxes an agent can validate after implementation. Each must be specific and testable.}

- [ ] {verification criterion 1, e.g., "`npm test` passes with SQLite as the test database"}
- [ ] {verification criterion 2, e.g., "no direct `pg` imports outside `src/db/client.ts`"}
- [ ] {verification criterion 3, e.g., "CI pipeline completes in under 60 seconds"}
- …

<!-- Optional — remove if not needed -->

## Pros and Cons of the Options

### {title of option 1}

{Brief description or link to more information}

- Good, because {argument a}
- Good, because {argument b}
- Neutral, because {argument c}
- Bad, because {argument d}
- …

### {title of option 2}

{Brief description or link to more information}

- Good, because {argument a}
- Good, because {argument b}
- Neutral, because {argument c}
- Bad, because {argument d}
- …

<!-- Optional — remove if not needed -->

## More Information

{Additional context, links to related ADRs, team agreements, implementation notes, or conditions that would trigger revisiting this decision. This section is a catch-all for anything that helps future readers (human or agent) understand the full picture.}
