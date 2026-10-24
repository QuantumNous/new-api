import type { IChartExtendsSeriesSpec, IChartSpec } from '../../typings/spec/common';
import type { IMapSeriesSpec } from '../../series/map/interface';
export interface IMapChartSpec extends IChartSpec, IChartExtendsSeriesSpec<IMapSeriesSpec> {
    type: 'map';
    series?: IMapSeriesSpec[];
}
