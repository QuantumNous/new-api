import { describe, it, vitest, expect, afterEach } from 'vitest';
import { renderHook, cleanup, waitFor } from '@testing-library/react';
import { useTranslation } from '../src/useTranslation';

vitest.unmock('../src/useTranslation');

// A mock i18n instance for consistent testing
const createMockI18n = (isInitialized = true) => ({
  language: 'en',
  languages: ['en'],
  isInitialized,
  reportNamespaces: {
    addUsedNamespaces: vitest.fn(),
    getUsedNamespaces: vitest.fn(),
  },
  services: {
    resourceStore: {
      data: {
        en: {
          translation: { key: 'translated_key' },
        },
      },
    },
  },
  getFixedT: (lng, ns, keyPrefix) => (key) => {
    const prefixedKey = keyPrefix ? `${keyPrefix}.${key}` : key;
    return (
      (lng === 'en' && ns === 'translation' && prefixedKey === 'key' && 'translated_key') ||
      prefixedKey
    );
  },
  hasLoadedNamespace(ns, options) {
    return options?.lng
      ? !!this.services.resourceStore.data[options.lng]?.[ns]
      : !!this.services.resourceStore.data.en?.[ns];
  },
  loadNamespaces: vitest.fn((ns, cb) => cb()), // Default to immediate load
  on: vitest.fn(),
  off: vitest.fn(),
  options: {},
});

describe('useTranslation mounting and re-render', () => {
  afterEach(() => {
    cleanup();
  });

  /**
   * This test verifies the fix for the React Rules of Hooks violation.
   * It starts with no i18n instance and then provides one on a subsequent render.
   * The hook should handle this gracefully without crashing.
   */
  it('should handle i18n instance becoming available after initial mount', () => {
    const mockI18n = createMockI18n();
    const { result, rerender } = renderHook(({ i18n }) => useTranslation('translation', { i18n }), {
      initialProps: { i18n: undefined },
    });

    // 1. Initial render without i18n
    expect(result.current.ready).toBe(false);
    expect(result.current.t('key')).toBe('key');
    expect(result.current.i18n).toEqual({});

    // 2. Re-render with i18n instance provided
    rerender({ i18n: mockI18n });

    // 3. Hook should now be ready and functional
    expect(result.current.ready).toBe(true);
    expect(result.current.t('key')).toBe('translated_key');
    // expect(result.current.i18n).toBe(mockI18n);
    expect(result.current.i18n.__original).toBe(mockI18n);
  });

  /**
   * This test verifies the fix for the state inconsistency bug.
   * It ensures that at the exact moment `ready` becomes `true`, the `t` function
   * is the correct, working translation function, not a stale fallback.
   */
  it('should ensure t function is correct as soon as ready is true', async () => {
    const mockI18n = createMockI18n(false); // Start as not initialized
    let loadNamespacesCallback;
    mockI18n.loadNamespaces.mockImplementation((ns, cb) => {
      loadNamespacesCallback = cb; // Capture the callback to trigger it manually
    });

    const { result } = renderHook(() =>
      useTranslation('translation', { i18n: mockI18n, useSuspense: false }),
    );

    // Initially, we are not ready
    expect(result.current.ready).toBe(false);

    // Simulate the end of the initialization and namespace loading
    mockI18n.isInitialized = true;
    loadNamespacesCallback(); // This triggers the state update inside the hook

    // Wait for the hook to re-render and report readiness.
    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });

    // Then, immediately check if `t` works after readiness is confirmed.
    expect(result.current.t('key')).toBe('translated_key');
  });

  /**
   * This test verifies the stability fixes.
   * It ensures that the returned `t` function and the result object itself
   * are stable across re-renders when nothing has changed, preventing
   * unnecessary re-renders in memoized child components.
   */
  it('should return stable t function and result object across re-renders', () => {
    const mockI18n = createMockI18n();
    const { result, rerender } = renderHook(() =>
      useTranslation('translation', { i18n: mockI18n }),
    );

    const initialResult = result.current;
    const initialT = result.current.t;

    // Re-render without changing any props
    rerender();

    // Assert that the function and result object instances are the same
    expect(result.current.t).toBe(initialT);
    expect(result.current).toBe(initialResult);
  });
});
