---
name: adr-skill
description: Create and maintain Architecture Decision Records (ADRs) optimized for agentic coding workflows. Use when you need to propose, write, update, accept/reject, deprecate, or supersede an ADR; bootstrap an adr folder and index; consult existing ADRs before implementing changes; or enforce ADR conventions. This skill uses Socratic questioning to capture intent before drafting, and validates output against an agent-readiness checklist.
metadata:
  internal: true
---

# ADR Skill

## Philosophy

ADRs created with this skill are **executable specifications for coding agents**. A human approves the decision; an agent implements it. The ADR must contain everything the agent needs to write correct code without asking follow-up questions.

This means:

- Constraints must be explicit and measurable, not vibes
- Decisions must be specific enough to act on ("use PostgreSQL 16 with pgvector" not "use a database")
- Consequences must map to concrete follow-up tasks
- Non-goals must be stated to prevent scope creep
- The ADR must be self-contained — no tribal knowledge assumptions
- **The ADR must include an implementation plan** — which files to touch, which patterns to follow, which tests to write, and how to verify the decision was implemented correctly

## When to Write an ADR

Write an ADR when a decision:

- **Changes how the system is built or operated** (new dependency, architecture pattern, infrastructure choice, API design)
- **Is hard to reverse** once code is written against it
- **Affects other people or agents** who will work in this codebase later
- **Has real alternatives** that were considered and rejected

Do NOT write an ADR for:

- Routine implementation choices within an established pattern
- Bug fixes or typo corrections
- Decisions already captured in an existing ADR (update it instead)
- Style preferences already covered by linters or formatters

When in doubt: if a future agent working in this codebase would benefit from knowing _why_ this choice was made, write the ADR.

### Proactive ADR Triggers (For Agents)

If you are an agent coding in a repo and you encounter any of these situations, **stop and propose an ADR** before continuing:

- You are about to introduce a new dependency that doesn't already exist in the project
- You are about to create a new architectural pattern (new way of handling errors, new data access layer, new API convention) that other code will need to follow
- You are about to make a choice between two or more real alternatives and the tradeoffs are non-obvious
- You are about to change something that contradicts an existing accepted ADR
- You realize you're writing a long code comment explaining "why" — that reasoning belongs in an ADR

**How to propose**: Tell the human what decision you've hit, why it matters, and ask if they want to capture it as an ADR. If yes, run the full four-phase workflow. If no, note the decision in a code comment and move on.

## Creating an ADR: Four-Phase Workflow

Every ADR goes through four phases. Do not skip phases.

### Phase 0: Scan the Codebase

Before asking any questions, gather context from the repo:

1. **Find existing ADRs.** Check `contributing/decisions/`, `docs/decisions/`, `adr/`, `docs/adr/`, `decisions/` for existing records. Read them. Note:
   - Existing conventions (directory, naming, template style)
   - Decisions that relate to or constrain the current one
   - Any ADRs this new decision might supersede

2. **Check the tech stack.** Read `package.json`, `go.mod`, `requirements.txt`, `Cargo.toml`, or equivalent. Note relevant dependencies and versions.

3. **Find related code patterns.** If the decision involves a specific area (e.g., "how we handle auth"), scan for existing implementations. Identify the specific files, directories, and patterns that will be affected by the decision.

4. **Check for ADR references in code.** Look for ADR references in comments and docs (see "Code ↔ ADR Linking" below). This reveals which existing decisions govern which parts of the codebase.

5. **Note what you found.** Carry this context into Phase 1 — it will sharpen your questions and prevent the ADR from contradicting existing decisions.

### Phase 1: Capture Intent (Socratic)

Interview the human to understand the decision space. Ask questions **one at a time**, building on previous answers. Do not dump a list of questions.

**Core questions** (ask in roughly this order, skip what's already clear from context or Phase 0):

1. **What are you deciding?** — Get a short, specific title. Push for a verb phrase ("Choose X", "Adopt Y", "Replace Z with W").
2. **Why now?** — What broke, what's changing, or what will break if you do nothing? This is the trigger.
3. **What constraints exist?** — Tech stack, timeline, budget, team size, existing code, compliance. Be concrete. Reference what you found in Phase 0 ("I see you're already using X — does that constrain this?").
4. **What does success look like?** — Measurable outcomes. Push past "it works" to specifics (latency, throughput, DX, maintenance burden).
5. **What options have you considered?** — At least two. For each: what's the core tradeoff? If they only have one option, help them articulate why alternatives were rejected.
6. **What's your current lean?** — Capture gut intuition early. Often reveals unstated priorities.
7. **Who needs to know or approve?** — Decision-makers, consulted experts, informed stakeholders.
8. **What would an agent need to implement this?** — Which files/directories are affected? What existing patterns should it follow? What should it avoid? What tests would prove it's working? This directly feeds the Implementation Plan.

**Adaptive follow-ups**: Based on answers, probe deeper where the decision is fuzzy. Common follow-ups:

- "What's the worst-case outcome if this decision is wrong?"
- "What would make you revisit this in 6 months?"
- "Is there anything you're explicitly choosing NOT to do?"
- "What prior art or existing patterns in the codebase does this relate to?"
- "I found [existing ADR/pattern] — does this new decision interact with it?"

**When to stop**: You have enough when you can fill every section of the ADR — including the Implementation Plan — without making things up. If you're guessing at any section, ask another question.

**Intent Summary Gate**: Before moving to Phase 2, present a structured summary of what you captured and ask the human to confirm or correct it:

> **Here's what I'm capturing for the ADR:**
>
> - **Title**: {title}
> - **Trigger**: {why now}
> - **Constraints**: {list}
> - **Options**: {option 1} vs {option 2} [vs ...]
> - **Lean**: {which option and why}
> - **Non-goals**: {what's explicitly out of scope}
> - **Related ADRs/code**: {what exists that this interacts with}
> - **Affected files/areas**: {where in the codebase this lands}
> - **Verification**: {how we'll know it's implemented correctly}
>
> **Does this capture your intent? Anything to add or correct?**

Do NOT proceed to Phase 2 until the human confirms the summary.

### Phase 2: Draft the ADR

1. **Choose the ADR directory.**
   - If one exists (found in Phase 0), use it.
   - If none exists, create `contributing/decisions/` (if `contributing/` exists), `docs/decisions/` (MADR default), or `adr/` (simpler repos).

2. **Choose a filename strategy.**
   - If existing ADRs use date prefixes (`YYYY-MM-DD-...`), continue that.
   - Otherwise use slug-only filenames (`choose-database.md`).

3. **Choose a template.**
   - Use `assets/templates/adr-simple.md` for straightforward decisions (one clear winner, minimal tradeoffs).
   - Use `assets/templates/adr-madr.md` when you need to document multiple options with structured pros/cons/drivers.
   - See `references/template-variants.md` for guidance.

4. **Fill every section from the confirmed intent summary.** Do not leave placeholder text. Every section should contain real content or be removed (optional sections only).

5. **Write the Implementation Plan.** This is the most important section for agent-first ADRs. It tells the next agent exactly what to do. See the template for structure.

6. **Write Verification criteria as checkboxes.** These must be specific enough that an agent can programmatically or manually check each one.

7. **Generate the file.**
   - Preferred: run `scripts/new_adr.js` (handles directory, naming, and optional index updates).
   - If you can't run scripts, copy a template from `assets/templates/` and fill it manually.

### Phase 3: Review Against Checklist

After drafting, review the ADR against the agent-readiness checklist in `references/review-checklist.md`.

**Present the review as a summary**, not a raw checklist dump. Format:

> **ADR Review**
>
> ✅ **Passes**: {list what's solid — e.g., "context is self-contained, implementation plan covers affected files, verification criteria are checkable"}
>
> ⚠️ **Gaps found**:
>
> - {specific gap 1 — e.g., "Implementation Plan doesn't mention test files — which test suite should cover this?"}
> - {specific gap 2}
>
> **Recommendation**: {Ship it / Fix the gaps first / Needs more Phase 1 work}

Only surface failures and notable strengths — do not recite every passing checkbox.

If there are gaps, propose specific fixes. Do not just flag problems — offer solutions and ask the human to approve.

Do not finalize until the ADR passes the checklist or the human explicitly accepts the gaps.

## Consulting ADRs (Read Workflow)

Agents should read existing ADRs **before implementing changes** in a codebase that has them. This is not part of the create-an-ADR workflow — it's a standalone operation any agent should do.

### When to Consult ADRs

- Before starting work on a feature that touches architecture (auth, data layer, API design, infrastructure)
- When you encounter a pattern in the code and wonder "why is it done this way?"
- Before proposing a change that might contradict an existing decision
- When a human says "check the ADRs" or "there's a decision about this"
- When you find an ADR reference in a code comment

### How to Consult ADRs

1. **Find the ADR directory.** Check `contributing/decisions/`, `docs/decisions/`, `adr/`, `docs/adr/`, `decisions/`. Also check for an index file (`README.md` or `index.md`).

2. **Scan titles and statuses.** Read the index or list filenames. Focus on `accepted` ADRs — these are active decisions.

3. **Read relevant ADRs fully.** Don't just read the title — read context, decision, consequences, non-goals, AND the Implementation Plan. The Implementation Plan tells you what patterns to follow and what files are governed by this decision.

4. **Respect the decisions.** If an accepted ADR says "use PostgreSQL," don't propose switching to MongoDB without creating a new ADR that supersedes it. If you find a conflict between what the code does and what the ADR says, flag it to the human.

5. **Follow the Implementation Plan.** When implementing code in an area governed by an ADR, follow the patterns specified in its Implementation Plan. If the plan says "all new queries go through the data-access layer in `src/db/`," do that.

6. **Reference ADRs in your work.** Add ADR references in code comments and PR descriptions (see "Code ↔ ADR Linking" below).

## Code ↔ ADR Linking

ADRs should be bidirectionally linked to the code they govern.

### ADR → Code (in the Implementation Plan)

The Implementation Plan section names specific files, directories, and patterns:

```markdown
## Implementation Plan

- **Affected paths**: `src/db/`, `src/config/database.ts`, `tests/integration/`
- **Pattern**: all database queries go through `src/db/client.ts`
```

### Code → ADR (in comments)

When implementing code guided by an ADR, add a comment referencing it:

```typescript
// ADR: Using better-sqlite3 for test database
// See: docs/decisions/2025-06-15-use-sqlite-for-test-database.md
import Database from 'better-sqlite3';
```

Keep these lightweight — one comment at the entry point, not on every line. The goal is discoverability: when a future agent reads this code, they can find the reasoning.

### Why This Matters

- An agent working in `src/db/` can find which ADRs govern that area
- An agent reading an ADR can find the code that implements it
- When an ADR is superseded, the code references make it easy to find all code that needs updating

## Other Operations

### Update an Existing ADR

1. Identify the intent:
   - **Accept / reject**: change status, add any final context.
   - **Deprecate**: status → `deprecated`, explain replacement path.
   - **Supersede**: create a new ADR, link both ways (old → new, new → old).
   - **Add learnings**: append to `## More Information` with a date stamp. Do not rewrite history.

2. Use `scripts/set_adr_status.js` for status changes (supports YAML front matter, bullet status, and section status).

### Post-Acceptance Lifecycle

After an ADR is accepted:

1. **Create implementation tasks.** Each item in the Implementation Plan and each follow-up in Consequences should become a trackable task (issue, ticket, or TODO).
2. **Reference the ADR in PRs.** Link to the ADR in PR descriptions, e.g. "Implements `contributing/decisions/2025-06-15-use-sqlite-for-test-database.md`."
3. **Add code references.** Add ADR path comments at key implementation points.
4. **Check verification criteria.** Once implementation is complete, walk through the Verification checkboxes. Update the ADR with results in `## More Information`.
5. **Revisit when triggers fire.** If the ADR specified revisit conditions ("if X happens, reconsider"), monitor for those conditions.

### Index

If the repo has an ADR index/log file (often `README.md` or `index.md` in the ADR dir), keep it updated.

Preferred: let `scripts/new_adr.js --update-index` do it. Otherwise:

- Add a bullet entry for the new ADR.
- Keep ordering consistent (numeric if numbered; date or alpha if slugs).

### Bootstrap

When introducing ADRs to a repo that has none:

```bash
node /path/to/adr-skill/scripts/bootstrap_adr.js
```

This creates the directory, an index file, and a filled-out first ADR ("Adopt architecture decision records") with real content explaining why the team is using ADRs. Use `--json` for machine-readable output. Use `--dir` to override the directory name.

### Categories (Large Projects)

For repos with many ADRs, organize by subdirectory:

```
docs/decisions/
  backend/
    2025-06-15-use-postgres.md
  frontend/
    2025-06-20-use-react.md
  infrastructure/
    2025-07-01-use-terraform.md
```

Date prefixes are local to each category. Choose a categorization scheme early (by layer, by domain, by team) and document it in the index.

## Resources

### scripts/

- `scripts/new_adr.js` — create a new ADR file from a template, using repo conventions.
- `scripts/set_adr_status.js` — update an ADR status in-place (YAML front matter or inline). Use `--json` for machine output.
- `scripts/bootstrap_adr.js` — create ADR dir, `README.md`, and initial "Adopt ADRs" decision.

### references/

- `references/review-checklist.md` — agent-readiness checklist for Phase 3 review.
- `references/adr-conventions.md` — directory, filename, status, and lifecycle conventions.
- `references/template-variants.md` — when to use simple vs MADR-style templates.
- `references/examples.md` — filled-out short and long ADR examples with implementation plans.

### assets/

- `assets/templates/adr-simple.md` — lean template for straightforward decisions.
- `assets/templates/adr-madr.md` — MADR 4.0 template for decisions with multiple options and structured tradeoffs.
- `assets/templates/adr-readme.md` — default ADR index scaffold used by `scripts/bootstrap_adr.js`.

### Script Usage

From the target repo root:

```bash
# Simple ADR
node /path/to/adr-skill/scripts/new_adr.js --title "Choose database" --status proposed

# MADR-style with options
node /path/to/adr-skill/scripts/new_adr.js --title "Choose database" --template madr --status proposed

# With index update
node /path/to/adr-skill/scripts/new_adr.js --title "Choose database" --status proposed --update-index

# Bootstrap a new repo
node /path/to/adr-skill/scripts/bootstrap_adr.js --dir docs/decisions
```

Notes:

- Scripts auto-detect ADR directory and filename strategy.
- Use `--dir` and `--strategy` to override.
- Use `--json` to emit machine-readable output.
