import type { ISeriesTheme } from '../series/interface';
import type { IMarkTheme } from '../typings/spec';
import type {
  IArcMarkSpec,
  IAreaMarkSpec,
  ILineMarkSpec,
  IRectMarkSpec,
  ISymbolMarkSpec,
  ITextMarkSpec,
  IPathMarkSpec,
  ILayoutPaddingSpec
} from '../typings';
import type { MarkTypeEnum } from '../mark/interface';
import type { IColorKey, IThemeColorScheme } from './color-scheme/interface';
import type { IColor } from '@visactor/vrender-core';
import type { IComponentTheme } from '../component/interface';
import type { ITokenKey, TokenMap } from './token/interface';
import type { ChartType } from '../chart/interface';

export interface ITheme {
  /**
   * 第 1 种配置：主题信息
   */
  /** 主题命名 */
  name?: string;
  /** 主题描述 */
  description?: string;
  /**
   * 主题类别：亮色或者暗色
   * 该配置用于指定该主题需要 merge 的是内置的亮色主题还是暗色主题
   */
  type?: 'light' | 'dark';

  /**
   * 第 2 种配置：图表层级的样式属性
   */
  /** 图表背景色 */
  background?: IColor | IColorKey;
  /** 图表内边距 */
  padding?: ILayoutPaddingSpec;
  /** 图表字体配置 */
  fontFamily?: string | ITokenKey;
  /**
   * 用户自定义的语义化 token，可以在主题中以 ITokenKey 的形式引用并作为常量赋值
   * @since 1.10.0
   */
  token?: TokenMap;

  /**
   * 第 3 种配置：色板
   */
  /** 全局色板 */
  colorScheme?: IThemeColorScheme;

  /**
   * 第 4 种配置：全局 mark 属性配置
   */
  /** 全局 mark 样式属性，按 mark 类别索引 */
  mark?: IGlobalMarkThemeByType;
  /** 全局 mark 样式属性，按 mark 名称索引，优先级更高 */
  markByName?: IGlobalMarkThemeByName;

  /**
   * 第 5 种配置：系列属性配置
   */
  /** 系列样式属性 */
  series?: ISeriesTheme;
  /**
   * 自动关闭动画的阀值，对应的是单系列data的长度
   */
  animationThreshold?: number;

  /**
   * 第 6 种配置：组件属性配置
   */
  /** 组件样式属性 */
  component?: IComponentTheme;
  /**
   * 第 7 种配置：根据图表类型配置不同主题样式
   */
  chart?: Record<ChartType, Omit<ITheme, 'name' | 'type' | 'description'>>;
}

export interface IGlobalMarkThemeByType {
  [MarkTypeEnum.line]?: Partial<IMarkTheme<ILineMarkSpec>>;
  [MarkTypeEnum.symbol]?: Partial<IMarkTheme<ISymbolMarkSpec>>;
  [MarkTypeEnum.area]?: Partial<IMarkTheme<IAreaMarkSpec>>;
  [MarkTypeEnum.rect]?: Partial<IMarkTheme<IRectMarkSpec>>;
  [MarkTypeEnum.arc]?: Partial<IMarkTheme<IArcMarkSpec>>;
  [MarkTypeEnum.text]?: Partial<IMarkTheme<ITextMarkSpec>>;
  [MarkTypeEnum.path]?: Partial<IMarkTheme<IPathMarkSpec>>;
}

export interface IGlobalMarkThemeByName {
  /** used in lineSeries, areaSeries, radarSeries, etc. */
  line?: Partial<IMarkTheme<ILineMarkSpec>>;
  /** used in lineSeries, areaSeries, radarSeries, scatterSeries etc. */
  point?: Partial<IMarkTheme<ISymbolMarkSpec>>;
  /** used in lineSeries, areaSeries, radarSeries, etc. */
  area?: Partial<IMarkTheme<IAreaMarkSpec>>;
  /** used in barSeries, rangeColumnSeries etc. */
  bar?: Partial<IMarkTheme<IRectMarkSpec>>;
  /** used in many series */
  label?: Partial<IMarkTheme<ITextMarkSpec>>;

  [markName: string]: Partial<IMarkTheme<any>>;
}
