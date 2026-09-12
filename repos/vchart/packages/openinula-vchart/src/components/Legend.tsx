import type { IDiscreteLegendSpec } from '@visactor/vchart';
import { LEGEND_CUSTOMIZED_EVENTS, LegendEventProps } from '../eventsUtils';
import { BaseComponentProps, createComponent } from './BaseComponent';

export type LegendProps = BaseComponentProps & IDiscreteLegendSpec & LegendEventProps;

export const Legend = createComponent<LegendProps>('Legend', 'legends', LEGEND_CUSTOMIZED_EVENTS);
