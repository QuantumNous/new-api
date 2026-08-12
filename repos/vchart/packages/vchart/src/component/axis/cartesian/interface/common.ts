import type { SegmentAttributes, AxisLabelOverlap } from '@visactor/vrender-components';
import type { IBaseScale } from '@visactor/vscale';
import type {
  IAxis,
  IAxisLocationCfg,
  ICommonAxisSpec,
  IDomainLine,
  ILabel,
  ITickCalculationCfg,
  ITitle
} from '../../interface';
import type { ITextMarkSpec, StringOrNumber } from '../../../../typings';

export type ICartesianDomainLineSpec = {
  startSymbol?: SegmentAttributes['startSymbol'];
  endSymbol?: SegmentAttributes['endSymbol'];
  /**
   * X 轴或者 Y 轴的轴线是否在另一个轴的 0 刻度上，只有在另一个轴为数值轴且包含 0 刻度时有效。
   * 默认为 false，交由用户按需打开
   */
  onZero?: boolean;
  /**
   * 当有多轴时，可以用这个属性手动指定，在哪个轴的 0 刻度上。
   * Tips: 该索引对应所有轴的 index
   */
  onZeroAxisIndex?: number;
  /**
   * 当有多轴时，可以用这个属性手动指定，在哪个轴的 0 刻度上。
   */
  onZeroAxisId?: StringOrNumber;
};
export type ICartesianDomainLine = IDomainLine & ICartesianDomainLineSpec;

export type ICartesianTitle = ITitle & {
  /**
   * 标题是否根据轴方向自动渲染，生效于左右纵轴。
   * 默认为 true，表现为左轴标题整体旋转 -90 度，右轴标题整体旋转为 90 度。
   * **如果需要单独在 `textStyle` 中配置文本的 angle 的话，建议将该属性设置为 false。**
   * @default true
   */
  autoRotate?: boolean;
  /**
   * 标题朝向，默认朝外(坐标线包围盒外部)
   * @default false
   */
  inside?: boolean;
};

export type ICartesianLabel = ILabel & {
  /**
   * If labels at the beginning or end of the axis should be aligned flush with the scale range.
   * 坐标轴首尾文字向内收缩
   * @default false
   */
  flush?: boolean;
  /**
   * 最后一个坐标轴文字是否显示。默认根据标签重叠策略自动判定。
   * @default null
   */
  lastVisible?: boolean | null;
  /**
   * 第一个坐标轴文字是否显示。默认根据标签重叠策略自动判定。
   * @default null
   * @since 1.12.8
   */
  firstVisible?: boolean | null;
  /**
   * label 相对于容器整体的对齐方式
   * - `top`：整体向上对齐（垂直方向）
   * - `middle`：整体居中对齐（垂直方向）
   * - `bottom`：整体向下对齐（垂直方向）
   * - `left`：整体向左对齐（水平方向）
   * - `center`：整体居中对齐（水平方向）
   * - `right`：整体向右对齐（水平方向）
   * @since 1.3.0
   */
  containerAlign?: 'left' | 'right' | 'center' | 'top' | 'bottom' | 'middle';
} & AxisLabelOverlap;

export interface ILinearAxis extends IAxis {
  readonly zero: boolean;
  readonly nice: boolean;

  // 用户其他模块扩充轴scale的区间
  setExtendDomain: (key: string, value: number | undefined) => void;

  niceLabelFormatter?: (value: StringOrNumber) => StringOrNumber;
}

export interface IAxisHelper {
  isContinuous: boolean;

  dataToPosition: (values: any[], cfg?: IAxisLocationCfg) => number;
  valueToPosition?: (value: any, cfg?: IAxisLocationCfg) => number;
  getScale?: (depth: number) => IBaseScale;
  getBandwidth?: (depth: number) => number; // band轴特有

  // 用户其他模块扩充轴scale的区间
  setExtendDomain?: (key: string, value: number | undefined) => void;

  getAxisType: () => string;

  getAxisId: () => number;

  getSpec?: () => ICommonAxisSpec;

  isInverse: () => boolean;

  // 在地理坐标系系列中，传递经纬度配置字段
  getFields?: () => string[];
}

export interface ITimeLayerType extends Omit<ITickCalculationCfg, 'noDecimals' | 'tickMode'> {
  /**
   * 时间转换格式
   * @default '%Y%m%d'
   */
  timeFormat?: string;
  /**
   * 时间转换模式
   * @default 'local'
   */
  timeFormatMode?: 'utc' | 'local'; // todo: 'iso'
}

export type ICartesianAxisUnit = {
  /**
   * 是否显示坐标轴单位
   */
  visible: boolean;

  /**
   * 轴单位名称
   */
  text?: string | number | number[] | string[];
  /**
   * 单位样式
   */
  style?: ITextMarkSpec;
};
