import type { BaseSeriesProps } from './BaseSeries';
import { createSeries } from './BaseSeries';
import type { IFunnel3dSeriesSpec } from '@visactor/vchart-extension';
import { registerFunnel3dSeries } from '@visactor/vchart-extension';

export type Funnel3dProps = BaseSeriesProps & Omit<IFunnel3dSeriesSpec, 'type'>;

export const Funnel3d = createSeries<Funnel3dProps>('Funnel3d', ['funnel'], 'funnel3d', [registerFunnel3dSeries]);
