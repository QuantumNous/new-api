import type { IModelSpec } from '../../model/interface';
import type { StringOrNumber } from '../../typings';

export interface IComponentSpec extends IModelSpec {
  /**
   * 组件关联的region索引
   * @default 0
   */
  regionIndex?: number | number[];
  /**
   * 组件关联的region id
   */
  regionId?: StringOrNumber | StringOrNumber[];
  /**
   * 组件关联的系列索引
   */
  seriesIndex?: number | number[];
  /**
   * 组件关联的系列id
   */
  seriesId?: StringOrNumber | StringOrNumber[];
}
