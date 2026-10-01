import { BaseSeriesProps, createSeries } from './BaseSeries';
import type { IScatterSeriesSpec } from '@visactor/vchart';

export type ScatterProps = BaseSeriesProps & Omit<IScatterSeriesSpec, 'type'>;

export const Scatter = createSeries<ScatterProps>('Scatter', ['scatter'], 'scatter');
