import { OrdinalScale } from '@visactor/vscale';
import type { ColorSchemeItem, ProgressiveDataScheme } from '../theme/color-scheme/interface';
export declare class ColorOrdinalScale extends OrdinalScale {
    protected _range: Array<ColorSchemeItem> | ProgressiveDataScheme<ColorSchemeItem>;
    setSpecified(value?: Record<string, unknown>): this;
    range(value?: Array<ColorSchemeItem> | ProgressiveDataScheme<ColorSchemeItem>): this | any;
    domain(value?: any[]): this | any;
    protected _resetRange(): void;
}
