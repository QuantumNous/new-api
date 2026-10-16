import type { IHeatmapSeriesSpec } from '../../series/heatmap/interface';
import type { IChartExtendsSeriesSpec } from '../../typings/spec';
import type { ICartesianChartSpec } from '../cartesian/interface';

export interface IHeatmapChartSpec extends ICartesianChartSpec, IChartExtendsSeriesSpec<IHeatmapSeriesSpec> {
  type: 'heatmap';
  /** 系列配置 */
  series?: IHeatmapSeriesSpec[];
}
