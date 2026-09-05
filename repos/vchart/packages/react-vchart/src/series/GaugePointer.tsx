import type { BaseSeriesProps } from './BaseSeries';
import { createSeries } from './BaseSeries';

import type { IGaugePointerSeriesSpec } from '@visactor/vchart';
import { registerGaugePointerSeries } from '@visactor/vchart';

export type GaugePointerProps = BaseSeriesProps & Omit<IGaugePointerSeriesSpec, 'type'>;

export const GaugePointer = createSeries<GaugePointerProps>(
  'GaugePointer',
  ['pinBackground', 'pin', 'pointer'],
  'gaugePointer',
  [registerGaugePointerSeries]
);
