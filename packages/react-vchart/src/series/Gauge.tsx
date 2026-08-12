import type { BaseSeriesProps } from './BaseSeries';
import { createSeries } from './BaseSeries';

import type { IGaugeSeriesSpec } from '@visactor/vchart';
import { registerGaugeSeries } from '@visactor/vchart';

export type GaugeProps = BaseSeriesProps & Omit<IGaugeSeriesSpec, 'type'>;

export const Gauge = createSeries<GaugeProps>('Gauge', ['segment', 'track', 'label'], 'gauge', [registerGaugeSeries]);
