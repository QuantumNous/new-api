import type { IChartExtendsSeriesSpec } from '../../typings/spec/common';
import type { IRangeAreaSeriesSpec } from '../../series/range-area/interface';
import type { ICartesianChartSpec } from '../cartesian/interface';
export interface IRangeAreaChartSpec extends ICartesianChartSpec, IChartExtendsSeriesSpec<IRangeAreaSeriesSpec> {
    type: 'rangeArea';
    series?: IRangeAreaSeriesSpec[];
}
