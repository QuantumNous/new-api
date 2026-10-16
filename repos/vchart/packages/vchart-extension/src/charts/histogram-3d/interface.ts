import type { ICartesianChartSpec, IChartExtendsSeriesSpec } from '@visactor/vchart';
import type { IBar3dSeriesSpec } from '../bar-3d/interface';

export interface IHistogram3dChartSpec
  extends ICartesianChartSpec,
    Omit<IChartExtendsSeriesSpec<IBar3dSeriesSpec>, 'type'> {
  type: 'histogram3d';
}
