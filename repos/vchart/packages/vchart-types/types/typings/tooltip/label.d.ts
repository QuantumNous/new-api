import type { ITooltipTextTheme } from '../../component/tooltip/interface/theme';
import type { TooltipContentProperty } from './common';
export interface ITooltipLabelPattern {
    keyStyle?: TooltipContentProperty<ITooltipTextTheme>;
    valueStyle?: TooltipContentProperty<ITooltipTextTheme>;
}
export interface ITooltipLabelActual {
    keyStyle?: ITooltipTextTheme;
    valueStyle?: ITooltipTextTheme;
}
