---
status: '{proposed | accepted | rejected | deprecated | superseded by [title](YYYY-MM-DD-title.md)}'
date: { YYYY-MM-DD }
decision-makers: '{list everyone who owns the decision}'
---

# {short title, representative of solved problem and found solution}

## Context and Problem Statement

{Why does this decision need to happen now? What constraints exist? Include enough background that someone (or an agent) reading this for the first time can understand without follow-up questions.}

## Decision

{What are we choosing to do? Be specific — include scope and non-goals.}

## Consequences

- Good, because {positive consequence}
- Bad, because {negative consequence}
- …

## Implementation Plan

- **Affected paths**: {files and directories that change}
- **Dependencies**: {packages to add/remove/update}
- **Patterns to follow**: {existing code patterns to match}
- **Patterns to avoid**: {what NOT to do}

### Verification

- [ ] {how to confirm the decision was implemented correctly}
- [ ] {another verification criterion}

<!-- Optional — remove if not needed -->

## Alternatives Considered

- {Alternative 1}: {Why it was rejected, in one or two sentences.}
- {Alternative 2}: {Why it was rejected.}

<!-- Optional — remove if not needed -->

## More Information

{Related ADRs, PRs, issues, docs, or conditions that would trigger revisiting this decision.}
