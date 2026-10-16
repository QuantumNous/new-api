import { vi, expect } from 'vitest';
/* eslint-disable testing-library/render-result-naming-convention */
import * as React from 'react';
import { createRenderer } from '#test-utils';
import { reactMajor } from '@mui/internal-test-utils';
import { EMPTY_OBJECT } from '@base-ui/utils/empty';
import type { BaseUIComponentProps, ComponentRenderFn, HTMLProps } from './types';
import { useRenderElement } from './useRenderElement';

describe('useRenderElement', () => {
  const { render } = createRenderer();

  const TestComponent = React.forwardRef(function TestComponent(
    componentProps: BaseUIComponentProps<'div', { active?: boolean }> & { active?: boolean },
    forwardedRef: React.ForwardedRef<HTMLDivElement>,
  ) {
    const { className, render: renderProp, active, style, ...elementProps } = componentProps;

    const state = { active };

    const element = useRenderElement('div', componentProps, {
      state,
      ref: forwardedRef,
      props: [{ ...elementProps, className: 'test-component', style: { padding: '10px' } }],
    });

    return element;
  });

  const DirectPropsTestComponent = React.forwardRef(function DirectPropsTestComponent(
    componentProps: BaseUIComponentProps<'div', { active?: boolean }> & { active?: boolean },
    forwardedRef: React.ForwardedRef<HTMLDivElement>,
  ) {
    const { className, render: renderProp, active, style, ...elementProps } = componentProps;

    return useRenderElement('div', componentProps, {
      state: { active },
      ref: forwardedRef,
      props: elementProps,
    });
  });

  const ArrayPropsTestComponent = React.forwardRef(function ArrayPropsTestComponent(
    componentProps: BaseUIComponentProps<'div', { active?: boolean }> & { active?: boolean },
    forwardedRef: React.ForwardedRef<HTMLDivElement>,
  ) {
    const { className, render: renderProp, active, style, ...elementProps } = componentProps;

    return useRenderElement('div', componentProps, {
      state: { active },
      ref: forwardedRef,
      props: [elementProps, { className: 'test-component' }],
    });
  });

  function DisabledPropsTestComponent(props: {
    propsGetter: () => React.ComponentPropsWithRef<'div'>;
  }) {
    return useRenderElement(
      'div',
      {},
      {
        enabled: false,
        props: [props.propsGetter],
      },
    );
  }

  function RerenderTestComponent(props: {
    enabled?: boolean;
    refs?: React.Ref<HTMLDivElement> | Array<React.Ref<HTMLDivElement> | undefined> | undefined;
    onClick?: React.MouseEventHandler<HTMLDivElement>;
  }) {
    return useRenderElement(
      'div',
      {},
      {
        enabled: props.enabled,
        ref: props.refs,
        props: [
          {
            id: 'rerender-target',
            onClick: props.onClick,
          },
        ],
      },
    );
  }

  it('accepts className as function', async () => {
    const { container } = await render(
      <TestComponent
        active
        className={(state) => (state.active ? 'active-class' : 'inactive-class')}
      />,
    );

    const element = container.firstElementChild;

    expect(element).toHaveAttribute('class', 'active-class test-component');
  });

  it('accepts className as function that returns undefined', async () => {
    const { container } = await render(
      <TestComponent className={(state) => (state.active ? 'active-class' : undefined)} />,
    );

    const element = container.firstElementChild;

    expect(element).toHaveAttribute('class', 'test-component');
  });

  it('accepts style as function', async () => {
    const { container } = await render(
      <TestComponent
        active
        style={(state) => ({ color: state.active ? 'rgb(255,0,0)' : 'rgb(0,255,0)' })}
      />,
    );

    const element = container.firstElementChild;

    expect(element?.getAttribute('style')).toBe('padding: 10px; color: rgb(255, 0, 0);');
  });

  it('accepts style as function that returns undefined', async () => {
    const { container } = await render(
      <TestComponent style={(state) => (state.active ? { color: 'rgb(255,0,0)' } : undefined)} />,
    );

    const element = container.firstElementChild;

    expect(element?.getAttribute('style')).toBe('padding: 10px;');
  });

  it('makes single prop objects preventable', async () => {
    const handleMouseDown = vi.fn((event) => {
      event.preventBaseUIHandler();
    });

    const { container } = await render(<DirectPropsTestComponent onMouseDown={handleMouseDown} />);

    const element = container.firstElementChild as HTMLDivElement;

    expect(() =>
      element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })),
    ).not.toThrow();
    expect(handleMouseDown).toHaveBeenCalledTimes(1);
  });

  it('makes multi-prop arrays preventable when the event handler is first', async () => {
    const handleMouseDown = vi.fn((event) => {
      event.preventBaseUIHandler();
    });

    const { container } = await render(<ArrayPropsTestComponent onMouseDown={handleMouseDown} />);

    const element = container.firstElementChild as HTMLDivElement;

    expect(() =>
      element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })),
    ).not.toThrow();
    expect(handleMouseDown).toHaveBeenCalledTimes(1);
  });

  it('makes obscure single-prop events preventable', async () => {
    const handleContextMenu = vi.fn((event) => {
      event.preventBaseUIHandler();
    });

    const { container } = await render(
      <DirectPropsTestComponent onContextMenu={handleContextMenu} />,
    );

    const element = container.firstElementChild as HTMLDivElement;

    expect(() =>
      element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })),
    ).not.toThrow();
    expect(handleContextMenu).toHaveBeenCalledTimes(1);
  });

  it('makes obscure multi-prop array events preventable when the event handler is first', async () => {
    const handleContextMenu = vi.fn((event) => {
      event.preventBaseUIHandler();
    });

    const { container } = await render(
      <ArrayPropsTestComponent onContextMenu={handleContextMenu} />,
    );

    const element = container.firstElementChild as HTMLDivElement;

    expect(() =>
      element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })),
    ).not.toThrow();
    expect(handleContextMenu).toHaveBeenCalledTimes(1);
  });

  it('does not resolve props when disabled', async () => {
    const propsGetter = vi.fn(() => ({
      onMouseDown() {},
    }));

    const { container } = await render(<DisabledPropsTestComponent propsGetter={propsGetter} />);

    expect(container.firstElementChild).toBeNull();
    expect(propsGetter).not.toHaveBeenCalled();
  });

  it('handles enabled toggles across rerenders', async () => {
    const ref = React.createRef<HTMLDivElement>();
    const handleClick = vi.fn();
    const { rerender } = await render(
      <RerenderTestComponent enabled={false} refs={ref} onClick={handleClick} />,
    );

    expect(document.getElementById('rerender-target')).toBeNull();
    expect(ref.current).toBeNull();

    await rerender(<RerenderTestComponent enabled refs={ref} onClick={handleClick} />);

    const element = document.getElementById('rerender-target') as HTMLDivElement;

    expect(element).not.toBeNull();
    expect(ref.current).toBe(element);

    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(handleClick).toHaveBeenCalledTimes(1);

    await rerender(<RerenderTestComponent enabled={false} refs={ref} onClick={handleClick} />);

    expect(document.getElementById('rerender-target')).toBeNull();
    expect(ref.current).toBeNull();
  });

  it('updates merged refs and event handlers when ref shape changes across rerenders', async () => {
    const primaryRef = React.createRef<HTMLDivElement>();
    const secondaryRef = React.createRef<HTMLDivElement>();
    const firstHandleClick = vi.fn();
    const secondHandleClick = vi.fn();
    const { rerender } = await render(
      <RerenderTestComponent refs={primaryRef} onClick={firstHandleClick} />,
    );

    const initialElement = document.getElementById('rerender-target');

    expect(primaryRef.current).toBe(initialElement);
    expect(secondaryRef.current).toBeNull();

    await rerender(
      <RerenderTestComponent refs={[primaryRef, secondaryRef]} onClick={secondHandleClick} />,
    );

    const updatedElement = document.getElementById('rerender-target') as HTMLDivElement;

    expect(primaryRef.current).toBe(updatedElement);
    expect(secondaryRef.current).toBe(updatedElement);

    updatedElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(firstHandleClick).toHaveBeenCalledTimes(0);
    expect(secondHandleClick).toHaveBeenCalledTimes(1);

    await rerender(<RerenderTestComponent refs={secondaryRef} onClick={secondHandleClick} />);

    expect(primaryRef.current).toBeNull();
    expect(secondaryRef.current).toBe(document.getElementById('rerender-target'));
  });

  describe('prop: render', () => {
    it('accepts render as a function that receives props and state', async () => {
      const renderCalls: Array<[HTMLProps, { active?: boolean }]> = [];
      const renderFn: ComponentRenderFn<HTMLProps, { active?: boolean }> = (props, state) => {
        renderCalls.push([props, state]);
        return <span {...props} data-active={String(state.active)} />;
      };

      const { container } = await render(
        <TestComponent active render={renderFn} data-testid="custom" />,
      );

      const element = container.firstElementChild;

      expect(renderCalls.length).toBeGreaterThan(0);
      const [firstCallProps, firstCallState] = renderCalls[0];
      expect(firstCallProps).toMatchObject({
        className: 'test-component',
        'data-testid': 'custom',
      });
      expect(firstCallProps.style).toEqual({ padding: '10px' });
      expect(firstCallState).toEqual({ active: true });
      expect(element?.tagName).toBe('SPAN');
      expect(element).toHaveAttribute('data-testid', 'custom');
      expect(element).toHaveAttribute('data-active', 'true');
    });

    it('warns when render is passed a function with an uppercase name', async () => {
      const warnSpy = vi
        .spyOn(console, 'warn')
        .mockName('console.warn')
        .mockImplementation(() => {});

      function UppercaseRenderPropWarningTestComponent(props: React.ComponentPropsWithRef<'span'>) {
        return <span {...props} />;
      }

      await render(<TestComponent render={UppercaseRenderPropWarningTestComponent} />);

      expect(warnSpy.mock.calls.length).toBe(1);
      expect(warnSpy.mock.calls[0][0]).toContain(
        'Base UI: The `render` prop received a function named `UppercaseRenderPropWarningTestComponent` that starts with an uppercase letter.',
      );
      expect(warnSpy.mock.calls[0][0]).toContain(
        'Use `render={<Component />}` or `render={(props) => <Component {...props} />}` instead.',
      );
      warnSpy.mockRestore();
    });

    it('warns when render is passed a function with an uppercase acronym prefix', async () => {
      const warnSpy = vi
        .spyOn(console, 'warn')
        .mockName('console.warn')
        .mockImplementation(() => {});

      function UIInput(props: React.ComponentPropsWithRef<'span'>) {
        return <span {...props} />;
      }

      await render(<TestComponent render={UIInput} />);

      expect(warnSpy.mock.calls.length).toBe(1);
      warnSpy.mockRestore();
    });

    it('does not warn when render is passed a lowercase callback', async () => {
      const warnSpy = vi
        .spyOn(console, 'warn')
        .mockName('console.warn')
        .mockImplementation(() => {});

      const renderFn = (props: React.ComponentPropsWithRef<'span'>) => <span {...props} />;

      await render(<TestComponent render={renderFn} />);

      expect(warnSpy.mock.calls.length).toBe(0);
      warnSpy.mockRestore();
    });

    it('does not warn when render is passed a screaming snake case callback', async () => {
      const warnSpy = vi
        .spyOn(console, 'warn')
        .mockName('console.warn')
        .mockImplementation(() => {});

      const renderFn = (props: React.ComponentPropsWithRef<'span'>) => <span {...props} />;
      Object.defineProperty(renderFn, 'name', {
        value: 'DEFAULT_RENDER',
      });

      await render(<TestComponent render={renderFn} />);

      expect(warnSpy.mock.calls.length).toBe(0);
      warnSpy.mockRestore();
    });

    it('does not warn when render is passed a callback with an inferred useCallback name', async () => {
      const warnSpy = vi
        .spyOn(console, 'warn')
        .mockName('console.warn')
        .mockImplementation(() => {});

      const renderFn = (props: React.ComponentPropsWithRef<'span'>) => <span {...props} />;
      Object.defineProperty(renderFn, 'name', {
        value: 'DropdownMenuExample.useCallback[renderSearchInput]',
      });

      await render(<TestComponent render={renderFn} />);

      expect(warnSpy.mock.calls.length).toBe(0);
      warnSpy.mockRestore();
    });

    it('does not warn when render is passed as a React element', async () => {
      const warnSpy = vi
        .spyOn(console, 'warn')
        .mockName('console.warn')
        .mockImplementation(() => {});

      function UppercaseRenderElement(props: React.ComponentPropsWithRef<'span'>) {
        return <span {...props} />;
      }

      await render(<TestComponent render={<UppercaseRenderElement />} />);

      expect(warnSpy.mock.calls.length).toBe(0);
      warnSpy.mockRestore();
    });

    it('accepts render as a React element and clones it with merged props', async () => {
      const CustomElement = React.forwardRef<HTMLSpanElement, React.ComponentPropsWithRef<'span'>>(
        function CustomElement(props, ref) {
          return <span ref={ref} {...props} />;
        },
      );

      const { container } = await render(
        <TestComponent active render={<CustomElement data-active="true" />} data-testid="custom" />,
      );

      const element = container.firstElementChild;

      expect(element?.tagName).toBe('SPAN');
      expect(element).toHaveAttribute('data-testid', 'custom');
      expect(element).toHaveAttribute('data-active', 'true');
    });

    it('forwards ref to render element', async () => {
      const CustomElement = React.forwardRef<HTMLDivElement, React.ComponentPropsWithRef<'div'>>(
        function CustomElement(props, ref) {
          return <div ref={ref} {...props} />;
        },
      );

      const ref = React.createRef<HTMLDivElement>();
      const { container } = await render(<TestComponent ref={ref} render={<CustomElement />} />);
      const element = container.firstElementChild;
      expect(ref.current).toBe(element);
    });

    it('merges className from render element and component props', async () => {
      const { container } = await render(
        <TestComponent
          active
          className="component-class"
          render={<div className="render-class" />}
        />,
      );

      const element = container.firstElementChild;

      expect(element?.className).toContain('component-class');
      expect(element?.className).toContain('render-class');
      expect(element?.className).toContain('test-component');
    });

    it('merges className function with render element', async () => {
      const { container } = await render(
        <TestComponent
          active
          className={(state) => (state.active ? 'active-class' : '')}
          render={<div className="render-class" />}
        />,
      );

      const element = container.firstElementChild;

      expect(element?.className).toContain('active-class');
      expect(element?.className).toContain('render-class');
      expect(element?.className).toContain('test-component');
    });

    it('merges style from render element and component props', async () => {
      const { container } = await render(
        <TestComponent
          active
          style={{ color: 'rgb(255, 0, 0)' }}
          render={<div style={{ fontSize: '16px' }} />}
        />,
      );

      const element = container.firstElementChild as HTMLElement;
      expect(element.style.padding).toBe('10px');
      expect(element.style.color).toBe('rgb(255, 0, 0)');
      expect(element.style.fontSize).toBe('16px');
    });

    it('merges style function with render element', async () => {
      const { container } = await render(
        <TestComponent
          active
          style={(state) => ({ color: state.active ? 'rgb(255, 0, 0)' : 'rgb(0, 0, 0)' })}
          render={<div style={{ fontSize: '16px' }} />}
        />,
      );

      const element = container.firstElementChild as HTMLElement;
      expect(element.style.padding).toBe('10px');
      expect(element.style.color).toBe('rgb(255, 0, 0)');
      expect(element.style.fontSize).toBe('16px');
    });

    it('handles lazy elements', async () => {
      const LazyComponent = React.lazy(() =>
        Promise.resolve({
          default: React.forwardRef<HTMLDivElement, React.ComponentPropsWithRef<'div'>>(
            function LazyDiv(props, ref) {
              return <div ref={ref} data-lazy="true" {...props} />;
            },
          ),
        }),
      );

      const { container } = await render(
        <React.Suspense fallback={<div>Loading…</div>}>
          <TestComponent active render={<LazyComponent data-testid="lazy" />} />
        </React.Suspense>,
      );

      const element = container.firstElementChild;
      expect(element).not.toBe(null);
      expect(element?.getAttribute('data-testid')).toBe('lazy');
      expect(element?.getAttribute('data-lazy')).toBe('true');
      expect(element?.className).toContain('test-component');
    });

    // React 18 also log console error, React 19 fixed that. Ignoring this test for React 18.
    it.skipIf(reactMajor < 19)(
      'throws error for invalid render element in development',
      async () => {
        const originalEnv = process.env.NODE_ENV;

        let error: Error | null = null;
        try {
          process.env.NODE_ENV = 'development';
          await render(<TestComponent render={'not a valid element' as any} />);
        } catch (err) {
          error = err as Error;
        } finally {
          process.env.NODE_ENV = originalEnv;
        }

        expect(error).not.toBe(null);
        expect(error?.message).toMatch(
          /Base UI: The `render` prop was provided an invalid React element/,
        );
      },
    );

    it('handles render element with existing ref', async () => {
      const CustomElement = React.forwardRef<HTMLDivElement, React.ComponentPropsWithRef<'div'>>(
        function CustomElement(props, ref) {
          return <div ref={ref} {...props} />;
        },
      );

      const renderRef = React.createRef<HTMLDivElement>();
      const componentRef = React.createRef<HTMLDivElement>();

      await render(<TestComponent ref={componentRef} render={<CustomElement ref={renderRef} />} />);

      expect(renderRef.current).toBeInstanceOf(HTMLDivElement);
      expect(componentRef.current).toBeInstanceOf(HTMLDivElement);
      expect(renderRef.current).toBe(componentRef.current);
    });
  });

  describe('EMPTY_OBJECT mutation safety', () => {
    // This test verifies that the hook doesn't attempt to mutate EMPTY_OBJECT
    // which would throw a TypeError in strict mode since it's frozen.
    const MinimalComponent = React.forwardRef(function MinimalComponent(
      componentProps: BaseUIComponentProps<'div', Record<string, never>>,
      forwardedRef: React.ForwardedRef<HTMLDivElement>,
    ) {
      // Using EMPTY_OBJECT as state and no additional props simulates the edge case
      // where mergeObjects might return undefined and fall back to EMPTY_OBJECT
      const element = useRenderElement('div', componentProps, {
        state: EMPTY_OBJECT,
        ref: forwardedRef,
        // No props passed - relies on stateProps which will be {}
      });

      return element;
    });

    it('does not throw when className is provided with minimal props', async () => {
      const { container } = await render(<MinimalComponent className="test-class" />);
      expect(container.firstElementChild).not.toBeNull();
      expect(container.firstElementChild).toHaveAttribute('class', 'test-class');
    });

    it('does not throw when style is provided with minimal props', async () => {
      const { container } = await render(<MinimalComponent style={{ color: 'red' }} />);
      expect(container.firstElementChild).not.toBeNull();
      const element = container.firstElementChild as HTMLElement;
      expect(element.style.color).toBe('red');
    });
  });
});
