import type { BarAppearPreset, IBarAnimationParams } from './interface';
import type { IAnimationTypeConfig } from '../../animation/interface';
export declare const barGrowIn: (params: IBarAnimationParams, isOverall?: boolean) => IAnimationTypeConfig;
export declare const barGrowOut: (params: IBarAnimationParams, isOverall?: boolean) => IAnimationTypeConfig;
export declare function barPresetAnimation(params: IBarAnimationParams, preset: BarAppearPreset | boolean): IAnimationTypeConfig;
export declare const registerBarAnimation: () => void;
