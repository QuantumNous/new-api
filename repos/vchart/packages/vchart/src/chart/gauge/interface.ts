import type { IPolarAxisSpec } from '../../component/axis/polar/interface';
import type { IGaugePointerSeriesSpec, IGaugeSeriesSpec } from '../../series/gauge/interface';
import type { ILinearAxisSpec } from '../../component/axis/interface';
import type { ICircularProgressSeriesSpec } from '../../series/progress/circular/interface';
import type { IPolarChartSpec } from '../polar/interface';

export interface IGaugeChartSpec
  extends Omit<IPolarChartSpec, 'axes'>,
    Omit<IGaugePointerSeriesSpec, 'data' | 'type' | 'morph' | 'tooltip'> {
  type: 'gauge';

  /** 表盘背景，可选择 gauge 系列或 circularProgress 系列的配置 */
  gauge?: Omit<IGaugeSeriesSpec, 'data'> | Omit<ICircularProgressSeriesSpec, 'data'>;

  /** 轴配置 */
  axes?: (IPolarAxisSpec | ILinearAxisSpec)[];
}
