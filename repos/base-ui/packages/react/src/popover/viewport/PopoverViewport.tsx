'use client';
import * as React from 'react';
import { usePopoverRootContext } from '../root/PopoverRootContext';
import { usePopoverPositionerContext } from '../positioner/PopoverPositionerContext';
import { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { PopoverViewportCssVars } from './PopoverViewportCssVars';
import { usePopupViewport } from '../../utils/usePopupViewport';

const stateAttributesMapping: StateAttributesMapping<PopoverViewportState> = {
  activationDirection: (value) =>
    value
      ? {
          'data-activation-direction': value,
        }
      : null,
};

/**
 * A viewport for displaying content transitions.
 * This component is only required if one popup can be opened by multiple triggers, its content
 * changes based on the trigger, and switching between them is animated.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Popover](https://base-ui.com/react/components/popover)
 */
export const PopoverViewport = React.forwardRef(function PopoverViewport(
  componentProps: PopoverViewport.Props,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const { render, className, style, children, ...elementProps } = componentProps;

  const { store } = usePopoverRootContext();
  const { side } = usePopoverPositionerContext();

  const instantType = store.useState('instantType');

  const { children: childrenToRender, state: viewportState } = usePopupViewport({
    store,
    side,
    cssVars: PopoverViewportCssVars,
    children,
  });

  const state: PopoverViewportState = {
    activationDirection: viewportState.activationDirection,
    transitioning: viewportState.transitioning,
    instant: instantType,
  };

  return useRenderElement('div', componentProps, {
    state,
    ref: forwardedRef,
    props: [elementProps, { children: childrenToRender }],
    stateAttributesMapping,
  });
});

export interface PopoverViewportState {
  /**
   * The activation direction of the transitioned content.
   */
  activationDirection: string | undefined;
  /**
   * Whether the viewport is currently transitioning between contents.
   */
  transitioning: boolean;
  /**
   * Present if animations should be instant.
   */
  instant: 'dismiss' | 'click' | 'focus' | 'trigger-change' | undefined;
}

export interface PopoverViewportProps extends BaseUIComponentProps<'div', PopoverViewportState> {
  /**
   * The content to render inside the transition container.
   */
  children?: React.ReactNode;
}

export namespace PopoverViewport {
  export type Props = PopoverViewportProps;
  export type State = PopoverViewportState;
}
