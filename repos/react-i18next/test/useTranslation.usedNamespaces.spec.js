import { describe, it, vitest, expect, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useTranslation } from '../src/useTranslation';

vitest.unmock('../src/useTranslation');

describe('useTranslation', () => {
  afterEach(() => {
    cleanup();
  });

  it('should render correct content if ready (having all ns)', () => {
    const i18n = {
      language: 'en',
      languages: ['en'],
      services: {
        resourceStore: {
          data: {},
        },
        backendConnector: { backend: {} },
      },
      isInitialized: true,
      changeLanguage: () => {},
      getFixedT: () => (message) => message,
      hasLoadedNamespace: () => false,
      hasResourceBundle: (lng, ns) => ns === 'ns1' || ns === 'ns2' || ns === 'ns3',
      loadNamespaces: () => {},
      on: () => {},
      off: () => {},
      options: {},
    };
    renderHook(() => useTranslation(['ns1', 'ns2', 'ns3'], { i18n }));

    expect(i18n.reportNamespaces.getUsedNamespaces()).toEqual(['ns1', 'ns2', 'ns3']);
  });
});
