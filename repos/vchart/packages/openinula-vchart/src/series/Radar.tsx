import { BaseSeriesProps, createSeries } from './BaseSeries';
import type { IRadarSeriesSpec } from '@visactor/vchart';

export type RadarProps = BaseSeriesProps & Omit<IRadarSeriesSpec, 'type'>;

export const Radar = createSeries<RadarProps>('Radar', ['radar'], 'radar');
