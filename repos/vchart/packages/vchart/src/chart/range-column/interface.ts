import type { IChartExtendsSeriesSpec } from '../../typings/spec/common';
import type { IRangeColumnSeriesSpec } from '../../series/range-column/interface';
import type { ICartesianChartSpec } from '../cartesian/interface';

export interface IRangeColumnChartSpec extends ICartesianChartSpec, IChartExtendsSeriesSpec<IRangeColumnSeriesSpec> {
  /** 图表类型配置 */
  type: 'rangeColumn';
  /** 系列配置 */
  series?: IRangeColumnSeriesSpec[];
}
