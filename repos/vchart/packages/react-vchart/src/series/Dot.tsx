import { BaseSeriesProps, createSeries } from './BaseSeries';
import type { IDotSeriesSpec } from '@visactor/vchart';
import { registerDotSeries } from '@visactor/vchart';

export type DotProps = BaseSeriesProps & Omit<IDotSeriesSpec, 'type'>;

export const Dot = createSeries<DotProps>('Dot', ['dot'], 'dot', [registerDotSeries]);
