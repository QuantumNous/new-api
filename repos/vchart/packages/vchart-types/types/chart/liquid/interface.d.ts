import type { ILiquidSeriesSpec } from '../../series/liquid/interface';
import type { ICartesianChartSpec } from '../cartesian/interface';
import type { IChartExtendsSeriesSpec } from '../../typings/spec/common';
export interface ILiquidChartSpec extends ICartesianChartSpec, IChartExtendsSeriesSpec<ILiquidSeriesSpec> {
    type: 'liquid';
    series?: ILiquidSeriesSpec[];
}
