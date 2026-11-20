import type { IAnimationTypeConfig } from '../../../animation/interface';
import { AnimationStateEnum } from '../../../animation/interface';
import type { Datum } from '../../../typings';
import type { IPieAnimationParams, PieAppearPreset } from '../interface';
import type { IMarkGraphic } from '../../../core';
export declare function pieGrowOption(pieParams: IPieAnimationParams, isOverall: boolean, state: AnimationStateEnum): (datum: Datum, graphic: IMarkGraphic, params: AnimationStateEnum) => {
    overall: number;
} | {
    overall: boolean;
};
export declare const Appear_Grow: (params: IPieAnimationParams) => IAnimationTypeConfig;
export declare const Appear_FadeIn: {
    type: string;
};
export declare const pieEnter: (params: IPieAnimationParams) => IAnimationTypeConfig;
export declare const pieExit: (params: IPieAnimationParams) => IAnimationTypeConfig;
export declare const pieDisappear: (params: IPieAnimationParams) => IAnimationTypeConfig;
export declare function piePresetAnimation(params: IPieAnimationParams, preset: PieAppearPreset | boolean): import("../../../animation/interface").CommonAnimationConfigItem | {
    type: string;
};
export declare const registerPieAnimation: () => void;
export declare const registerEmptyCircleAnimation: () => void;
