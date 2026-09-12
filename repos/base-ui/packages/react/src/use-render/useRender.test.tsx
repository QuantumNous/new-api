import { expect } from 'vitest';
/* eslint-disable testing-library/render-result-naming-convention */
import * as React from 'react';
import { useRender } from '@base-ui/react/use-render';
import { createRenderer } from '#test-utils';

describe('useRender', () => {
  const { render } = createRenderer();

  it('render props does not overwrite className in a render function when unspecified', async () => {
    function TestComponent(props: {
      render: useRender.Parameters<{}, Element, undefined>['render'];
      className?: string;
    }) {
      const { render: renderProp, className } = props;
      const element = useRender({
        render: renderProp,
        props: {
          className,
        },
      });
      return element;
    }

    const { container } = await render(
      <TestComponent
        render={(props: any, state: any) => (
          <span {...props} className={`my-span ${props.className ?? ''}`} {...state} />
        )}
      />,
    );

    const element = container.firstElementChild;

    expect(element).toHaveAttribute('class', 'my-span ');
  });

  it('refs are handled as expected', async () => {
    const refs: React.Ref<HTMLElement | undefined>[] = [];

    function TestComponent(
      props: {
        render: useRender.Parameters<{}, Element, undefined>['render'];
        className?: string;
      } & React.ComponentPropsWithRef<'span'>,
    ) {
      const { render: renderProp, ...otherProps } = props;
      const ref1 = React.useRef<HTMLElement>(null);
      const ref2 = React.useRef<HTMLElement>(null);

      React.useEffect(() => {
        refs[0] = ref1;
        refs[1] = ref2;
      }, []);

      const element = useRender({
        render: renderProp,
        ref: [ref1, ref2],
        props: otherProps,
      });
      return element;
    }

    const { container } = await render(
      <TestComponent render={(props: any, state: any) => <span {...props} {...state} />} />,
    );
    expect(refs.length).toBe(2);

    refs.forEach((ref) => {
      expect(ref).toEqual({ current: container.firstElementChild });
    });
  });

  describe('param: defaultTagName', () => {
    it('renders div by default if no defaultTagName and no render params are provided', async () => {
      function TestComponent() {
        return useRender({});
      }

      const { container } = await render(<TestComponent />);
      expect(container.firstElementChild).toHaveProperty('tagName', 'DIV');
    });

    it('renders the element with the default tag with no render prop', async () => {
      function TestComponent({
        defaultTagName,
      }: {
        defaultTagName: keyof React.JSX.IntrinsicElements;
      }) {
        return useRender({ defaultTagName });
      }

      const { container, setProps } = await render(<TestComponent defaultTagName="div" />);
      expect(container.firstElementChild).toHaveProperty('tagName', 'DIV');

      await setProps({ defaultTagName: 'span' });
      expect(container.firstElementChild).toHaveProperty('tagName', 'SPAN');
    });

    it('is overwritten by the render prop', async () => {
      function TestComponent({
        render: renderProp,
        defaultTagName,
      }: {
        render: useRender.Parameters<{}, Element, undefined>['render'];
        defaultTagName: keyof React.JSX.IntrinsicElements;
      }) {
        return useRender({ render: renderProp, defaultTagName });
      }

      const { container, setProps } = await render(
        <TestComponent defaultTagName="div" render={<span />} />,
      );
      expect(container.firstElementChild).toHaveProperty('tagName', 'SPAN');

      await setProps({ defaultTagName: 'a' });
      expect(container.firstElementChild).toHaveProperty('tagName', 'SPAN');
    });
  });

  describe('state to data attributes', () => {
    it('converts state to data attributes automatically', async () => {
      function TestComponent() {
        const element = useRender({
          render: <button type="button" />,
          state: {
            active: true,
            index: 42,
          },
        });
        return element;
      }

      const { container } = await render(<TestComponent />);
      const button = container.firstElementChild;

      expect(button).toHaveAttribute('data-active', '');
      expect(button).toHaveAttribute('data-index', '42');
    });

    it('handles undefined values in state', async () => {
      function TestComponent() {
        const element = useRender({
          render: <div />,
          state: {
            defined: 'value',
            notDefined: undefined,
          },
        });
        return element;
      }

      const { container } = await render(<TestComponent />);
      const div = container.firstElementChild;

      expect(div).toHaveAttribute('data-defined', 'value');
      expect(div).not.toHaveAttribute('data-notdefined');
    });

    it('merges state-based data attributes with existing props', async () => {
      function TestComponent() {
        const element = useRender({
          render: <button type="button" />,
          state: {
            form: 'login',
          },
          props: {
            className: 'btn-primary',
            id: 'submit-btn',
            'data-existing': 'prop',
          },
        });
        return element;
      }

      const { container } = await render(<TestComponent />);
      const button = container.firstElementChild;

      expect(button).toHaveAttribute('data-form', 'login');

      expect(button).toHaveAttribute('class', 'btn-primary');
      expect(button).toHaveAttribute('id', 'submit-btn');

      expect(button).toHaveAttribute('data-existing', 'prop');
    });

    it('props override state-based data attributes', async () => {
      function TestComponent() {
        const element = useRender({
          render: <button type="button" />,
          state: {
            active: true,
          },
          props: {
            'data-active': 'false',
          },
        });
        return element;
      }

      const { container } = await render(<TestComponent />);
      const button = container.firstElementChild;

      expect(button).toHaveAttribute('data-active', 'false');
    });

    it('handles empty state', async () => {
      function TestComponent() {
        const element = useRender({
          render: <span />,
          state: {},
          props: {
            className: 'test-class',
          },
        });
        return element;
      }

      const { container } = await render(<TestComponent />);
      const span = container.firstElementChild;

      expect(span).toHaveAttribute('class', 'test-class');

      const attributes = span?.attributes;
      if (attributes) {
        for (let i = 0; i < attributes.length; i += 1) {
          expect(attributes[i].name).not.toMatch(/^data-/);
        }
      }
    });

    it('handles undefined state', async () => {
      function TestComponent() {
        const element = useRender({
          render: <div />,
          state: undefined,
          props: {
            className: 'test-class',
            'data-from-props': 'value',
          },
        });
        return element;
      }

      const { container } = await render(<TestComponent />);
      const div = container.firstElementChild;

      expect(div).toHaveAttribute('class', 'test-class');
      expect(div).toHaveAttribute('data-from-props', 'value');
    });

    it('converts boolean values in state to data attributes', async () => {
      function TestComponent() {
        const element = useRender({
          render: <button type="button" />,
          state: {
            active: true,
            disabled: false,
          },
        });
        return element;
      }

      const { container } = await render(<TestComponent />);
      const button = container.firstElementChild;

      expect(button).toHaveAttribute('data-active', '');
      expect(button).not.toHaveAttribute('data-disabled');
    });

    it('converts number values in state to data attributes', async () => {
      function TestComponent() {
        const element = useRender({
          render: <div />,
          state: {
            count: 0,
            index: 42,
            percentage: 99.9,
          },
        });
        return element;
      }

      const { container } = await render(<TestComponent />);
      const div = container.firstElementChild;

      expect(div).not.toHaveAttribute('data-count');
      expect(div).toHaveAttribute('data-index', '42');
      expect(div).toHaveAttribute('data-percentage', '99.9');
    });

    it('supports custom stateAttributesMapping for kebab-case conversion', async () => {
      function TestComponent() {
        const element = useRender({
          render: <button type="button" />,
          state: {
            isActive: true,
            itemCount: 5,
            userName: 'John',
          },
          stateAttributesMapping: {
            isActive: (value) => (value ? { 'data-is-active': '' } : null),
            itemCount: (value) => ({ 'data-item-count': value.toString() }),
            userName: (value) => ({ 'data-user-name': value }),
          },
        });
        return element;
      }

      const { container } = await render(<TestComponent />);
      const button = container.firstElementChild;

      expect(button).toHaveAttribute('data-is-active', '');
      expect(button).toHaveAttribute('data-item-count', '5');
      expect(button).toHaveAttribute('data-user-name', 'John');
    });
  });
});
