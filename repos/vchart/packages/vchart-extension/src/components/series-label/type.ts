import type {
  ITextGraphicAttribute,
  TextAlignType,
  TextBaselineType,
  ICartesianSeries,
  IGroupGraphicAttribute,
  ILineGraphicAttribute
} from '@visactor/vchart';

export type SeriesLabelData = {
  /**
   * 数据点位置
   */
  point: {
    x: number;
    y: number;
  };
  /**
   * 标签文本
   */
  label: string;
  /**
   * 标签颜色
   */
  color: string;
  textAlign: TextAlignType;
  textBaseline: TextBaselineType;
  series: ICartesianSeries;
  datum: any;
  id: string;
  position: string;
};

export interface SeriesLabelAttrs extends IGroupGraphicAttribute {
  /**
   * 系列标签连接线
   */
  line?: {
    /**
     * 是否显示系列标签
     * @default true
     */
    visible?: boolean;
    /**
     * 是否智能显示，仅当 visible 开启的时候生效
     * @default true
     */
    autoVisible?: boolean;
    /**
     * 线样式
     */
    style?: ILineGraphicAttribute;
  };
  /**
   * 系列标签配置
   */
  label?: {
    /**
     * 文本格式化配置
     * @param text
     * @returns
     */
    formatMethod?: (text: string, datum: any, context: any) => string;
    /**
     * 文本样式配置
     */
    style?: ITextGraphicAttribute;
    /**
     * 标签距离数据点的间距
     */
    space?: number;
    styleMap?: {
      [key: string]: {
        visible?: boolean;
        style?: ITextGraphicAttribute;
        formatMethod?: (text: string, datum: any, context: any) => string;
      };
    };
  };
  /**
   * 标签数据
   */
  data: SeriesLabelData[];
  /**
   * 标签的布局方向，主要用于判断采用那个方向的抖动算法
   */
  layout: 'horizontal' | 'vertical';
  position: 'start' | 'end' | 'both-ends';
}

export interface SeriesLabelSpec extends Partial<Pick<SeriesLabelAttrs, 'line' | 'label' | 'position'>> {
  visible?: boolean;
}
