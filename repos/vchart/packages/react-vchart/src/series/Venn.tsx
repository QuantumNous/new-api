import type { BaseSeriesProps } from './BaseSeries';
import { createSeries } from './BaseSeries';
import type { IVennSeriesSpec } from '@visactor/vchart';
import { registerVennSeries } from '@visactor/vchart';

export type VennProps = BaseSeriesProps & Omit<IVennSeriesSpec, 'type'>;

export const Venn = createSeries<VennProps>('Venn', ['circle', 'overlap', 'overlapLabel'], 'venn', [
  registerVennSeries
]);
