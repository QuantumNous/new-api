import type { ITooltipTextTheme } from '../../component/tooltip/interface/theme';
import type { TooltipContentProperty } from './common';

export interface ITooltipLabelPattern {
  /** key 样式（只在 content 上需要配置） */
  keyStyle?: TooltipContentProperty<ITooltipTextTheme>;
  /** value 样式 */
  valueStyle?: TooltipContentProperty<ITooltipTextTheme>;
}

export interface ITooltipLabelActual {
  keyStyle?: ITooltipTextTheme;
  valueStyle?: ITooltipTextTheme;
}
