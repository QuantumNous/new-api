import type { IRectMarkSpec, ISymbolMarkSpec, ITextMarkSpec, StringOrNumber } from '../../../typings';
import type { ComponentThemeWithDirection } from '../../interface';
import type { ILegendCommonSpec, NoVisibleMarkStyle } from '../interface';
import type { HandlerTextStyleContext } from '@visactor/vrender-components';
type Text = StringOrNumber;
type ContinuousLegendTextStyle = Omit<NoVisibleMarkStyle<ITextMarkSpec>, 'text'>;
type ContinuousLegendTextStyleCallback = (value: Text, position: 'start' | 'end', context: HandlerTextStyleContext) => ContinuousLegendTextStyle | undefined;
export type TextAttribute = {
    visible?: boolean;
    text?: Text;
    space?: number;
    style?: ContinuousLegendTextStyle;
};
export type HandlerTextAttribute = {
    visible?: boolean;
    precision?: number;
    formatter?: (text: Text) => Text;
    space?: number;
    style?: ContinuousLegendTextStyle | ContinuousLegendTextStyleCallback;
};
export type IContinuousLegendSpec = ILegendCommonSpec & {
    inverse?: boolean;
    field?: string;
    scale?: string;
    defaultSelected?: [number, number];
    slidable?: boolean;
    rail?: {
        width?: number;
        height?: number;
        style?: Omit<NoVisibleMarkStyle<IRectMarkSpec>, 'width' | 'height'>;
    };
    handler?: {
        visible?: boolean;
        style?: NoVisibleMarkStyle<ISymbolMarkSpec>;
    };
    track?: {
        style?: Omit<NoVisibleMarkStyle<IRectMarkSpec>, 'width' | 'height'>;
    };
    startText?: TextAttribute;
    endText?: TextAttribute;
    handlerText?: HandlerTextAttribute;
};
export type IColorLegendSpec = IContinuousLegendSpec & {
    type: 'color';
};
export type ISizeLegendSpec = IContinuousLegendSpec & {
    type: 'size';
    sizeBackground?: Omit<NoVisibleMarkStyle<IRectMarkSpec>, 'visible' | 'width' | 'height'>;
    align?: 'top' | 'bottom' | 'left' | 'right';
};
export type IContinuousLegendTheme = Omit<IContinuousLegendSpec, 'type' | 'field' | 'scale' | 'regionIndex' | 'regionId' | 'seriesIndex' | 'seriesId' | 'id' | 'defaultSelected'>;
export type ISizeLegendCommonTheme = IContinuousLegendTheme & {
    sizeBackground?: ISizeLegendSpec['sizeBackground'];
};
export type IColorLegendTheme = ComponentThemeWithDirection<IContinuousLegendTheme>;
export type ISizeLegendTheme = ComponentThemeWithDirection<ISizeLegendCommonTheme>;
export {};
