# Recall registration time range group filter

## Goal

Let an administrator narrow the existing `registration_time_range` recall audience by user group, including `Allow -> PLG`, without adding a new audience template or changing the template's other eligibility rules.

## Chosen design

- Reuse the campaign editor's existing group mode and group selector controls for `registration_time_range`.
- Keep the group filter optional. An empty group mode and empty group list preserve the current behavior and include every group.
- When groups are configured, validate the same contract used by the existing recall templates: `allow` or `block`, a non-empty group list, and no blank group names.
- Apply the existing `recallAudienceGroupAllowed` predicate during preview and snapshot selection. `allow + ["plg"]` includes only PLG users; `block + ["plg"]` excludes PLG users.
- Continue to ignore usage, payment, subscription, and verified-email conditions for this template. Only the registration range, basic safety exclusions, and the newly optional group filter affect eligibility.

## Compatibility

Existing saved campaigns with no group configuration keep their current audience. No schema migration or API shape change is required because `group_mode` and `groups` already exist in `audience_config`.

## Alternatives rejected

- Add a separate PLG-only audience template: duplicates the existing grouping model and makes future group choices harder.
- Add a dedicated PLG checkbox: couples recall campaigns to one group name and cannot express other allow/block selections.

## Verification

- Frontend component test proves `registration_time_range` renders the existing group mode control and reveals the selector when a mode is selected.
- Frontend schema test proves invalid group configurations are rejected for this template.
- Backend validation test proves the same group contract is enforced.
- Backend preview/snapshot test proves `allow + plg` excludes a non-PLG user while retaining otherwise eligible PLG users.
