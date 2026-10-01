import type { IDomainLine, IGrid, ILabel, ISubTick, ITick, ITitle } from './spec';

export interface IAxisCommonTheme {
  /** 网格线配置 */
  grid?: IGrid;
  /** 网格线配置 */
  subGrid?: IGrid;
  /** 轴线配置 */
  domainLine?: IDomainLine;
  /** 轴标签配置 */
  label?: ILabel;
  /** 轴标题配置 */
  title?: ITitle;
  /** 轴刻度线配置 */
  tick?: ITick;
  /** 轴刻度线配置 */
  subTick?: ISubTick;
}

export interface IBandAxisTheme extends IAxisCommonTheme {
  bandPadding?: number | number[];
  paddingInner?: number | number[];
  paddingOuter?: number | number[];
}
