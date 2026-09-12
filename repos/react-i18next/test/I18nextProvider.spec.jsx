import { describe, it, expect, vitest, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { I18nextProvider } from '../src/I18nextProvider';
import { useTranslation } from '../src/useTranslation';
import hasLoadedNamespace from './hasLoadedNamespaceMock.js';

vitest.unmock('../src/useTranslation');
vitest.unmock('../src/I18nextProvider');

const instance = {
  language: 'en',
  languages: ['en', 'fr'],
  services: {
    resourceStore: {
      data: {},
    },
    backendConnector: { backend: {}, state: {} },
  },
  isInitialized: true,
  changeLanguage: () => {},
  getFixedT: () => (message) => message,
  hasResourceBundle: (lng, ns) => ns === 'translation',
  loadNamespaces: () => {},
  hasLoadedNamespace: (ns) => hasLoadedNamespace(ns, instance),
  on: () => {},
  off: () => {},
  options: {},
};

describe('I18nextProvider', () => {
  afterEach(() => {
    cleanup();
  });

  it('should render correct content', () => {
    function TestComponent() {
      const { t, i18n } = useTranslation('translation');

      expect(typeof t).toBe('function');
      // expect(i18n).toBe(instance);
      expect(i18n.__original).toBe(instance);

      return <div>{t('key1')}</div>;
    }

    render(
      <I18nextProvider i18n={instance}>
        <TestComponent />
      </I18nextProvider>,
    );

    expect(screen.getByText('key1')).toBeInTheDocument();
  });

  it('should not rerender if value is not changed', () => {
    let count = 0;
    const TestComponent = React.memo(function TestComponent() {
      const { t } = useTranslation('translation');
      count += 1;
      return <div>{t('key1')}</div>;
    });

    const { rerender } = render(
      <I18nextProvider i18n={instance}>
        <TestComponent />
      </I18nextProvider>,
    );
    expect(count).toBe(1);
    rerender(
      <I18nextProvider i18n={instance}>
        <TestComponent />
      </I18nextProvider>,
    );
    expect(count).toBe(1);
  });
});
