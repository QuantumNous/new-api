import type { IArcMarkSpec, IMarkSpec, IMarkTheme } from '../../../typings';
import type { IPolarSeriesSpec, IPolarSeriesTheme } from '../interface';
export type ProgressLikeAppearPreset = 'grow' | 'fadeIn';
export interface IProgressLikeAnimationParams {
    startAngle?: number;
}
export interface IContinuousTickData {
    index?: number;
    value: number;
}
export interface ITickMaskSpec {
    angle?: number;
    offsetAngle?: number;
    forceAlign?: boolean;
}
export interface IProgressLikeSeriesSpec extends IPolarSeriesSpec {
    roundCap?: boolean | [boolean, boolean];
    cornerRadius?: number;
    tickMask?: Omit<IMarkSpec<IArcMarkSpec>, 'state'> & ITickMaskSpec;
    clamp?: boolean;
}
export interface IProgressLikeSeriesTheme extends IPolarSeriesTheme {
    roundCap?: boolean | [boolean, boolean];
    cornerRadius?: number;
    tickMask?: Omit<IMarkTheme<IArcMarkSpec>, 'state'> & ITickMaskSpec;
}
