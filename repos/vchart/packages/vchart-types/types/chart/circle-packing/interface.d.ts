import type { ICirclePackingSeriesSpec } from '../../series/circle-packing/interface';
import type { IChartExtendsSeriesSpec, IChartSpec } from '../../typings/spec/common';
export interface ICirclePackingChartSpec extends IChartSpec, IChartExtendsSeriesSpec<ICirclePackingSeriesSpec> {
    type: 'circlePacking';
    series?: ICirclePackingSeriesSpec[];
}
