import type { ILayoutNumber, IRectMarkSpec, StringOrNumber } from '../../../../typings';
import type { IBandAxisSpec, ILinearAxisSpec, IGrid, ICommonAxisSpec } from '../../interface';
import type {
  ICartesianDomainLine,
  ICartesianLabel,
  ITimeLayerType,
  ICartesianTitle,
  ICartesianAxisUnit
} from './common';
import type { AxisItemStateStyle } from '@visactor/vrender-components';

/** spec */
export type ICartesianAxisSpec =
  | ICartesianLinearAxisSpec
  | ICartesianBandAxisSpec
  | ICartesianTimeAxisSpec
  | ICartesianLogAxisSpec
  | ICartesianSymlogAxisSpec;

export type ICartesianVertical = {
  /**
   * 坐标轴的位置
   */
  orient: 'left' | 'right';
  /**
   * 内padding/留白
   * @since 1.8.10
   */
  innerOffset?: {
    /**
     * 顶部留白
     */
    top?: ILayoutNumber;
    /**
     * 底部留白
     */
    bottom?: ILayoutNumber;
  };
};
export type ICartesianHorizontal = {
  /**
   * 坐标轴的位置
   */
  orient: 'top' | 'bottom';
  /**
   * 内padding/留白
   * @since 1.8.10
   */
  innerOffset?: {
    /**
     * 左侧留白
     */
    left?: ILayoutNumber;
    /**
     * 右侧留白
     */
    right?: ILayoutNumber;
  };
};
export type ICartesianZ = {
  /**
   * 坐标轴的位置
   */
  orient: 'z';
};

export type ICartesianAxisCommonSpec = ICommonAxisSpec & {
  /**
   * 当轴关联的系列没有收集到任何轴数据时，是否自动隐藏该轴。
   * 仅在 `visible !== false` 时生效。
   * @default false
   * @since 2.0.20
   */
  hideWhenEmpty?: boolean;
  /**
   * 网格线配置
   */
  grid?: IGrid;
  /**
   * 子网格线配置
   */
  subGrid?: IGrid;
  /**
   * 轴线配置
   */
  domainLine?: ICartesianDomainLine;
  /**
   * 轴标签配置
   */
  label?: ICartesianLabel;
  /**
   * 轴标题配置
   */
  title?: ICartesianTitle;
  /**
   * 是否进行自动缩进
   * 设置为 true 时，当轴元素超出绘图区会被裁剪时，会对图表增加额外的padding，使轴可以显示完整
   */
  autoIndent?: boolean;
  /**
   * 坐标轴背景配置
   */
  background?: {
    /**
     * 是否绘制坐标轴背景
     * @default false
     */
    visible: boolean;
    /**
     * 背景样式
     */
    style?: Partial<IRectMarkSpec>;
    /**
     * 背景在交互状态下的样式配置
     */
    state?: AxisItemStateStyle<Partial<IRectMarkSpec>>;
  };
  /**
   * 是否是3d模式的轴
   */
  mode?: '2d' | '3d';
  /**
   * 轴的z方向深度
   */
  depth?: number;
  /**
   * 轴单位配置，仅支持直角坐标系下的坐标轴
   * @since 1.5.1
   */
  unit?: ICartesianAxisUnit;
  /**
   * 是否在此轴上指定显示 dimension tooltip
   * （离散轴默认不需要配置）
   * @since 1.9.0
   */
  hasDimensionTooltip?: boolean;
} & (ICartesianVertical | ICartesianHorizontal | ICartesianZ);

export interface ILinearAxisSync {
  /**
   * 配置参照的轴 id
   */
  axisId: StringOrNumber;
  /**
   * 是否保持 2 个轴的 0 值对齐
   * @default false
   */
  zeroAlign?: boolean;
  /**
   * 是否使这个轴的 tick 与目标轴保持比例对齐
   * @default false
   */
  tickAlign?: boolean;
}

export type ICartesianLinearAxisSpec = ICartesianAxisCommonSpec &
  ILinearAxisSpec & {
    /**
     * 设置轴同步相关内容，包含0值对齐和刻度对齐功能
     */
    sync?: ILinearAxisSync;
  };

export type ICartesianBandAxisSpec = ICartesianAxisCommonSpec &
  IBandAxisSpec & {
    /**
     * 轴组宽设置
     * @since 1.4.0
     */
    bandSize?: number;
    /**
     * 轴最大组宽设置
     * @since 1.4.0
     */
    maxBandSize?: number;
    /**
     * 轴最小组宽设置
     * @since 1.4.0
     */
    minBandSize?: number;

    /**
     * 指定在哪个 scale 层级上设置 bandSize，默认为 0
     * @since 1.10.0
     */
    bandSizeLevel?: number;

    /**
     * 在当前 scale 层级设置 bandSize 后，当前层级 range 的扩增值
     * @since 1.10.0
     */
    bandSizeExtend?: {
      /** 两个 band 之间的 gap，单位为 px 或者百分比 */
      gap?: number | string;
      /** 当前层级 range 的总体扩增值，单位为 px */
      extend?: number;
    };

    /**
     * 是否根据组宽自动计算 region 宽度或高度，仅当 `bandSize` 或 `maxBandSize` 配置时生效
     * @since 1.4.0
     */
    autoRegionSize?: boolean;
  };

export type ICartesianTimeAxisSpec = Omit<ICartesianAxisCommonSpec, 'inverse'> & {
  /**
   * 轴的层级配置。
   * layer[0] 为主轴，即离坐标轴线最近的轴
   * @description 目前仅支持单层 / 双层，即layers.length <= 2
   */
  layers?: ITimeLayerType[];
};

export type ICartesianLogAxisSpec = ICartesianLinearAxisSpec & {
  /**
   * 底数
   * @default 10
   */
  base?: number;
};

export type ICartesianSymlogAxisSpec = ICartesianLinearAxisSpec & {
  /**
   * 底数
   * @default 10
   */
  constant?: number;
};
