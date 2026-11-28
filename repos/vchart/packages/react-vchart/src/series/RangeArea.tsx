import type { BaseSeriesProps } from './BaseSeries';
import { createSeries } from './BaseSeries';
import type { IRangeAreaSeriesSpec } from '@visactor/vchart';
import { registerRangeAreaSeries } from '@visactor/vchart';

export type RangeAreaProps = BaseSeriesProps & Omit<IRangeAreaSeriesSpec, 'type'>;

export const RangeArea = createSeries<RangeAreaProps>('RangeArea', ['rangeArea'], 'rangeArea', [
  registerRangeAreaSeries
]);
