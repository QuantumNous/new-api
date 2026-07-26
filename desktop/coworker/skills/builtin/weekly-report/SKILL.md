---
name: weekly-report
description: Compile weekly reports, morning briefs, or status digests by aggregating activity from connected tools (Slack, email, calendar, GitHub) and workspace files. Use for "write my weekly report", "morning brief", or recurring status updates.
---

# Weekly report & status digest

Aggregate what actually happened, then write a tight report. Built for one-off requests and for scheduled automations ("every Friday 17:00").

## Workflow

1. Establish scope: period covered (default: last 7 days), audience (manager, team, self), and delivery target (file, email draft, Slack message).
2. Gather evidence — use whichever sources are connected, in parallel where possible:
   - **Slack**: catch up on the channels the session subscribes to; pull threads the user was active in.
   - **Email** (Gmail/Outlook): sent mail and flagged threads for the period.
   - **Calendar**: meetings attended and upcoming ones worth flagging.
   - **GitHub/Jira/Linear**: merged PRs, closed issues, tickets moved.
   - **Workspace**: files and notes changed during the period.
3. Write the report:

```markdown
# Weekly report — <name>, <week range>

## Done
- <outcome, not activity — "shipped X", not "worked on X">

## In progress
- <item — state, next step>

## Blocked / needs decision
- <item — who/what unblocks it>

## Next week
- <top 3 priorities>
```

4. Deliver: markdown file in the workspace by default; `send_message` for Slack delivery; an email draft when asked (never send without approval).
5. When the user wants this regularly, offer to set up a scheduled automation for it (the scheduling tools are available in knowledge sessions).

## Guidelines

- Every "Done" line should trace back to evidence gathered in step 2; do not pad. If a section is empty, keep it and write "—" rather than inventing content.
- Lead with outcomes and numbers ("closed 7 tickets, cut p95 by 30%"); drop process narration.
- Keep the whole report under ~250 words unless the user asks for detail; long weeks get an appendix, not a longer body.
- A morning brief is the same structure compressed: yesterday / today / blockers, under 120 words.
- Match the user's language and any prior report format found in the workspace.
