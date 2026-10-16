import type { IBarSeriesSpec } from '../../series/bar/interface';
import type { IChartExtendsSeriesSpec } from '../../typings';
import type { ICartesianChartSpec } from '../cartesian/interface';
export interface IHistogramChartSpec extends ICartesianChartSpec, Omit<IChartExtendsSeriesSpec<IBarSeriesSpec>, 'type'> {
    type: 'histogram';
}
