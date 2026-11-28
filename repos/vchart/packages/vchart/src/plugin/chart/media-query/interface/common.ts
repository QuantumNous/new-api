import type { ComponentTypeEnum } from '../../../../component/interface';
import type { IVChart } from '../../../../core/interface';
import type { IModelSpecInfo } from '../../../../model/interface';
import type { SeriesTypeEnum } from '../../../../series/interface';
import type { IChartSpec } from '../../../../typings';

export interface IMediaQueryActionFilterResult<T extends Record<string, unknown> = any> {
  /** 是否是图表层级 */
  isChart?: boolean;
  /** 如果不是图表层级，是哪个 model 类型 */
  modelType?: 'series' | 'region' | 'component';
  /** model 具体的类型 */
  type?: SeriesTypeEnum | ComponentTypeEnum;
  /** model 在图表 spec 中对应的 key */
  specKey?: keyof IChartSpec;
  /** 匹配到的 model 的 spec 信息 */
  modelInfo: IModelSpecInfo<T>[];
}

export interface IMediaQueryOption {
  globalInstance: IVChart;
  updateSpec: (spec: any, compile?: boolean, render?: boolean) => void;
}

export interface IMediaQueryCheckResult {
  /** 是否命中媒体查询条件 */
  isActive: boolean;
  /** 当前媒体查询的状态是否发生改变（生效->失效 或 失效->生效） */
  hasChanged: boolean;
}

export interface IMediaQueryActionResult {
  /** 返回的图表 spec */
  chartSpec: any;
  /** spec 是否被更改 */
  hasChanged: boolean;
}
