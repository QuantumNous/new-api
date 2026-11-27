# CLAUDE.md — Project Conventions for new-api

At the start of every session and every new task, before planning, coding, reviewing, or answering a project question, Read the repo-root `AGENTS.md` in full with the Read tool. Claude Code does not reliably inline an `@AGENTS.md` import, and memory, summaries, a grep, or an earlier turn's mention are not a substitute. Follow every rule in it for the rest of the work.

- If the task touches `web/`, also Read `web/AGENTS.md` before editing frontend files.
- If the task touches billing as defined under **Billing rules (mandatory read gate)** in `AGENTS.md`, also Read `.agents/rules/billing.md` in full before planning or editing. Tasks outside that definition may skip it.
