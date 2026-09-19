import { describe, it, expect, vi } from 'vitest';
import { isString, isObject, warn, hasLoadedNamespace } from '../src/utils.js';

describe('isString', () => {
  it('should return true for strings', () => {
    expect(isString('string')).toBe(true);
  });

  it.each([[undefined], [null], [1], [{}], [[]], [() => {}]])(
    'should return false for non-strings, testing %o',
    (value) => {
      expect(isString(value)).toBe(false);
    },
  );
});

describe('isObject', () => {
  it.each([[{}], [{ key: 'value' }], [[]]])(
    'should return true for objects, testing %o',
    (value) => {
      expect(isObject(value)).toBe(true);
    },
  );

  it.each([[undefined], [null], [1], ['string'], [() => {}]])(
    'should return false for non-objects, testing %o',
    (value) => {
      expect(isObject(value)).toBe(false);
    },
  );
});

describe('warn', () => {
  it('should use console.warn when i18n logger is not available', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    warn(null, 'TEST_CODE', 'Test message');

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('react-i18next::'),
      expect.objectContaining({ code: 'TEST_CODE' }),
    );

    consoleWarnSpy.mockRestore();
  });
});

describe('hasLoadedNamespace', () => {
  it('should handle when languages is undefined', () => {
    const mockI18n = {
      languages: undefined,
      hasLoadedNamespace: () => true,
    };

    const result = hasLoadedNamespace('test', mockI18n);
    expect(result).toBe(true);
  });

  it('should handle empty languages array', () => {
    const mockI18n = {
      languages: [],
      hasLoadedNamespace: () => true,
    };

    const result = hasLoadedNamespace('test', mockI18n);
    expect(result).toBe(true);
  });

  it('should handle language changing check', () => {
    const mockI18n = {
      languages: ['en'],
      isLanguageChangingTo: 'de',
      services: {
        backendConnector: {
          backend: true,
        },
      },
      hasLoadedNamespace: (ns, options) => {
        if (options.precheck) {
          const precheckResult = options.precheck(mockI18n, () => false);
          if (precheckResult === false) return false;
        }
        return true;
      },
    };

    const result = hasLoadedNamespace('test', mockI18n, {
      bindI18n: 'languageChanging loaded',
    });

    expect(result).toBe(false);
  });
});
