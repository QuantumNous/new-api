# Playground Handoff Model Lock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep a model-page handoff model fixed in the Playground while placing the handoff prompt in the input without generating automatically.

**Architecture:** Extend the pure handoff resolver so it preserves the normalized requested model separately from the validated selectable model. Feed that explicit handoff state through `Playground` into `PlaygroundInput`, use it to disable the combined model/group chooser, and stop all automatic model-selection branches while the lock exists. Existing raw-model validation and submit gating remain unchanged.

**Tech Stack:** React 19, TypeScript 6, Bun test, React server rendering, TanStack Query.

---

## File Structure

- Modify `web/default/src/features/playground/lib/playground-handoff.ts`: expose normalized requested handoff model independently from its authorization result.
- Modify `web/default/src/features/playground/lib/playground-handoff.test.ts`: lock the valid and invalid requested-model contracts.
- Modify `web/default/src/features/playground/components/playground-input.tsx`: accept a model lock and disable the model/group chooser without disabling prompt editing or submit.
- Create `web/default/src/features/playground/components/playground-input.test.tsx`: verify locked and ordinary selector behavior through the actual `PlaygroundInput` component boundary.
- Modify `web/default/src/features/playground/index.tsx`: derive the page-session lock, prevent automatic first-run/default fallback, and pass the lock to the input.
- Modify `web/default/src/features/playground/index.test.tsx`: verify handoff visits are locked, ordinary visits are not, prompt remains draft-only, and no generation occurs on mount.

### Task 1: Preserve Requested Handoff Model State

**Files:**
- Modify: `web/default/src/features/playground/lib/playground-handoff.test.ts`
- Modify: `web/default/src/features/playground/lib/playground-handoff.ts`

- [ ] **Step 1: Change the resolver tests first**

Update the valid handoff expectation to include the normalized requested model:

```ts
expect(
  resolvePlaygroundHandoff({
    models: [{ label: 'gpt-4o', value: 'gpt-4o' }],
    availableModels: ['gpt-4o', 'gpt-image-2'],
    model: ' gpt-image-2 ',
    prompt: ' Draw a violet fox ',
  })
).toEqual({
  requestedModel: 'gpt-image-2',
  model: 'gpt-image-2',
  prompt: 'Draw a violet fox',
  models: [
    { label: 'gpt-image-2', value: 'gpt-image-2' },
    { label: 'gpt-4o', value: 'gpt-4o' },
  ],
})
```

Update the unavailable-model test so the URL request remains explicit without entering selectable models:

```ts
expect(
  resolvePlaygroundHandoff({
    models: [{ label: 'gpt-4o', value: 'gpt-4o' }],
    availableModels: ['gpt-4o'],
    model: 'not-a-real-model',
  })
).toEqual({
  requestedModel: 'not-a-real-model',
  models: [{ label: 'gpt-4o', value: 'gpt-4o' }],
})
```

- [ ] **Step 2: Run the resolver test and verify RED**

Run:

```bash
bun test src/features/playground/lib/playground-handoff.test.ts
```

Expected: FAIL because `requestedModel` is missing from the returned object.

- [ ] **Step 3: Add the minimum resolver field**

Extend the internal result type and return object:

```ts
type PlaygroundHandoff = {
  models: ModelOption[]
  requestedModel?: string
  model?: string
  prompt?: string
}

return {
  models,
  ...(model ? { requestedModel: model } : {}),
  ...(availableModel ? { model: availableModel } : {}),
  ...(prompt ? { prompt } : {}),
}
```

Do not add an unavailable model to `models` and do not expose it as validated `model`.

- [ ] **Step 4: Run the resolver test and verify GREEN**

Run:

```bash
bun test src/features/playground/lib/playground-handoff.test.ts
```

Expected: all resolver tests PASS.

- [ ] **Step 5: Commit the resolver contract**

Stage only the two resolver files and commit with Lore trailers:

```text
Keep handoff intent visible through model validation

Constraint: Unknown URL models must remain unselectable and unsendable
Confidence: high
Scope-risk: narrow
Directive: Treat requestedModel as handoff state, never as authorization
Tested: bun test src/features/playground/lib/playground-handoff.test.ts
```

### Task 2: Disable the Selector Without Disabling the Prompt

**Files:**
- Create: `web/default/src/features/playground/components/playground-input.test.tsx`
- Modify: `web/default/src/features/playground/components/playground-input.tsx`

- [ ] **Step 1: Write the component-boundary test first**

Create a Bun test that spies on `ModelGroupSelector`, imports `PlaygroundInput` after the spy, renders with React server rendering, and captures the selector props:

```tsx
import * as React from 'react'
import { afterAll, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import * as modelGroupSelectorModule from '@/components/model-group-selector'
import type { ModelGroupSelectorProps } from '@/components/model-group-selector'

let capturedSelectorProps: ModelGroupSelectorProps | undefined

spyOn(modelGroupSelectorModule, 'ModelGroupSelector').mockImplementation(
  ((props: ModelGroupSelectorProps) => {
    capturedSelectorProps = props
    return null
  }) as never
)

const { PlaygroundInput } = await import('./playground-input')

function renderInput(modelLocked: boolean) {
  renderToStaticMarkup(
    <PlaygroundInput
      groups={[]}
      groupValue='default'
      modelLocked={modelLocked}
      models={[{ label: 'gpt-image-2', value: 'gpt-image-2' }]}
      modelValue='gpt-image-2'
      onGroupChange={() => undefined}
      onModelChange={() => undefined}
      onSubmit={() => undefined}
      showGroupSelector={false}
    />
  )
  if (!capturedSelectorProps) throw new Error('selector was not rendered')
  return capturedSelectorProps
}

beforeEach(() => {
  capturedSelectorProps = undefined
})

describe('PlaygroundInput model lock', () => {
  test('disables the model chooser for a handoff visit', () => {
    expect(renderInput(true).disabled).toBe(true)
  })

  test('keeps the model chooser enabled for an ordinary visit', () => {
    expect(renderInput(false).disabled).toBe(false)
  })
})

afterAll(() => mock.restore())
```

- [ ] **Step 2: Run the new component test and verify RED**

Run:

```bash
bun test src/features/playground/components/playground-input.test.tsx
```

Expected: FAIL because `modelLocked` is ignored and the captured selector remains enabled.

- [ ] **Step 3: Add the minimum input prop and disable expression**

Add the prop, default it to false, and include it only in selector disable state:

```ts
interface PlaygroundInputProps {
  // existing props
  modelLocked?: boolean
}

export function PlaygroundInput({
  // existing props
  modelLocked = false,
}: PlaygroundInputProps) {
  // existing state
  const isModelSelectDisabled = disabled || isModelLoading || modelLocked
}
```

Keep `PromptInputTextarea.disabled`, `isSubmitDisabled`, and `handleSubmit` unchanged so a lock does not disable prompt editing or explicit submission.

- [ ] **Step 4: Run the new component test and verify GREEN**

Run:

```bash
bun test src/features/playground/components/playground-input.test.tsx
```

Expected: 2 tests PASS.

- [ ] **Step 5: Commit the input lock**

Stage only the input component and its test and commit with Lore trailers:

```text
Prevent handoff visits from changing their generation target

Constraint: Prompt editing and explicit submit must remain available
Rejected: Disable the whole input | would block the requested draft workflow
Confidence: high
Scope-risk: narrow
Directive: Keep modelLocked scoped to the selector controls
Tested: bun test src/features/playground/components/playground-input.test.tsx
```

### Task 3: Wire the Lock and Stop Automatic Model Replacement

**Files:**
- Modify: `web/default/src/features/playground/index.test.tsx`
- Modify: `web/default/src/features/playground/index.tsx`

- [ ] **Step 1: Extend integration tests first**

Add the lock prop to the captured input shape:

```ts
type CapturedInputProps = {
  initialText?: string
  modelLocked?: boolean
  modelValue: string
  submitDisabled?: boolean
  onSubmit: (text: string) => void
}
```

In the existing valid and unavailable handoff tests, assert:

```ts
expect(input.modelLocked).toBe(true)
```

Add an ordinary Playground case without initial handoff values:

```tsx
test('keeps the model chooser unlocked without a handoff model', () => {
  modelsQueryData = ['gpt-4o']
  isModelsQueryLoading = false
  renderToStaticMarkup(<Playground />)
  if (!capturedInputProps) throw new Error('PlaygroundInput was not rendered')

  expect(capturedInputProps.modelLocked).toBe(false)
})
```

Keep the existing assertions that `initialText` contains the prompt and `sendChatMock` has no calls after mount.

- [ ] **Step 2: Run the integration test and verify RED**

Run:

```bash
bun test src/features/playground/index.test.tsx
```

Expected: FAIL because `Playground` does not pass `modelLocked`.

- [ ] **Step 3: Derive and apply the page-session lock**

After resolving `handoff`, derive the lock from the explicit requested model:

```ts
const isHandoffModelLocked = !!handoff.requestedModel
```

In the model-list effect, keep `setModels(handoff.models)` but return before first-run or default model replacement when locked:

```ts
if (availableModelsData === undefined) return

setModels(handoff.models)

if (isHandoffModelLocked) return

if (firstRun && !userPickedModel && !!firstRunModel) {
  // existing first-run selection
}
```

Add `isHandoffModelLocked` to the effect dependency list. Pass it to the input:

```tsx
<PlaygroundInput
  // existing props
  modelLocked={isHandoffModelLocked}
/>
```

This preserves the URL model in `config.model` even if validation is pending or fails. Existing `isCurrentModelValid` keeps submission blocked until the requested model appears in the authorized selectable set.

- [ ] **Step 4: Run all handoff tests and verify GREEN**

Run:

```bash
bun test \
  src/features/playground/lib/playground-handoff.test.ts \
  src/features/playground/components/playground-input.test.tsx \
  src/features/playground/index.test.tsx
```

Expected: all tests PASS; existing no-auto-send and unknown-model cases remain green.

- [ ] **Step 5: Run typecheck and focused formatting checks**

Run:

```bash
bun run typecheck
bunx prettier --check \
  src/features/playground/lib/playground-handoff.ts \
  src/features/playground/lib/playground-handoff.test.ts \
  src/features/playground/components/playground-input.tsx \
  src/features/playground/components/playground-input.test.tsx \
  src/features/playground/index.tsx \
  src/features/playground/index.test.tsx
```

Expected: both commands exit 0.

- [ ] **Step 6: Commit the Playground wiring**

Stage only the Playground integration files and commit with Lore trailers:

```text
Honor the source model for the full Playground handoff session

Constraint: Async model loading may validate but never replace a handoff target
Rejected: Reapply the URL model after every query update | leaves the selector interactive and causes state churn
Confidence: high
Scope-risk: narrow
Directive: Preserve fail-closed submit gating for unavailable requested models
Tested: focused Bun tests; bun run typecheck; focused Prettier check
```

### Task 4: Final Verification and Review

**Files:**
- Verify all files changed since `origin/main`.

- [ ] **Step 1: Run GitNexus impact/detect checks**

Attempt impact analysis before production-symbol edits and run change detection before final commit/review:

```bash
gitnexus impact resolvePlaygroundHandoff --direction upstream
gitnexus impact PlaygroundInput --direction upstream
gitnexus impact Playground --direction upstream
gitnexus detect-changes --scope compare --base-ref origin/main
```

If the repository remains unindexed, record the exact CLI failure as a verification gap and use the git diff plus independent reviewer evidence.

- [ ] **Step 2: Run full scoped validation**

Run:

```bash
bun test src/features/playground
bun run typecheck
bun run build
git diff --check origin/main...HEAD
```

Expected: all commands exit 0.

- [ ] **Step 3: Request spec and code-quality reviews**

Have an independent spec reviewer compare the implementation against `docs/superpowers/specs/2026-08-10-playground-handoff-model-lock-design.md`, then have an independent code reviewer inspect `origin/main..HEAD`. Fix and re-review every Critical or Important issue before proceeding.

- [ ] **Step 4: Push and open the main PR**

Push `fix/playground-model-lock-20260810` and create a PR targeting `main`. The PR body must include background, reproduction, root cause, design, risk, validation, and deployment advice. Router deploy is not required; `newapi-console` deploy is required after merge.
