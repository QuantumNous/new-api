import type { IAreaSeriesSpec, IAreaSeriesTheme } from '../area/interface';
export interface IRangeAreaSeriesSpec extends Omit<IAreaSeriesSpec, 'type'> {
  /**
   * 系列类型
   */
  type: 'rangeArea';

  /**
   * 数据字段配置
   */
  /* 区间最小值字段 */
  minField?: string;
  /* 区间最大值字段 */
  maxField?: string;
}

export type IRangeAreaSeriesTheme = IAreaSeriesTheme;
