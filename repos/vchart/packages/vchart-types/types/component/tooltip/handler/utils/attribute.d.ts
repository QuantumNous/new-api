import type { TooltipAttributes, TooltipPanelAttrs } from '@visactor/vrender-components';
import type { IToolTipActual } from '../../../../typings';
import type { ITooltipTextStyle } from '../interface';
import type { ITooltipSpec } from '../../interface/spec';
import type { ITooltipTextTheme, ITooltipTheme } from '../../interface/theme';
import type { ITheme } from '../../../../theme';
export declare function getTextAttributes(style?: ITooltipTextTheme, globalTheme?: ITheme, defaultAttributes?: Partial<ITooltipTextStyle>): ITooltipTextStyle;
export declare const getPanelAttributes: (style: ITooltipTheme['panel']) => TooltipPanelAttrs;
export declare const getTooltipAttributes: (actualTooltip: IToolTipActual, spec: ITooltipSpec, globalTheme: ITheme) => TooltipAttributes;
