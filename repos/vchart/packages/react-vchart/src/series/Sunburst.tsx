import { BaseSeriesProps, createSeries } from './BaseSeries';

import type { ISunburstSeriesSpec } from '@visactor/vchart';
import { registerSunBurstSeries } from '@visactor/vchart';

export type SunburstProps = BaseSeriesProps & Omit<ISunburstSeriesSpec, 'type'>;

export const Sunburst = createSeries<SunburstProps>('Sunburst', ['sunburst', 'label'], 'sunburst', [
  registerSunBurstSeries
]);
