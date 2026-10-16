'use client';
import * as React from 'react';
import { useRenderElement } from '../../internals/useRenderElement';
import { valueToPercent } from '../../utils/valueToPercent';
import type { ProgressRootState } from '../root/ProgressRoot';
import { useProgressRootContext } from '../root/ProgressRootContext';
import { progressStateAttributesMapping } from '../root/stateAttributesMapping';
import type { BaseUIComponentProps } from '../../internals/types';

/**
 * Visualizes the completion status of the task.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Progress](https://base-ui.com/react/components/progress)
 */
export const ProgressIndicator = React.forwardRef(function ProgressIndicator(
  componentProps: ProgressIndicator.Props,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const { render, className, style, ...elementProps } = componentProps;

  const { max, min, value, state } = useProgressRootContext();

  const percentageValue =
    Number.isFinite(value) && value !== null ? valueToPercent(value, min, max) : null;

  const indicatorStyle: React.CSSProperties =
    percentageValue == null
      ? {}
      : {
          insetInlineStart: 0,
          height: 'inherit',
          width: `${percentageValue}%`,
        };

  const element = useRenderElement('div', componentProps, {
    state,
    ref: forwardedRef,
    props: [
      {
        style: indicatorStyle,
      },
      elementProps,
    ],
    stateAttributesMapping: progressStateAttributesMapping,
  });

  return element;
});

export interface ProgressIndicatorState extends ProgressRootState {}

export interface ProgressIndicatorProps extends BaseUIComponentProps<
  'div',
  ProgressIndicatorState
> {}

export namespace ProgressIndicator {
  export type State = ProgressIndicatorState;
  export type Props = ProgressIndicatorProps;
}
