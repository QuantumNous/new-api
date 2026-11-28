import { describe, it, vitest, beforeAll, afterAll, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import i18n from './i18n';
import { setI18n } from '../src/context';
import { useSSR } from '../src/useSSR';

vitest.unmock('../src/useSSR');

describe('useSSR', () => {
  const mockI18n = {
    language: 'en',
    languages: ['en'],
    options: {
      ns: [],
      defaultNS: 'defaultNS',
      nsMode: 'fallback',
    },
    services: {
      resourceStore: {
        data: {},
      },
      backendConnector: {},
    },
    isInitialized: true,
    changeLanguage: (lng) => {
      mockI18n.language = lng;
    },
    getFixedT: () => (message) => message,
    hasResourceBundle: (lng, ns) => ns === 'alreadyLoadedNS',
    loadNamespaces: () => {},
  };

  beforeAll(() => {
    setI18n(mockI18n);
  });

  afterAll(() => {
    setI18n(i18n);
  });

  it('should set values', () => {
    renderHook(() => useSSR({ foo: 'bar' }, 'de'));
    expect(mockI18n.language).toBe('de');
    expect(mockI18n.services.resourceStore.data).toEqual({ foo: 'bar' });
  });

  it('should not crash and warn when i18n is not available', () => {
    setI18n(undefined);
    const warnSpy = vitest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => {
      renderHook(() => useSSR({ foo: 'bar' }, 'en'));
    }).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('useSSR'),
      expect.objectContaining({ code: 'NO_I18NEXT_INSTANCE' }),
    );
    warnSpy.mockRestore();
    setI18n(mockI18n);
  });

  it('should not crash and warn when i18n exists but is not initialized', () => {
    const uninitializedI18n = {
      options: {},
      services: {},
    };
    setI18n(uninitializedI18n);
    const warnSpy = vitest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => {
      renderHook(() => useSSR({ foo: 'bar' }, 'en'));
    }).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('useSSR'),
      expect.objectContaining({ code: 'I18N_NOT_INITIALIZED' }),
    );
    warnSpy.mockRestore();
    setI18n(mockI18n);
  });
});
