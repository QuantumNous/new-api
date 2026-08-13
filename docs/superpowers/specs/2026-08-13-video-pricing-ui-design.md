# Video Per-Second Pricing UI Design

## Decision

Add a fourth billing mode, `video`, to the model pricing sheet. Selecting it
expands an inline rule table where an administrator edits the per-second price
rules that already drive video billing.

This is a frontend-only change. The backend already stores, validates, and
serves these rules; the UI is a visual editor for an option key that is
currently only reachable through the API.

## Goal

Make the video price table editable in the console. Today an administrator must
`PUT /api/option/` by hand with a 7691-character JSON payload, which offers no
value-domain help and no feedback short of a rejected save.

## Why no backend change

`billing_setting_video.video_price_rules` is already:

- persisted as an option key,
- normalized and strictly validated on save through
  `billing_setting.UpdateVideoPriceSettingFromMap`,
- read by every video adapter via `GetVideoPriceRules`.

The UI reads and writes that same key. Rule validity stays a backend concern:
the frontend checks only presence and number format, and surfaces the backend's
rejection message otherwise.

Duplicating the rule checks in TypeScript would create a second source of truth
for what a valid rule is. That has already bitten this feature once — the
resolution vocabulary is deliberately duplicated between `taskcommon` and
`billing_setting` because the import direction forbids sharing, and the two
drifted until a reachability test pinned them together. A third copy in the
browser would drift the same way, and the failure is silent: a rule the UI
accepts but the matcher never matches rejects every request for that model.

## Scope

In scope: the `web/default` model pricing sheet and a new rule editor component.

Out of scope: `web/classic` (unchanged, per the existing decision to ship only
the default theme); the public pricing page; any backend file.

## Data flow

```
read   GET  /api/option/  -> billing_setting_video.video_price_rules
write  PUT  /api/option/  -> same key
                             -> UpdateVideoPriceSettingFromMap
                                normalize values, reject ambiguity,
                                reject unknown dimension values
```

Two option keys are written, never merged into one request:

- `billing_setting_video.video_price_rules` — the rule list.
- `ModelPrice` — the calculation base.

**`ModelPrice` must be merged, not replaced.** Production holds 102 entries for
unrelated models; a whole-object write would erase every one of them. The editor
reads the current object, changes only the affected model's key, and writes the
merged result.

## ModelPrice handling

Selecting `video` mode writes `ModelPrice = 1` for that model if it has no value
yet. An existing value is left alone.

The field is not shown. `ComputeSecondBilling` computes
`price_per_second * seconds / ModelPrice` and the surrounding chain multiplies
`ModelPrice` back in, so the value cancels and cannot change what a customer
pays. Exposing a number that looks like a price but does not behave like one
invites misreading.

It is not optional, though: a non-positive or non-finite value makes
`ComputeSecondBilling` reject the request outright, and the entry's presence is
what sets `UsePrice` — which is how a model leaves token settlement for
per-second billing. Writing it automatically is what stops an administrator from
saving rules that reject every request.

Two models already carry a deliberate base — `doubao-seedance-2-5-260628` at
`0.14` and `MiniMax-H3` at `0.08`. Overwriting them with `1` would rescale
`video_billing_units` in the logs and break continuity with historical records,
so an existing value is preserved.

## Rule editor

Each rule constrains an open set of dimensions, matching the backend's `match`
map.

```
Match dimensions   [x] resolution   [720p     v]
                   [x] has_video    [yes      v]
                   [ ] mode                        (kling only)

Price per second   $ [0.314]

Basis              (o) output duration
                   ( ) total duration
                       fallback seconds [30]
```

### Dimensions are checkboxes, not blank-means-any

An unchecked dimension is unconstrained. A blank text field cannot distinguish
"any value" from "not filled in yet", and the two have opposite consequences:
the first is a valid wildcard, the second saves a rule the matcher may never
reach.

Channels genuinely differ here, which is why the set is open rather than two
fixed columns:

| Channel | Dimensions |
| --- | --- |
| seedance family, doubao, byteplus, vertex, gemini, ali, vidu | `resolution`, `has_video` |
| kling | `mode` (`std`/`pro`), `has_video` — it has no output resolution parameter |
| xaigrok, sonilo, jimeng | `has_video` only |

Hard-coding two columns would let an administrator write a `resolution` rule for
kling that can never match — and for a configured model, an unmatched rule
rejects every request.

### Values are dropdowns, not free text

Options come from the backend's closed vocabularies: `480p`, `512p`, `720p`,
`768p`, `1080p`, `2k`, `4k` for resolution; `std`, `pro` for mode; yes/no for
`has_video`.

The backend folds case and known aliases, so `4K` would survive a save. `1440p`
would not — it is rejected. A dropdown removes the class of typo entirely rather
than relying on the administrator reading an error.

### Basis is explicit, with no default

`output_duration` multiplies the generated length. `total_duration` multiplies
input plus output, which is how upstreams price a request carrying a reference
video. The two differ by roughly a factor of two on a typical request, so a
default would silently pick a price.

`fallback_seconds` appears only for `total_duration`. Input media length cannot
be determined without fetching customer-controlled URLs, so the reservation uses
this bound instead.

## Component structure

| File | Change | ~Lines |
| --- | --- | ---: |
| `model-pricing-core.ts` | `PricingMode` gains `'video'`; rule types; preview rows | 40 |
| `model-pricing-sheet.tsx` | mode branch, defaults, submit | 50 |
| `model-ratio-visual-editor.tsx` | mode counts, read/write the rules key | 40 |
| `model-pricing-snapshots.ts` | mode label, price summary | 35 |
| `model-ratio-table-columns.tsx` | mode badge | 5 |
| `video-pricing-editor.tsx` (new) | the rule table | 250 |
| i18n × 8 locales | ~20 strings | 160 |

About 580 lines across six edits and one new file.

`tiered-pricing-editor.tsx` is the structural precedent — it is the existing
proof that a fourth mode fits this sheet. Its own body runs to 1877 lines, but
almost all of that is AST parsing, expression evaluation, and a
visual/raw dual editor. A rule table needs none of them.

## Known hazards

These come from implementing the backend half, not from guesswork.

**`ratio-settings-card.tsx` repeats each field in eight places** — schema,
normalize, format, two resets, submit, and a key map. Missing one produces a
field that saves but does not reload, and the type system cannot catch it
because every one of them is a string.

**i18n must cover all eight locales.** `CLAUDE.md` records this as a repeat
source of defects, with es and pt having been missed before. Run
`bun run i18n:sync` and check `locales/_reports/{lang}.untranslated.json` for the
new keys before committing.

**The two option keys are written separately.** `ModelPrice` and the rule list
live under different keys and must not be combined into one request. `ModelPrice`
is read-modify-write.

## Error handling

Backend rejections surface verbatim. The messages already name the offending
rule index, model, and field — for example `video price rules 0 and 1 (model m):
ambiguous, both have 1 constraints and can match the same request`. Rewriting
them in the UI would lose that precision.

A rejected save leaves the live table untouched, so the editor keeps the
administrator's unsaved edits on screen for correction rather than reverting.

Client-side checks are limited to what the backend cannot express positionally:
price present and numerically positive, and `fallback_seconds` present when
`total_duration` is selected.

## Test contract

- Mode switching writes and clears the right option keys.
- `ModelPrice` merge preserves unrelated models; an existing base is not
  overwritten.
- A rule with no checked dimensions saves as a wildcard `{}`.
- `total_duration` requires `fallback_seconds`; `output_duration` omits it.
- A backend rejection is displayed and does not discard unsaved edits.
- All new i18n keys exist in all eight locale files.

## Deployment impact

`Router deploy: not required` — the diff is confined to `web/default`, which the
console serves. `newapi-console` needs the build. No relay path, no migration,
no environment variable.

Multi-node (Rule 11) is not implicated: the editor performs ordinary option
writes through the existing API, and the backend's save path already takes the
module write lock.
