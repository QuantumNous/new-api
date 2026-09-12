import type { IBarAnimationParams } from '../bar/interface';
import type { WaterfallAppearPreset } from './interface';
import type { IAnimationTypeConfig } from '../../animation/interface';
export declare function waterfallPresetAnimation(params: IBarAnimationParams, preset: WaterfallAppearPreset): IAnimationTypeConfig;
export declare const registerWaterfallAnimation: () => void;
