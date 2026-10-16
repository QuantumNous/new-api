import { expect } from 'vitest';
import { resolveThumbCollision } from './resolveThumbCollision';

describe('resolveThumbCollision', () => {
  it('prevents thumbs from passing each other when behavior is "none"', () => {
    const result = resolveThumbCollision({
      behavior: 'none',
      values: [20, 40],
      pressedIndex: 0,
      nextValue: 70,
      min: 0,
      max: 100,
      step: 1,
      minStepsBetweenValues: 0,
    });

    expect(result.value).toEqual([40, 40]);
    expect(result.thumbIndex).toBe(0);
    expect(result.didSwap).toBe(false);
  });

  it('pushes thumbs forward without cling when behavior is "push"', () => {
    const result = resolveThumbCollision({
      behavior: 'push',
      values: [20, 40],
      pressedIndex: 0,
      nextValue: 70,
      min: 0,
      max: 100,
      step: 1,
      minStepsBetweenValues: 0,
    });

    expect(result.value).toEqual([70, 70]);
    expect(result.thumbIndex).toBe(0);
    expect(result.didSwap).toBe(false);
  });

  it('keeps pushed thumbs in place when moving backward in push mode', () => {
    const startValues = [20, 40];

    const pushed = resolveThumbCollision({
      behavior: 'push',
      values: startValues,
      currentValues: startValues,
      initialValues: startValues,
      pressedIndex: 0,
      nextValue: 70,
      min: 0,
      max: 100,
      step: 1,
      minStepsBetweenValues: 0,
    });

    const nextValues = pushed.value as number[];
    expect(nextValues).toEqual([70, 70]);

    const movedBack = resolveThumbCollision({
      behavior: 'push',
      values: nextValues,
      currentValues: nextValues,
      initialValues: startValues,
      pressedIndex: 0,
      nextValue: 30,
      min: 0,
      max: 100,
      step: 1,
      minStepsBetweenValues: 0,
    });

    expect(movedBack.value).toEqual([30, 70]);
    expect(movedBack.thumbIndex).toBe(0);
    expect(movedBack.didSwap).toBe(false);
  });

  it('swaps thumbs when behavior is "swap"', () => {
    const result = resolveThumbCollision({
      behavior: 'swap',
      values: [20, 40],
      pressedIndex: 0,
      nextValue: 65,
      min: 0,
      max: 100,
      step: 1,
      minStepsBetweenValues: 0,
    });

    expect(result.value).toEqual([40, 65]);
    expect(result.thumbIndex).toBe(1);
    expect(result.didSwap).toBe(true);
  });

  it('maintains swap continuity with minimum steps when provided current and initial values', () => {
    const startValues = [20, 80];

    const first = resolveThumbCollision({
      behavior: 'swap',
      values: startValues,
      currentValues: startValues,
      initialValues: startValues,
      pressedIndex: 0,
      nextValue: 85,
      min: 0,
      max: 100,
      step: 1,
      minStepsBetweenValues: 10,
    });

    const firstValues = first.value as number[];
    expect(firstValues).toEqual([70, 85]);
    expect(first.thumbIndex).toBe(1);
    expect(first.didSwap).toBe(true);

    const continued = resolveThumbCollision({
      behavior: 'swap',
      values: startValues,
      currentValues: firstValues,
      initialValues: startValues,
      pressedIndex: first.thumbIndex,
      nextValue: 95,
      min: 0,
      max: 100,
      step: 1,
      minStepsBetweenValues: 10,
    });

    const continuedValues = continued.value as number[];
    expect(continuedValues).toEqual([70, 95]);
    expect(continued.thumbIndex).toBe(1);
    expect(continued.didSwap).toBe(false);
  });

  it('does not swap before reaching neighbour value with minimum steps', () => {
    const result = resolveThumbCollision({
      behavior: 'swap',
      values: [25, 45],
      currentValues: [40, 45],
      initialValues: [25, 45],
      pressedIndex: 0,
      nextValue: 44,
      min: 0,
      max: 100,
      step: 1,
      minStepsBetweenValues: 5,
    });

    const resultValues = result.value as number[];
    expect(resultValues).toEqual([40, 45]);
    expect(result.thumbIndex).toBe(0);
    expect(result.didSwap).toBe(false);
  });

  it('swaps once reaching the neighbour value with minimum steps', () => {
    const result = resolveThumbCollision({
      behavior: 'swap',
      values: [25, 45],
      currentValues: [40, 45],
      initialValues: [25, 45],
      pressedIndex: 0,
      nextValue: 45,
      min: 0,
      max: 100,
      step: 1,
      minStepsBetweenValues: 5,
    });

    const resultValues = result.value as number[];
    expect(resultValues).toEqual([40, 45]);
    expect(result.thumbIndex).toBe(1);
    expect(result.didSwap).toBe(true);
  });

  it('does not swap backward before reaching neighbour value with minimum steps', () => {
    const result = resolveThumbCollision({
      behavior: 'swap',
      values: [25, 45],
      currentValues: [25, 40],
      initialValues: [25, 45],
      pressedIndex: 1,
      nextValue: 29,
      min: 0,
      max: 100,
      step: 1,
      minStepsBetweenValues: 5,
    });

    const resultValues = result.value as number[];
    expect(resultValues).toEqual([25, 30]);
    expect(result.thumbIndex).toBe(1);
    expect(result.didSwap).toBe(false);
  });

  it('swaps backward once reaching the neighbour value with minimum steps', () => {
    const result = resolveThumbCollision({
      behavior: 'swap',
      values: [25, 45],
      currentValues: [25, 40],
      initialValues: [25, 45],
      pressedIndex: 1,
      nextValue: 25,
      min: 0,
      max: 100,
      step: 1,
      minStepsBetweenValues: 5,
    });

    const resultValues = result.value as number[];
    expect(resultValues).toEqual([25, 30]);
    expect(result.thumbIndex).toBe(0);
    expect(result.didSwap).toBe(true);
  });

  it('does not move the clamped neighbour when swapping across with minimum steps', () => {
    const startValues = [25, 45];
    const currentValues = [40, 45];

    const result = resolveThumbCollision({
      behavior: 'swap',
      values: currentValues,
      currentValues,
      initialValues: startValues,
      pressedIndex: 0,
      nextValue: 46,
      min: 0,
      max: 100,
      step: 1,
      minStepsBetweenValues: 5,
    });

    const resultValues = result.value as number[];
    expect(resultValues).toEqual([40, 46]);
    expect(result.thumbIndex).toBe(1);
    expect(result.didSwap).toBe(true);
  });
});
