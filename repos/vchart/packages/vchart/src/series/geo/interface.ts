import type { ISeriesSpec } from '../../typings';

export interface IGeoSeriesSpec extends ISeriesSpec {
  /** 数值字段 */
  valueField?: string;
}
