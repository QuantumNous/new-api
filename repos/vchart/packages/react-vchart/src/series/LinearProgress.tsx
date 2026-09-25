import { BaseSeriesProps, createSeries } from './BaseSeries';
import type { ILinearProgressSeriesSpec } from '@visactor/vchart';
import { registerLinearProgressSeries } from '@visactor/vchart';

export type LinearProgressProps = BaseSeriesProps & Omit<ILinearProgressSeriesSpec, 'type'>;

export const LinearProgress = createSeries<LinearProgressProps>(
  'LinearProgress',
  ['linearProgress'],
  'linearProgress',
  [registerLinearProgressSeries]
);
