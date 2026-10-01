import type { TooltipPanelAttrs, TooltipRichTextAttrs } from '@visactor/vrender-components';
import type { ITooltipActual, MaybeArray } from '../../../../typings';
import type { ITooltipAttributes, ITooltipTextStyle } from '../interface';
import type { ITooltipSpec, ITooltipTextTheme, ITooltipTheme } from '../../../../component/tooltip';
interface ITooltipTextInfo {
    width: number;
    height: number;
    text: MaybeArray<number> | MaybeArray<string> | TooltipRichTextAttrs;
}
export declare const measureTooltipText: (text: string | TooltipRichTextAttrs, style: ITooltipTextStyle) => ITooltipTextInfo;
export declare function getTextAttributes(style?: ITooltipTextTheme, globalFontFamily?: string, defaultAttributes?: Partial<ITooltipTextStyle>): ITooltipTextStyle;
export declare const getPanelAttributes: (style: ITooltipTheme['panel']) => TooltipPanelAttrs;
export declare const getTooltipAttributes: (actualTooltip: ITooltipActual, spec: ITooltipSpec, globalFontFamily?: string) => ITooltipAttributes;
export {};
