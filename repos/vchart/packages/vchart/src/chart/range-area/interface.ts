import type { IChartExtendsSeriesSpec } from '../../typings/spec/common';
import type { IRangeAreaSeriesSpec } from '../../series/range-area/interface';
import type { ICartesianChartSpec } from '../cartesian/interface';

export interface IRangeAreaChartSpec extends ICartesianChartSpec, IChartExtendsSeriesSpec<IRangeAreaSeriesSpec> {
  /** 图表类型配置 */
  type: 'rangeArea';
  /** 系列配置 */
  series?: IRangeAreaSeriesSpec[];
}
