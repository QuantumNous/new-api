import type { IChartExtendsSeriesSpec } from '../../typings/spec/common';
import type { ICartesianChartSpec } from '../cartesian/interface';
import type { IMosaicSeriesSpec } from '../../series/mosaic/interface';

export interface IMosaicChartSpec extends ICartesianChartSpec, IChartExtendsSeriesSpec<IMosaicSeriesSpec> {
  /** 图表类型配置 */
  type: 'mosaic';
  /** 系列配置 */
  series?: IMosaicSeriesSpec[];
}
