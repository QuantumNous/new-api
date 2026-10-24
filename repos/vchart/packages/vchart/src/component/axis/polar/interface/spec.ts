import type { IPointLike } from '@visactor/vutils';
import type { AxisLabelOverlap } from '@visactor/vrender-components';
import type { ILayoutRect, IPolarOrientType } from '../../../../typings';
import type { IBandAxisSpec, IDomainLine, ILinearAxisSpec, ITitle, ILabel, ICommonAxisSpec } from '../../interface';
import type { IPolarGrid } from './common';

/** spec */
export type IPolarAxisSpec = IPolarLinearAxisSpec | IPolarBandAxisSpec;

/**
 * 自1.12.6版本，角度轴也支持自动省略、自动隐藏、自动换行等功能
 * @since 1.12.6
 */
export type IPolarAxisLabel = ILabel &
  Pick<
    AxisLabelOverlap,
    'autoHide' | 'autoHideMethod' | 'autoHideSeparation' | 'autoLimit' | 'limitEllipsis' | 'layoutFunc' | 'autoWrap'
  > & {
    /**
     * 是否自动限制标签最大宽度（开启基于布局的宽度控制）
     * @since 2.0.12
     */
    autoLabelMaxWidth?: boolean;
  };

export type IPolarAxisCommonSpec = Omit<ICommonAxisSpec, 'center'> & {
  /**
   * 布局半径，相当于计算内径、外径的基准值
   * 默认值为: region宽度、高度最小值的一般
   * @since 1.11.2
   */
  layoutRadius?: 'auto' | number | ((layoutRect: ILayoutRect, center: IPointLike) => number);
  /**
   * 当配置了 innerRadius 时，可以通过设置 inside: true，将坐标轴展示在内圆。
   * @default false
   */
  inside?: boolean;
  /**
   * 轴位置，枚举类型，支持：`'radius'` 和 `'angle'`
   * - `'radius'` 代表半径轴
   * - `'angle'` 代表角度轴
   */
  orient: IPolarOrientType;
  /**
   * 网格线配置
   */
  grid?: IPolarGrid;
  /**
   * 轴的外半径，数值范围 0 -1
   */
  radius?: number;
  /**
   * 子网格线配置
   */
  subGrid?: IPolarGrid;
  /**
   * 轴线配置
   */
  domainLine?: IDomainLine;
  /**
   * 轴标签配置
   */
  label?: IPolarAxisLabel;
  /**
   * 轴标题配置
   */
  title?: ITitle;
  /**
   * 内半径（比例值，取值范围 0~1）
   */
  innerRadius?: number;
  /**
   * 外半径（比例值，取值范围 0~1）
   */
  outerRadius?: number;
  /**
   * 中心点
   * @since 1.11.2 x,y 支持百分比的值，如`50%`
   */
  center?: { x: number | string; y: number | string };
  /**
   * 起始角度
   */
  startAngle?: number;
  /**
   * 终止角度
   */
  endAngle?: number;
};

export type IPolarLinearAxisSpec = IPolarAxisCommonSpec & ILinearAxisSpec;

export type IPolarBandAxisSpec = IPolarAxisCommonSpec & IBandAxisSpec;
