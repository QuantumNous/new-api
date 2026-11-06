import type { RegressionLineAttrs } from '../regression-line/type';

export interface HistogramRegressionLineAttrs extends Omit<RegressionLineAttrs, 'confidenceInterval'> {
  type: 'kde' | 'ecdf';
}

export interface HistogramRegressionLineSpec
  extends Partial<Pick<HistogramRegressionLineAttrs, 'type' | 'line' | 'label'>> {
  /**
   * 是否显示回归线
   */
  visible?: boolean;
  /**
   * 主色，可以不设置，默认取散点图系列颜色
   */
  color?: string;
}
