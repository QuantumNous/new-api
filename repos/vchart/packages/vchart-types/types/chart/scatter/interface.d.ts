import type { IScatterSeriesSpec } from '../../series/scatter/interface';
import type { IChartExtendsSeriesSpec } from '../../typings/spec';
import type { ICartesianChartSpec } from '../cartesian/interface';
export interface IScatterChartSpec extends ICartesianChartSpec, IChartExtendsSeriesSpec<IScatterSeriesSpec> {
    type: 'scatter';
    series?: IScatterSeriesSpec[];
}
