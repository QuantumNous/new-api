import type { IMarkTheme, IMarkSpec, ISymbolMarkSpec, IRippleMarkSpec } from '../../typings';
import type { ILabelSpec, IMultiLabelSpec } from '../../component/label/interface';
import type { SeriesMarkNameEnum } from '../interface/type';
import type { IPolarSeriesSpec } from '../polar/interface';
import type { IAnimationSpec } from '../../animation/spec';

export type CorrelationMarks = 'point' | 'label';

export type CorrelationAppearPreset = 'scaleIn' | 'fadeIn';

export interface ICorrelationAnimationParams {
  [key: string]: object;
}

export interface ICorrelationSeriesSpec
  extends Omit<IPolarSeriesSpec, 'innerRadius' | 'outerRadius'>,
    IAnimationSpec<CorrelationMarks, CorrelationAppearPreset> {
  /**
   * @since 1.5.1
   * 系列类型
   */
  type: 'correlation';

  /**
   * 数据字段配置
   */
  /** 节点名称字段配置 */
  categoryField: string;
  /** 相关性数据字段配置 */
  valueField: string;
  /** 节点系列字段配置 */
  seriesField?: string;
  /** 节点尺寸数据字段配置 */
  sizeField?: string;
  /** 节点尺寸映射范围 */
  sizeRange?: number[];

  /**
   * layout & position
   */
  /** 图表中心点位置X坐标 */
  centerX?: number;
  /** 图表中心点位置Y坐标 */
  centerY?: number;
  /** 节点分布内半径 */
  innerRadius?: string | number;
  /** 节点分布外半径 */
  outerRadius?: string | number;
  /** 图表起始角度 */
  startAngle?: number;
  /** 图表终止角度 */
  endAngle?: number;

  /**
   * 图元配置
   */
  /** 中心点图元属性 **/
  [SeriesMarkNameEnum.centerPoint]?: IMarkSpec<ISymbolMarkSpec>;
  /** 水波纹图元属性 **/
  [SeriesMarkNameEnum.ripplePoint]?: IMarkSpec<IRippleMarkSpec>;
  /** 中心点label属性 **/
  [SeriesMarkNameEnum.centerLabel]?: ILabelSpec & {
    /** 标签位置 */
    position?:
      | 'top'
      | 'bottom'
      | 'left'
      | 'right'
      | 'top-right'
      | 'top-left'
      | 'bottom-right'
      | 'bottom-left'
      | 'center';
  };

  /** 节点图元属性 **/
  [SeriesMarkNameEnum.nodePoint]?: IMarkSpec<ISymbolMarkSpec>;
  /** 标签配置 */
  [SeriesMarkNameEnum.label]?: IMultiLabelSpec<
    ILabelSpec & {
      /** 标签位置 */
      position?:
        | 'top'
        | 'bottom'
        | 'left'
        | 'right'
        | 'top-right'
        | 'top-left'
        | 'bottom-right'
        | 'bottom-left'
        | 'center';
    }
  >;
}

export interface ICorrelationSeriesTheme {
  [SeriesMarkNameEnum.nodePoint]?: IMarkTheme<ISymbolMarkSpec>;
  [SeriesMarkNameEnum.ripplePoint]?: IMarkTheme<IRippleMarkSpec>;
  [SeriesMarkNameEnum.centerPoint]?: IMarkTheme<ISymbolMarkSpec>;
  [SeriesMarkNameEnum.centerLabel]?: ILabelSpec;
  [SeriesMarkNameEnum.label]?: ILabelSpec;
}
