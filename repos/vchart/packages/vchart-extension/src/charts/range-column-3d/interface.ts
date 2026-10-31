import type { ICartesianChartSpec, IChartExtendsSeriesSpec, IRangeColumnSeriesSpec } from '@visactor/vchart';

export interface IRangeColumn3dChartSpec
  extends ICartesianChartSpec,
    IChartExtendsSeriesSpec<IRangeColumn3dSeriesSpec> {
  /** 图表类型配置 */
  type: 'rangeColumn3d';
  /** 系列配置 */
  series?: IRangeColumn3dSeriesSpec[];
}

export interface IRangeColumn3dSeriesSpec extends Omit<IRangeColumnSeriesSpec, 'type'> {
  type: 'rangeColumn3d';
}
