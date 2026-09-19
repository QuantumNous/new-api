import type { BaseEventParams } from '../../interface';
import type { ISeries } from '../../../series/interface';
import type { Datum } from '../../../typings';
import type { IAxis } from '../../../component/axis/interface';

export enum DimensionEventEnum {
  dimensionHover = 'dimensionHover',
  dimensionClick = 'dimensionClick'
}

export interface IDimensionInfo {
  /** 维度项索引，在连续轴上不存在 */
  index?: number;
  /** 维度项原始值，在离散轴上为维度标签，在连续轴上为数字 */
  value: string | number;
  /** 维度项所在坐标（scale 执行后的值） */
  position?: number;
  /** 维度项所在轴 */
  axis?: IAxis;
  /** 维度项对应数据 */
  data: IDimensionData[];
  /** 维度对应的类型 */
  dimType?: string;
}

export interface IDimensionData {
  /** 图元上的原始数据（考虑到有多个图元的情况，实际为数组类型） */
  datum: Datum[];
  /** 图元所在的系列实例 */
  series: ISeries;
  /** 该数据项的 hash 值 */
  key?: string;
}

export type DimensionEventParams = BaseEventParams & {
  action: 'enter' | 'leave' | 'move' | 'click';
  dimensionInfo: IDimensionInfo[];
};
