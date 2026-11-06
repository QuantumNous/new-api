import { expect, vi } from 'vitest';
import * as React from 'react';
import { act, fireEvent, screen } from '@mui/internal-test-utils';
import { useMergedRefs } from '@base-ui/utils/useMergedRefs';
import { createRenderer, isJSDOM } from '#test-utils';
import { useButton } from './useButton';
import { CompositeRoot } from '../composite/root/CompositeRoot';
import { mergeProps } from '../../merge-props';

describe('useButton', () => {
  const { render, renderToString } = createRenderer();
  const focusElement = async (element: HTMLElement) => {
    await act(async () => {
      element.focus();
    });
  };

  describe('non-native button', () => {
    describe('keyboard interactions', () => {
      ['Enter', 'Space'].forEach((key) => {
        it(`can be activated with ${key} key`, async () => {
          const clickSpy = vi.fn();

          function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
            const { getButtonProps } = useButton({
              native: false,
            });

            return <span {...getButtonProps(props)} />;
          }

          const { user } = await render(<Button onClick={clickSpy} />);

          const button = screen.getByRole('button');

          await user.keyboard('[Tab]');
          expect(button).toHaveFocus();

          await user.keyboard(`[${key}]`);
          expect(clickSpy).toHaveBeenCalledTimes(1);
        });
      });

      it('does not set a type prop', async () => {
        let buttonProps: Record<string, unknown> | undefined = undefined;

        function Button() {
          const { getButtonProps } = useButton({ native: false });
          buttonProps = getButtonProps();
          return <span {...buttonProps} />;
        }

        await render(<Button />);
        expect(buttonProps).not.toHaveProperty('type');
      });

      it.skipIf(isJSDOM)(
        'can be activated with Enter when the keyboard event originates inside a shadow root',
        async () => {
          const clickSpy = vi.fn();

          function Button(props: React.HTMLAttributes<HTMLSpanElement>) {
            const { getButtonProps, buttonRef } = useButton({
              native: false,
            });
            const hostRef = React.useRef<HTMLSpanElement | null>(null);
            const mergedRef = useMergedRefs(hostRef, buttonRef);

            const handleRef = React.useCallback(
              (node: HTMLSpanElement | null) => {
                mergedRef?.(node);

                if (!node || node.shadowRoot) {
                  return;
                }

                const shadowRoot = node.attachShadow({ mode: 'open' });
                const inner = document.createElement('span');
                inner.tabIndex = 0;
                shadowRoot.appendChild(inner);
              },
              [mergedRef],
            );

            return <span {...getButtonProps({ ...props, ref: handleRef })} />;
          }

          await render(<Button onClick={clickSpy} />);

          const host = screen.getByRole('button');
          const inner = host.shadowRoot?.querySelector('span');

          expect(inner).toBeTruthy();

          if (!inner) {
            return;
          }

          await act(async () => {
            (inner as HTMLElement).focus();
          });

          await act(async () => {
            inner.dispatchEvent(
              new KeyboardEvent('keydown', {
                key: 'Enter',
                bubbles: true,
                composed: true,
              }),
            );
          });

          expect(clickSpy).toHaveBeenCalledTimes(1);
        },
      );
    });
  });

  describe('param: focusableWhenDisabled', () => {
    it('allows disabled buttons to be focused', async () => {
      function TestButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
        const { disabled, ...otherProps } = props;
        const { getButtonProps } = useButton({
          disabled,
          focusableWhenDisabled: true,
        });

        return <button {...getButtonProps(otherProps)} />;
      }
      await render(<TestButton disabled />);
      const button = screen.getByRole('button');
      await focusElement(button);
      expect(button).toHaveFocus();
    });

    it('force overrides disabled attribute when put in a composite', async () => {
      function TestButton(props: { buttonKey?: React.Key }) {
        const { getButtonProps, buttonRef } = useButton({
          disabled: true,
          focusableWhenDisabled: true,
        });
        return (
          <button ref={buttonRef} key={props.buttonKey} {...getButtonProps({ disabled: true })} />
        );
      }

      const { rerender } = await render(
        <CompositeRoot>
          <TestButton />
        </CompositeRoot>,
      );

      async function verify() {
        const button = screen.getByRole('button');
        await focusElement(button);
        expect(button).toHaveFocus();
      }

      await verify();

      // Ensure it works after ref change
      await rerender(
        <CompositeRoot>
          <TestButton buttonKey="rerender" />
        </CompositeRoot>,
      );
      await verify();
    });

    it('prevents interactions except focus and blur', async () => {
      const handleClick = vi.fn();
      const handleKeyDown = vi.fn();
      const handleKeyUp = vi.fn();
      const handleFocus = vi.fn();
      const handleBlur = vi.fn();

      function TestButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
        const { disabled, ...otherProps } = props;
        const { getButtonProps } = useButton({
          disabled,
          focusableWhenDisabled: true,
          native: false,
        });

        return <span {...getButtonProps(otherProps)} />;
      }

      const { user } = await render(
        <TestButton
          disabled
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />,
      );

      const button = screen.getByRole('button');
      expect(document.activeElement).not.toBe(button);

      expect(handleFocus).toHaveBeenCalledTimes(0);
      await user.keyboard('[Tab]');
      expect(button).toHaveFocus();
      expect(handleFocus).toHaveBeenCalledTimes(1);

      await user.keyboard('[Enter]');
      expect(handleKeyDown).toHaveBeenCalledTimes(0);
      expect(handleClick).toHaveBeenCalledTimes(0);

      await user.keyboard('[Space]');
      expect(handleKeyUp).toHaveBeenCalledTimes(0);
      expect(handleClick).toHaveBeenCalledTimes(0);

      await user.click(button);
      expect(handleKeyDown).toHaveBeenCalledTimes(0);
      expect(handleKeyUp).toHaveBeenCalledTimes(0);
      expect(handleClick).toHaveBeenCalledTimes(0);

      expect(handleBlur).toHaveBeenCalledTimes(0);
      await user.keyboard('[Tab]');
      expect(handleBlur).toHaveBeenCalledTimes(1);
      expect(document.activeElement).not.toBe(button);
    });
  });

  describe('param: tabIndex', () => {
    it('returns tabIndex in getButtonProps when host component is BUTTON', async () => {
      function TestButton() {
        const { getButtonProps } = useButton();

        expect(getButtonProps().tabIndex).toBe(0);

        return <button {...getButtonProps()} />;
      }

      await render(<TestButton />);
      expect(screen.getByRole('button')).toHaveProperty('tabIndex', 0);
    });

    it('returns tabIndex in getButtonProps when host component is not BUTTON', async () => {
      function TestButton() {
        const ref = React.useRef(null);
        const { getButtonProps, buttonRef } = useButton({ native: false });
        useMergedRefs(ref, buttonRef);

        expect(getButtonProps().tabIndex).toBe(0);

        return <span {...getButtonProps()} />;
      }

      await render(<TestButton />);
      expect(screen.getByRole('button')).toHaveProperty('tabIndex', 0);
    });

    it('returns tabIndex in getButtonProps if it is explicitly provided', async () => {
      const customTabIndex = 3;
      function TestButton() {
        const { getButtonProps } = useButton({ tabIndex: customTabIndex });
        return <button {...getButtonProps()} />;
      }

      await render(<TestButton />);
      expect(screen.getByRole('button')).toHaveProperty('tabIndex', customTabIndex);
    });
  });

  describe('arbitrary props', () => {
    it('are passed to the host component', async () => {
      const buttonTestId = 'button-test-id';
      function TestButton() {
        const { getButtonProps } = useButton();
        return <button {...getButtonProps({ 'data-testid': buttonTestId })} />;
      }

      await render(<TestButton />);
      expect(screen.getByRole('button')).toHaveAttribute('data-testid', buttonTestId);
    });
  });

  describe('event handlers', () => {
    it('key: Space fires keyup then click on non-composite buttons', async () => {
      const handleKeyDown = vi.fn();
      const handleKeyUp = vi.fn();
      const handleClick = vi.fn();

      function TestButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
        const { getButtonProps } = useButton({ native: false });

        return <span {...getButtonProps(props)} />;
      }

      await render(
        <TestButton onKeyDown={handleKeyDown} onKeyUp={handleKeyUp} onClick={handleClick} />,
      );

      const button = screen.getByRole('button');

      await focusElement(button);
      expect(button).toHaveFocus();

      fireEvent.keyDown(button, { key: ' ' });
      expect(handleKeyDown).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledTimes(0);

      fireEvent.keyUp(button, { key: ' ' });
      expect(handleKeyUp).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('key: Space fires keydown then click on composite buttons', async () => {
      const handleKeyDown = vi.fn();
      const handleKeyUp = vi.fn();
      const handleClick = vi.fn();

      function TestButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
        const { getButtonProps } = useButton({ native: false, composite: true });

        return <span {...getButtonProps(props)} />;
      }

      await render(
        <TestButton
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onClick={handleClick}
        />,
      );

      const button = screen.getByRole('button');

      await focusElement(button);
      expect(button).toHaveFocus();

      fireEvent.keyDown(button, { key: ' ' });
      expect(handleKeyDown).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledTimes(1);

      fireEvent.keyUp(button, { key: ' ' });
      expect(handleKeyUp).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('key: Space fires keydown then click on composite links', async () => {
      const handleClick = vi.fn();

      function TestButton(props: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
        const { getButtonProps } = useButton({ native: false, composite: true });

        return <a href="#test" {...getButtonProps(props)} />;
      }

      await render(<TestButton onClick={handleClick} />);

      const link = screen.getByRole('button');

      await focusElement(link);
      expect(link).toHaveFocus();

      fireEvent.keyDown(link, { key: ' ' });
      expect(handleClick).toHaveBeenCalledTimes(1);

      fireEvent.keyUp(link, { key: ' ' });
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('does not click composite links when Space is prevented for text navigation', async () => {
      const handleClick = vi.fn();

      function TestButton(props: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
        const { getButtonProps } = useButton({ native: false, composite: true });

        return <a href="#test" {...getButtonProps({ role: 'menuitem', ...props })} />;
      }

      await render(
        <TestButton onKeyDown={(event) => event.preventDefault()} onClick={handleClick} />,
      );

      const link = screen.getByRole('menuitem');

      await focusElement(link);
      expect(link).toHaveFocus();

      fireEvent.keyDown(link, { key: ' ' });
      expect(handleClick).toHaveBeenCalledTimes(0);
    });

    it('does not click composite gridcells when Space is prevented', async () => {
      const handleClick = vi.fn();

      function TestButton(props: React.HTMLAttributes<HTMLDivElement>) {
        const { getButtonProps } = useButton({ native: false, composite: true });

        return <div {...getButtonProps({ role: 'gridcell', tabIndex: 0, ...props })} />;
      }

      await render(
        <TestButton onKeyDown={(event) => event.preventDefault()} onClick={handleClick} />,
      );

      const gridcell = screen.getByRole('gridcell');

      await focusElement(gridcell);
      expect(gridcell).toHaveFocus();

      fireEvent.keyDown(gridcell, { key: ' ' });
      expect(handleClick).toHaveBeenCalledTimes(0);
    });

    it('clicks composite switches when Space is prevented', async () => {
      const handleClick = vi.fn();

      function TestButton(props: React.HTMLAttributes<HTMLDivElement>) {
        const { getButtonProps } = useButton({ native: false, composite: true });

        return <div {...getButtonProps({ role: 'switch', tabIndex: 0, ...props })} />;
      }

      await render(
        <TestButton onKeyDown={(event) => event.preventDefault()} onClick={handleClick} />,
      );

      const switchElement = screen.getByRole('switch');

      await focusElement(switchElement);
      expect(switchElement).toHaveFocus();

      fireEvent.keyDown(switchElement, { key: ' ' });
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('key: Space fires keydown then click on native composite buttons', async () => {
      const handleKeyDown = vi.fn();
      const handleKeyUp = vi.fn();
      const handleClick = vi.fn();

      function TestButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
        const { getButtonProps } = useButton({ composite: true });

        return <button {...getButtonProps(props)} />;
      }

      await render(
        <TestButton onKeyDown={handleKeyDown} onKeyUp={handleKeyUp} onClick={handleClick} />,
      );

      const button = screen.getByRole('button');

      await focusElement(button);
      expect(button).toHaveFocus();

      fireEvent.keyDown(button, { key: ' ' });
      expect(handleKeyDown).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledTimes(1);

      fireEvent.keyUp(button, { key: ' ' });
      expect(handleKeyUp).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('does not fire duplicate clicks for Space on native composite buttons', async () => {
      const handleClick = vi.fn();

      function TestButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
        const { getButtonProps } = useButton({ composite: true });

        return <button {...getButtonProps(props)} />;
      }

      const { user } = await render(<TestButton onClick={handleClick} />);

      const button = screen.getByRole('button');

      await focusElement(button);
      expect(button).toHaveFocus();

      await user.keyboard('[Space]');
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('does not fire duplicate clicks for Space when composed with another useButton', async () => {
      const handleClick = vi.fn();

      function TestButton() {
        const outer = useButton({ native: false, composite: true });
        const inner = useButton({ native: false, composite: true });

        return (
          <span
            {...mergeProps(
              outer.getButtonProps({ onClick: handleClick, tabIndex: 0 }),
              inner.getButtonProps({ onClick: handleClick }),
            )}
          />
        );
      }

      const { user } = await render(<TestButton />);

      const button = screen.getByRole('button');

      await focusElement(button);
      expect(button).toHaveFocus();

      await user.keyboard('[Space]');
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('key: Space preserves native submit semantics on composite buttons', async () => {
      const handleSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
      });

      function TestButton() {
        const { getButtonProps } = useButton({ composite: true });

        return (
          <form onSubmit={handleSubmit}>
            <button {...getButtonProps({ type: 'submit' })}>Submit</button>
          </form>
        );
      }

      await render(<TestButton />);

      const button = screen.getByRole('button', { name: 'Submit' });

      await focusElement(button);
      expect(button).toHaveFocus();

      fireEvent.keyDown(button, { key: ' ' });
      expect(handleSubmit).toHaveBeenCalledTimes(1);

      fireEvent.keyUp(button, { key: ' ' });
      expect(handleSubmit).toHaveBeenCalledTimes(1);
    });

    it('key: Space preserves native reset semantics on composite buttons', async () => {
      const handleReset = vi.fn((event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
      });

      function TestButton() {
        const { getButtonProps } = useButton({ composite: true });

        return (
          <form onReset={handleReset}>
            <button {...getButtonProps({ type: 'reset' })}>Reset</button>
          </form>
        );
      }

      await render(<TestButton />);

      const button = screen.getByRole('button', { name: 'Reset' });

      await focusElement(button);
      expect(button).toHaveFocus();

      fireEvent.keyDown(button, { key: ' ' });
      expect(handleReset).toHaveBeenCalledTimes(1);

      fireEvent.keyUp(button, { key: ' ' });
      expect(handleReset).toHaveBeenCalledTimes(1);
    });

    it('does not click composite buttons when keydown calls preventBaseUIHandler', async () => {
      const handleClick = vi.fn();

      function TestButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
        const { getButtonProps } = useButton({ native: false, composite: true });

        return <span {...getButtonProps(props)} />;
      }

      await render(
        <TestButton
          tabIndex={0}
          onKeyDown={(event) =>
            (
              event as React.KeyboardEvent<HTMLButtonElement> & {
                preventBaseUIHandler: () => void;
              }
            ).preventBaseUIHandler()
          }
          onClick={handleClick}
        />,
      );

      const button = screen.getByRole('button');

      await focusElement(button);
      expect(button).toHaveFocus();

      fireEvent.keyDown(button, { key: ' ' });
      expect(handleClick).toHaveBeenCalledTimes(0);
    });

    it('key: Space fires keydown then click when in composite root context', async () => {
      const handleKeyDown = vi.fn();
      const handleKeyUp = vi.fn();
      const handleClick = vi.fn();

      function TestButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
        const { getButtonProps } = useButton({ native: false });

        return <span {...getButtonProps(props)} />;
      }

      await render(
        <CompositeRoot>
          <TestButton
            tabIndex={0}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            onClick={handleClick}
          />
        </CompositeRoot>,
      );

      const button = screen.getByRole('button');

      await focusElement(button);
      expect(button).toHaveFocus();

      fireEvent.keyDown(button, { key: ' ' });
      expect(handleKeyDown).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledTimes(1);

      fireEvent.keyUp(button, { key: ' ' });
      expect(handleKeyUp).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('key: Space fires keydown then click on native buttons in composite root context', async () => {
      const handleKeyDown = vi.fn();
      const handleKeyUp = vi.fn();
      const handleClick = vi.fn();

      function TestButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
        const { getButtonProps } = useButton();

        return <button {...getButtonProps(props)} />;
      }

      await render(
        <CompositeRoot>
          <TestButton onKeyDown={handleKeyDown} onKeyUp={handleKeyUp} onClick={handleClick} />
        </CompositeRoot>,
      );

      const button = screen.getByRole('button');

      await focusElement(button);
      expect(button).toHaveFocus();

      fireEvent.keyDown(button, { key: ' ' });
      expect(handleKeyDown).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledTimes(1);

      fireEvent.keyUp(button, { key: ' ' });
      expect(handleKeyUp).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('`composite=false` keeps keyup activation inside composite root context', async () => {
      const handleKeyDown = vi.fn();
      const handleKeyUp = vi.fn();
      const handleClick = vi.fn();

      function TestButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
        const { getButtonProps } = useButton({ native: false, composite: false });

        return <span {...getButtonProps(props)} />;
      }

      await render(
        <CompositeRoot>
          <TestButton onKeyDown={handleKeyDown} onKeyUp={handleKeyUp} onClick={handleClick} />
        </CompositeRoot>,
      );

      const button = screen.getByRole('button');

      await focusElement(button);
      expect(button).toHaveFocus();

      fireEvent.keyDown(button, { key: ' ' });
      expect(handleKeyDown).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledTimes(0);

      fireEvent.keyUp(button, { key: ' ' });
      expect(handleKeyUp).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    // calling preventDefault in keyUp on a <button> will not dispatch a click event if Space is pressed
    // https://codesandbox.io/p/sandbox/button-keyup-preventdefault-dn7f0
    it('key: Space fires a click event even if preventDefault was called on keyUp', async () => {
      const handleClick = vi.fn();

      function TestButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
        const { getButtonProps } = useButton({ native: false });

        return <span {...getButtonProps(props)} />;
      }

      const { user } = await render(
        <TestButton
          onKeyUp={(event: React.KeyboardEvent<HTMLButtonElement>) => event.preventDefault()}
          onClick={handleClick}
        />,
      );

      const button = screen.getByRole('button');

      await user.keyboard('[Tab]');
      expect(button).toHaveFocus();

      await user.keyboard('[Space]');
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('key: Enter fires keydown then click on non-native buttons', async () => {
      const handleKeyDown = vi.fn();
      const handleClick = vi.fn();

      function TestButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
        const { getButtonProps } = useButton({ native: false });

        return <span {...getButtonProps(props)} />;
      }

      await render(<TestButton onKeyDown={handleKeyDown} onClick={handleClick} />);

      const button = screen.getByRole('button');

      await focusElement(button);
      expect(button).toHaveFocus();

      expect(handleKeyDown).toHaveBeenCalledTimes(0);
      fireEvent.keyDown(button, { key: 'Enter' });
      expect(handleKeyDown).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe.skipIf(isJSDOM)('server-side rendering', () => {
    it('should server-side render', async () => {
      function TestButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
        const { disabled, ...otherProps } = props;
        const { getButtonProps } = useButton({ disabled, native: false });

        return <span {...getButtonProps(otherProps)} />;
      }

      const { container } = await renderToString(<TestButton disabled />);

      expect(container.firstChild).toHaveProperty('role', 'button');
    });

    it('adds disabled attribute', async () => {
      function TestButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
        const { disabled, ...otherProps } = props;
        const { getButtonProps } = useButton({ disabled });
        return <button {...getButtonProps(otherProps)} />;
      }

      renderToString(<TestButton disabled>Submit</TestButton>);
      expect(screen.getByRole('button')).toHaveProperty('disabled');
    });
  });

  describe('dev warnings', () => {
    it('errors if nativeButton=true but ref is not a button', async () => {
      const errorSpy = vi
        .spyOn(console, 'error')
        .mockName('console.error')
        .mockImplementation(() => {});
      function TestButton() {
        const { getButtonProps, buttonRef } = useButton({ native: true });
        return <span {...getButtonProps()} ref={buttonRef} />;
      }
      await render(<TestButton />);
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Base UI: A component that acts as a button expected a native <button> because ' +
            'the `nativeButton` prop is true. Rendering a non-<button> removes native button semantics, ' +
            'which can impact forms and accessibility. Use a real <button> in the `render` prop, or set ' +
            '`nativeButton` to `false`.',
        ),
      );
    });

    it('errors if nativeButton=false but ref is a button', async () => {
      const errorSpy = vi
        .spyOn(console, 'error')
        .mockName('console.error')
        .mockImplementation(() => {});
      function TestButton() {
        const { getButtonProps, buttonRef } = useButton({ native: false });
        return <button {...getButtonProps()} ref={buttonRef} />;
      }
      await render(<TestButton />);
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Base UI: A component that acts as a button expected a non-<button> because ' +
            'the `nativeButton` prop is false. Rendering a <button> keeps native behavior while Base UI ' +
            'applies non-native attributes and handlers, which can add unintended extra attributes ' +
            '(such as `role` or `aria-disabled`). Use a non-<button> in the `render` prop, or set ' +
            '`nativeButton` to `true`.',
        ),
      );
    });
  });
});
