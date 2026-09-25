import type { IMarkSpec, ISeriesSpec } from '../../typings/spec/common';
import type { IArcMarkSpec, IRectMarkSpec, IGroupMarkSpec } from '../../typings/visual';

export interface IProgressSeriesSpec extends ISeriesSpec {
  /**
   * 进度条圆角半径
   * @default 0
   */
  cornerRadius?: number;

  /** 进度条样式 */
  progress?: IMarkSpec<IArcMarkSpec> | IMarkSpec<IRectMarkSpec>;
  /** 背景样式 */
  track?: IMarkSpec<IArcMarkSpec> | IMarkSpec<IGroupMarkSpec>;
}
