# Research: Fix Subtitle Layout Bug

## Problem Analysis

The user reported a layout error when only `subtext` is set in the Title component.
Investigation of `packages/vchart/src/component/title/title.ts` reveals that `text` attribute is passed directly from spec:
```typescript
text: this._spec.text,
```
If `this._spec.text` is undefined, it is passed as undefined to `@visactor/vrender-components`.

## Hypothesis

The underlying `Title` component from `@visactor/vrender-components` likely expects `text` to be a valid string or handles `undefined` `text` incorrectly when `subtext` is present, leading to a layout calculation failure (e.g., trying to measure undefined text).

## Proposed Solution

Ensure `text` is always a string, defaulting to `''` if undefined.
```typescript
text: this._spec.text ?? '',
```

## Verification

A regression test `repro.test.ts` was created to simulate the scenario.
