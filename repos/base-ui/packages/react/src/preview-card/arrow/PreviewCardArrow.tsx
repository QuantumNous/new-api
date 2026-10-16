'use client';
import * as React from 'react';
import { usePreviewCardPositionerContext } from '../positioner/PreviewCardPositionerContext';
import { usePreviewCardRootContext } from '../root/PreviewCardContext';
import type { BaseUIComponentProps } from '../../internals/types';
import type { Align, Side } from '../../utils/useAnchorPositioning';
import { popupStateMapping } from '../../utils/popupStateMapping';
import { useRenderElement } from '../../internals/useRenderElement';

/**
 * Displays an element positioned against the preview card anchor.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Preview Card](https://base-ui.com/react/components/preview-card)
 */
export const PreviewCardArrow = React.forwardRef(function PreviewCardArrow(
  componentProps: PreviewCardArrow.Props,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const { render, className, style, ...elementProps } = componentProps;

  const store = usePreviewCardRootContext();
  const { arrowRef, side, align, arrowUncentered, arrowStyles } = usePreviewCardPositionerContext();

  const open = store.useState('open');

  const state: PreviewCardArrowState = {
    open,
    side,
    align,
    uncentered: arrowUncentered,
  };

  const element = useRenderElement('div', componentProps, {
    state,
    ref: [arrowRef, forwardedRef],
    props: [{ style: arrowStyles, 'aria-hidden': true }, elementProps],
    stateAttributesMapping: popupStateMapping,
  });

  return element;
});

export interface PreviewCardArrowState {
  /**
   * Whether the preview card is currently open.
   */
  open: boolean;
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

export interface PreviewCardArrowProps extends BaseUIComponentProps<'div', PreviewCardArrowState> {}

export namespace PreviewCardArrow {
  export type State = PreviewCardArrowState;
  export type Props = PreviewCardArrowProps;
}
