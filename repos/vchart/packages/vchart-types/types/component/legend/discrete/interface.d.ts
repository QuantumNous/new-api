import type { IRectMarkSpec, ISymbolMarkSpec, ITextMarkSpec } from '../../../typings/visual';
import type { DiscreteLegendAttrs, LegendItemDatum, LegendItem, LegendPagerAttributes, LegendScrollbarAttributes } from '@visactor/vrender-components';
import type { ILegendCommonSpec, NoVisibleMarkStyle } from '../interface';
import type { IFormatMethod, StringOrNumber } from '../../../typings';
import type { ILayoutRect } from '../../../typings/layout';
import type { IOrientType } from '../../../typings/space';
import type { IBaseScale } from '@visactor/vscale';
import type { IGlobalScale } from '../../../scale/interface';
import type { ComponentThemeWithDirection } from '../../interface';
export type formatterCallback = IFormatMethod<[text: StringOrNumber, item: LegendItemDatum, index: number]>;
export type LegendItemStyleValue<T> = T | ((item: LegendItemDatum, isSelected: boolean, index: number, allItems: LegendItemDatum[]) => T);
export type LegendItemStyle<T> = {
    style?: T;
    state?: {
        selected?: T;
        unSelected?: T;
        selectedHover?: T;
        unSelectedHover?: T;
    };
};
export type IItem = {
    align?: 'left' | 'right';
    background?: {
        visible?: boolean;
    } & LegendItemStyle<LegendItemStyleValue<NoVisibleMarkStyle<IRectMarkSpec>>>;
    shape?: {
        visible?: boolean;
        space?: number;
    } & LegendItemStyle<LegendItemStyleValue<Partial<NoVisibleMarkStyle<ISymbolMarkSpec>>>>;
    label?: {
        widthRatio?: number;
        space?: number;
        formatMethod?: formatterCallback;
        formatter?: string;
    } & LegendItemStyle<LegendItemStyleValue<NoVisibleMarkStyle<ITextMarkSpec>>>;
    value?: {
        widthRatio?: number;
        space?: number;
        alignRight?: boolean;
        formatMethod?: formatterCallback;
        formatter?: string | string[];
    } & LegendItemStyle<LegendItemStyleValue<NoVisibleMarkStyle<ITextMarkSpec>>>;
    focusIconStyle?: NoVisibleMarkStyle<ISymbolMarkSpec>;
    maxWidth?: number | string;
    width?: number | string;
    height?: number | string;
    autoEllipsisStrategy?: 'labelFirst' | 'valueFirst' | 'none';
} & Omit<LegendItem, 'background' | 'shape' | 'label' | 'value' | 'focusIconStyle' | 'width' | 'height' | 'maxWidth'>;
export type IPager = {
    textStyle?: Partial<NoVisibleMarkStyle<ITextMarkSpec>>;
    handler?: {
        space?: number;
        preShape?: string;
        nextShape?: string;
        style?: Omit<NoVisibleMarkStyle<ISymbolMarkSpec>, 'symbolType'>;
        state?: {
            hover?: Omit<NoVisibleMarkStyle<ISymbolMarkSpec>, 'symbolType'>;
            disable?: Omit<NoVisibleMarkStyle<ISymbolMarkSpec>, 'symbolType'>;
        };
    };
} & Omit<LegendPagerAttributes, 'textStyle' | 'handler'>;
export type ILegendScrollbar = {
    type: 'scrollbar';
    railStyle?: Omit<Partial<NoVisibleMarkStyle<IRectMarkSpec>>, 'width' | 'height'>;
    sliderStyle?: Omit<Partial<NoVisibleMarkStyle<IRectMarkSpec>>, 'width' | 'height'>;
} & Omit<LegendScrollbarAttributes, 'railStyle' | 'sliderStyle'>;
export interface IDiscreteLegendArrangeContext {
    rect: ILayoutRect;
    orient: IOrientType;
    id?: StringOrNumber;
}
export type DiscreteLegendArrangeCount = number | ((ctx: IDiscreteLegendArrangeContext) => number);
export type IDiscreteLegendSpec = ILegendCommonSpec & {
    type?: 'discrete';
    data?: (data: LegendItemDatum[], colorScale: IBaseScale, globalScale: IGlobalScale) => LegendItemDatum[];
    item?: IItem;
    pager?: IPager | ILegendScrollbar;
    scale?: string;
    scaleName?: string;
    field?: string;
    defaultSelected?: string[];
    maxRow?: DiscreteLegendArrangeCount;
    maxCol?: DiscreteLegendArrangeCount;
} & Omit<DiscreteLegendAttrs, 'layout' | 'title' | 'items' | 'item' | 'pager' | 'maxRow' | 'maxCol'>;
export type IDiscreteLegendCommonTheme = Omit<IDiscreteLegendSpec, 'type' | 'data' | 'regionIndex' | 'regionId' | 'seriesIndex' | 'seriesId' | 'id' | 'defaultSelected'>;
export type IDiscreteLegendTheme = ComponentThemeWithDirection<IDiscreteLegendCommonTheme>;
