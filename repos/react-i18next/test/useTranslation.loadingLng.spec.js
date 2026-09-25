import { describe, it, vitest, beforeEach, afterEach, expect } from 'vitest';
import { renderHook, cleanup, waitFor } from '@testing-library/react';
import i18n from './i18n';
import { BackendLngAwareMock } from './backendLngAwareMock';
import { useTranslation } from '../src/useTranslation';

vitest.unmock('../src/useTranslation');

describe('useTranslation loading ns with lng via props', () => {
  let newI18n;
  /** @type {BackendLngAwareMock} */
  let backend;

  beforeEach(() => {
    newI18n = i18n.createInstance();
    backend = new BackendLngAwareMock();
    newI18n.use(backend).init({
      lng: 'en',
      fallbackLng: 'en',
    });
  });

  afterEach(cleanup);

  it('should wait for correct translation with suspense', async () => {
    const all = [];
    const { result } = renderHook(() => {
      const value = useTranslation('common', { i18n: newI18n, useSuspense: true, lng: 'de' });
      all.push(value);
      return value;
    });

    expect(all).toHaveLength(0);
    backend.flush();
    await waitFor(() => expect(result.current.t('key1')).toBe('de/common for key1'));
  });

  it('should wait for correct translation without suspense', async () => {
    const { result } = renderHook(() =>
      useTranslation('common', { i18n: newI18n, useSuspense: false, lng: 'it' }),
    );
    const { t } = result.current;
    expect(t('key1')).toBe('key1');

    backend.flush();
    expect(t('key1')).toBe('it/common for key1');
  });

  it('should return defaultValue if resources not yet loaded', async () => {
    const { result } = renderHook(() =>
      useTranslation('common', { i18n: newI18n, useSuspense: false, lng: 'fr' }),
    );
    const { t } = result.current;
    expect(t('key1', 'my default value')).toBe('my default value');
    expect(t('key1', { defaultValue: 'my default value' })).toBe('my default value');

    backend.flush({ language: 'en' });
    expect(t('key1', 'my default value')).toBe('en/common for key1');
    expect(t('key1', { defaultValue: 'my default value' })).toBe('en/common for key1');

    backend.flush({ language: 'fr' });
    expect(t('key1', 'my default value')).toBe('fr/common for key1');
    expect(t('key1', { defaultValue: 'my default value' })).toBe('fr/common for key1');
  });

  it('should correctly return and render correct translations in multiple useTranslation usages', async () => {
    {
      const { result } = renderHook(() =>
        useTranslation('newns', { i18n: newI18n, useSuspense: true, lng: 'pt' }),
      );

      backend.flush();
      await waitFor(() => expect(result.current.t('key1')).toBe('pt/newns for key1'));
    }

    {
      const { result } = renderHook(() =>
        useTranslation('newns', { i18n: newI18n, useSuspense: true, lng: 'de' }),
      );

      backend.flush({ language: 'de' });
      await waitFor(() => expect(result.current.t('key1')).toBe('de/newns for key1'));
    }

    {
      const { result } = renderHook(() =>
        useTranslation('newns', { i18n: newI18n, useSuspense: true, lng: 'pt' }),
      );
      // backend.flush({ language: 'pt' }); // already loaded
      // await retPT.waitForNextUpdate(); // already loaded
      const { t } = result.current;
      expect(t('key1')).toBe('pt/newns for key1');
    }
  });
});
