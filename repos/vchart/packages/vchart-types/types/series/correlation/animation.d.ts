import type { CorrelationAppearPreset, ICorrelationAnimationParams } from './interface';
import type { IAnimationTypeConfig } from '../../animation/interface';
export declare const correlationPresetAnimation: (_params: ICorrelationAnimationParams, preset: CorrelationAppearPreset) => IAnimationTypeConfig;
export declare const registerCorrelationAnimation: () => void;
