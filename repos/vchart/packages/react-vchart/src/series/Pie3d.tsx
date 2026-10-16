import type { BaseSeriesProps } from './BaseSeries';
import { createSeries } from './BaseSeries';
import type { IPie3dSeriesSpec } from '@visactor/vchart-extension';
import { registerPie3dSeries } from '@visactor/vchart-extension';

export type Pie3dProps = BaseSeriesProps & Omit<IPie3dSeriesSpec, 'type'>;

export const Pie3d = createSeries<Pie3dProps>('Pie3d', ['pie'], 'pie3d', [registerPie3dSeries]);
