import type { Datum, IFormatMethod } from '../../typings';
import type { IPercent } from '../../typings/layout';
import type { ConvertToMarkStyleSpec, ITextMarkSpec } from '../../typings/visual';
import type { IComponentSpec } from '../base/interface';
import type { IComponent } from '../interface';
import type { ITextGraphicAttribute } from '@visactor/vrender-core';
export interface IIndicatorItemSpec {
    visible?: boolean;
    field?: string;
    space?: number;
    autoLimit?: boolean;
    autoFit?: boolean;
    fitPercent?: number;
    fitStrategy?: 'default' | 'inscribed';
    formatMethod?: (text: string | number, textStyle: ITextGraphicAttribute) => IFormatMethod<[activeDatum: Datum]> | ITextMarkSpec['text'] | ReturnType<IFormatMethod<[activeDatum: Datum]>>;
    style?: Omit<ConvertToMarkStyleSpec<ITextMarkSpec>, 'visible' | 'text'> & {
        type?: 'text' | 'rich';
        text?: IFormatMethod<[activeDatum: Datum]> | ITextMarkSpec['text'] | ReturnType<IFormatMethod<[activeDatum: Datum]>>;
    };
}
export type IIndicator = IComponent & {
    updateDatum: (datum: any) => void;
};
export interface IIndicatorSpec extends IComponentSpec {
    visible?: boolean;
    fixed?: boolean;
    trigger?: 'hover' | 'select' | 'none';
    gap?: number;
    offsetX?: number | IPercent;
    offsetY?: number | IPercent;
    limitRatio?: number;
    title?: IIndicatorItemSpec;
    content?: IIndicatorItemSpec[] | IIndicatorItemSpec;
}
export interface IIndicatorItemTheme extends Omit<IIndicatorItemSpec, 'style'> {
    style?: Omit<ITextMarkSpec, 'visible'>;
}
export interface IIndicatorTheme extends Omit<IIndicatorSpec, 'content' | 'title'> {
    title?: IIndicatorItemTheme;
    content?: IIndicatorItemTheme;
}
