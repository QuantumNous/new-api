import type { ILayoutItemSpec } from '../../../layout/interface';
import type { IPadding } from '../../../typings';
import type { IRectMarkSpec } from '../../../typings/visual';
import type { ComponentThemeWithDirection } from '../../interface';
import type { IFilterMode, IDataFilterComponentSpec } from '../interface';
export interface IScrollBarStyle {
    rail?: Omit<IRectMarkSpec, 'width' | 'height'>;
    slider?: Omit<IRectMarkSpec, 'width' | 'height'>;
}
export interface IScrollBarSpec extends IDataFilterComponentSpec, IScrollBarStyle {
    filterMode?: IFilterMode;
    round?: boolean;
    innerPadding?: number | number[] | IPadding;
    range?: [number, number];
    limitRange?: [number, number];
    scrollStep?: number;
    minSliderSize?: number;
}
export type IScrollBarCommonTheme = ILayoutItemSpec & IScrollBarStyle & {
    orient?: IScrollBarSpec['orient'];
    width?: IScrollBarSpec['width'];
    height?: IScrollBarSpec['height'];
    round?: IScrollBarSpec['round'];
    innerPadding?: IScrollBarSpec['innerPadding'];
};
export type IScrollBarTheme = ComponentThemeWithDirection<IScrollBarCommonTheme>;
