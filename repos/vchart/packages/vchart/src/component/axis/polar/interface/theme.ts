import type { IDomainLine, ITick, ITitle, ILabel } from '../../interface';
import type { IPolarGrid } from './common';

export interface IPolarAxisCommonTheme {
  /** 网格线配置 */
  grid?: IPolarGrid;
  /** 子网格线配置 */
  subGrid?: IPolarGrid;
  /** 轴线配置 */
  domainLine?: IDomainLine;
  /** 轴标签配置 */
  label?: ILabel;
  /** 轴标题配置 */
  title?: ITitle;
  /** 轴刻度线配置 */
  tick?: ITick;
  /** 轴子刻度线配置 */
  subTick?: ITick;
}
