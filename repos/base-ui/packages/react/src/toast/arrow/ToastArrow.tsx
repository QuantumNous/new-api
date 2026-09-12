'use client';
import * as React from 'react';
import { useToastPositionerContext } from '../positioner/ToastPositionerContext';
import type { BaseUIComponentProps } from '../../internals/types';
import type { Side, Align } from '../../utils/useAnchorPositioning';
import { useRenderElement } from '../../internals/useRenderElement';

/**
 * Displays an element positioned against the toast anchor.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Toast](https://base-ui.com/react/components/toast)
 */
export const ToastArrow = React.forwardRef(function ToastArrow(
  componentProps: ToastArrow.Props,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const { className, render, style, ...elementProps } = componentProps;

  const { arrowRef, side, align, arrowUncentered, arrowStyles } = useToastPositionerContext();

  const state: ToastArrowState = {
    side,
    align,
    uncentered: arrowUncentered,
  };

  const element = useRenderElement('div', componentProps, {
    state,
    ref: [forwardedRef, arrowRef],
    props: [{ style: arrowStyles, 'aria-hidden': true }, elementProps],
  });

  return element;
});

export interface ToastArrowState {
  /**
   * The side of the anchor the component is placed on.
   */
  side: Side;
  /**
   * The alignment of the component relative to the anchor.
   */
  align: Align;
  /**
   * Whether the arrow cannot be centered on the anchor.
   */
  uncentered: boolean;
}

export interface ToastArrowProps extends BaseUIComponentProps<'div', ToastArrowState> {}

export namespace ToastArrow {
  export type State = ToastArrowState;
  export type Props = ToastArrowProps;
}
