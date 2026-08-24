# Recall History Baseline Repair Design

## Status

- Approved in conversation on 2026-08-03 as option A.
- This is a regression repair for Activity Operations after PR #624.
- Implementation starts from `origin/main` at `e6977ecdf` on branch `fix/recall-history-baseline-and-translation-empty-20260803`.

## Problem and Evidence

Two production-visible regressions share the same release boundary but have separate causes.

First, historical accepted and failed email metrics disappeared even though the `recall_messages` rows still exist. The new card, drawer, and CSV contract reads append-only `recall_events` with `event_type = message_state_changed`. Activity 14 produced a metric snapshot with `message_state_event_max_id = 0`, so all message-state results were empty. The existing baseline reconciler only selects `recall_messages.state_version = 0`. Some historical rows already have `state_version > 0` but no corresponding message-state event, so the reconciler incorrectly treats them as complete.

Second, opening a saved campaign that has never created a translation task automatically requests `GET /api/recall-campaigns/:id/email-translations/tasks/latest`. The backend returns 404 for this normal empty state, and the global Axios interceptor displays `recall translation task not found`.

## Decision

Repair the event baseline rather than adding a legacy metric fallback or a one-time production SQL script.

The alternatives were rejected because a legacy-table fallback would split the card, drawer, snapshot, and CSV definitions, while a one-time SQL script would not repair another environment or protect against the same incomplete baseline state recurring.

## Message-State Baseline Repair

### Detection

A Recall message is unbaselined when either:

1. `recall_messages.state_version = 0`; or
2. no `recall_events` row exists for that message with `event_type = message_state_changed` and `source = message_state`.

The campaign-local readiness check and the bounded global reconciler must use the same definition. The missing-event predicate is expressed through GORM and a `NOT EXISTS` subquery that works on SQLite, MySQL, and PostgreSQL.

This repair targets the observed corrupt historical shape: a message has no state events at all. It does not synthesize arbitrary intermediate transitions or rewrite existing event history.

### Reconciliation

The existing `state_version = 0` path remains unchanged: atomically advance the version to 1 and emit a version-1 baseline event.

For `state_version > 0` rows with no state event:

- keep the stored version unchanged;
- emit a baseline event from the empty state to the message's current state;
- use the existing stable source key `<message_id>:<state_version>`;
- preserve the current campaign, recipient, message, stage, failure code, and database timestamp fields.

The existing unique index on `(source, source_event_id)` and conflict-safe event insertion make the repair idempotent across repeated runs and concurrent application instances. A duplicate insert is accepted only if a matching event now exists; an absent event after the attempted repair remains an error. No schema migration is required.

### Metric Behavior

Before issuing a new message-grain snapshot, the metric path continues to return its existing retry signal while any matching unbaselined message remains. The scheduler's bounded reconciliation then repairs the rows. A refreshed metric snapshot includes the new event high-water mark, restoring accepted/failed totals, drill-down rows, and CSV export from one source of truth.

Previously issued snapshots remain immutable and are not rewritten.

## Empty Latest Translation Task

`GET /api/recall-campaigns/:id/email-translations/tasks/latest` treats `gorm.ErrRecordNotFound` as a normal empty collection state:

```json
{
  "success": true,
  "message": "",
  "data": null
}
```

The frontend return type becomes `ApiResponse<RecallTranslationTask | null>`. The existing editor already ignores a falsy task, so it performs no polling and shows no error toast.

`GET /api/recall-campaigns/:id/email-translations/tasks/:task_id` keeps its 404 behavior because a specifically requested missing task is an error.

## Tests

Implementation follows red-green TDD.

Backend message-state tests will prove that:

- an accepted message with `state_version = 1` and no event is counted as unbaselined;
- reconciliation emits one accepted baseline event without incrementing its version;
- a second reconciliation is a no-op and produces no duplicate event;
- the repaired event restores the accepted message metric and drill-down row;
- the existing `state_version = 0` behavior remains intact.

Translation tests will prove that:

- `latest` with no task returns HTTP 200 and `data: null`;
- lookup by a missing explicit task ID still returns HTTP 404;
- the frontend API accepts `null`, and the editor does not start active polling for it.

Targeted model, service/controller, frontend unit, typecheck, and production build checks are required before the PR is opened.

## Deployment and Risk

This changes Console backend, Console frontend, and a database-backed maintenance job. It does not change `/v1` relay behavior, provider routing, quota settlement, or shared router request handling.

- Router deploy: not required.
- Other deploy targets: `newapi-console` is required; staging should be validated before production.
- Database migration: none.
- Main risk: an overly broad missing-event predicate could create misleading history. The repair is therefore limited to messages with no message-state event at all and records only their current state as a baseline.

## Acceptance Criteria

- Activity 14's accepted emails reappear without modifying or deleting its message rows.
- Accepted and failed cards, drawers, and CSV exports agree after a fresh snapshot.
- Repeated or concurrent reconciliation does not create duplicate events.
- Opening a campaign with no translation history produces no `recall translation task not found` toast.
- Explicit missing translation-task lookup still returns 404.
- SQLite tests pass, and the query shape remains portable to MySQL and PostgreSQL.
