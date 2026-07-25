# Recall Audience Group Multiselect Design

## Goal

Allow operators to target any configured user groups in every recall audience template, including `first_purchase`, and replace the free-form comma-separated group field with a searchable multi-select.

## Current problem

The backend currently rejects every non-`plg` user for `first_purchase` before applying the operator-configured group filter. The UI still exposes `No group filter`, `Allow groups`, and `Block groups`, so selecting a non-PLG group cannot work even though the form implies it can. The first-purchase help text exposes this hidden restriction instead of explaining the operator-controlled group filter.

## Approved behavior

- Audience templates define lifecycle conditions only. `first_purchase` means a registered user who has never paid and satisfies its configured thresholds; it does not imply a user group.
- `No group filter` includes eligible users from every group. The multi-select is visible, empty, and disabled.
- `Allow groups` includes only eligible users whose group is selected. At least one selected group remains required by the existing schema and backend validation.
- `Block groups` excludes eligible users whose group is selected. At least one selected group remains required.
- The selectable values come from the existing admin endpoint `GET /api/group/?type=user`, which is the authoritative assignable user-group list.
- Operators cannot create arbitrary group names from this control. Saved values that are no longer returned by the endpoint remain visible as selected fallback values when editing an existing draft.
- The help text says that templates define lifecycle eligibility and that the group mode plus multi-select determine which groups are included or excluded.

## Frontend design

Create a focused `CampaignGroupSelector` next to `CampaignProductSelector`. It owns the React Query request, converts returned strings to `MultiSelect` options, preserves selected fallback values, and renders loading, error, and empty states. `CampaignEditor` continues to own form state and passes `groups`, `groupMode`, `onChange`, and `immutable` into the selector.

The existing `MultiSelect` component is reused with `allowCreate` disabled. The selector is disabled while the campaign is immutable, group mode is `No group filter`, or the authoritative group list is unavailable. Switching to `No group filter` continues to clear stale selections through the existing helper.

## Backend design

Remove only the implicit `user.Group == "plg"` check from recall eligibility. Keep `recallAudienceGroupAllowed` unchanged so `allow` and `block` remain the single source of group behavior for all templates.

## Internationalization

Replace the PLG-specific first-purchase description and add selector status/help strings in all eight console locale files: `en`, `zh`, `es`, `fr`, `pt`, `ru`, `ja`, and `vi`. English remains the source key.

## Verification

- Backend regression tests prove that `first_purchase` accepts eligible users from multiple groups with no filter and respects explicit allow/block selections.
- Frontend component tests prove that configured groups render as multi-select options, no-filter disables the control, selected unavailable values remain visible, and loading/error/empty states are explained.
- Editor and copy tests prove the PLG wording is removed and the multi-select is integrated.
- Run targeted Go and Bun tests, Go build/vet, TypeScript typecheck, targeted ESLint/Prettier, i18n sync inspection, and production frontend build.

## Scope exclusions

- No change to campaign persistence schema or API payload shape.
- No change to payment-provider filters, audience thresholds, product selection, coupon behavior, or email localization.
- No arbitrary group creation from the recall editor.
