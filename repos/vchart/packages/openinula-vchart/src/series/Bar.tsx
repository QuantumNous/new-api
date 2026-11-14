import { BaseSeriesProps, createSeries } from './BaseSeries';

import type { IBarSeriesSpec } from '@visactor/vchart';

export type BarProps = BaseSeriesProps & Omit<IBarSeriesSpec, 'type'>;

export const Bar = createSeries<BarProps>('Bar', ['bar'], 'bar');
