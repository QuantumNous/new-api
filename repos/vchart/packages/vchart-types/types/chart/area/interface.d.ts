import type { ICartesianChartSpec } from '../cartesian/interface';
import type { IAreaSeriesSpec } from '../../series/area/interface';
import type { IChartExtendsSeriesSpec } from '../../typings/spec';
export interface IAreaChartSpec extends ICartesianChartSpec, IChartExtendsSeriesSpec<IAreaSeriesSpec> {
    type: 'area';
    series?: IAreaSeriesSpec[];
}
