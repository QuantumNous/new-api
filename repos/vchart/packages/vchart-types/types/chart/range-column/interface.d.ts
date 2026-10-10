import type { IChartExtendsSeriesSpec } from '../../typings/spec/common';
import type { IRangeColumnSeriesSpec } from '../../series/range-column/interface';
import type { ICartesianChartSpec } from '../cartesian/interface';
export interface IRangeColumnChartSpec extends ICartesianChartSpec, IChartExtendsSeriesSpec<IRangeColumnSeriesSpec> {
    type: 'rangeColumn';
    series?: IRangeColumnSeriesSpec[];
}
