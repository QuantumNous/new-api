import type { IAnimationTypeConfig } from '../../animation/interface';
import type { AreaAppearPreset, IAreaAnimationParams } from './interface';
export declare function areaPresetAnimation(params: IAreaAnimationParams, preset: AreaAppearPreset | boolean): IAnimationTypeConfig;
export declare const registerAreaSeriesAnimation: () => void;
