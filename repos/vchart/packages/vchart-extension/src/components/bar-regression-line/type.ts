import type { RegressionLineAttrs } from '../regression-line/type';

export interface BarRegressionLineAttrs extends RegressionLineAttrs {
  /**
   * 多项式回归的阶数，仅当 type 为 polynomial 时有效
   */
  degree?: number;
}

export interface BarRegressionLineSpec
  extends Partial<Pick<BarRegressionLineAttrs, 'line' | 'label' | 'confidenceInterval' | 'degree'>> {
  /**
   * 是否显示回归线
   */
  visible?: boolean;
  /**
   * 主色，可以不设置，默认取散点图系列颜色
   */
  color?: string;
}
