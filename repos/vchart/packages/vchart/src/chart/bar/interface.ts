import type { IBarSeriesSpec } from '../../series/bar/interface';
import type { IChartExtendsSeriesSpec } from '../../typings/spec/common';
import type { ICartesianChartSpec } from '../cartesian/interface';

export interface IBarChartSpec extends ICartesianChartSpec, IChartExtendsSeriesSpec<IBarSeriesSpec> {
  type: 'bar';
  /** 系列配置 */
  series?: IBarSeriesSpec[];
  /**
   * 是否开启自动 bandSize。如果开启，会根据传入的 barWidth 等配置自动计算 bandSize，从而影响轴实际长度
   * @since 1.10.0
   */
  autoBandSize?:
    | boolean
    | {
        /** 设置 bandSize 的在自动计算结果基础上的扩增值，单位为 px */
        extend: number;
      };
}
