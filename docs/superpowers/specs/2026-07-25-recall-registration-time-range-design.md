# Recall registration time range audience

## Goal

Add a distinct `registration_time_range` audience template that selects users only by an inclusive account registration timestamp range. Preserve the existing `registered_only` template and fix its datetime inputs so start and end values do not disappear on blur.

## Chosen design

- Keep `registered_only` unchanged: registration range, no successful payment, and no API requests.
- Add `registration_time_range`: include every enabled user whose `created_at` is between the selected start and end, regardless of API usage, payment history, subscription history, user group, or email-verification state.
- Continue mandatory delivery protections for the new template: exclude disabled users, invalid email addresses, and users who opted out of recall marketing.
- Show both templates' start and end inputs inside one full-width **Registration time range** fieldset.
- Bind transformed `datetime-local` values with React Hook Form `Controller`. The visible value remains a local datetime string while form state remains Unix seconds, so blur cannot overwrite the numeric value with a raw string.

## Alternatives rejected

- Reuse `registered_only` for the broader behavior: rejected because it would silently enlarge existing saved campaigns.
- Re-expose separate ungrouped datetime inputs: rejected because it does not make the required range relationship clear.
- Add a date-range dependency: rejected because the existing native inputs are sufficient and a new dependency is unnecessary.

## Validation and selection

- Both templates require positive start and end timestamps.
- End must be equal to or later than start.
- Range boundaries are inclusive.
- Repository selection for `registration_time_range` filters only on `users.created_at`; it must not add request, payment, subscription, group, or verified-email predicates.
- Preview and snapshot use the same selection and mandatory delivery protections.

## Verification

- Frontend regression: select start, blur, select end, blur, and submit; both Unix timestamps remain present.
- Frontend schema and editor tests cover the new template and shared range fieldset.
- Backend repository and service tests prove in-range users remain eligible despite API usage, successful payment, active subscription, group, or unverified email, while disabled, invalid-email, and opted-out users remain excluded.
- Existing `registered_only` tests remain unchanged to prevent semantic drift.
