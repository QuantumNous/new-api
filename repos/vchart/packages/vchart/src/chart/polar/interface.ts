import type { IPointLike } from '@visactor/vutils';
import type { IPolarAxisSpec } from '../../component/axis/polar/interface';
import type { IPolarCrosshairSpec } from '../../component/crosshair/interface';
import type { IChartSpec, ILayoutRect } from '../../typings';
import type { IIndicatorSpec } from '../../component/indicator/interface';

export interface IPolarChartSpec extends IChartSpec {
  /**
   * 极坐标系下坐标轴配置，支持半径轴和角度轴。
   * * `orient: 'angle'` 角度轴
   * * `orient: 'radius'` 半径轴
   */
  axes?: IPolarAxisSpec[];
  /**
   * 十字辅助线配置
   */
  crosshair?: IPolarCrosshairSpec | IPolarCrosshairSpec[];

  /**
   * @since 1.11.2
   */
  layoutRadius?: 'auto' | number | ((layoutRect: ILayoutRect, center: IPointLike) => number);

  /**
   * 指标卡配置
   */
  indicator?: IIndicatorSpec | IIndicatorSpec[];
}
