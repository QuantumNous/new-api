import type {
  IMarkSpec,
  ISymbolMarkSpec,
  ITextMarkSpec,
  ILineMarkSpec,
  IPathMarkSpec,
  ICartesianSeriesSpec
} from '@visactor/vchart';

/** horizontal 布局时的标题位置 */
export type HorizontalLabelPosition = 'top' | 'bottom' | 'top-bottom' | 'bottom-top';

/** vertical 布局时的标题位置 */
export type VerticalLabelPosition = 'left' | 'right' | 'left-right' | 'right-left';

/** 标题位置配置 */
export type LabelPosition = HorizontalLabelPosition | VerticalLabelPosition;

export interface IEventSeriesSpec extends ICartesianSeriesSpec, IEventSeriesTheme {
  type: 'event';
  /**
   * 时间字段，用于指定事件在时间轴上的位置
   */
  timeField?: string;
  /**
   * 事件名称字段
   */
  eventField?: string;
  /**
   * 事件详情字段（副标题）
   */
  subTitleField?: string;
  /**
   * 系列字段，用于分组显示
   */
  seriesField?: string;
  /**
   * 图标字段，用于显示图标或图片
   */
  iconField?: string;
  /** 标题和副标题的位置 */
  labelPosition?: LabelPosition;
}

export interface IEventSeriesTheme {
  /**
   * 点图元配置
   */
  dot?: IMarkSpec<ISymbolMarkSpec>;
  /**
   * 图标图元配置
   * offset: 图标相对于点的偏移距离，单位像素，正值向外偏移，负值向内偏移
   */
  icon?: IMarkSpec<ISymbolMarkSpec> & { offset?: number };
  /**
   * 事件标题图元配置
   * subTitleGap: 标题与副标题的间距，单位像素
   * offset: 标题相对于点的偏移距离，单位像素，正值向外偏移，负值向内偏移
   */
  title?: IMarkSpec<ITextMarkSpec> & { subTitleGap?: number; offset?: number };
  /**
   * 事件副标题图元配置
   */
  subTitle?: IMarkSpec<ITextMarkSpec>;
  /**
   * 事件线图元配置
   */
  line?: IMarkSpec<ILineMarkSpec>;
  /**
   * 箭头图元配置
   * thickness: 箭头的厚度，单位像素
   */
  arrow?: IMarkSpec<IPathMarkSpec> & { thickness?: number };
}
