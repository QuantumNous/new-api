import { expect, it } from 'vitest';
import { removeUndefinedEntries } from './remove-undefined-entries';

it('should remove undefined entries from record', () => {
  const input = {
    a: 1,
    b: undefined,
    c: 'test',
    d: undefined,
  };

  expect(removeUndefinedEntries(input)).toEqual({
    a: 1,
    c: 'test',
  });
});

it('should handle empty object', () => {
  const input = {};
  expect(removeUndefinedEntries(input)).toEqual({});
});

it('should handle object with all undefined values', () => {
  const input = {
    a: undefined,
    b: undefined,
  };
  expect(removeUndefinedEntries(input)).toEqual({});
});

it('should remove null values', () => {
  // Both null and undefined will be removed.
  const input = {
    a: null,
    b: undefined,
    c: 'test',
  };
  expect(removeUndefinedEntries(input)).toEqual({
    c: 'test',
  });
});

it('should preserve falsy values except null and undefined', () => {
  // Only false, 0, and '' are preserved.
  const input = {
    a: false,
    b: 0,
    c: '',
    d: undefined,
    e: null,
  };
  expect(removeUndefinedEntries(input)).toEqual({
    a: false,
    b: 0,
    c: '',
  });
});
