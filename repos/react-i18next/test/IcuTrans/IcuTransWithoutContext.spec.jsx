import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { IcuTransWithoutContext } from '../../src/IcuTransWithoutContext';
import * as i18nInstanceModule from '../../src/i18nInstance';
import i18n from '../i18n';

describe('IcuTransWithoutContext', () => {
  beforeAll(async () => {
    await i18n.init();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('basic rendering with i18n prop', () => {
    it('should render with i18n instance passed as prop', () => {
      const { container } = render(
        <IcuTransWithoutContext
          i18nKey="test.plain"
          defaultTranslation="Hello World"
          content={[]}
          i18n={i18n}
        />,
      );

      expect(container.textContent).toBe('Hello World');
    });

    it('should render with components', () => {
      const { container } = render(
        <IcuTransWithoutContext
          i18nKey="test.component"
          defaultTranslation="Click <0>here</0>"
          content={[{ type: 'strong', props: {} }]}
          i18n={i18n}
        />,
      );

      expect(container.innerHTML).toContain('<strong>here</strong>');
    });
  });

  describe('missing i18n instance', () => {
    it('should fallback to defaultTranslation when i18n is not available', () => {
      // Mock getI18n to return undefined
      vi.spyOn(i18nInstanceModule, 'getI18n').mockReturnValue(undefined);

      const { container } = render(
        <IcuTransWithoutContext
          i18nKey="test.no.i18n"
          defaultTranslation="Fallback text"
          content={[]}
        />,
      );

      // Should render the defaultTranslation
      expect(container.textContent).toBe('Fallback text');
    });

    it('should render defaultTranslation as plain text when no i18n', () => {
      // Mock getI18n to return undefined
      vi.spyOn(i18nInstanceModule, 'getI18n').mockReturnValue(undefined);

      const { container } = render(
        <IcuTransWithoutContext
          i18nKey="test.no.i18n.components"
          defaultTranslation="Fallback with tags"
          content={[{ type: 'strong', props: {} }]}
        />,
      );

      // Should render just the defaultTranslation string (not parsed when no i18n)
      expect(container.textContent).toBe('Fallback with tags');
    });
  });

  describe('namespace handling', () => {
    it('should use provided namespace string', () => {
      const { container } = render(
        <IcuTransWithoutContext
          i18nKey="test.ns"
          defaultTranslation="Namespace test"
          content={[]}
          ns="translation"
          i18n={i18n}
        />,
      );

      expect(container.textContent).toBeTruthy();
    });

    it('should use namespace array when provided', () => {
      const { container } = render(
        <IcuTransWithoutContext
          i18nKey="test.ns.array"
          defaultTranslation="Multi namespace"
          content={[]}
          ns={['common', 'translation']}
          i18n={i18n}
        />,
      );

      expect(container.textContent).toBeTruthy();
    });

    it('should fall back to translation namespace when ns is null/undefined', () => {
      // Create i18n without defaultNS and t without ns
      const mockI18n = {
        t: vi.fn((key, opts) => opts.defaultValue),
        options: {},
      };

      const { container } = render(
        <IcuTransWithoutContext
          i18nKey="test.no.ns"
          defaultTranslation="No namespace"
          content={[]}
          ns={null}
          i18n={mockI18n}
        />,
      );

      expect(container.textContent).toBe('No namespace');
      // Verify the t function was called with 'translation' namespace
      expect(mockI18n.t).toHaveBeenCalledWith(
        'test.no.ns',
        expect.objectContaining({
          ns: ['translation'],
        }),
      );
    });

    it('should use t.ns when available and no ns prop provided', () => {
      const customT = vi.fn(() => 'Translation');
      customT.ns = 'custom';

      const { container } = render(
        <IcuTransWithoutContext
          i18nKey="test.t.ns"
          defaultTranslation="Test"
          content={[]}
          i18n={i18n}
          t={customT}
        />,
      );

      expect(container.textContent).toBeTruthy();
    });
  });

  describe('values and interpolation', () => {
    it('should pass values to translation', () => {
      const { container } = render(
        <IcuTransWithoutContext
          i18nKey="test.values"
          defaultTranslation="Hello World"
          content={[]}
          values={{ name: 'World' }}
          i18n={i18n}
        />,
      );

      expect(container.textContent).toBeTruthy();
    });

    it('should merge default interpolation variables', () => {
      // Create a custom i18n instance with default variables
      const customI18n = i18n.cloneInstance({
        interpolation: {
          defaultVariables: {
            appName: 'MyApp',
            version: '1.0',
          },
        },
      });

      const { container } = render(
        <IcuTransWithoutContext
          i18nKey="test.default.vars"
          defaultTranslation="Test"
          content={[]}
          values={{ custom: 'value' }}
          i18n={customI18n}
        />,
      );

      expect(container.textContent).toBeTruthy();
    });

    it('should use only default variables when no values provided', () => {
      const customI18n = i18n.cloneInstance({
        interpolation: {
          defaultVariables: {
            appName: 'MyApp',
          },
        },
      });

      const { container } = render(
        <IcuTransWithoutContext
          i18nKey="test.only.defaults"
          defaultTranslation="Test"
          content={[]}
          i18n={customI18n}
        />,
      );

      expect(container.textContent).toBeTruthy();
    });
  });

  describe('custom t function', () => {
    it('should use custom t function when provided', () => {
      const customT = vi.fn(() => 'Custom translation');

      const { container } = render(
        <IcuTransWithoutContext
          i18nKey="test.custom.t"
          defaultTranslation="Default"
          content={[]}
          i18n={i18n}
          t={customT}
        />,
      );

      expect(customT).toHaveBeenCalled();
      expect(container.textContent).toBe('Custom translation');
    });

    it('should use fallback t function when i18n.t is not available', () => {
      // Create an i18n-like object without a t function
      const mockI18n = {
        options: {
          defaultNS: 'translation',
        },
      };

      const { container } = render(
        <IcuTransWithoutContext
          i18nKey="test.fallback.t"
          defaultTranslation="Fallback key test"
          content={[]}
          i18n={mockI18n}
        />,
      );

      // Should use the fallback t function `((k) => k)` which returns the key
      expect(container.textContent).toBe('test.fallback.t');
    });
  });

  describe('error handling', () => {
    it('should handle rendering errors gracefully with mismatched tags', () => {
      const { container } = render(
        <IcuTransWithoutContext
          i18nKey="test.error.mismatched"
          defaultTranslation="<0>Text</1>"
          content={[{ type: 'div', props: {} }]}
          i18n={i18n}
        />,
      );

      // Should fallback to showing the translation string when error occurs
      expect(container.textContent).toBe('<0>Text</1>');
    });
  });

  describe('displayName', () => {
    it('should have correct displayName', () => {
      expect(IcuTransWithoutContext.displayName).toBe('IcuTransWithoutContext');
    });
  });
});
