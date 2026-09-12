import type { IAnimationTypeConfig } from '../../animation/interface';
import type { IRangeColumnAnimationParams, RangeColumnAppearPreset } from './interface';
export declare const rangeColumnGrowIn: (params: IRangeColumnAnimationParams) => IAnimationTypeConfig;
export declare const rangeColumnGrowOut: (params: IRangeColumnAnimationParams) => IAnimationTypeConfig;
export declare function rangeColumnPresetAnimation(params: IRangeColumnAnimationParams, preset: RangeColumnAppearPreset): IAnimationTypeConfig;
export declare const registerRangeColumnAnimation: () => void;
