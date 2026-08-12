import type { BaseSeriesProps } from './BaseSeries';
import { createSeries } from './BaseSeries';
import type { IPictogramSeriesSpec } from '@visactor/vchart-extension';
import { registerPictogramSeries } from '@visactor/vchart-extension';

export type PictogramProps = BaseSeriesProps & Omit<IPictogramSeriesSpec, 'type'>;

export const Pictogram = createSeries<PictogramProps>('Pictogram', ['pictogram'], 'pictogram', [
  registerPictogramSeries
]);
