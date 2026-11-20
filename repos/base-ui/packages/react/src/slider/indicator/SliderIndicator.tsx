'use client';
import * as React from 'react';
import type { BaseUIComponentProps } from '../../internals/types';
import { valueToPercent } from '../../utils/valueToPercent';
import { useIsHydrating } from '../../utils/useIsHydrating';
import { useRenderElement } from '../../internals/useRenderElement';
import { useSliderRootContext } from '../root/SliderRootContext';
import { sliderStateAttributesMapping } from '../root/stateAttributesMapping';
import type { SliderRootState } from '../root/SliderRoot';

function getInsetStyles(
  vertical: boolean,
  range: boolean,
  start: number | undefined,
  end: number | undefined,
  renderBeforeHydration: boolean,
  hydrating: boolean,
): React.CSSProperties & Record<string, unknown> {
  const visibility =
    start === undefined || (range && end === undefined) ? ('hidden' as const) : undefined;

  const startEdge = vertical ? 'bottom' : 'insetInlineStart';
  const mainSide = vertical ? 'height' : 'width';
  const crossSide = vertical ? 'width' : 'height';

  const styles: React.CSSProperties & Record<string, unknown> = {
    visibility: renderBeforeHydration && hydrating ? 'hidden' : visibility,
    position: vertical ? 'absolute' : 'relative',
    [crossSide]: 'inherit',
  };

  styles['--start-position'] = `${start ?? 0}%`;

  if (!range) {
    styles[startEdge] = 0;
    styles[mainSide] = 'var(--start-position)';

    return styles;
  }

  styles['--relative-size'] = `${(end ?? 0) - (start ?? 0)}%`;

  styles[startEdge] = 'var(--start-position)';
  styles[mainSide] = 'var(--relative-size)';

  return styles;
}

function getCenteredStyles(
  vertical: boolean,
  range: boolean,
  start: number,
  end: number,
): React.CSSProperties {
  const startEdge = vertical ? 'bottom' : 'insetInlineStart';
  const mainSide = vertical ? 'height' : 'width';
  const crossSide = vertical ? 'width' : 'height';

  const styles: React.CSSProperties = {
    position: vertical ? 'absolute' : 'relative',
    [crossSide]: 'inherit',
  };

  if (!range) {
    styles[startEdge] = 0;
    styles[mainSide] = `${start}%`;

    return styles;
  }

  const size = end - start;

  styles[startEdge] = `${start}%`;
  styles[mainSide] = `${size}%`;

  return styles;
}

/**
 * Visualizes the current value of the slider.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Slider](https://base-ui.com/react/components/slider)
 */
export const SliderIndicator = React.forwardRef(function SliderIndicator(
  componentProps: SliderIndicator.Props,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const { render, className, style: styleProp, ...elementProps } = componentProps;

  const { indicatorPosition, inset, max, min, orientation, renderBeforeHydration, state, values } =
    useSliderRootContext();

  const isHydrating = useIsHydrating();

  const vertical = orientation === 'vertical';
  const range = values.length > 1;

  const style = inset
    ? getInsetStyles(
        vertical,
        range,
        indicatorPosition[0],
        indicatorPosition[1],
        renderBeforeHydration,
        isHydrating,
      )
    : getCenteredStyles(
        vertical,
        range,
        valueToPercent(values[0], min, max),
        valueToPercent(values[values.length - 1], min, max),
      );

  const element = useRenderElement('div', componentProps, {
    state,
    ref: forwardedRef,
    props: [
      {
        ['data-base-ui-slider-indicator' as string]: renderBeforeHydration ? '' : undefined,
        style,
        suppressHydrationWarning: renderBeforeHydration || undefined,
      },
      elementProps,
    ],
    stateAttributesMapping: sliderStateAttributesMapping,
  });

  return element;
});

export interface SliderIndicatorState extends SliderRootState {}

export interface SliderIndicatorProps extends BaseUIComponentProps<'div', SliderIndicatorState> {}

export namespace SliderIndicator {
  export type State = SliderIndicatorState;
  export type Props = SliderIndicatorProps;
}
