import type { IRoseAnimationParams, RoseAppearPreset } from './interface';
import type { IAnimationTypeConfig } from '../../animation/interface';
export declare const Appear_Grow: (params: IRoseAnimationParams) => IAnimationTypeConfig;
export declare const Appear_FadeIn: IAnimationTypeConfig;
export declare const roseEnter: (params: IRoseAnimationParams) => IAnimationTypeConfig;
export declare const roseExit: (params: IRoseAnimationParams) => IAnimationTypeConfig;
export declare const roseDisappear: (params: IRoseAnimationParams) => IAnimationTypeConfig;
export declare function rosePresetAnimation(params: IRoseAnimationParams, preset: RoseAppearPreset | boolean): IAnimationTypeConfig;
export declare const registerRoseAnimation: () => void;
