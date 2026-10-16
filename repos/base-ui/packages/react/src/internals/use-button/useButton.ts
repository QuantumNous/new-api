'use client';
import * as React from 'react';
import { isHTMLElement } from '@floating-ui/utils/dom';
import { useStableCallback } from '@base-ui/utils/useStableCallback';
import { error } from '@base-ui/utils/error';
import { SafeReact } from '@base-ui/utils/safeReact';
import { useIsoLayoutEffect } from '@base-ui/utils/useIsoLayoutEffect';
import { makeEventPreventable, mergeProps } from '../../merge-props';
import { useCompositeRootContext } from '../composite/root/CompositeRootContext';
import { BaseUIEvent, HTMLProps } from '../types';
import { useFocusableWhenDisabled } from '../../utils/useFocusableWhenDisabled';

export function useButton(parameters: UseButtonParameters = {}): UseButtonReturnValue {
  const {
    disabled = false,
    focusableWhenDisabled,
    tabIndex = 0,
    native: isNativeButton = true,
    composite: compositeProp,
  } = parameters;

  const elementRef = React.useRef<HTMLElement | null>(null);

  const compositeRootContext = useCompositeRootContext(true);
  const isCompositeItem = compositeProp ?? compositeRootContext !== undefined;

  const { props: focusableWhenDisabledProps } = useFocusableWhenDisabled({
    focusableWhenDisabled,
    disabled,
    composite: isCompositeItem,
    tabIndex,
    isNativeButton,
  });

  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    React.useEffect(() => {
      if (!elementRef.current) {
        return;
      }

      const isButtonTag = isButtonElement(elementRef.current);

      if (isNativeButton) {
        if (!isButtonTag) {
          const ownerStackMessage = SafeReact.captureOwnerStack?.() || '';
          const message =
            'A component that acts as a button expected a native <button> because the ' +
            '`nativeButton` prop is true. Rendering a non-<button> removes native button ' +
            'semantics, which can impact forms and accessibility. Use a real <button> in the ' +
            '`render` prop, or set `nativeButton` to `false`.';
          error(`${message}${ownerStackMessage}`);
        }
      } else if (isButtonTag) {
        const ownerStackMessage = SafeReact.captureOwnerStack?.() || '';
        const message =
          'A component that acts as a button expected a non-<button> because the `nativeButton` ' +
          'prop is false. Rendering a <button> keeps native behavior while Base UI applies ' +
          'non-native attributes and handlers, which can add unintended extra attributes (such ' +
          'as `role` or `aria-disabled`). Use a non-<button> in the `render` prop, or set ' +
          '`nativeButton` to `true`.';
        error(`${message}${ownerStackMessage}`);
      }
    }, [isNativeButton]);
  }

  // handles a disabled composite button rendering another button, e.g.
  // <Toolbar.Button disabled render={<Menu.Trigger />} />
  // the `disabled` prop needs to pass through 2 `useButton`s then finally
  // delete the `disabled` attribute from DOM
  const updateDisabled = React.useCallback(() => {
    const element = elementRef.current;

    if (!isButtonElement(element)) {
      return;
    }

    if (
      isCompositeItem &&
      disabled &&
      focusableWhenDisabledProps.disabled === undefined &&
      element.disabled
    ) {
      element.disabled = false;
    }
  }, [disabled, focusableWhenDisabledProps.disabled, isCompositeItem]);

  useIsoLayoutEffect(updateDisabled, [updateDisabled]);

  const getButtonProps = React.useCallback(
    (externalProps: GenericButtonProps = {}) => {
      const {
        onClick: externalOnClick,
        onMouseDown: externalOnMouseDown,
        onKeyUp: externalOnKeyUp,
        onKeyDown: externalOnKeyDown,
        onPointerDown: externalOnPointerDown,
        ...otherExternalProps
      } = externalProps;

      return mergeProps<'button'>(
        {
          onClick(event: React.MouseEvent) {
            if (disabled) {
              event.preventDefault();
              return;
            }
            externalOnClick?.(event);
          },
          onMouseDown(event: React.MouseEvent) {
            if (!disabled) {
              externalOnMouseDown?.(event);
            }
          },
          onKeyDown(event: BaseUIEvent<React.KeyboardEvent>) {
            if (disabled) {
              return;
            }

            makeEventPreventable(event);
            externalOnKeyDown?.(event);
            if (event.baseUIHandlerPrevented) {
              return;
            }

            const isCurrentTarget = event.target === event.currentTarget;
            const currentTarget = event.currentTarget as HTMLElement;
            const isButton = isButtonElement(currentTarget);
            const isLink = !isNativeButton && isValidLinkElement(currentTarget);
            const shouldClick = isCurrentTarget && (isNativeButton ? isButton : !isLink);
            const isEnterKey = event.key === 'Enter';
            const isSpaceKey = event.key === ' ';
            const role = currentTarget.getAttribute('role');
            const isTextNavigationRole =
              role?.startsWith('menuitem') || role === 'option' || role === 'gridcell';

            if (isCurrentTarget && isCompositeItem && isSpaceKey) {
              if (event.defaultPrevented && isTextNavigationRole) {
                return;
              }

              event.preventDefault();

              if (isLink || (isNativeButton && isButton)) {
                currentTarget.click();
                event.preventBaseUIHandler();
              } else if (shouldClick) {
                externalOnClick?.(event);
                event.preventBaseUIHandler();
              }

              return;
            }

            // Keyboard accessibility for native and non-native elements.
            if (shouldClick) {
              if (!isNativeButton && (isSpaceKey || isEnterKey)) {
                event.preventDefault();
              }

              if (!isNativeButton && isEnterKey) {
                externalOnClick?.(event);
              }
            }
          },
          onKeyUp(event: BaseUIEvent<React.KeyboardEvent>) {
            if (disabled) {
              return;
            }

            // calling preventDefault in keyUp on a <button> will not dispatch a click event if Space is pressed
            // https://codesandbox.io/p/sandbox/button-keyup-preventdefault-dn7f0
            makeEventPreventable(event);
            externalOnKeyUp?.(event);

            if (
              event.target === event.currentTarget &&
              isNativeButton &&
              isCompositeItem &&
              isButtonElement(event.currentTarget as HTMLElement) &&
              event.key === ' '
            ) {
              event.preventDefault();
              return;
            }

            if (event.baseUIHandlerPrevented) {
              return;
            }

            // Keyboard accessibility for non interactive elements
            if (
              event.target === event.currentTarget &&
              !isNativeButton &&
              !isCompositeItem &&
              event.key === ' '
            ) {
              externalOnClick?.(event);
            }
          },
          onPointerDown(event: React.PointerEvent) {
            if (disabled) {
              event.preventDefault();
              return;
            }
            externalOnPointerDown?.(event);
          },
        },
        isNativeButton ? { type: 'button' } : { role: 'button' },
        focusableWhenDisabledProps,
        otherExternalProps,
      );
    },
    [disabled, focusableWhenDisabledProps, isCompositeItem, isNativeButton],
  );

  const buttonRef = useStableCallback((element: HTMLElement | null) => {
    elementRef.current = element;
    updateDisabled();
  });

  return {
    getButtonProps,
    buttonRef,
  };
}

function isButtonElement(
  elem: HTMLButtonElement | HTMLAnchorElement | HTMLElement | null,
): elem is HTMLButtonElement {
  return isHTMLElement(elem) && elem.tagName === 'BUTTON';
}

function isValidLinkElement(elem: HTMLElement | null): elem is HTMLAnchorElement {
  return Boolean(elem?.tagName === 'A' && (elem as HTMLAnchorElement)?.href);
}

interface GenericButtonProps extends Omit<HTMLProps, 'onClick'>, AdditionalButtonProps {
  onClick?: ((event: React.SyntheticEvent) => void) | undefined;
}

interface AdditionalButtonProps extends Partial<{
  'aria-disabled': React.AriaAttributes['aria-disabled'];
  disabled: boolean;
  role: React.AriaRole;
  tabIndex?: number | undefined;
}> {}

export interface UseButtonParameters {
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Whether the button may receive focus even if it is disabled.
   * @default false
   */
  focusableWhenDisabled?: boolean | undefined;
  tabIndex?: NonNullable<React.HTMLAttributes<any>['tabIndex']> | undefined;
  /**
   * Whether the component is being rendered as a native button.
   * @default true
   */
  native?: boolean | undefined;
  /**
   * Whether the button is part of a composite widget.
   * When `true`, keyboard activation for Space occurs on keydown rather than keyup.
   * @default inferred from CompositeRoot context
   */
  composite?: boolean | undefined;
}

export interface UseButtonReturnValue {
  /**
   * Resolver for the button props.
   * @param externalProps additional props for the button
   * @returns props that should be spread on the button
   */
  getButtonProps: (
    externalProps?: React.ComponentPropsWithRef<any>,
  ) => React.ComponentPropsWithRef<any>;
  /**
   * A ref to the button DOM element. This ref should be passed to the rendered element.
   * It is not a part of the props returned by `getButtonProps`.
   */
  buttonRef: React.Ref<HTMLElement>;
}

export interface UseButtonState {}
