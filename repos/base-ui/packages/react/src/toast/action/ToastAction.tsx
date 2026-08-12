'use client';
import * as React from 'react';
import type { BaseUIComponentProps, NativeButtonProps } from '../../internals/types';
import { useToastRootContext } from '../root/ToastRootContext';
import { useButton } from '../../internals/use-button/useButton';
import { useRenderElement } from '../../internals/useRenderElement';

/**
 * Performs an action when clicked.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Toast](https://base-ui.com/react/components/toast)
 */
export const ToastAction = React.forwardRef(function ToastAction(
  componentProps: ToastAction.Props,
  forwardedRef: React.ForwardedRef<HTMLButtonElement>,
) {
  const {
    render,
    className,
    style,
    disabled,
    nativeButton = true,
    ...elementProps
  } = componentProps;

  const { toast } = useToastRootContext();

  const computedChildren = toast.actionProps?.children ?? elementProps.children;
  const shouldRender = Boolean(computedChildren);

  const { getButtonProps, buttonRef } = useButton({
    disabled,
    native: nativeButton,
  });

  const state: ToastActionState = {
    type: toast.type,
  };

  const element = useRenderElement('button', componentProps, {
    ref: [forwardedRef, buttonRef],
    state,
    props: [
      elementProps,
      toast.actionProps,
      getButtonProps,
      {
        children: computedChildren,
      },
    ],
  });

  if (!shouldRender) {
    return null;
  }

  return element;
});

export interface ToastActionState {
  /**
   * The type of the toast.
   */
  type: string | undefined;
}

export interface ToastActionProps
  extends NativeButtonProps, BaseUIComponentProps<'button', ToastActionState> {}

export namespace ToastAction {
  export type State = ToastActionState;
  export type Props = ToastActionProps;
}
