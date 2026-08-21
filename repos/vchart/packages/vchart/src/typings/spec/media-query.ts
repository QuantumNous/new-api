import type { ComponentTypeEnum } from '../../component/interface';
import type { IVChart } from '../../core/interface';
import type { IModelSpecInfo } from '../../model/interface';
import type { SeriesTypeEnum } from '../../series/interface/type';
import type { IChartSpec } from './common';

export interface IMediaInfo {
  /** 图表宽度 */
  width: number;
  /** 图表高度 */
  height: number;
}

/**
 * 媒体查询配置（包含多项查询）
 * @since 1.8.0
 */
export type IMediaQuerySpec = IMediaQueryItem[];

/** 媒体查询配置（表示一项查询）*/
export interface IMediaQueryItem {
  /** 媒体查询条件 */
  query: IMediaQueryCondition;
  /** 命中媒体查询条件之后的动作 */
  action: IMediaQueryAction | IMediaQueryAction[];
}

/** 媒体查询条件，多个属性之间为“且”关系 */
export interface IMediaQueryCondition {
  /** 最小图表宽度 */
  minWidth?: number;
  /** 最大图表宽度 */
  maxWidth?: number;
  /** 最小图表高度 */
  minHeight?: number;
  /** 最大图表高度 */
  maxHeight?: number;
  /** 当图表宽度或高度发生变化时触发的回调，由回调指定是否命中查询条件 */
  onResize?: (info: IMediaInfo, vchart: IVChart) => boolean;
}

/** 命中媒体查询条件之后的动作 */
export interface IMediaQueryAction<T extends Record<string, unknown> = any> {
  /**
   * 需要应用的新 spec
   * - 如果元素过滤器匹配到了某些图表元素，新 spec 将依次合并到这些元素
   * - 如果元素过滤器没有匹配到任何图表元素，新 spec 可能会作为新的图表元素添加到图表（forceAppend 为 true 的情况）。
   *
   * 有两种配置类型：
   * - 直接指定新 spec
   * - 使用回调的方式返回新 spec
   */
  spec:
    | Partial<T>
    | ((
        /** filter 匹配到的图表元素信息 */
        filteredModelInfo: IModelSpecInfo<T>[],
        /** 当前 action 对象 */
        action: IMediaQueryAction<T>,
        /** 当前媒体查询条件 */
        query: IMediaQueryCondition
      ) => Partial<T>);
  /**
   * 元素过滤器类型
   * （规定 filter 需要过滤的元素类型，以及新 spec 对应的元素类型）
   * @default 'chart'
   */
  filterType?: MediaQueryActionFilterType;
  /**
   * 元素过滤器
   * （如果不配置，则匹配 filterType 对应的所有元素）
   *
   * 有两种配置类型：
   * - 配置为元素 spec 的一部分，在过滤图表元素时基于此 spec 进行模糊匹配
   * - 配置为函数回调，依次决定当前 filterType 类型下的每个元素实例是否被匹配
   */
  filter?: MediaQueryActionFilter<T> | Array<MediaQueryActionFilter<T>>;
  /**
   * 元素过滤器匹配不到图表元素时，是否将新 spec 作为新的图表元素添加到图表
   * （filterType 为 'chart' 时该配置失效）
   * @default false
   */
  forceAppend?: boolean;
}

/**
 * 元素过滤器类型
 */
export type MediaQueryActionFilterType =
  | 'region'
  | 'series'
  | 'chart'
  | `${SeriesTypeEnum}` // 具体 series 类型，如 'bar'、'line'
  | `${ComponentTypeEnum}` // 具体 component 类型，如 'cartesianAxis-band'
  | keyof IChartSpec; // 组件 spec key，可视为简化版 component 类型，如 'axes'、'legends'、'crosshair'

/**
 * 元素过滤器
 *
 * 有两种配置类型：
 * - 配置为元素 spec 的一部分，在过滤图表元素时基于此 spec 进行模糊匹配
 * - 配置为函数回调，依次决定当前 filterType 类型下的每个元素实例是否被匹配
 */
export type MediaQueryActionFilter<T extends Record<string, unknown> = any> =
  | Partial<T>
  | ((
      /** 当前图表元素信息 */
      modelInfo: IModelSpecInfo<T>,
      /** 当前 action 对象 */
      action: IMediaQueryAction<T>,
      /** 当前媒体查询条件 */
      query: IMediaQueryCondition
    ) => boolean);
