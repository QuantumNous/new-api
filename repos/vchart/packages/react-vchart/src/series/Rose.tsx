import { BaseSeriesProps, createSeries } from './BaseSeries';
import type { IRoseSeriesSpec } from '@visactor/vchart';
import { registerRoseSeries } from '@visactor/vchart';

export type RoseProps = BaseSeriesProps & Omit<IRoseSeriesSpec, 'type'>;

export const Rose = createSeries<RoseProps>('Rose', ['rose'], 'rose', [registerRoseSeries]);
