import { BaseSeriesProps, createSeries } from './BaseSeries';
import type { IAreaSeriesSpec } from '@visactor/vchart';
import { registerAreaSeries } from '@visactor/vchart';

export type AreaProps = BaseSeriesProps & Omit<IAreaSeriesSpec, 'type'>;
export const Area = createSeries<AreaProps>('Area', ['area'], 'area', [registerAreaSeries]);
