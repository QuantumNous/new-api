import type { IAreaMarkSpec, ILineMarkSpec, IRectMarkSpec, ISymbolMarkSpec, ITextMarkSpec } from '../../../typings/visual';
import type { IComponentSpec } from '../../base/interface';
import type { ComponentThemeWithDirection, IComponent } from '../../interface';
import type { IFilterMode, IDataFilterComponent, IDataFilterComponentSpec } from '../interface';
export type IDataZoom = IComponent & IDataFilterComponent;
export interface IDataZoomStyle {
    showDetail?: 'auto' | boolean;
    middleHandler?: {
        visible?: boolean;
        icon?: ISymbolMarkSpec;
        background?: {
            size?: number;
        } & IRectMarkSpec;
    };
    background?: {
        size?: number;
    } & IRectMarkSpec;
    startHandler?: ISymbolMarkSpec;
    endHandler?: ISymbolMarkSpec;
    startText?: {
        padding?: number;
    } & ITextMarkSpec;
    endText?: {
        padding?: number;
    } & ITextMarkSpec;
    dragMask?: IRectMarkSpec;
    selectedBackground?: IRectMarkSpec;
    backgroundChart?: {
        line?: ILineMarkSpec;
        area?: IAreaMarkSpec;
    };
    selectedBackgroundChart?: {
        line?: ILineMarkSpec;
        area?: IAreaMarkSpec;
    };
}
export interface IDataZoomSpec extends IDataZoomStyle, IDataFilterComponentSpec {
    showBackgroundChart?: boolean;
    filterMode?: IFilterMode;
    valueField?: string;
    startText?: {
        padding?: number;
        style?: ITextMarkSpec;
        formatMethod?: (text: string | number) => string | string[];
        formatter?: string | string[];
    };
    endText?: {
        padding?: number;
        style?: ITextMarkSpec;
        formatMethod?: (text: string | number) => string | string[];
        formatter?: string | string[];
    };
    brushSelect?: boolean;
    ignoreBandSize?: boolean;
    tolerance?: number;
}
export type IDataZoomCommonTheme = IComponentSpec & IDataZoomStyle & {
    orient?: IDataZoomSpec['orient'];
    width?: IDataZoomSpec['width'];
    height?: IDataZoomSpec['height'];
    brushSelect?: boolean;
};
export type IDataZoomTheme = ComponentThemeWithDirection<IDataZoomCommonTheme>;
