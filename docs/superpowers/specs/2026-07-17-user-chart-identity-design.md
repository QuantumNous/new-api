# User Chart Identity Design

## Context

The user consumption ranking and trend charts currently prefer `display_name` as both the visible label and the aggregation key. Because display names are not unique, two different users with the same display name can be merged into one chart series and their quota totals can be added together incorrectly.

## Decision

Chart aggregation will use a stable user identity derived from `user_id`. The visible label remains presentation-only:

- Use `display_name` when present; otherwise fall back to `username`.
- When multiple user IDs share the same visible display name, disambiguate each label with its username, for example `用户显示名称A（用户名1）` and `用户显示名称A（用户名2）`.
- If a legacy row has no `user_id`, use `username` as the identity fallback so existing data remains usable.

## Data Flow

`processUserChartData` will build three separate concepts:

1. A stable identity key used by quota totals, top-user selection, time-series aggregation, and color assignment.
2. A base label derived from `display_name || username || 'unknown'`.
3. A final unique presentation label. Duplicate base labels receive the username suffix; non-duplicate labels remain unchanged.

Both ranking and trend output will use the same final label map, so the bar chart, legend, tooltip, series colors, and trend points remain consistent.

## Compatibility and Scope

The backend response and TypeScript API types do not change. The fix is limited to chart processing and its regression test. It does not alter database storage, user records, filtering behavior, or unrelated dashboard charts.

## Testing

Add a deterministic regression test containing two different `user_id` values with the same `display_name` and different usernames. The test must first demonstrate the current incorrect merge, then verify that:

- two ranking entries remain;
- quota totals are not combined;
- the labels use the approved `显示名称（用户名）` format;
- two independent trend series remain.

Run the targeted chart test, frontend type checking, changed-file lint and formatting checks, the frontend production build, and the full Go test suite before creating the pull request.
