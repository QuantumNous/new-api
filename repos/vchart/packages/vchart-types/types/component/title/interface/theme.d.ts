import type { ILayoutItemSpec } from '../../../layout/interface';
import type { IColorKey } from '../../../theme/color-scheme/interface';
import type { ITokenKey } from '../../../theme/token/interface';
import type { StringOrNumber } from '../../../typings';
import type { TextAlign, TextBaseLine } from '../../../typings/visual';
export interface ITitleTextTheme {
    width?: number;
    height?: number;
    fontFamily?: string;
    fontSize?: number | ITokenKey;
    fill?: string | IColorKey;
    fontWeight?: StringOrNumber;
    textAlign?: TextAlign;
    textBaseline?: TextBaseLine;
    lineHeight?: number | ITokenKey;
}
export interface ITitleTheme extends ILayoutItemSpec {
    textStyle?: ITitleTextTheme;
    subtextStyle?: ITitleTextTheme;
}
