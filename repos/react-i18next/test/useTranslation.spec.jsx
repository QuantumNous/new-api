import { describe, it, vitest, expect, beforeAll, afterAll, afterEach } from 'vitest';
import React from 'react';
import { renderHook, cleanup, render, act } from '@testing-library/react';
import { createInstance } from 'i18next';
import i18nInstance from './i18n';
import { useTranslation } from '../src/useTranslation';
import { setI18n } from '../src/context';
import { I18nextProvider } from '../src/I18nextProvider';

vitest.unmock('../src/useTranslation');
vitest.unmock('../src/I18nextProvider');

describe('useTranslation', () => {
  afterEach(() => {
    cleanup();
  });

  describe('object', () => {
    it('should render correct content', () => {
      const { result } = renderHook(() => useTranslation('translation', { i18n: i18nInstance }));
      const { t, i18n } = result.current;
      expect(t('key1')).toBe('test');
      expect(t(($) => $.key1)).toBe('test');
      // expect(i18n).toBe(i18nInstance);
      expect(i18n.__original).toBe(i18nInstance);
    });
  });

  describe('proper object-equality of returned t function', () => {
    it('should refresh t upon i18n.changeLanguage', () => {
      const { result, rerender } = renderHook(() =>
        useTranslation('translation', { i18n: i18nInstance }),
      );
      const { i18n, t } = result.current;
      expect(i18n.language).toBe('en');
      i18n.changeLanguage('fr');
      try {
        rerender();
        const { t: refreshedT, i18n: refreshedI18n } = result.current;
        expect(refreshedT).not.toBe(t);
        // expect(refreshedI18n).toBe(i18n);
        expect(refreshedI18n.__original).toBe(i18n.__original);
      } finally {
        i18n.changeLanguage('en');
      }
    });
  });

  describe('array', () => {
    it('should render correct content', () => {
      const { result } = renderHook(() => useTranslation('translation', { i18n: i18nInstance }));
      const [t, i18n] = result.current;
      expect(t('key1')).toBe('test');
      // expect(i18n).toBe(i18nInstance);
      expect(i18n.__original).toBe(i18nInstance);
    });
  });

  describe('without i18next instance', () => {
    beforeAll(() => {
      setI18n(undefined);
    });

    afterAll(() => {
      setI18n(i18nInstance);
    });

    describe('handling gracefully', () => {
      it('should render content fallback', () => {
        console.warn = vitest.fn();

        const { result } = renderHook(() => useTranslation('translation', { i18n: undefined }));
        const { t, i18n } = result.current;

        expect(t('key1')).toBe('key1');
        expect(t(['doh', 'Human friendly fallback'])).toBe('Human friendly fallback');
        expect(i18n).toEqual({});

        expect(console.warn).toHaveBeenCalled();
      });

      it('should return empty string for a selector function when not ready', () => {
        console.warn = vitest.fn();

        const { result } = renderHook(() => useTranslation('translation', { i18n: undefined }));
        const { t } = result.current;

        // A selector function cannot be resolved without an i18n instance —
        // returning '' is safer than leaking the raw function reference.
        expect(t(($) => $.foo)).toBe('');
      });

      it('should return empty string for an array of selector functions when not ready', () => {
        console.warn = vitest.fn();

        const { result } = renderHook(() => useTranslation('translation', { i18n: undefined }));
        const { t } = result.current;

        expect(t([($) => $.foo, ($) => $.fallback])).toBe('');
      });

      it('should still honour defaultValue with a selector when not ready', () => {
        console.warn = vitest.fn();

        const { result } = renderHook(() => useTranslation('translation', { i18n: undefined }));
        const { t } = result.current;

        expect(t(($) => $.foo, 'my default')).toBe('my default');
        expect(t([($) => $.foo, ($) => $.fallback], { defaultValue: 'my default' })).toBe(
          'my default',
        );
      });
    });
  });

  describe('few namespaces', () => {
    it('hook destructured values are expected types', () => {
      const { result } = renderHook(() =>
        useTranslation(['other', 'translation'], { i18n: i18nInstance }),
      );
      const { t, i18n } = result.current;
      expect(typeof t).toBe('function');
      expect(i18n).toEqual(i18nInstance);
      expect(t('key1')).toEqual('key1');
    });

    describe('fallback mode', () => {
      beforeAll(() => {
        i18nInstance.options.react.nsMode = 'fallback';
      });

      afterAll(() => {
        delete i18nInstance.options.react.nsMode;
      });

      it('should render correct content', () => {
        const { result } = renderHook(() =>
          useTranslation(['other', 'translation'], { i18n: i18nInstance }),
        );
        const { t } = result.current;

        expect(t('key1')).toBe('test');
      });
    });

    it('should render content fallback', () => {
      const { result } = renderHook(() =>
        useTranslation(['other', 'translation'], { i18n: i18nInstance }),
      );
      const { t } = result.current;

      expect(t('key1')).toBe('key1');
    });

    // Hook is bound to its full namespace list via getFixedT's `scopeNs` opt
    // (i18next ≥ 26.0.10). Resolution scope is unchanged (still primary-only
    // outside `nsMode: 'fallback'`); only the selector path[0] check sees the
    // secondary namespaces, so `$ => $.secondaryNs.foo` routes correctly.
    describe('selector with secondary namespace prefix (no nsMode: fallback)', () => {
      it('should resolve a selector path whose first segment is a secondary namespace', () => {
        const { result } = renderHook(() =>
          useTranslation(['translation', 'other'], { i18n: i18nInstance }),
        );
        const { t } = result.current;

        // 'transTest1' exists in both namespaces with different values.
        // Selector with explicit secondary-ns prefix must resolve to `other`.
        expect(t(($) => $.other.transTest1)).toBe('Another go <1>there</1>.');
        // No prefix → still resolved against primary ns.
        expect(t(($) => $.transTest1)).toBe('Go <1>there</1>.');
      });

      it('should keep non-selector resolution isolated to the primary ns', () => {
        // Defends against accidentally turning every t() into a fallback chain.
        const { result } = renderHook(() =>
          useTranslation(['translation', 'other'], { i18n: i18nInstance }),
        );
        const { t } = result.current;

        // 'nestedKey2' only exists in `other`. Default mode must NOT find it.
        expect(t('nestedKey2')).toBe('nestedKey2');
      });
    });
  });

  describe('default namespace from context', () => {
    afterEach(() => {
      i18nInstance.reportNamespaces.usedNamespaces = {};
    });

    const namespace = 'sampleNS';
    const wrapper = ({ children }) => (
      <I18nextProvider defaultNS={namespace} i18={i18nInstance}>
        {children}
      </I18nextProvider>
    );

    it('should render content fallback', () => {
      const { result } = renderHook(() => useTranslation(), { wrapper });
      const { t } = result.current;

      expect(t('key1')).toBe('key1');

      expect(i18nInstance.reportNamespaces.getUsedNamespaces()).toContain(namespace);
    });
  });

  describe('key prefix', () => {
    i18nInstance.addResource('en', 'translation', 'deeply.nested_a.key', 'here_a!');
    i18nInstance.addResource('en', 'translation', 'deeply.nested_b.key', 'here_b!');

    it('should apply keyPrefix and reset it once changed', () => {
      let keyPrefix = 'deeply.nested_a';
      const { result, rerender } = renderHook(() =>
        useTranslation('translation', { i18n: i18nInstance, keyPrefix }),
      );
      const { t: t1 } = result.current;
      expect(t1('key')).toBe('here_a!');
      expect(t1.keyPrefix).toBe('deeply.nested_a');
      expect(t1(($) => $.key)).toBe('here_a!');

      keyPrefix = 'deeply.nested_b';
      rerender();

      const { t: t2 } = result.current;
      expect(t2('key')).toBe('here_b!');
      expect(t2.keyPrefix).toBe('deeply.nested_b');
      expect(t2(($) => $.key)).toBe('here_b!');
    });
  });

  describe('replacing i18n instance in provider', () => {
    i18nInstance.addResource('fr', 'translation', 'key1', 'test2');
    const i18nInstanceClone = i18nInstance.cloneInstance({ lng: 'fr' });
    const wrapper = ({ children }) => (
      <I18nextProvider i18n={children?.props?.renderCallbackProps.i18n}>{children}</I18nextProvider>
    );

    it('should render correct content', async () => {
      const { result, rerender } = renderHook(() => useTranslation(), {
        wrapper,
        initialProps: { i18n: i18nInstance },
      });

      expect(result.current.t('key1')).toBe('test');
      rerender({ i18n: i18nInstanceClone });
      expect(result.current.t('key1')).toBe('test2');
    });
  });

  describe('with lng prop', () => {
    i18nInstance.addResource('en', 'translation', 'myKey', 'second test');
    i18nInstance.addResource('fr', 'translation', 'myKey', 'deuxième essai');
    i18nInstance.addResource('it', 'translation', 'myKey', 'secondo test');
    const wrapper = ({ children, i18n }) => (
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    );

    it('should not fail when passing bindI18n: false or undefined', () => {
      expect(() =>
        renderHook(() => useTranslation('translation', { bindI18n: false })),
      ).to.not.throw();
      expect(() =>
        renderHook(() => useTranslation('translation', { bindI18n: undefined })),
      ).to.not.throw();
    });

    it('should render correct content', () => {
      const { result: resultNoLng } = renderHook(() => useTranslation('translation'), {
        wrapper,
        initialProps: {
          i18n: i18nInstance,
        },
      });
      const { t: t1 } = resultNoLng.current;
      expect(t1('myKey')).toBe('second test');

      const { result: resultIt } = renderHook(() => useTranslation('translation', { lng: 'it' }), {
        wrapper,
        initialProps: {
          i18n: i18nInstance,
        },
      });

      const { t: t2 } = resultIt.current;
      expect(t2('myKey')).toBe('secondo test');

      const { result: resultFr } = renderHook(() => useTranslation('translation', { lng: 'fr' }), {
        wrapper,
        initialProps: {
          i18n: i18nInstance,
        },
      });

      const { t: t3 } = resultFr.current;
      expect(t3('myKey')).toBe('deuxième essai');
    });
  });

  describe('deprecated wait option', () => {
    it('should warn when using deprecated wait option', () => {
      const i18nWithWait = createInstance();
      i18nWithWait.init({
        lng: 'en',
        resources: {
          en: { translation: { key: 'value' } },
        },
        react: {
          wait: true,
        },
      });

      function TestComponent() {
        const { t } = useTranslation(undefined, { i18n: i18nWithWait });
        return <div>{t('key')}</div>;
      }

      const { container } = render(<TestComponent />);
      expect(container.textContent).toBeTruthy();
    });
  });

  describe('useTranslation __original safety', () => {
    it('does not throw when the source i18n has a non-configurable __original property', async () => {
      const mockI18n = createInstance();
      await mockI18n.init({
        lng: 'en',
        resources: { en: { translation: { key1: 'test' } } },
        react: { useSuspense: false },
      });

      // Simulate a non-configurable __original on the source instance
      Object.defineProperty(mockI18n, '__original', {
        value: 'existing',
        writable: false,
        enumerable: false,
        configurable: false,
      });

      // Should not throw; wrapper creation should handle the existing non-configurable descriptor
      const { result } = renderHook(() => useTranslation('translation', { i18n: mockI18n }));

      // The returned wrapper should expose __original pointing to the original instance
      expect(result.current.i18n.__original).toBe(mockI18n);
    });
  });

  describe('useTranslation language wrapper identity', () => {
    it('only replaces returned i18n wrapper when language actually changes', async () => {
      const { result, rerender } = renderHook(() =>
        useTranslation('translation', { i18n: i18nInstance }),
      );

      const beforeWrapper = result.current.i18n;
      expect(beforeWrapper.__original || beforeWrapper).toBe(i18nInstance);

      // calling changeLanguage with the same current language should NOT replace wrapper
      await i18nInstance.changeLanguage(i18nInstance.language);
      rerender();
      expect(result.current.i18n).toBe(beforeWrapper);

      // calling changeLanguage to a different language SHOULD replace wrapper
      i18nInstance.changeLanguage('fr');
      rerender();
      const afterWrapper = result.current.i18n;
      expect(afterWrapper).not.toBe(beforeWrapper);
      expect(afterWrapper.__original).toBe(i18nInstance);

      // restore language
      await i18nInstance.changeLanguage('en');
      rerender();
    });
  });

  it('should not trigger loadNamespaces on every render if namespaces array is unstable (inline)', async () => {
    const i18n = createInstance();
    i18n.init({
      lng: 'en',
      resources: {},
      react: { useSuspense: false },
    });

    // Mock hasLoadedNamespace to return false so we hit the loading path
    i18n.hasLoadedNamespace = () => false;

    // Mock loadNamespaces to do nothing (pending)
    i18n.loadNamespaces = vitest.fn();

    let renderCount = 0;
    const countCalls = [];
    // Create a hook wrapper that forces re-renders by prop
    const { rerender } = renderHook(
      ({ count }) => {
        countCalls.push(count);
        renderCount += 1;
        // Inline array: New reference every render
        useTranslation(['ns1'], { i18n });
      },
      { initialProps: { count: 0 } },
    );

    // Initial render
    expect(i18n.loadNamespaces).toHaveBeenCalledTimes(1);
    expect(renderCount).to.eql(1);
    expect(countCalls).to.have.lengthOf(1);
    expect(countCalls[0]).to.eql(0);

    rerender({ count: 1 });
    expect(i18n.loadNamespaces).toHaveBeenCalledTimes(1);
    expect(renderCount).to.eql(2);
    expect(countCalls).to.have.lengthOf(2);
    expect(countCalls[1]).to.eql(1);

    rerender({ count: 2 });
    expect(i18n.loadNamespaces).toHaveBeenCalledTimes(1);
    expect(renderCount).to.eql(3);
    expect(countCalls).to.have.lengthOf(3);
    expect(countCalls[2]).to.eql(2);
  });
});
