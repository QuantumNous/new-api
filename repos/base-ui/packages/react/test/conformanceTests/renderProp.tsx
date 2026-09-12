import * as React from 'react';
import { expect } from 'vitest';
import { randomStringValue, screen } from '@mui/internal-test-utils';
import type {
  ConformantComponentProps,
  BaseUiConformanceTestsOptions,
} from '../describeConformance';
import { throwMissingPropError } from './utils';

export function testRenderProp(
  element: React.ReactElement<ConformantComponentProps>,
  getOptions: () => BaseUiConformanceTestsOptions,
) {
  const {
    render,
    testRenderPropWith: Element = 'div',
    button = false,
    wrappingAllowed = true,
  } = getOptions();

  if (!render) {
    throwMissingPropError('render');
  }

  const nativeButton = Element === 'button';

  const Wrapper = React.forwardRef<any, { children?: React.ReactNode }>(
    function Wrapper(props, forwardedRef) {
      return wrappingAllowed ? (
        <div data-testid="base-ui-wrapper">
          <Element ref={forwardedRef} {...props} data-testid="wrapped" />
        </div>
      ) : (
        /* @ts-expect-error complex type */
        <Element ref={forwardedRef} {...props} data-testid="wrapped" />
      );
    },
  );

  describe('prop: render', () => {
    it('renders a customized root element with a function', async () => {
      const testValue = randomStringValue();

      await render(
        React.cloneElement(element, {
          render: (props: any) => {
            const { key, ...propsWithoutKey } = props;
            return <Wrapper key={key} {...propsWithoutKey} data-test-value={testValue} />;
          },
          ...(button && { nativeButton }),
        }),
      );

      if (wrappingAllowed) {
        expect(screen.queryByTestId('base-ui-wrapper')).not.toBe(null);
      }
      expect(screen.queryByTestId('wrapped')).not.toBe(null);
      expect(screen.queryByTestId('wrapped')).toHaveAttribute('data-test-value', testValue);
    });

    it('renders a customized root element with an element', async () => {
      const testValue = randomStringValue();

      await render(
        React.cloneElement(element, {
          render: <Wrapper data-test-value={testValue} />,
          ...(button && { nativeButton }),
        }),
      );

      if (wrappingAllowed) {
        expect(screen.queryByTestId('base-ui-wrapper')).not.toBe(null);
      }
      expect(screen.queryByTestId('wrapped')).not.toBe(null);
      expect(screen.queryByTestId('wrapped')).toHaveAttribute('data-test-value', testValue);
    });

    it('renders a customized root element with an element', async () => {
      await render(
        React.cloneElement(element, {
          render: <Wrapper />,
          ...(button && { nativeButton: Element === 'button' }),
        }),
      );

      if (wrappingAllowed) {
        expect(screen.queryByTestId('base-ui-wrapper')).not.toBe(null);
      } else {
        expect(screen.queryByTestId('wrapped')).not.toBe(null);
      }
    });

    it('should pass the ref to the custom component', async () => {
      let instanceFromRef = null;

      function Test() {
        return React.cloneElement(element, {
          ref: (el: HTMLElement | null) => {
            instanceFromRef = el;
          },
          render: (props: any) => {
            const { key, ...propsWithoutKey } = props;
            return <Wrapper key={key} {...propsWithoutKey} />;
          },
          'data-testid': 'wrapped',
          ...(button && { nativeButton }),
        });
      }

      await render(<Test />);
      expect(instanceFromRef!.tagName).toBe(Element.toUpperCase());
      expect(instanceFromRef!).toHaveAttribute('data-testid', 'wrapped');
    });

    it('should merge the rendering element ref with the custom component ref', async () => {
      let refA = null;
      let refB = null;

      function Test() {
        return React.cloneElement(element, {
          ref: (el: HTMLElement | null) => {
            refA = el;
          },
          render: (
            <Wrapper
              ref={(el: HTMLElement | null) => {
                refB = el;
              }}
            />
          ),
          'data-testid': 'wrapped',
          ...(button && { nativeButton }),
        });
      }

      await render(<Test />);

      expect(refA).not.toBe(null);
      expect(refA!.tagName).toBe(Element.toUpperCase());
      expect(refA!).toHaveAttribute('data-testid', 'wrapped');
      expect(refB).not.toBe(null);
      expect(refB!.tagName).toBe(Element.toUpperCase());
      expect(refB!).toHaveAttribute('data-testid', 'wrapped');
    });

    it('should merge the rendering element className with the custom component className', async () => {
      function Test() {
        return React.cloneElement(element, {
          className: 'component-classname',
          render: <Element className="render-prop-classname" />,
          'data-testid': 'test-component',
          ...(button && { nativeButton }),
        });
      }

      await render(<Test />);

      const component = screen.getByTestId('test-component');
      expect(component.classList.contains('component-classname')).toBe(true);
      expect(component.classList.contains('render-prop-classname')).toBe(true);
    });

    it('should merge the rendering element resolved className with the custom component className', async () => {
      function Test() {
        return React.cloneElement(element, {
          className: () => 'conditional-component-classname',
          render: <Element className="render-prop-classname" />,
          'data-testid': 'test-component',
          ...(button && { nativeButton }),
        });
      }

      await render(<Test />);

      const component = screen.getByTestId('test-component');
      expect(component.classList.contains('conditional-component-classname')).toBe(true);
      expect(component.classList.contains('render-prop-classname')).toBe(true);
    });
  });
}
