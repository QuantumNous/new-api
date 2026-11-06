import type { IScatterAnimationParams, ScatterAppearPreset } from './interface';
import type { IAnimationTypeConfig } from '../../animation/interface';
export declare const scatterPresetAnimation: (_params: IScatterAnimationParams, preset: ScatterAppearPreset) => IAnimationTypeConfig;
export declare const registerScatterAnimation: () => void;
