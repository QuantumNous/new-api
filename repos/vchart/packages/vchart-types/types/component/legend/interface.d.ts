import type { LegendTitle } from '@visactor/vrender-components';
import type { Datum, IOrientType, IPadding, IRectMarkSpec, ISymbolMarkSpec, ITextMarkSpec, StringOrNumber } from '../../typings';
import type { IComponent } from '../interface';
import type { IComponentSpec } from '../base/interface';
import type { IDiscreteLegendSpec } from './discrete/interface';
import type { IColorLegendSpec, ISizeLegendSpec } from './continuous/interface';
export type ILegend = IComponent & {
    getLegendData: () => Datum[];
    getSelectedData: () => StringOrNumber[];
    setSelectedData: (d: StringOrNumber[]) => void;
};
export interface IDiscreteLegend extends ILegend {
    getLegendDefaultData: (originalData?: boolean) => StringOrNumber[];
}
export type NoVisibleMarkStyle<T> = Omit<T, 'visible'>;
export type ITitle = {
    textStyle?: NoVisibleMarkStyle<ITextMarkSpec>;
    style?: NoVisibleMarkStyle<ITextMarkSpec>;
    shape?: {
        visible?: boolean;
        space?: number;
        style?: NoVisibleMarkStyle<ISymbolMarkSpec>;
    };
    background?: {
        visible?: boolean;
        style?: Omit<NoVisibleMarkStyle<IRectMarkSpec>, 'visible' | 'width' | 'height'>;
    };
} & Omit<LegendTitle, 'textStyle' | 'style' | 'background'>;
export type ILegendCommonSpec = {
    visible?: boolean;
    orient?: IOrientType;
    position?: 'start' | 'middle' | 'end';
    layout?: 'horizontal' | 'vertical';
    filter?: boolean;
    customFilter?: (data: any, selectedRange: StringOrNumber[], datumField: string) => any;
    title?: ITitle;
    background?: {
        visible?: boolean;
        padding?: IPadding | number | number[];
        style?: Omit<NoVisibleMarkStyle<IRectMarkSpec>, 'visible' | 'width' | 'height'>;
    };
    interactive?: boolean;
} & Omit<IComponentSpec, 'orient'>;
export type ILegendSpec = IDiscreteLegendSpec | IColorLegendSpec | ISizeLegendSpec;
