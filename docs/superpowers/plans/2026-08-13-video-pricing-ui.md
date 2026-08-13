# Video Pricing UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fourth billing mode, `video`, to the console model pricing sheet, with an inline editor for the per-second price rules that already drive video billing.

**Architecture:** Frontend only. The option key `billing_setting_video.video_price_rules`, its strict save-time validation, and the adapters that read it all exist already. This adds a visual editor for a config that is currently API-only. Rule validity stays a backend concern; the UI surfaces backend rejections verbatim.

**Tech Stack:** React 19, TypeScript, Rsbuild, Base UI, Tailwind. Tests via `bun test` (161 test files already exist in `web/default/src`).

**Spec:** `docs/superpowers/specs/2026-08-13-video-pricing-ui-design.md`

---

## Background For The Implementer

You are working in `web/default`, the console dashboard SPA. **All paths below are relative to `web/default/`** unless stated otherwise.

The model pricing sheet already supports three billing modes: `per-token`,
`per-request`, and `tiered_expr`. You are adding a fourth. `tiered_expr` is the
structural precedent — read how it threads through the files before starting.

**What the backend already does** (do not re-implement any of this):

- Stores rules under option key `billing_setting_video.video_price_rules`.
- On save, folds values to a canonical vocabulary and rejects anything unknown,
  ambiguous, or malformed. Error messages name the rule index and field.
- Reads rules on every video request through `GetVideoPriceRules`.

A rule looks like this:

```json
{
  "model": "doubao-seedance-2-5-260628",
  "match": { "resolution": "720p", "has_video": "true" },
  "price_per_second": 0.188,
  "basis": "total_duration",
  "fallback_seconds": 30
}
```

`match` is an open dimension map. Only the keys present are constrained; absent
keys are wildcards. Channels genuinely differ — most use `resolution` +
`has_video`, `kling` uses `mode` (`std`/`pro`) and has no resolution parameter,
and `xaigrok`/`sonilo`/`jimeng` have only `has_video`.

**Two option keys, written separately:**

- `billing_setting_video.video_price_rules` — the rule list, replaced wholesale.
- `ModelPrice` — **read-modify-write**. Production holds 102 entries for
  unrelated models; a whole-object write erases every one of them.

**Rules that apply** (from the repo's `CLAUDE.md`): Rule 3 (use `bun`), and the
i18n section — new user-visible strings must land in all eight locale files
under `src/i18n/locales/`, with real translations, not English copied across.

---

## File Structure

**New**

| File | Responsibility |
| --- | --- |
| `src/features/system-settings/models/video-pricing-types.ts` | Rule type, canonical vocabularies, serialize/parse helpers |
| `src/features/system-settings/models/video-pricing-types.test.ts` | Tests for the above |
| `src/features/system-settings/models/video-pricing-editor.tsx` | The rule table UI |

**Modified**

| File | Change |
| --- | --- |
| `model-pricing-core.ts` | `PricingMode` gains `'video'`; `ModelRatioData` gains `videoRules` |
| `model-pricing-sheet.tsx` | Mode tab, default on switch, submit wiring |
| `model-ratio-visual-editor.tsx` | Mode counts, read/write the rules key |
| `model-pricing-snapshots.ts` | Mode label and price summary |
| `model-ratio-table-columns.tsx` | Mode badge |
| `src/i18n/locales/*.json` (×8) | New strings |

Types and pure helpers live in their own file so they can be unit-tested without
rendering React. The editor component holds only presentation.

---

## Task 1: Rule Types And Vocabularies

**Files:**
- Create: `src/features/system-settings/models/video-pricing-types.ts`
- Test: `src/features/system-settings/models/video-pricing-types.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/features/system-settings/models/video-pricing-types.test.ts`:

```ts
import { describe, expect, test } from 'bun:test'
import {
  BASIS_OPTIONS,
  DIMENSION_KEYS,
  HAS_VIDEO_VALUES,
  MODE_VALUES,
  RESOLUTION_VALUES,
  createEmptyRule,
  type VideoPriceRule,
} from './video-pricing-types'

describe('video pricing vocabularies', () => {
  test('resolution values match the backend canonical set', () => {
    // setting/billing_setting/video_price.go canonicalResolutions.
    // 2160p is an alias that folds to 4k, so it is not offered separately.
    expect(RESOLUTION_VALUES).toEqual([
      '480p',
      '512p',
      '720p',
      '768p',
      '1080p',
      '2k',
      '4k',
    ])
  })

  test('mode values match the backend canonical set', () => {
    expect(MODE_VALUES).toEqual(['std', 'pro'])
  })

  test('has_video is a string boolean, matching what adapters emit', () => {
    expect(HAS_VIDEO_VALUES).toEqual(['true', 'false'])
  })

  test('dimension keys cover every channel shape', () => {
    expect(DIMENSION_KEYS).toEqual(['resolution', 'has_video', 'mode'])
  })

  test('basis options carry the two backend values', () => {
    expect(BASIS_OPTIONS.map((o) => o.value)).toEqual([
      'output_duration',
      'total_duration',
    ])
  })

  test('a new rule starts with no dimensions constrained', () => {
    const rule: VideoPriceRule = createEmptyRule()
    expect(rule.match).toEqual({})
    expect(rule.basis).toBe('output_duration')
    expect(rule.price_per_second).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web/default && bun test src/features/system-settings/models/video-pricing-types.test.ts`
Expected: FAIL — cannot resolve `./video-pricing-types`.

- [ ] **Step 3: Write minimal implementation**

Create `src/features/system-settings/models/video-pricing-types.ts`:

```ts
/**
 * Mirrors setting/billing_setting/video_price.go.
 *
 * The vocabularies are duplicated rather than fetched because they are a closed
 * set the backend enforces on save. Offering a dropdown removes a class of typo
 * entirely: the backend folds case ("4K" survives) but rejects unknown tiers
 * ("1440p" does not), and a rejected save is a worse experience than never
 * being able to type it.
 */

export type BasisValue = 'output_duration' | 'total_duration'

export type VideoPriceRule = {
  model: string
  match: Record<string, string>
  price_per_second: number
  basis: BasisValue
  fallback_seconds?: number
  source_rate_per_1m_tokens?: number
  assumed_fps?: number
}

// canonicalResolutions in video_price.go. 2160p is an alias folding to 4k, so
// it is not a separate choice.
export const RESOLUTION_VALUES = [
  '480p',
  '512p',
  '720p',
  '768p',
  '1080p',
  '2k',
  '4k',
] as const

// canonicalMode. kling prices by generation mode and has no resolution.
export const MODE_VALUES = ['std', 'pro'] as const

// canonicalHasVideo. Adapters emit string booleans, not JSON booleans.
export const HAS_VIDEO_VALUES = ['true', 'false'] as const

export const DIMENSION_KEYS = ['resolution', 'has_video', 'mode'] as const

export type DimensionKey = (typeof DIMENSION_KEYS)[number]

export const DIMENSION_VALUES: Record<DimensionKey, readonly string[]> = {
  resolution: RESOLUTION_VALUES,
  has_video: HAS_VIDEO_VALUES,
  mode: MODE_VALUES,
}

export const BASIS_OPTIONS: ReadonlyArray<{ value: BasisValue }> = [
  { value: 'output_duration' },
  { value: 'total_duration' },
]

export function createEmptyRule(model = ''): VideoPriceRule {
  return {
    model,
    match: {},
    price_per_second: 0,
    basis: 'output_duration',
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web/default && bun test src/features/system-settings/models/video-pricing-types.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Verify the vocabulary actually matches the backend**

Run from the repo root:

```bash
grep -oE '"[0-9a-z]+p"|"[24]k"' setting/billing_setting/video_price.go | sort -u
```

Expected output includes `"480p" "512p" "720p" "768p" "1080p" "2k" "4k"` plus
`"2160p"`. Confirm your `RESOLUTION_VALUES` lists the seven canonical values and
omits the `2160p` alias. If they disagree, the backend is the source of truth —
fix the TypeScript, not the Go.

- [ ] **Step 6: Commit**

```bash
git add web/default/src/features/system-settings/models/video-pricing-types.ts web/default/src/features/system-settings/models/video-pricing-types.test.ts
git commit -m "Add video price rule types mirroring the backend vocabulary"
```

---

## Task 2: Serialize And Parse Rules For One Model

The editor edits one model's rules; the option key holds every model's. These
helpers convert between the two.

**Files:**
- Modify: `src/features/system-settings/models/video-pricing-types.ts`
- Test: `src/features/system-settings/models/video-pricing-types.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `video-pricing-types.test.ts`:

```ts
import {
  mergeModelRules,
  parseAllRules,
  rulesForModel,
} from './video-pricing-types'

describe('rule serialization', () => {
  const allRules: VideoPriceRule[] = [
    {
      model: 'a',
      match: { resolution: '720p' },
      price_per_second: 0.314,
      basis: 'output_duration',
    },
    {
      model: 'b',
      match: { has_video: 'true' },
      price_per_second: 0.08,
      basis: 'total_duration',
      fallback_seconds: 30,
    },
  ]

  test('parses a stored JSON string', () => {
    expect(parseAllRules(JSON.stringify(allRules))).toEqual(allRules)
  })

  test('an empty or absent value parses to no rules', () => {
    expect(parseAllRules('')).toEqual([])
    expect(parseAllRules('[]')).toEqual([])
    expect(parseAllRules(undefined)).toEqual([])
  })

  test('malformed JSON parses to no rules rather than throwing', () => {
    // A save would overwrite the key anyway; throwing here would break the
    // whole pricing sheet over one bad row.
    expect(parseAllRules('{not json')).toEqual([])
  })

  test('selects only the requested model', () => {
    expect(rulesForModel(allRules, 'a')).toEqual([allRules[0]])
    expect(rulesForModel(allRules, 'missing')).toEqual([])
  })

  test('merging replaces one model and leaves the others untouched', () => {
    const next = mergeModelRules(allRules, 'a', [
      {
        model: 'a',
        match: { resolution: '1080p' },
        price_per_second: 0.5,
        basis: 'output_duration',
      },
    ])
    expect(rulesForModel(next, 'b')).toEqual([allRules[1]])
    expect(rulesForModel(next, 'a')[0].price_per_second).toBe(0.5)
    expect(next).toHaveLength(2)
  })

  test('merging an empty list removes that model entirely', () => {
    const next = mergeModelRules(allRules, 'a', [])
    expect(rulesForModel(next, 'a')).toEqual([])
    expect(rulesForModel(next, 'b')).toEqual([allRules[1]])
  })

  test('merging stamps the model name onto every rule', () => {
    // The editor does not ask the administrator to retype the model per row.
    const next = mergeModelRules([], 'c', [
      { model: '', match: {}, price_per_second: 1, basis: 'output_duration' },
    ])
    expect(next[0].model).toBe('c')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web/default && bun test src/features/system-settings/models/video-pricing-types.test.ts`
Expected: FAIL — `parseAllRules` is not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `video-pricing-types.ts`:

```ts
/**
 * Reads the stored option value. Returns no rules for anything unreadable: a
 * save replaces the key wholesale, so refusing to render the sheet over one
 * malformed row would be a worse failure than starting from empty.
 */
export function parseAllRules(raw: string | undefined): VideoPriceRule[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as VideoPriceRule[]) : []
  } catch {
    return []
  }
}

export function rulesForModel(
  all: VideoPriceRule[],
  model: string,
): VideoPriceRule[] {
  return all.filter((rule) => rule.model === model)
}

/**
 * Replaces one model's rules, preserving every other model's. The editor only
 * ever sees one model, so a wholesale write would delete the rest of the table.
 */
export function mergeModelRules(
  all: VideoPriceRule[],
  model: string,
  next: VideoPriceRule[],
): VideoPriceRule[] {
  const others = all.filter((rule) => rule.model !== model)
  return [...others, ...next.map((rule) => ({ ...rule, model }))]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web/default && bun test src/features/system-settings/models/video-pricing-types.test.ts`
Expected: PASS, 13 tests total.

- [ ] **Step 5: Commit**

```bash
git add web/default/src/features/system-settings/models/video-pricing-types.ts web/default/src/features/system-settings/models/video-pricing-types.test.ts
git commit -m "Serialize video price rules per model without disturbing others"
```

---

## Task 3: Client-Side Rule Checks

Only what the backend cannot express positionally. Everything else — unknown
values, ambiguity — is the backend's job and its messages are better.

**Files:**
- Modify: `src/features/system-settings/models/video-pricing-types.ts`
- Test: `src/features/system-settings/models/video-pricing-types.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `video-pricing-types.test.ts`:

```ts
import { validateRuleDraft } from './video-pricing-types'

describe('client-side rule checks', () => {
  test('accepts a well-formed output_duration rule', () => {
    expect(
      validateRuleDraft({
        model: 'm',
        match: { resolution: '720p' },
        price_per_second: 0.314,
        basis: 'output_duration',
      }),
    ).toBeNull()
  })

  test('rejects a non-positive price', () => {
    for (const price of [0, -1, Number.NaN]) {
      expect(
        validateRuleDraft({
          model: 'm',
          match: {},
          price_per_second: price,
          basis: 'output_duration',
        }),
      ).toBe('price')
    }
  })

  test('total_duration requires a positive fallback', () => {
    expect(
      validateRuleDraft({
        model: 'm',
        match: {},
        price_per_second: 1,
        basis: 'total_duration',
      }),
    ).toBe('fallback')

    expect(
      validateRuleDraft({
        model: 'm',
        match: {},
        price_per_second: 1,
        basis: 'total_duration',
        fallback_seconds: 0,
      }),
    ).toBe('fallback')
  })

  test('output_duration does not require a fallback', () => {
    expect(
      validateRuleDraft({
        model: 'm',
        match: {},
        price_per_second: 1,
        basis: 'output_duration',
      }),
    ).toBeNull()
  })

  test('an unconstrained match is valid — it is a deliberate wildcard', () => {
    expect(
      validateRuleDraft({
        model: 'm',
        match: {},
        price_per_second: 1,
        basis: 'output_duration',
      }),
    ).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web/default && bun test src/features/system-settings/models/video-pricing-types.test.ts`
Expected: FAIL — `validateRuleDraft` is not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `video-pricing-types.ts`:

```ts
export type RuleDraftError = 'price' | 'fallback'

/**
 * Checks only what the backend cannot report positionally against a draft the
 * administrator is still editing. Unknown dimension values and ambiguous rule
 * pairs are deliberately left to the backend, whose messages name the offending
 * rule index and field.
 */
export function validateRuleDraft(rule: VideoPriceRule): RuleDraftError | null {
  if (!Number.isFinite(rule.price_per_second) || rule.price_per_second <= 0) {
    return 'price'
  }
  if (rule.basis === 'total_duration') {
    const fallback = rule.fallback_seconds
    if (!Number.isFinite(fallback ?? Number.NaN) || (fallback ?? 0) <= 0) {
      return 'fallback'
    }
  }
  return null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web/default && bun test src/features/system-settings/models/video-pricing-types.test.ts`
Expected: PASS, 18 tests total.

- [ ] **Step 5: Commit**

```bash
git add web/default/src/features/system-settings/models/video-pricing-types.ts web/default/src/features/system-settings/models/video-pricing-types.test.ts
git commit -m "Check video rule drafts for what the backend cannot report positionally"
```

---

## Task 4: Add The `video` Mode To Core Types

**Files:**
- Modify: `src/features/system-settings/models/model-pricing-core.ts:40` and `:50-63`

- [ ] **Step 1: Read the current definitions**

Run: `sed -n '38,64p' web/default/src/features/system-settings/models/model-pricing-core.ts`

You will see `PricingMode` as a three-value union and `ModelRatioData` carrying
`billingMode` / `billingExpr` / `requestRuleExpr`.

- [ ] **Step 2: Extend the union**

Change line 40 from:

```ts
export type PricingMode = 'per-token' | 'per-request' | 'tiered_expr'
```

to:

```ts
export type PricingMode = 'per-token' | 'per-request' | 'tiered_expr' | 'video'
```

- [ ] **Step 3: Add the rules field to `ModelRatioData`**

Inside the `ModelRatioData` type, after `requestRuleExpr?: string`, add:

```ts
  /** Serialized VideoPriceRule[] for this model only. Empty when not in video mode. */
  videoRules?: string
```

- [ ] **Step 4: Verify the project still type-checks**

Run: `cd web/default && bun run build 2>&1 | tail -20`
Expected: build succeeds. If TypeScript reports non-exhaustive `switch` or
`if/else` chains over `PricingMode`, note each file and line — those are the
call sites Tasks 5-8 must handle. Do not fix them yet.

- [ ] **Step 5: Commit**

```bash
git add web/default/src/features/system-settings/models/model-pricing-core.ts
git commit -m "Add the video billing mode to the pricing type union"
```

---

## Task 5: The Rule Editor Component

**Files:**
- Create: `src/features/system-settings/models/video-pricing-editor.tsx`

- [ ] **Step 1: Read the precedent**

Run:
```bash
sed -n '1,60p' web/default/src/features/system-settings/models/tiered-pricing-editor.tsx
grep -n "useTranslation\|t(" web/default/src/features/system-settings/models/model-pricing-sheet.tsx | head -10
```

Note how the file imports UI primitives and how translation is called. Match
both. Do not invent a new component library or translation pattern.

- [ ] **Step 2: Write the component**

Create `src/features/system-settings/models/video-pricing-editor.tsx`:

```tsx
import { useTranslation } from 'react-i18next'

import {
  BASIS_OPTIONS,
  DIMENSION_KEYS,
  DIMENSION_VALUES,
  createEmptyRule,
  validateRuleDraft,
  type DimensionKey,
  type VideoPriceRule,
} from './video-pricing-types'

type Props = {
  model: string
  rules: VideoPriceRule[]
  onChange: (rules: VideoPriceRule[]) => void
}

/**
 * Edits one model's per-second price rules.
 *
 * Dimensions are checkboxes rather than blank-means-any: a blank field cannot
 * distinguish "matches any value" from "not filled in yet", and those have
 * opposite consequences. An unchecked dimension is an explicit wildcard.
 */
export function VideoPricingEditor({ model, rules, onChange }: Props) {
  const { t } = useTranslation()

  const updateRule = (index: number, next: VideoPriceRule) => {
    onChange(rules.map((rule, i) => (i === index ? next : rule)))
  }

  const toggleDimension = (index: number, key: DimensionKey) => {
    const rule = rules[index]
    const match = { ...rule.match }
    if (key in match) {
      delete match[key]
    } else {
      match[key] = DIMENSION_VALUES[key][0]
    }
    updateRule(index, { ...rule, match })
  }

  const setDimensionValue = (
    index: number,
    key: DimensionKey,
    value: string,
  ) => {
    const rule = rules[index]
    updateRule(index, { ...rule, match: { ...rule.match, [key]: value } })
  }

  return (
    <div className='flex flex-col gap-4'>
      {rules.map((rule, index) => {
        const error = validateRuleDraft(rule)
        return (
          <div
            key={index}
            className='flex flex-col gap-3 rounded-lg border p-4'
          >
            <div className='flex flex-col gap-2'>
              <span className='text-sm font-medium'>
                {t('Match dimensions')}
              </span>
              {DIMENSION_KEYS.map((key) => (
                <label key={key} className='flex items-center gap-2 text-sm'>
                  <input
                    type='checkbox'
                    checked={key in rule.match}
                    onChange={() => toggleDimension(index, key)}
                  />
                  <span className='w-24'>{t(key)}</span>
                  {key in rule.match ? (
                    <select
                      value={rule.match[key]}
                      onChange={(e) =>
                        setDimensionValue(index, key, e.target.value)
                      }
                      className='rounded border px-2 py-1'
                    >
                      {DIMENSION_VALUES[key].map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </label>
              ))}
            </div>

            <label className='flex items-center gap-2 text-sm'>
              <span className='w-32'>{t('Price per second ($)')}</span>
              <input
                type='number'
                step='0.000001'
                min='0'
                value={rule.price_per_second}
                onChange={(e) =>
                  updateRule(index, {
                    ...rule,
                    price_per_second: Number(e.target.value),
                  })
                }
                className='rounded border px-2 py-1'
              />
            </label>

            <div className='flex flex-col gap-1 text-sm'>
              <span className='font-medium'>{t('Billing basis')}</span>
              {BASIS_OPTIONS.map((option) => (
                <label key={option.value} className='flex items-center gap-2'>
                  <input
                    type='radio'
                    name={`basis-${index}`}
                    checked={rule.basis === option.value}
                    onChange={() =>
                      updateRule(index, { ...rule, basis: option.value })
                    }
                  />
                  <span>{t(option.value)}</span>
                </label>
              ))}
              {rule.basis === 'total_duration' ? (
                <label className='flex items-center gap-2 pl-6'>
                  <span>{t('Fallback seconds')}</span>
                  <input
                    type='number'
                    min='1'
                    value={rule.fallback_seconds ?? ''}
                    onChange={(e) =>
                      updateRule(index, {
                        ...rule,
                        fallback_seconds: Number(e.target.value),
                      })
                    }
                    className='w-24 rounded border px-2 py-1'
                  />
                </label>
              ) : null}
            </div>

            {error ? (
              <span className='text-sm text-red-600'>
                {error === 'price'
                  ? t('Price per second must be greater than zero')
                  : t('Total duration billing requires a fallback in seconds')}
              </span>
            ) : null}

            <button
              type='button'
              onClick={() => onChange(rules.filter((_, i) => i !== index))}
              className='self-start text-sm text-red-600'
            >
              {t('Delete rule')}
            </button>
          </div>
        )
      })}

      <button
        type='button'
        onClick={() => onChange([...rules, createEmptyRule(model)])}
        className='self-start rounded border px-3 py-1 text-sm'
      >
        {t('Add rule')}
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Verify it compiles**

Run: `cd web/default && bun run build 2>&1 | tail -20`
Expected: build succeeds. The component has no callers yet — that is Task 6.

- [ ] **Step 4: Commit**

```bash
git add web/default/src/features/system-settings/models/video-pricing-editor.tsx
git commit -m "Add the video price rule editor component"
```

---

## Task 6: Wire The Mode Into The Pricing Sheet

**Files:**
- Modify: `src/features/system-settings/models/model-pricing-sheet.tsx`

- [ ] **Step 1: Find the three integration points**

Run:
```bash
grep -n "handleModeChange\|grid-cols-3\|tiered_expr" web/default/src/features/system-settings/models/model-pricing-sheet.tsx
```

You need: the mode-change handler (~line 331), the tab strip that is currently
`grid-cols-3`, and the submit builder.

- [ ] **Step 2: Widen the tab strip**

Change `grid-cols-3` to `grid-cols-4` on the `TabsList`, and add a fourth tab
alongside the existing three, following their exact markup:

```tsx
<TabsTrigger value='video'>{t('Video per-second')}</TabsTrigger>
```

- [ ] **Step 3: Seed a first rule when switching to video mode**

In `handleModeChange`, after the existing `tiered_expr` branch, add:

```tsx
    if (nextMode === 'video' && videoRules.length === 0) {
      setVideoRules([createEmptyRule(modelName)])
    }
```

Add the state near the other mode state in the same component:

```tsx
  const [videoRules, setVideoRules] = useState<VideoPriceRule[]>(
    () => rulesForModel(parseAllRules(initialVideoRules), modelName),
  )
```

Use whatever prop already carries the model name in this component — read the
surrounding code and match it; do not assume `modelName`.

- [ ] **Step 4: Render the editor**

Where the sheet renders the `tiered_expr` editor, add the parallel branch:

```tsx
{pricingMode === 'video' ? (
  <VideoPricingEditor
    model={modelName}
    rules={videoRules}
    onChange={setVideoRules}
  />
) : null}
```

- [ ] **Step 5: Include the rules in submit**

In `buildSubmitData` (or whatever the submit builder is named here — grep for
where `billingExpr` is added), add the parallel branch:

```tsx
  if (pricingMode === 'video') {
    data.videoRules = JSON.stringify(videoRules)
  }
```

- [ ] **Step 6: Verify**

Run: `cd web/default && bun run build 2>&1 | tail -20`
Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add web/default/src/features/system-settings/models/model-pricing-sheet.tsx
git commit -m "Offer the video billing mode in the pricing sheet"
```

---

## Task 7: Persist Through The Visual Editor

This is where the two option keys are written. **`ModelPrice` is
read-modify-write** — production holds 102 entries for other models.

**Files:**
- Modify: `src/features/system-settings/models/model-ratio-visual-editor.tsx`

- [ ] **Step 1: Find how the existing keys are saved**

Run:
```bash
grep -n "tiered_expr\|billingExpr\|ModelPrice" web/default/src/features/system-settings/models/model-ratio-visual-editor.tsx
```

Read how `billingExpr` reaches its option key on save. Follow the same route.

- [ ] **Step 2: Merge this model's rules into the full list on save**

Where the save handler assembles option values, add:

```tsx
    if (row.billingMode === 'video') {
      const all = parseAllRules(currentVideoRulesJson)
      const merged = mergeModelRules(all, row.name, parseAllRules(row.videoRules))
      nextOptions['billing_setting_video.video_price_rules'] =
        JSON.stringify(merged)

      // ModelPrice is the divisor in price_per_second * seconds / ModelPrice and
      // cancels out of the final quota, so its value cannot change what a
      // customer pays. Its presence is what switches the model onto per-second
      // billing, and a non-positive value makes the backend reject every
      // request -- so it must exist. An existing base is preserved: two models
      // deliberately carry 0.14 and 0.08, and rescaling them would break
      // continuity with historical log values.
      const prices = JSON.parse(currentModelPriceJson || '{}')
      if (!(row.name in prices)) {
        prices[row.name] = 1
        nextOptions.ModelPrice = JSON.stringify(prices)
      }
    }
```

Substitute the real variable names for the current option values — read the
surrounding code to find how the component already reads them.

- [ ] **Step 3: Count the video mode in the mode summary**

Find where modes are counted for display (grep `modeCounts` or `tiered_expr` in
this file) and add `video` alongside the existing entries.

- [ ] **Step 4: Verify**

Run: `cd web/default && bun run build 2>&1 | tail -20`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add web/default/src/features/system-settings/models/model-ratio-visual-editor.tsx
git commit -m "Save video rules and seed the model price base"
```

---

## Task 8: Mode Label, Badge, And Summary

**Files:**
- Modify: `src/features/system-settings/models/model-pricing-snapshots.ts`
- Modify: `src/features/system-settings/models/model-ratio-table-columns.tsx`

- [ ] **Step 1: Find every mode-dependent branch**

Run:
```bash
grep -n "tiered_expr" web/default/src/features/system-settings/models/model-pricing-snapshots.ts web/default/src/features/system-settings/models/model-ratio-table-columns.tsx
```

Every hit is a place that must also handle `'video'`.

- [ ] **Step 2: Add the label and variant**

In `model-pricing-snapshots.ts`, extend `getModeLabel` and `getModeVariant`
following the existing `tiered_expr` cases, using `t('Video per-second')` as the
label.

- [ ] **Step 3: Add the price summary**

Extend `getPriceSummary` / `getPriceDetail` with a `video` branch that reports
the rule count, for example `t('{{count}} per-second rules', { count })`.

- [ ] **Step 4: Add the table badge**

In `model-ratio-table-columns.tsx`, add the `video` case to the badge branch.

- [ ] **Step 5: Verify**

Run: `cd web/default && bun run build 2>&1 | tail -20`
Expected: build succeeds, with no non-exhaustive-union errors remaining.

- [ ] **Step 6: Commit**

```bash
git add web/default/src/features/system-settings/models/model-pricing-snapshots.ts web/default/src/features/system-settings/models/model-ratio-table-columns.tsx
git commit -m "Label the video billing mode across the pricing views"
```

---

## Task 9: Translations For All Eight Locales

`CLAUDE.md` records i18n as a repeat source of defects, with es and pt
previously shipped untranslated. English copied into another locale counts as a
miss.

**Files:**
- Modify: `src/i18n/locales/{en,zh,fr,ru,ja,vi,es,pt}.json`

- [ ] **Step 1: List every new key**

Run:
```bash
cd web/default
grep -ohE "t\('[^']+'\)" src/features/system-settings/models/video-pricing-editor.tsx | sort -u
```

Plus the mode label `Video per-second` and the summary string from Task 8.

- [ ] **Step 2: Add each key to all eight files with a real translation**

The keys are the English source strings. For example, in `zh.json`:

```json
  "Match dimensions": "匹配维度",
  "Price per second ($)": "每秒单价（$）",
  "Billing basis": "计费基准",
  "output_duration": "输出时长",
  "total_duration": "输入+输出总时长",
  "Fallback seconds": "兜底秒数",
  "Add rule": "添加规则",
  "Delete rule": "删除规则",
  "Video per-second": "视频按秒",
  "Price per second must be greater than zero": "每秒单价必须大于 0",
  "Total duration billing requires a fallback in seconds": "按总时长计费时必须填写兜底秒数",
  "resolution": "分辨率",
  "has_video": "参考视频",
  "mode": "生成模式"
```

Translate the same keys into `fr`, `ru`, `ja`, `vi`, `es`, `pt`. `en.json` takes
the English strings verbatim.

- [ ] **Step 3: Sync and check for misses**

Run:
```bash
cd web/default
bun run i18n:sync
```

Then inspect `src/i18n/locales/_reports/` for your new keys:

```bash
grep -l "Match dimensions" src/i18n/locales/_reports/*.untranslated.json
```

Expected: no output. Any file listed still has that key untranslated.

- [ ] **Step 4: Verify every key exists in every locale**

Run:
```bash
cd web/default
for k in "Match dimensions" "Video per-second" "Billing basis"; do
  echo "$k: $(grep -l "$k" src/i18n/locales/*.json | wc -l)/8"
done
```

Expected: `8/8` for each.

- [ ] **Step 5: Commit**

```bash
git add web/default/src/i18n/locales/
git commit -m "Translate the video pricing editor into all eight locales"
```

---

## Task 10: Full Verification

- [ ] **Step 1: Run the unit tests**

Run: `cd web/default && bun test src/features/system-settings/`
Expected: all pass, including the 18 from Tasks 1-3.

- [ ] **Step 2: Build**

Run: `cd web/default && bun run build 2>&1 | tail -20`
Expected: succeeds with no TypeScript errors.

- [ ] **Step 3: Confirm the backend is untouched**

Run from the repo root:

```bash
git diff --name-only origin/main...HEAD | grep -vE '^web/default/' | grep -vE '^docs/'
```

Expected: no output. This plan is frontend-only; any Go file in that list is a
scope violation and must be reverted.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "Fix issues found in the full verification pass"
```

---

## Manual Acceptance

Not automated — needs a running console and a live option table.

- [ ] Open a video model in the pricing sheet, select **Video per-second**, and
      confirm one empty rule appears.
- [ ] Add a rule with `resolution=720p`, `has_video=false`, price `0.314`,
      basis `output duration`. Save. Reopen and confirm it round-trips.
- [ ] Add a deliberately ambiguous pair (two rules for the same model, each with
      one constraint on different keys). Save. Confirm the backend rejection is
      displayed and the unsaved edits stay on screen.
- [ ] Confirm an unrelated model's `ModelPrice` is unchanged after saving —
      compare against `E:\workspace\video-billing-config\backup_ModelPrice.json`,
      which holds the 96 pre-existing entries.
- [ ] Switch a model out of video mode and confirm its rules are removed from
      the option key while other models' rules survive.

## Deployment Impact

`Router deploy: not required` — the diff is confined to `web/default`, which the
console serves. `newapi-console` needs the build. No relay path, no DB
migration, no environment variable.

Multi-node (Rule 11) is not implicated: the editor performs ordinary option
writes through the existing API, and the backend save path already takes the
module write lock.
