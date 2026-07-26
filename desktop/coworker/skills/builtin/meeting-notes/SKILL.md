---
name: meeting-notes
description: Turn meeting transcripts, chat logs, or rough notes into structured minutes — decisions, action items with owners and due dates, and follow-ups. Use when asked to summarize a meeting, produce minutes, or extract action items.
---

# Meeting notes & minutes

Turn raw meeting material (transcript file, pasted text, Slack thread, Granola notes) into minutes the team can act on.

## Workflow

1. Ingest the source: read the file the user points at, or pull the thread/channel via the Slack tools if connected. If no source is given, ask for it.
2. Extract, in this order:
   - **Decisions** — what was agreed, verbatim where wording matters.
   - **Action items** — `owner → task (due date)`. Only name an owner the source actually assigns; mark unassigned items as `TBD`.
   - **Open questions** — raised but unresolved.
   - **Summary** — 3–6 sentences of narrative context, written last.
3. Produce the deliverable in this shape:

```markdown
# <Meeting title> — <date>
**Attendees:** …

## Summary
…

## Decisions
- …

## Action items
- [ ] @owner — task (due: …)

## Open questions
- …
```

4. Deliver in the format asked: markdown file in the workspace by default; a .docx via the `docx-report` skill when the user wants a document; a Slack reply via `send_message` when the request came from a thread.
5. Offer follow-through, and only act on it with approval: calendar holds for deadlines (Google Calendar connector), or posting action items back to the channel.

## Guidelines

- Never invent attendees, owners, or dates that are not in the source; minutes are a record, not a guess. Quote ambiguous decisions rather than paraphrasing them.
- Keep action items atomic — one owner, one task each.
- Long transcripts: process in chunks, collect candidate decisions/actions per chunk, then merge and dedupe before writing the final minutes.
- Preserve the meeting's language: Chinese transcript → Chinese minutes, unless the user asks otherwise.
