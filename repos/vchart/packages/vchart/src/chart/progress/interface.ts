import type { IChartSpec } from '../../typings/spec/common';
import type { ICartesianAxisSpec } from '../../component/axis/cartesian/interface';
import type { IPolarAxisSpec } from '../../component/axis/polar/interface';

export interface IProgressChartSpec extends IChartSpec {
  /**
   * 分组字段
   */
  seriesField?: string;
  /**
   * 进度条圆角半径
   * @default 0
   */
  cornerRadius?: number;
  /** 轴配置 */
  axes?: ICartesianAxisSpec[] | IPolarAxisSpec[];
}
