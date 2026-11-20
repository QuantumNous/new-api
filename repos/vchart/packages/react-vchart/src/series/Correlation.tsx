import { BaseSeriesProps, createSeries } from './BaseSeries';
import type { ICorrelationSeriesSpec } from '@visactor/vchart';
import { registerCorrelationChart } from '@visactor/vchart';

export type CorrelationProps = BaseSeriesProps & Omit<ICorrelationSeriesSpec, 'type'>;

export const Correlation = createSeries<CorrelationProps>(
  'Correlation',
  ['centerPoint', 'ripplePoint', 'centerLabel', 'nodePoint', 'label'],
  'correlation',
  [registerCorrelationChart]
);
