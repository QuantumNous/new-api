import type {
  IFormatMethod,
  IMarkSpec,
  IPathMarkSpec,
  IFunnelChartSpec,
  ISymbolMarkSpec,
  ITextMarkSpec,
  IFunnelSeriesSpec,
  IRectMarkSpec
} from '@visactor/vchart';

export interface Arrow {
  /**
   * from 节点索引
   */
  from: number;
  /**
   * to 节点索引
   */
  to: number;
  /**
   * 箭头位置
   */
  position?: 'left' | 'right';
  /**
   * 箭头与柱子之间的距离
   */
  distance?: number;
  /**
   * 箭头文字
   */
  text?: string;
}

export interface IConversionFunnelSpec {
  /**
   * 转化率箭头配置
   */
  conversionArrow?: {
    /**
     * 箭头配置
     */
    arrows?: Arrow[];
    /**
     * 箭头与柱子之间的距离
     * @default 12
     */
    margin?: number;
    /**
     * 箭头线配置
     */
    line?: IMarkSpec<Omit<IPathMarkSpec, 'points' | 'fill'>>;
    /**
     * 箭头符号配置
     */
    symbol?: IMarkSpec<ISymbolMarkSpec>;
    /**
     * 标签配置
     */
    text?: IMarkSpec<ITextMarkSpec> & {
      /**
       * 箭头文字格式化方法
       */
      formatMethod?: IFormatMethod<[text: string, params?: { from: any; to: any; arrow: Arrow }]>;
      /**
       * 箭头文本与柱子之间的距离
       * @default 4
       */
      textMargin?: number;
    };
  };
  /**
   * 漏斗层背景配置
   */
  funnelBackground?: IMarkSpec<IRectMarkSpec>;
}

export interface IConversionFunnelSeriesSpecBase extends IFunnelSeriesSpec, IConversionFunnelSpec {}

export interface IConversionFunnelChartSpecBase extends IFunnelChartSpec, IConversionFunnelSpec {}

export interface IConversionFunnelSeriesSpec extends Omit<IConversionFunnelSeriesSpecBase, 'type' | 'series'> {
  type: 'conversionFunnel';
}

export interface IConversionFunnelChartSpec extends Omit<IConversionFunnelChartSpecBase, 'type' | 'series'> {
  type: 'conversionFunnel';
}
