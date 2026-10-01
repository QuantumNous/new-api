import type {
  IAreaGraphicAttribute,
  IGroupGraphicAttribute,
  ILineGraphicAttribute,
  ITextGraphicAttribute
} from '@visactor/vchart';

/**
 * 回归线数据格式
 */
export interface RegressionLineData {
  /**
   * 颜色值
   */
  color?: string;
  /**
   * 回归线数据点
   */
  line: { x: number; y: number }[];
  /**
   * 置信区间数据点
   */
  area?: { x: number; y: number; y1: number }[];
}

export interface RegressionLineAttrs extends IGroupGraphicAttribute {
  /**
   * 用于区分的名称
   */
  name?: string;
  /**
   * 回归线配置
   */
  line?: {
    /**
     * 是否显示系列标签
     * @default true
     */
    visible?: boolean;
    /**
     * 线样式
     */
    style?: ILineGraphicAttribute;
  };
  /**
   * 回归线公式标签
   */
  label?: {
    /**
     * 是否显示标签
     */
    visible?: boolean;
    /**
     * 标签文本
     */
    text: string;
    /**
     * 标签样式
     */
    style?: ITextGraphicAttribute;
  };
  /**
   * 置信区间
   */
  confidenceInterval?: {
    visible?: boolean;
    style?: IAreaGraphicAttribute;
  };

  data: RegressionLineData[];
}
