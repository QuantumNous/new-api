import type { ISeriesFilter } from '../../region/interface';
import type { ILayoutModel, IModelConstructor, IModelOption, IModelSpecInfo } from '../../model/interface';
// eslint-disable-next-line no-duplicate-imports
import type { IRegion } from '../../region/interface';
import type { ISeries } from '../../series/interface';
import type { Maybe, StringOrNumber } from '../../typings';
import type { IGraphic } from '@visactor/vrender-core';
import type { IChartSpecInfo } from '../../chart/interface';
/**
 * 组件作为图表辅助阅读等功能的模块，除了model提供的能力之外，还有以下功能特点
 * 支持对多region的绑定。
 * 能够在resize时正常的重新对内部元素布局。
 * 保持数据独立，模块间的依赖关系，能从数据上处理的应当从数据上处理。
 */

export interface IComponentOption extends IModelOption {
  // 区域
  getAllRegions: () => IRegion[];
  getRegionsInIndex: (index?: number[]) => IRegion[];
  getRegionsInIds: (ids: number[]) => IRegion[];
  getRegionsInUserIdOrIndex: (user_ids?: StringOrNumber[], index?: number[]) => IRegion[];
  // series
  getAllSeries: () => ISeries[];
  getSeriesInIndex: (index?: number[]) => ISeries[];
  getSeriesInIds: (ids?: number[]) => ISeries[];
  getSeriesInUserIdOrIndex: (user_ids?: StringOrNumber[], index?: number[]) => ISeries[];
  // component
  getAllComponents: () => IComponent[];
  getComponentByIndex: (key: string, index: number) => IComponent | undefined;
  getComponentByUserId: (userId: StringOrNumber) => IComponent | undefined;
  getComponentsByKey: (key: string) => IComponent[];
  getComponentsByType: (type: string) => IComponent[];
}

export interface IComponent extends ILayoutModel {
  readonly name: string;

  // 区域
  getRegions: () => IRegion[];
  getBindSeriesFilter?: () => ISeriesFilter;
  getVRenderComponents: () => IGraphic[];

  // 清空，用于更新等场景
  clear: () => void;

  // 数据
  getDatum: (childGraphic?: IGraphic) => any | undefined;
}

export interface IComponentConstructor extends IModelConstructor {
  type: string;
  specKey?: string;
  getSpecInfo?: (chartSpec: any, chartSpecInfo?: IChartSpecInfo) => Maybe<IModelSpecInfo[]>;
  createComponent: (specInfo: IModelSpecInfo, options: IComponentOption) => IComponent;
  new (spec: any, options: IComponentOption): IComponent;
}
