import type { BaseSeriesProps } from './BaseSeries';
import { createSeries } from './BaseSeries';
import type { IBar3dSeriesSpec } from '@visactor/vchart-extension';
import { registerBar3dSeries } from '@visactor/vchart-extension';

export type Bar3dProps = BaseSeriesProps & Omit<IBar3dSeriesSpec, 'type'>;

export const Bar3d = createSeries<Bar3dProps>('Bar3d', ['bar'], 'bar3d', [registerBar3dSeries]);
