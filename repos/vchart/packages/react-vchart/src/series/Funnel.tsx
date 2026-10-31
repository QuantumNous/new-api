import { BaseSeriesProps, createSeries } from './BaseSeries';
import type { IFunnelSeriesSpec } from '@visactor/vchart';
import { registerFunnelSeries } from '@visactor/vchart';

export type FunnelProps = BaseSeriesProps & Omit<IFunnelSeriesSpec, 'type'>;

export const Funnel = createSeries<FunnelProps>('Funnel', ['funnel'], 'funnel', [registerFunnelSeries]);
