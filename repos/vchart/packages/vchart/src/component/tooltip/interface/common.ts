import type { DimensionEventParams } from '../../../event/events/dimension/interface';
import type { DimensionTooltipInfo, GroupTooltipInfo, MarkTooltipInfo } from '../processor/interface';
import type { Datum, IShowTooltipOption, ITooltipActual, ITooltipHandler } from '../../../typings';
import type { IComponent } from '../../interface';
import type { ITooltipSpec } from './spec';

export type TooltipHandlerParams = DimensionEventParams & {
  /** 本次触发的 tooltip 是否只改变了位置 */
  changePositionOnly?: boolean;
  /** tooltip 组件实例 */
  tooltip: ITooltip;
  /** tooltip 原始的spec */
  tooltipSpec?: ITooltipSpec;
  /** TODO: 本次触发的tooltip，主要包含pattern数据，待优化 */
  activeTooltipSpec?: ITooltipActual;
  // Pick<ITooltipSpec, 'activeType' | 'dimension' | 'mark' | 'group' | 'visible' | 'handler'>;
  /** 和 datum 同组的数据项 */
  groupDatum?: Datum[];
};

export interface ITooltipActiveTypeAsKeys<T, K, U> {
  /**
   * mark tooltip对应的配置，其中mark tooltip 用于展示图元对应的数据信息，比如柱图中的柱子，散点图中的点，面积图中的点灯
   */
  mark?: T;
  /**
   * dimension tooltip 对应的配置，其中dimension tooltip 用于展示维度对应的数据信息，比如x轴对应的数据信息
   */
  dimension?: K;
  /**
   * group tooltip 对应的配置，其中group tooltip 用于展示整个分组数据对应的数据信息，比如说线图中一条线代表一个相同的分组，可以使用 group tooltip展示整条线所有点对应的数据
   */
  group?: U;
}

export type TotalMouseEventData = {
  tooltipInfo: Partial<ITooltipActiveTypeAsKeys<MarkTooltipInfo, DimensionTooltipInfo, GroupTooltipInfo>>;
  ignore: Partial<ITooltipActiveTypeAsKeys<boolean, boolean, boolean>>;
};

export const enum TooltipResult {
  /** tooltip 显示成功 */
  success = 0,
  /** tooltip 未成功显示 */
  failed = 1
}

export interface ITooltip extends IComponent {
  tooltipHandler?: ITooltipHandler;
  getVisible: () => boolean;
  showTooltip: (datum: Datum, options: IShowTooltipOption) => void;
  enable?: boolean;
}
