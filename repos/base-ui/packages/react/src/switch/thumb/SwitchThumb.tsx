'use client';
import * as React from 'react';
import type { SwitchRootState } from '../root/SwitchRoot';
import { useSwitchRootContext } from '../root/SwitchRootContext';
import { useRenderElement } from '../../internals/useRenderElement';
import type { BaseUIComponentProps } from '../../internals/types';
import { stateAttributesMapping } from '../stateAttributesMapping';

/**
 * The movable part of the switch that indicates whether the switch is on or off.
 * Renders a `<span>`.
 *
 * Documentation: [Base UI Switch](https://base-ui.com/react/components/switch)
 */
export const SwitchThumb = React.forwardRef(function SwitchThumb(
  componentProps: SwitchThumb.Props,
  forwardedRef: React.ForwardedRef<HTMLSpanElement>,
) {
  const { render, className, style, ...elementProps } = componentProps;

  const state = useSwitchRootContext();

  return useRenderElement('span', componentProps, {
    state,
    ref: forwardedRef,
    stateAttributesMapping,
    props: elementProps,
  });
});

export interface SwitchThumbProps extends BaseUIComponentProps<'span', SwitchThumbState> {}

export interface SwitchThumbState extends SwitchRootState {}

export namespace SwitchThumb {
  export type Props = SwitchThumbProps;
  export type State = SwitchThumbState;
}
