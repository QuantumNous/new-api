'use client';
import * as React from 'react';
import { BaseUIComponentProps } from '../../internals/types';
import type { MeterRootState } from '../root/MeterRoot';
import { useMeterRootContext } from '../root/MeterRootContext';
import { useRenderElement } from '../../internals/useRenderElement';

/**
 * Visualizes the position of the value along the range.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Meter](https://base-ui.com/react/components/meter)
 */
export const MeterIndicator = React.forwardRef(function MeterIndicator(
  componentProps: MeterIndicator.Props,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const { render, className, style, ...elementProps } = componentProps;

  const { percentageValue } = useMeterRootContext();

  return useRenderElement('div', componentProps, {
    ref: forwardedRef,
    props: [
      {
        style: {
          insetInlineStart: 0,
          height: 'inherit',
          width: `${percentageValue}%`,
        },
      },
      elementProps,
    ],
  });
});

export interface MeterIndicatorState extends MeterRootState {}

export interface MeterIndicatorProps extends BaseUIComponentProps<'div', MeterIndicatorState> {}

export namespace MeterIndicator {
  export type State = MeterIndicatorState;
  export type Props = MeterIndicatorProps;
}
