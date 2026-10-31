import type { Functional } from '@visactor/vrender-components';
import type { ILabelSpec } from '../../component/label/interface';
import type { IMarkTheme } from '../../typings/spec/common';
import type { ILineMarkSpec, ISymbolMarkSpec } from '../../typings/visual';

export interface ILineLikeSeriesTheme {
  /**
   * 线图元的主题样式配置
   */
  line?: Partial<IMarkTheme<ILineMarkSpec>>;
  /**
   * 点图元的主题样式配置
   */
  point?: Partial<IMarkTheme<ISymbolMarkSpec>> & { visibleInActive?: boolean };
  /**
   * 标签的主题样式配置
   */
  label?: Partial<ILineLikeLabelSpec>;
}

export type ILineLikeLabelSpec = Omit<ILabelSpec, 'position'> & {
  /** 标签位置
   * @since 1.6.0
   * 支持以函数形式配置
   */
  position?: Functional<
    'top' | 'bottom' | 'left' | 'right' | 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'center'
  >;
};
