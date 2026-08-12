import type { IWaterfallSeriesSpec } from '../../series/waterfall/interface';
import type { IChartExtendsSeriesSpec } from '../../typings/spec';
import type { ICartesianChartSpec } from '../cartesian/interface';
export interface IWaterfallChartSpec extends ICartesianChartSpec, IChartExtendsSeriesSpec<IWaterfallSeriesSpec> {
    type: 'waterfall';
    series?: IWaterfallSeriesSpec[];
}
