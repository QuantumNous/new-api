import type { EasingType, IGraphic } from '@visactor/vrender-core';
import type { IAnimationConfig, IStateAnimationConfig } from './interface';
export interface ICommonStateAnimateSpec {
    duration?: number;
    delay?: number;
    easing?: EasingType;
    oneByOne?: boolean;
}
export interface IStateAnimateSpec<Preset extends string> extends ICommonStateAnimateSpec {
    preset?: Preset | false;
}
export type IMarkAnimateSpec<MarkName extends string> = Partial<Record<MarkName, false | IAnimationConfig | IAnimationConfig[]>>;
export interface IAnimationSpec<MarkName extends string, Preset extends string> {
    animationAppear?: boolean | IStateAnimateSpec<Preset> | IMarkAnimateSpec<MarkName>;
    animationEnter?: boolean | ICommonStateAnimateSpec | IMarkAnimateSpec<MarkName>;
    animationUpdate?: boolean | ICommonStateAnimateSpec | IMarkAnimateSpec<MarkName>;
    animationExit?: boolean | ICommonStateAnimateSpec | IMarkAnimateSpec<MarkName>;
    animationDisappear?: boolean | ICommonStateAnimateSpec | IMarkAnimateSpec<MarkName>;
    animationState?: boolean | IStateAnimationConfig;
    animationNormal?: IMarkAnimateSpec<MarkName>;
}
export interface IMorphSeriesSpec {
    enable?: boolean;
    morphKey?: string;
    morphElementKey?: string;
}
export type MorphData = {
    prev: any[];
    next: any[];
};
export type MorphElements = {
    prev: IGraphic[];
    next: IGraphic[];
};
export type MorphFunctionCallback<T> = (datum: MorphData, element: MorphElements, parameters: any) => T;
export type MorphFunctionType<T> = T | MorphFunctionCallback<T>;
export type MorphFunctionValueType<T> = MorphFunctionType<T> | T;
export interface IMorphAnimationConfig {
    easing?: EasingType;
    delay?: MorphFunctionValueType<number>;
    duration?: MorphFunctionValueType<number>;
    oneByOne?: MorphFunctionValueType<boolean | number>;
    splitPath?: MorphFunctionValueType<'clone' | null | undefined>;
}
export interface IMorphConfig {
    reuse?: boolean;
    morph?: boolean;
    morphAll?: boolean;
    animation?: IMorphAnimationConfig;
    enableExitAnimation?: boolean;
}
