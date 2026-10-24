# updateSpec Effects Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a compatible `updateSpec` effects contract and merge helpers without changing runtime update behavior.

**Architecture:** Keep existing `IUpdateSpecResult` flags as the source of current behavior. Add optional scoped effects beside those flags, merge only explicitly returned effects, and provide a lazy compatibility converter from old flags to effects for later phases.

**Tech Stack:** TypeScript, Jest, VChart existing `IUpdateSpecResult` and `mergeUpdateResult` utilities.

---

### Task 1: Add The Effects Type Contract

**Files:**
- Modify: `packages/vchart/src/model/interface.ts`

- [x] **Step 1: Add `IUpdateSpecEffects` before `IUpdateSpecResult`**

```ts
export interface IUpdateSpecEffects {
  remake?: boolean;
  compile?: boolean;
  render?: boolean;
  layout?: boolean;
  data?: boolean;
  scaleDomain?: boolean;
  series?: boolean;
  component?: boolean;
  animation?: boolean;
  localOnly?: boolean;
}
```

- [x] **Step 2: Add optional `effects` to `IUpdateSpecResult`**

```ts
export interface IUpdateSpecResult {
  change: boolean;
  reMake: boolean;
  reRender?: boolean;
  reSize?: boolean;
  // TODO: compile 的判断应不应该出现在这里?
  reCompile?: boolean;
  reTransformSpec?: boolean;
  effects?: IUpdateSpecEffects;
  reAnimate?: boolean;
  changeTheme?: boolean;
  changeBackground?: boolean;
}
```

### Task 2: Add Compatible Effect Helpers

**Files:**
- Modify: `packages/vchart/src/chart/util.ts`

- [x] **Step 1: Import `IUpdateSpecEffects`**

```ts
import type { IUpdateSpecEffects, IUpdateSpecResult } from '../model/interface';
```

- [x] **Step 2: Add effect keys and explicit effect merge helper**

```ts
const UPDATE_SPEC_EFFECT_KEYS: (keyof IUpdateSpecEffects)[] = [
  'remake',
  'compile',
  'render',
  'layout',
  'data',
  'scaleDomain',
  'series',
  'component',
  'animation',
  'localOnly'
];

function mergeUpdateSpecEffects(target: IUpdateSpecResult, ...sources: IUpdateSpecResult[]) {
  sources.forEach(source => {
    const sourceEffects = source?.effects;

    if (!sourceEffects) {
      return;
    }
    if (!target.effects) {
      target.effects = {};
    }
    const targetEffects = target.effects;

    UPDATE_SPEC_EFFECT_KEYS.forEach(key => {
      targetEffects[key] = targetEffects[key] || sourceEffects[key];
    });
  });
}
```

- [x] **Step 3: Call effect merge from `mergeUpdateResult`**

```ts
mergeUpdateSpecEffects(target, ...sources);
return target;
```

- [x] **Step 4: Add lazy legacy flag conversion**

```ts
export function normalizeUpdateSpecEffects(result: IUpdateSpecResult): IUpdateSpecEffects {
  const effects = result.effects ?? (result.effects = {});

  if (result.reMake) {
    effects.remake = true;
    effects.compile = true;
    effects.data = true;
    effects.scaleDomain = true;
    effects.layout = true;
    effects.render = true;
  }
  if (result.reCompile) {
    effects.compile = true;
    effects.layout = true;
    effects.render = true;
  }
  if (result.reRender) {
    effects.render = true;
  }
  if (result.reSize) {
    effects.layout = true;
    effects.render = true;
  }

  return effects;
}
```

### Task 3: Add Pure Unit Coverage

**Files:**
- Create: `packages/vchart/__tests__/unit/chart/update-result.test.ts`

- [x] **Step 1: Add tests for explicit merge and legacy conversion**

```ts
import type { IUpdateSpecResult } from '../../../src/model/interface';
import { mergeUpdateResult, normalizeUpdateSpecEffects } from '../../../src/chart/util';

const createResult = (result: Partial<IUpdateSpecResult>): IUpdateSpecResult => ({
  change: false,
  reMake: false,
  reRender: false,
  reSize: false,
  reCompile: false,
  ...result
});

describe('update spec result effects', () => {
  it('merges explicit scoped effects without changing legacy flags', () => {
    const target = createResult({ effects: { component: true } });

    mergeUpdateResult(
      target,
      createResult({ reRender: true, effects: { render: true, layout: true } }),
      createResult({ effects: { data: true } })
    );

    expect(target.reMake).toBe(false);
    expect(target.reRender).toBe(true);
    expect(target.effects).toEqual({
      component: true,
      render: true,
      layout: true,
      data: true
    });
  });

  it('normalizes reMake to the conservative full update effect set', () => {
    const result = createResult({ reMake: true });

    expect(normalizeUpdateSpecEffects(result)).toEqual({
      remake: true,
      compile: true,
      data: true,
      scaleDomain: true,
      layout: true,
      render: true
    });
  });

  it('normalizes compile, render, and resize flags into effects lazily', () => {
    const result = createResult({ reCompile: true, reRender: true, reSize: true });
    const effects = normalizeUpdateSpecEffects(result);

    expect(effects).toEqual({
      compile: true,
      layout: true,
      render: true
    });
    expect(result.effects).toBe(effects);
  });
});
```

- [x] **Step 2: Run the new unit test**

Run:

```bash
cd packages/vchart
./node_modules/.bin/jest __tests__/unit/chart/update-result.test.ts --runInBand
```

Expected: PASS.

### Task 4: Verify Behavior Compatibility

**Files:**
- Verify only.

- [x] **Step 1: Run updateSpec-related tests**

Run:

```bash
cd packages/vchart
./node_modules/.bin/jest __tests__/unit/core/update-spec.test.ts __tests__/unit/chart/update-result.test.ts --runInBand
```

Expected: PASS.

- [x] **Step 2: Run animation regression tests**

Run:

```bash
cd packages/vchart
./node_modules/.bin/jest __tests__/unit/animation/manual-ticker.test.ts --runInBand
```

Expected: PASS for current branch baseline.

- [x] **Step 3: Run touched-file lint and typecheck**

Run:

```bash
cd packages/vchart
./node_modules/.bin/eslint src/model/interface.ts src/chart/util.ts __tests__/unit/chart/update-result.test.ts
./node_modules/.bin/tsc --noEmit --project tsconfig.json
```

Expected: eslint exits 0; typecheck exits 0.
