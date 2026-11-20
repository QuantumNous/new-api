import type { IAnimationTypeConfig } from '../../animation/interface';
export type ProgressLikeAppearPreset = 'grow' | 'fadeIn';
export interface IProgressLikeAnimationParams {
    startAngle?: number;
}
export declare function gaugePointerPresetAnimation(params: IProgressLikeAnimationParams, preset: ProgressLikeAppearPreset): IAnimationTypeConfig;
export declare const registerGaugePointerAnimation: () => void;
