import type { ITextAttribute } from '@visactor/vrender-core';
import type { ILayoutNumber, ITooltipShapePattern, StringOrNumber, TextAlign, TextBaseLine } from '../../../typings';
import type { Padding } from '@visactor/vrender-components';
import type { ITokenKey } from '../../../theme/token/interface';
import type { ITooltipSpec } from './spec';
export interface ITooltipTextTheme<ColorType = string> {
    fontFamily?: string;
    fontSize?: number | ITokenKey;
    fill?: ColorType;
    fontColor?: ColorType;
    fontWeight?: StringOrNumber;
    textAlign?: TextAlign;
    textBaseline?: TextBaseLine;
    lineHeight?: number | string | ITokenKey;
    spacing?: number;
    multiLine?: boolean;
    maxWidth?: number;
    wordBreak?: ITextAttribute['wordBreak'];
    autoWidth?: boolean;
}
export interface ITooltipTheme<ColorType = string> {
    panel?: {
        padding?: Padding;
        backgroundColor?: ColorType;
        border?: {
            color?: ColorType;
            width?: number;
            radius?: number;
        };
        shadow?: {
            x: number;
            y: number;
            blur: number;
            spread: number;
            color: ColorType;
        };
    };
    shape?: {
        size?: number;
        spacing?: number;
    } & Omit<ITooltipShapePattern, 'seriesId'>;
    titleLabel?: ITooltipTextTheme<ColorType>;
    keyLabel?: Omit<ITooltipTextTheme<ColorType>, 'autoWidth'>;
    valueLabel?: ITooltipTextTheme<ColorType>;
    spaceRow?: number;
    maxContentHeight?: ILayoutNumber;
    offset?: {
        x?: number;
        y?: number;
    };
    transitionDuration?: number;
    align?: 'left' | 'right';
    trigger?: ITooltipSpec['trigger'];
    triggerOff?: ITooltipSpec['triggerOff'];
}
