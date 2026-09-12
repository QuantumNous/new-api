'use client';
import * as React from 'react';
import type { BaseUIComponentProps } from '../../internals/types';
import { useMeterRootContext } from '../root/MeterRootContext';
import type { MeterRootState } from '../root/MeterRoot';
import { useRenderElement } from '../../internals/useRenderElement';

/**
 * A text element displaying the current value.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Meter](https://base-ui.com/react/components/meter)
 */
export const MeterValue = React.forwardRef(function MeterValue(
  componentProps: MeterValue.Props,
  forwardedRef: React.ForwardedRef<HTMLSpanElement>,
) {
  const { className, render, children, style, ...elementProps } = componentProps;

  const { value, formattedValue } = useMeterRootContext();

  return useRenderElement('span', componentProps, {
    ref: forwardedRef,
    props: [
      {
        'aria-hidden': true,
        children: typeof children === 'function' ? children(formattedValue, value) : formattedValue,
      },
      elementProps,
    ],
  });
});

export interface MeterValueState extends MeterRootState {}

export interface MeterValueProps extends Omit<
  BaseUIComponentProps<'span', MeterValueState>,
  'children'
> {
  children?: null | ((formattedValue: string, value: number) => React.ReactNode) | undefined;
}

export namespace MeterValue {
  export type State = MeterValueState;
  export type Props = MeterValueProps;
}
