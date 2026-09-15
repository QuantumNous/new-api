import { BaseComponentProps, createComponent } from './BaseComponent';
import type { IIndicatorSpec } from '@visactor/vchart';

export type IndicatorProps = IIndicatorSpec & BaseComponentProps;

export const Indicator = createComponent<IndicatorProps>('Indicator', 'indicator', null, true);
