import type { IContinuousLegendSpec } from '@visactor/vchart';
import { LEGEND_CUSTOMIZED_EVENTS, LegendEventProps } from '../eventsUtils';
import { BaseComponentProps, createComponent } from './BaseComponent';
import { registerContinuousLegend } from '@visactor/vchart';

export type ContinuousLegendProps = BaseComponentProps & IContinuousLegendSpec & LegendEventProps;

export const ContinuousLegend = createComponent<IContinuousLegendSpec>(
  'ContinuousLegend',
  'legends',
  LEGEND_CUSTOMIZED_EVENTS,
  false,
  [registerContinuousLegend]
);
