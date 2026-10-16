import { BaseSeriesProps, createSeries } from './BaseSeries';
import type { IMapSeriesSpec } from '@visactor/vchart';
import { registerMapSeries } from '@visactor/vchart';

export type MapProps = BaseSeriesProps & Omit<IMapSeriesSpec, 'type'>;

export const Map = createSeries<MapProps>('Map', ['map'], 'map', [registerMapSeries]);
