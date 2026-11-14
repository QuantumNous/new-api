import { describe, expect, it } from 'vitest';
import { getOwn } from './get-own';

describe('getOwn', () => {
  it('returns own properties', () => {
    expect(getOwn({ a: 1, b: 2 }, 'a')).toBe(1);
  });

  it('returns undefined for absent keys', () => {
    expect(getOwn({ a: 1 }, 'missing')).toBeUndefined();
  });

  it('returns undefined for inherited object properties rather than a prototype value', () => {
    for (const key of ['constructor', 'toString', 'valueOf', '__proto__']) {
      expect(getOwn({ a: 1 }, key)).toBeUndefined();
    }
  });

  it('still returns an own property that shadows an inherited name', () => {
    expect(getOwn({ toString: 'shadowed' }, 'toString')).toBe('shadowed');
  });

  it('returns undefined for null/undefined objects', () => {
    expect(getOwn(undefined, 'a')).toBeUndefined();
    expect(getOwn(null, 'a')).toBeUndefined();
  });
});
