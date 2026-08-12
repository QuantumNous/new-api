'use client';
import * as React from 'react';
import type { BaseUIComponentProps, Orientation } from '../internals/types';
import { useRenderElement } from '../internals/useRenderElement';

/**
 * A separator element accessible to screen readers.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Separator](https://base-ui.com/react/components/separator)
 */
export const Separator = React.forwardRef(function SeparatorComponent(
  componentProps: Separator.Props,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const { className, render, orientation = 'horizontal', style, ...elementProps } = componentProps;

  const state: SeparatorState = { orientation };

  const element = useRenderElement('div', componentProps, {
    state,
    ref: forwardedRef,
    props: [{ role: 'separator', 'aria-orientation': orientation }, elementProps],
  });

  return element;
});

export interface SeparatorProps extends BaseUIComponentProps<'div', SeparatorState> {
  /**
   * The orientation of the separator.
   * @default 'horizontal'
   */
  orientation?: Orientation | undefined;
}

export interface SeparatorState {
  /**
   * The orientation of the separator.
   */
  orientation: Orientation;
}

export namespace Separator {
  export type Props = SeparatorProps;
  export type State = SeparatorState;
}
