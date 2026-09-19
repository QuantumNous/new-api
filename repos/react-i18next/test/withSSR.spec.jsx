import { describe, it, vitest, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import React from 'react';
import i18n from './i18n';
import { setI18n } from '../src/context';
import { withSSR } from '../src/withSSR';
import { useTranslation } from '../src/useTranslation';
import hasLoadedNamespace from './hasLoadedNamespaceMock.js';

vitest.unmock('../src/withSSR');

describe('withSSR', () => {
  afterEach(() => {
    cleanup();
  });

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
    getResourceBundle: (lng, ns) => ({ lng, ns }),
    loadNamespaces: () => {},
    hasLoadedNamespace: (ns) => hasLoadedNamespace(ns, mockI18n),
    on: () => {},
    off: () => {},
  };

  function TestComponent() {
    useTranslation('ns1');
    return <div>SSR</div>;
  }

  TestComponent.getInitialProps = async () => ({ foo: 'bar' });

  beforeAll(() => {
    setI18n(mockI18n);
  });

  afterAll(() => {
    setI18n(i18n);
  });

  it('should export wrapped component', () => {
    const HocElement = withSSR()(TestComponent);
    expect(HocElement.WrappedComponent).toBe(TestComponent);
  });

  it('should set values', () => {
    const HocElement = withSSR()(TestComponent);
    const { container } = render(
      <HocElement initialI18nStore={{ foo: 'bar' }} initialLanguage="de" />,
    );
    expect(container.firstChild).toMatchInlineSnapshot(`
      <div>
        SSR
      </div>
    `);
    expect(mockI18n.language).toBe('de');
    expect(mockI18n.services.resourceStore.data).toEqual({ foo: 'bar' });
  });

  it('should get initialProps', async () => {
    const HocElement = withSSR()(TestComponent);

    expect.assertions(1);
    const props = await HocElement.getInitialProps({});

    const expected = {
      foo: 'bar',
      initialI18nStore: {
        en: {
          ns1: {
            lng: 'en',
            ns: 'ns1',
          },
        },
      },
      initialLanguage: 'de',
    };

    expect(props).toEqual(expected);
  });
});
