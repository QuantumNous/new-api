import { expect } from 'vitest';
import { getPushedThumbValues } from './getPushedThumbValues';

describe('getPushedThumbValues', () => {
  it('pushes the next thumb forward when moving past it', () => {
    const result = getPushedThumbValues({
      values: [20, 40],
      index: 0,
      nextValue: 70,
      min: 0,
      max: 100,
      step: 1,
      minStepsBetweenValues: 0,
    });

    expect(result).toEqual([70, 70]);
  });

  it('ensures minimum distance between thumbs while pushing forward', () => {
    const result = getPushedThumbValues({
      values: [20, 40],
      index: 0,
      nextValue: 60,
      min: 0,
      max: 100,
      step: 1,
      minStepsBetweenValues: 5,
    });

    expect(result).toEqual([60, 65]);
  });

  it('pushes previous thumbs backward when moving before them', () => {
    const result = getPushedThumbValues({
      values: [20, 40],
      index: 1,
      nextValue: -10,
      min: 0,
      max: 100,
      step: 1,
      minStepsBetweenValues: 0,
    });

    expect(result).toEqual([0, 0]);
  });

  it('pushes multiple thumbs in sequence', () => {
    const result = getPushedThumbValues({
      values: [10, 50, 90],
      index: 1,
      nextValue: 95,
      min: 0,
      max: 100,
      step: 1,
      minStepsBetweenValues: 5,
    });

    expect(result).toEqual([10, 95, 100]);
  });

  it('allows fractional minimum distances', () => {
    const result = getPushedThumbValues({
      values: [0, 1],
      index: 0,
      nextValue: 1.4,
      min: 0,
      max: 10,
      step: 1,
      minStepsBetweenValues: 0.4,
    });

    expect(result[0]).toBe(1.4);
    expect(result[1]).toBe(1.8);
  });

  it('restores pushed thumbs towards their initial value when space allows', () => {
    const initialValues = [30, 50];

    const pushed = getPushedThumbValues({
      values: initialValues,
      initialValues,
      index: 1,
      nextValue: 20,
      min: 0,
      max: 100,
      step: 1,
      minStepsBetweenValues: 0,
    });

    expect(pushed).toEqual([20, 20]);

    const restored = getPushedThumbValues({
      values: pushed,
      initialValues,
      index: 1,
      nextValue: 35,
      min: 0,
      max: 100,
      step: 1,
      minStepsBetweenValues: 0,
    });

    expect(restored).toEqual([30, 35]);
  });
});
