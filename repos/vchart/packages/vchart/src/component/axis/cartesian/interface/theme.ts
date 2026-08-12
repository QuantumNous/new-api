import type { ILayoutNumber, ILayoutPaddingSpec } from '../../../../typings/layout';
import type { ITick, IGrid } from '../../interface';
import type { ICartesianAxisUnit, ICartesianDomainLine, ICartesianLabel, ICartesianTitle } from './common';
import type { ICartesianAxisCommonSpec } from './spec';

export interface ICartesianAxisCommonTheme {
  /** 网格线配置 */
  grid?: IGrid;
  /** 网格线配置 */
  subGrid?: IGrid;
  /** 轴线配置 */
  domainLine?: ICartesianDomainLine;
  /** 轴标签配置 */
  label?: ICartesianLabel;
  /** 轴标题配置 */
  title?: ICartesianTitle;
  /** 轴刻度线配置 */
  tick?: ITick;
  /** 轴刻度线配置 */
  subTick?: ITick;
  /**
   * 轴背景配置
   */
  background?: ICartesianAxisCommonSpec['background'];
  /** 模块的布局间距 */
  padding?: ILayoutPaddingSpec;
  /** 模块的布局大小：宽度 */
  width?: ILayoutNumber;
  /** 模块的布局最大宽度 */
  maxWidth?: ILayoutNumber;
  /** 模块的布局最小宽度 */
  minWidth?: ILayoutNumber;
  /** 模块的布局大小：高度 */
  height?: ILayoutNumber;
  /** 模块的布局最大高度 */
  maxHeight?: ILayoutNumber;
  /** 模块的布局最小高度 */
  minHeight?: ILayoutNumber;
  /**
   * 轴单位配置
   */
  unit?: ICartesianAxisUnit;
}
