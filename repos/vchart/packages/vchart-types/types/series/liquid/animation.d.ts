import type { IAnimationTypeConfig } from '../../animation/interface';
import type { ILiquidAnimationParams, LiquidAppearPreset } from './interface';
export declare function liquidPresetAnimation(params: ILiquidAnimationParams, preset: LiquidAppearPreset): IAnimationTypeConfig;
export declare function liquidGroupPresetAnimation(params: ILiquidAnimationParams, preset: LiquidAppearPreset): IAnimationTypeConfig;
export declare const registerLiquidAnimation: () => void;
