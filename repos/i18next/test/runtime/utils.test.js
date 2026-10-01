import { describe, it, expect } from 'vitest';
import { deepExtend, deepFind, getCleanedCode } from '../../src/utils.js';

describe('utils', () => {
  describe('#deepExtend', () => {
    it('it should overwrite if flag set', () => {
      const res = deepExtend(
        {
          some: 'thing',
        },
        {
          some: 'else',
        },
        true,
      );

      expect(res).toEqual({ some: 'else' });
    });

    it('it should not overwrite', () => {
      const res = deepExtend(
        {
          some: 'thing',
        },
        {
          some: 'else',
        },
        false,
      );

      expect(res).toEqual({ some: 'thing' });
    });

    it('it should not corrupt shared built-ins via inherited keys', () => {
      const target = {};
      const res = deepExtend(target, { hasOwnProperty: { call: 'corrupted' } }, true);

      // the inherited Object.prototype.hasOwnProperty function must stay intact
      expect(typeof Object.prototype.hasOwnProperty.call).toBe('function');
      expect(() => Object.prototype.hasOwnProperty.call({}, 'x')).not.toThrow();
      // the attacker key is copied as a plain own property instead
      expect(Object.prototype.hasOwnProperty.call(res, 'hasOwnProperty')).toBe(true);
      expect(res.hasOwnProperty).toEqual({ call: 'corrupted' });
    });

    it('it should still merge nested own properties', () => {
      const res = deepExtend({ a: { b: 'old', c: 'keep' } }, { a: { b: 'new', d: 'add' } }, true);

      expect(res).toEqual({ a: { b: 'new', c: 'keep', d: 'add' } });
    });
  });

  describe('#deepFind', () => {
    it('finds value for a basic path', () => {
      const obj = { a: { b: { c: 1 } } };
      const value = deepFind(obj, 'a.b.c');
      expect(value).toEqual(1);
    });

    it('finds no value for a non-existent path', () => {
      const obj = { a: { b: { c: 1 } } };
      const value = deepFind(obj, 'a.b.d');
      expect(value).toEqual(undefined);
    });

    it('finds value for a key that has a dot', () => {
      const obj = { a: { b: 'zero', 'b.b': { c: 1 } } };
      const value = deepFind(obj, 'a.b.b.c');
      expect(value).toEqual(1);
      const value2 = deepFind(obj, 'a.b');
      expect(value2).toEqual('zero');
      const value3 = deepFind(obj, 'a.b.b');
      expect(value3).toEqual({ c: 1 });
    });

    it('finds value for an array index', () => {
      const obj = { a: [{ c: 1 }] };
      const value = deepFind(obj, 'a.0.c');
      expect(value).toEqual(1);
    });
  });

  describe('#getCleanedCode', () => {
    it('should replace single underscore', () => {
      expect(getCleanedCode('en_US')).toBe('en-US');
    });

    it('should replace all underscores in locale codes', () => {
      expect(getCleanedCode('zh_Hant_TW')).toBe('zh-Hant-TW');
      expect(getCleanedCode('en_US_POSIX')).toBe('en-US-POSIX');
      expect(getCleanedCode('sr_Latn_RS')).toBe('sr-Latn-RS');
    });

    it('should return undefined for nullish input', () => {
      expect(getCleanedCode(undefined)).toBeUndefined();
      expect(getCleanedCode(null)).toBeUndefined();
    });

    it('should return code unchanged if no underscores', () => {
      expect(getCleanedCode('en-US')).toBe('en-US');
      expect(getCleanedCode('ko')).toBe('ko');
    });
  });
});
