import type { IWordcloudAnimationParams, WordcloudAppearPreset } from './interface';
import type { IAnimationTypeConfig } from '../../animation/interface';
export declare const WordCloudScaleInAnimation: (params: IWordcloudAnimationParams) => IAnimationTypeConfig;
export declare function wordcloudPresetAnimation(params: IWordcloudAnimationParams, preset: WordcloudAppearPreset | boolean): IAnimationTypeConfig;
export declare const registerWordCloudAnimation: () => void;
