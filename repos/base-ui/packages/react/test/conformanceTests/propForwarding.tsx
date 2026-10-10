import * as React from 'react';
import { expect } from 'vitest';
import { flushMicrotasks, randomStringValue, screen } from '@mui/internal-test-utils';
import { throwMissingPropError } from './utils';
import type {
  ConformantComponentProps,
  BaseUiConformanceTestsOptions,
} from '../describeConformance';

export function testPropForwarding(
  element: React.ReactElement<ConformantComponentProps>,
  getOptions: () => BaseUiConformanceTestsOptions,
) {
  const { render, testRenderPropWith: Element = 'div', button = false } = getOptions();

  if (!render) {
    throwMissingPropError('render');
  }

  const nativeButton = Element === 'button';

  describe('prop forwarding', () => {
    it('forwards custom props to the default element', async () => {
      const otherProps = {
        lang: 'fr',
        'data-foobar': randomStringValue(),
      };

      await render(React.cloneElement(element, { 'data-testid': 'root', ...otherProps }));

      await flushMicrotasks();

      const customRoot = screen.getByTestId('root');
      expect(customRoot).toHaveAttribute('lang', otherProps.lang);
      expect(customRoot).toHaveAttribute('data-foobar', otherProps['data-foobar']);
    });

    it('forwards custom props to the customized element defined with a function', async () => {
      const otherProps = {
        lang: 'fr',
        'data-foobar': randomStringValue(),
        ...(button && { nativeButton }),
      };

      await render(
        React.cloneElement(element, {
          render: (props: any) => {
            return <Element {...props} data-testid="custom-root" />;
          },
          ...otherProps,
        }),
      );

      await flushMicrotasks();

      const customRoot = screen.getByTestId('custom-root');
      expect(customRoot).toHaveAttribute('lang', otherProps.lang);
      expect(customRoot).toHaveAttribute('data-foobar', otherProps['data-foobar']);
    });

    it('forwards custom props to the customized element defined using JSX', async () => {
      const otherProps = {
        lang: 'fr',
        'data-foobar': randomStringValue(),
        ...(button && { nativeButton }),
      };

      await render(
        React.cloneElement(element, {
          render: <Element data-testid="custom-root" />,
          ...otherProps,
        }),
      );

      await flushMicrotasks();

      const customRoot = screen.getByTestId('custom-root');
      expect(customRoot).toHaveAttribute('lang', otherProps.lang);
      expect(customRoot).toHaveAttribute('data-foobar', otherProps['data-foobar']);
    });

    it('forwards the custom `style` attribute defined on the component', async () => {
      await render(
        React.cloneElement(element, {
          style: { color: 'green' },
          'data-testid': 'custom-root',
        }),
      );

      await flushMicrotasks();

      const customRoot = screen.getByTestId('custom-root');
      expect(customRoot).toHaveAttribute('style');
      expect(customRoot.getAttribute('style')).toContain('color: green');
    });

    it('forwards the custom `style` attribute defined on the render function', async () => {
      await render(
        React.cloneElement(element, {
          render: (props: any) => {
            return <Element {...props} style={{ color: 'green' }} data-testid="custom-root" />;
          },
          ...(button && { nativeButton }),
        }),
      );

      await flushMicrotasks();

      const customRoot = screen.getByTestId('custom-root');
      expect(customRoot).toHaveAttribute('style');
      expect(customRoot.getAttribute('style')).toContain('color: green');
    });

    it('forwards the custom `style` attribute defined on the render function', async () => {
      await render(
        React.cloneElement(element, {
          render: <Element style={{ color: 'green' }} data-testid="custom-root" />,
          ...(button && { nativeButton }),
        }),
      );

      await flushMicrotasks();

      const customRoot = screen.getByTestId('custom-root');
      expect(customRoot).toHaveAttribute('style');
      expect(customRoot.getAttribute('style')).toContain('color: green');
    });
  });
}
