import { BaseSeriesProps, createSeries } from './BaseSeries';
import type { ICirclePackingSeriesSpec } from '@visactor/vchart';
import { registerCirclePackingSeries } from '@visactor/vchart';

export type CirclePackingProps = BaseSeriesProps & Omit<ICirclePackingSeriesSpec, 'type'>;

export const CirclePacking = createSeries<CirclePackingProps>(
  'CirclePacking',
  ['circlePacking', 'label'],
  'circlePacking',
  [registerCirclePackingSeries]
);
