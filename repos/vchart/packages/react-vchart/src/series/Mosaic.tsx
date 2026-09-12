import type { BaseSeriesProps } from './BaseSeries';
import { createSeries } from './BaseSeries';
import type { IMosaicSeriesSpec } from '@visactor/vchart';
import { registerMosaicSeries } from '@visactor/vchart';

export type MosaicProps = BaseSeriesProps & Omit<IMosaicSeriesSpec, 'type'>;

export const Mosaic = createSeries<MosaicProps>('Mosaic', ['mosaic'], 'mosaic', [registerMosaicSeries]);
