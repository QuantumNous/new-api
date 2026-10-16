import type { IChartSpec } from '../../typings/spec/common';
import type { ICartesianAxisSpec } from '../../component/axis/cartesian/interface';
import type { ICartesianCrosshairSpec } from '../../component/crosshair/interface';
import type { IMarkLineSpec } from '../../component/marker/mark-line/interface';
import type { IMarkAreaSpec } from '../../component/marker/mark-area/interface';
import type { IMarkPointSpec } from '../../component/marker/mark-point/interface';
import type { DirectionType } from '../../typings';

export interface ICartesianChartSpec extends IChartSpec {
  /**
   * 图表的方向配置。
   * - 'vertical' 垂直布局，即常见的直角坐标系布局，x 轴位于底部，y 轴位于左侧。
   * - 'horizontal' 水平布局，可理解为 x 轴和 y 轴位置互换。
   */
  direction?: DirectionType;
  /**
   * 笛卡尔坐标系的坐标轴配置
   */
  axes?: ICartesianAxisSpec[];
  /**
   * 十字辅助线配置
   */
  crosshair?: ICartesianCrosshairSpec | ICartesianCrosshairSpec[];
  /**
   * 参考线配置
   */
  markLine?: IMarkLineSpec | IMarkLineSpec[];
  /**
   * 参考区域配置
   */
  markArea?: IMarkAreaSpec | IMarkAreaSpec[];
  /**
   * 参考点配置
   */
  markPoint?: IMarkPointSpec | IMarkPointSpec[];
}
