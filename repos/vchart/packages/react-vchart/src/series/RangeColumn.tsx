import { BaseSeriesProps, createSeries } from './BaseSeries';
import type { IRangeColumnSeriesSpec } from '@visactor/vchart';
import { registerRangeColumnSeries } from '@visactor/vchart';

export type RangeColumnProps = BaseSeriesProps & Omit<IRangeColumnSeriesSpec, 'type'>;

export const RangeColumn = createSeries<RangeColumnProps>('RangeColumn', ['rangeColumn'], 'rangeColumn', [
  registerRangeColumnSeries
]);
