import type { IUpdateSpecResult } from '../../../src/model/interface';
import { isUpdateSpecResultLocalOnly, mergeUpdateResult, normalizeUpdateSpecEffects } from '../../../src/chart/util';

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

  it('treats explicit local-only component effects as local', () => {
    expect(
      isUpdateSpecResultLocalOnly(createResult({ change: true, effects: { localOnly: true, component: true } }))
    ).toBe(true);
  });

  it('does not treat legacy render or compile work as local-only', () => {
    expect(isUpdateSpecResultLocalOnly(createResult({ reRender: true, effects: { localOnly: true } }))).toBe(false);
    expect(isUpdateSpecResultLocalOnly(createResult({ reCompile: true, effects: { localOnly: true } }))).toBe(false);
  });
});
