import { describe, it, vitest, expect, beforeEach, afterEach } from 'vitest';
import React, { Suspense } from 'react';
import { render, renderHook, cleanup, screen } from '@testing-library/react';
import { useTranslation } from '../src/useTranslation';
import hasLoadedNamespace from './hasLoadedNamespaceMock.js';

vitest.unmock('../src/useTranslation');

describe('useTranslation', () => {
  afterEach(() => {
    cleanup();
  });

  let instance;
  beforeEach(() => {
    instance = {
      language: 'en',
      languages: ['en', 'fr'],
      services: {
        resourceStore: {
          data: {},
        },
        backendConnector: { backend: {}, state: { 'en|notLoadedNS': 1, 'fr|notLoadedNS': 1 } },
      },
      isInitialized: true,
      changeLanguage: () => {},
      getFixedT: () => (message) => message,
      hasResourceBundle: (lng, ns) => ns === 'alreadyLoadedNS',
      loadNamespaces: () => {},
      hasLoadedNamespace: (ns) => hasLoadedNamespace(ns, instance),
      on: () => {},
      off: () => {},
      options: {},
    };
  });

  function TestComponentNotReady({ i18n }) {
    const { t } = useTranslation(['notLoadedNS', 'alreadyLoadedNS'], { i18n });

    return <div>{t('keyOne')}</div>;
  }

  it('should render suspense if not ready (having not all ns)', async () => {
    render(
      <Suspense fallback="Suspended">
        <TestComponentNotReady i18n={instance} />
      </Suspense>,
    );

    expect(screen.getByText('Suspended')).toBeInTheDocument();
  });

  it('should render correct content if ready (having all ns)', () => {
    const { result } = renderHook(() => useTranslation('alreadyLoadedNS', { i18n: instance }));

    const { t } = result.current;
    expect(t('keyOne')).toBe('keyOne');
  });

  it('should ignore suspense if no backend defined', () => {
    const instance2 = { ...instance };
    instance2.services.backendConnector = { backend: false };
    const { result } = renderHook(() =>
      useTranslation(['notLoadedNS', 'alreadyLoadedNS'], { i18n: instance2 }),
    );

    const { t } = result.current;
    expect(t('keyOne')).toBe('keyOne');
  });

  it('should ignore suspense if failed loading ns and no fallback lng is defined', () => {
    const instance2 = { ...instance };
    instance2.services.backendConnector = {
      backend: {},
      state: { 'en|notLoadedNS': -1 },
    };
    instance2.services.options = { fallbackLng: false };
    const { result } = renderHook(() =>
      useTranslation(['notLoadedNS', 'alreadyLoadedNS'], { i18n: instance2 }),
    );

    const { t } = result.current;
    expect(t('keyOne')).toBe('keyOne');
  });

  it('should ignore suspense if failed loading ns but has fallback loaded', () => {
    const instance2 = { ...instance };
    instance2.services.backendConnector = {
      backend: {},
      state: { 'en|notLoadedNS': -1, 'fr|notLoadedNS': 2 },
    };

    const { result } = renderHook(() =>
      useTranslation(['notLoadedNS', 'alreadyLoadedNS'], { i18n: instance2 }),
    );

    const { t } = result.current;
    expect(t('keyOne')).toBe('keyOne');
  });

  it('should ignore suspense if failed loading ns and has fallback failing too', () => {
    const instance2 = { ...instance };
    instance2.services.backendConnector = {
      backend: {},
      state: { 'en|notLoadedNS': -1, 'fr|notLoadedNS': -1 },
    };

    const { result } = renderHook(() =>
      useTranslation(['notLoadedNS', 'alreadyLoadedNS'], { i18n: instance2 }),
    );

    const { t } = result.current;
    expect(t('keyOne')).toBe('keyOne');
  });

  it('should warn when t is called before ready with useSuspense false', () => {
    const warnSpy = vitest.spyOn(console, 'warn').mockImplementation(() => {});
    const instance2 = { ...instance };
    instance2.options.react = { useSuspense: false };
    instance2.services.backendConnector = {
      backend: {},
      state: { 'en|notLoadedNS': 1, 'fr|notLoadedNS': 1 },
    };

    const { result } = renderHook(() =>
      useTranslation(['notLoadedNS', 'alreadyLoadedNS'], { i18n: instance2 }),
    );

    expect(result.current.ready).toBe(false);
    warnSpy.mockClear();
    result.current.t('keyOne');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('t was called before ready'),
      expect.objectContaining({ code: 'USE_T_BEFORE_READY' }),
    );
    warnSpy.mockRestore();
  });

  it('should not warn when t is called and ready is true', () => {
    const warnSpy = vitest.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderHook(() => useTranslation('alreadyLoadedNS', { i18n: instance }));

    expect(result.current.ready).toBe(true);
    warnSpy.mockClear();
    result.current.t('keyOne');
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('t was called before ready'),
      expect.anything(),
    );
    warnSpy.mockRestore();
  });

  it('should not warn when using suspense (default)', () => {
    const warnSpy = vitest.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderHook(() => useTranslation('alreadyLoadedNS', { i18n: instance }));

    warnSpy.mockClear();
    result.current.t('keyOne');
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('t was called before ready'),
      expect.anything(),
    );
    warnSpy.mockRestore();
  });

  it('should ignore suspense if set useSuspense to false', () => {
    const instance2 = { ...instance };
    instance2.options.react = { useSuspense: false };
    instance2.services.backendConnector = {
      backend: {},
      state: { 'en|notLoadedNS': 1, 'fr|notLoadedNS': 1 },
    };

    const { result } = renderHook(() =>
      useTranslation(['notLoadedNS', 'alreadyLoadedNS'], { i18n: instance2 }),
    );

    const { t } = result.current;
    expect(t('keyOne')).toBe('keyOne');
  });
});
