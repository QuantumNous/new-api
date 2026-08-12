import type {
  Datum,
  IMarkSpec,
  IMarkTheme,
  ISeriesSpec,
  IOrientType,
  IPathMarkSpec,
  IPolygonMarkSpec,
  IRuleMarkSpec,
  ITextMarkSpec,
  IPercent,
  IComposedTextMarkSpec,
  IFormatMethod
} from '../../typings';
import type { IAnimationSpec } from '../../animation/spec';
import type { SeriesMarkNameEnum } from '../interface/type';
import type { ILabelSpec } from '../../component/label/interface';

type FunnelMarks = 'funnel';

export type FunnelAppearPreset = 'clipIn' | 'fadeIn';
export interface IFunnelSeriesSpec extends ISeriesSpec, IAnimationSpec<FunnelMarks, FunnelAppearPreset> {
  type: 'funnel';
  /**
   * 分类字段
   */
  categoryField: string;
  /**
   * 数值字段
   */
  valueField: string;
  /**
   * 漏斗图朝向。
   * @default 'top'
   */
  funnelOrient?: IOrientType;
  /**
   * 图元形状。转化漏斗图仅支持 'rect'
   * @default 'trapezoid'
   */
  shape?: 'rect' | 'trapezoid';
  /**
   * 是否是转化漏斗图
   * @default false
   */
  isTransform?: boolean;
  /**
   * 漏斗图最下层是否尖角。shape为`rect`时不生效
   * @default true
   */
  isCone?: boolean;
  /**
   * 漏斗图对齐方式。转化漏斗图仅支持'center'
   * @default 'center'
   */
  funnelAlign?: 'left' | 'center' | 'right';
  /**
   * 漏斗层之间的像素间隔。转化漏斗图不支持gap配置。
   * @default 0
   */
  gap?: number;
  /**
   * 指定数据项的最大值和最小值
   */
  range?: {
    min?: number;
    max?: number;
  };
  /**
   * 漏斗图最大宽度，支持配置像素值和百分比字符串。
   * @default '80%'
   */
  maxSize?: number | IPercent;
  /**
   * 漏斗图最小宽度，支持配置像素值和百分比字符串。
   * @default 0
   */
  minSize?: number | IPercent;
  /**
   * 漏斗层与转化层的图形高度比例
   * The height ratio between the funnel graphic and the transform graphic
   * @default 0.5
   * @since 1.10.1
   */
  heightRatio?: number;
  /**
   * 漏斗图转化率文案，用于转化层 tooltip key 的显示内容
   *  @since 1.13.6
   * @default '转化率'
   * */
  transformRatioText?: string;
  /**
   * 漏斗层样式
   */
  [SeriesMarkNameEnum.funnel]?: IMarkSpec<IPathMarkSpec>;
  /**
   * 转化层样式
   */
  [SeriesMarkNameEnum.transform]?: IMarkSpec<IPathMarkSpec>;
  /**
   * 漏斗层标签配置
   */
  [SeriesMarkNameEnum.label]?: IFunnelLabelSpec;
  /**
   * 漏斗层外部标签配置
   */
  [SeriesMarkNameEnum.outerLabel]?: IFunnelOuterLabelSpec;
  /**
   * 转化层标签配置
   */
  [SeriesMarkNameEnum.transformLabel]?: IFunnelLabelSpec;
}

interface IFunnelLabelSpec extends Omit<ILabelSpec, 'position' | 'offset'> {
  /**
   * 标签文字样式
   */
  limit?: 'shapeSize' | number;
}

export interface IFunnelOuterLabelSpec extends IMarkSpec<IComposedTextMarkSpec> {
  formatMethod?: IFormatMethod<[text: string | string[], datum?: Datum]>;
  /**
   * 标签布局方式
   * @default 'left' | 'bottom'
   */
  position?: 'left' | 'right' | 'top' | 'bottom';
  /**
   * 文字与引导线间隔宽度
   * @default 5
   */
  spaceWidth?: number;
  /**
   * 文字是否对齐
   * @default true
   */
  alignLabel?: boolean;
  /**
   * 文字样式
   */
  style?: ITextMarkSpec;
  /**
   *  标签引导线样式
   */
  line?: {
    /**
     * 标签引导线最小长度
     * @default 20
     * @since 1.12.7
     */
    minLength?: number;
  } & IMarkSpec<IRuleMarkSpec>;
}

export interface IFunnelSeriesTheme {
  [SeriesMarkNameEnum.funnel]?: Partial<IMarkTheme<IPolygonMarkSpec>>;
  [SeriesMarkNameEnum.transform]?: Partial<IMarkTheme<IPolygonMarkSpec>>;
  [SeriesMarkNameEnum.label]?: Partial<IMarkTheme<ITextMarkSpec>>;
  [SeriesMarkNameEnum.outerLabel]?: Partial<IMarkTheme<ITextMarkSpec>> & {
    line?: Partial<IMarkTheme<IRuleMarkSpec>>;
  };
  [SeriesMarkNameEnum.transformLabel]?: Partial<IMarkTheme<ITextMarkSpec>>;
}
