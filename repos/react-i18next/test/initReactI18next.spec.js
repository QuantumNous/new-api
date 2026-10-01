import { describe, it, expect } from 'vitest';
import { initReactI18next } from '../src/initReactI18next';
import { getDefaults, setDefaults } from '../src/defaults';
import { getI18n } from '../src/i18nInstance';

describe('initReactI18next', () => {
  it('should have correct type', () => {
    expect(initReactI18next.type).toBe('3rdParty');
  });

  it('should initialize with i18next instance', () => {
    const mockI18n = {
      options: {
        react: {
          useSuspense: false,
          bindI18n: 'languageChanged loaded',
        },
      },
    };

    initReactI18next.init(mockI18n);

    const defaults = getDefaults();
    expect(defaults.useSuspense).toBe(false);
    expect(defaults.bindI18n).toBe('languageChanged loaded');

    const storedI18n = getI18n();
    expect(storedI18n).toBe(mockI18n);
  });

  it('should handle setDefaults with options', () => {
    setDefaults({ useSuspense: true, customOption: 'test' });
    const defaults = getDefaults();
    expect(defaults.useSuspense).toBe(true);
    expect(defaults.customOption).toBe('test');
  });

  it('should handle setDefaults with empty options', () => {
    const defaultsBefore = getDefaults();
    setDefaults();
    const defaultsAfter = getDefaults();
    expect(defaultsAfter).toEqual(defaultsBefore);
  });

  it('should preserve existing defaults when setting new ones', () => {
    setDefaults({ bindI18n: 'languageChanged' });

    setDefaults({ useSuspense: false });
    const defaults = getDefaults();

    // Should preserve bindI18n and add useSuspense
    expect(defaults.bindI18n).toBe('languageChanged');
    expect(defaults.useSuspense).toBe(false);
  });
});
