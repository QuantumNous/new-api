import type { ACustomAnimate, AStageAnimate } from '@visactor/vrender-animate';
import type { IGraphic, EasingType, IStage } from '@visactor/vrender-core';
import type { IMark, IMarkGraphic } from '../mark/interface/common';
import type { BaseMark } from '../mark';
export declare enum AnimationStateEnum {
    appear = "appear",
    disappear = "disappear",
    enter = "enter",
    update = "update",
    state = "state",
    exit = "exit",
    normal = "normal",
    none = "none"
}
export type IAnimationState = keyof typeof AnimationStateEnum;
export interface IAnimateState {
    animationState: {
        callback: (datum: any, element: any) => AnimationStateEnum;
    };
}
export interface ICartesianGroupAnimationParams {
    direction: () => 'x' | 'y';
    orient: () => 'positive' | 'negative';
    width: () => number;
    height: () => number;
}
export interface IAnimationParameters {
    width: number;
    height: number;
    mark: IMark;
    group: IMark | null;
    elementIndex: number;
    elementCount: number;
    view: any;
}
export type IAnimationChannelInterpolator = (ratio: number, from: any, to: any, nextAttributes: any, datum: any, g: IGraphic, parameters: IAnimationParameters) => boolean | void;
export type GraphicFunctionCallback<T> = (datum: any, g: IGraphic, params: any) => T;
export type GraphicFunctionValueType<T> = GraphicFunctionCallback<T> | T;
export interface IStateAnimationConfig {
    duration?: number;
    easing?: EasingType;
}
export interface IAnimationControlOptions {
    stopWhenStateChange?: boolean;
    immediatelyApply?: boolean;
    ignoreLoopFinalAttributes?: boolean;
}
export interface CommonAnimationConfigItem {
    custom?: IAnimationChannelInterpolator | IAnimationCustomConstructor;
    customParameters?: GraphicFunctionValueType<any>;
    easing?: EasingType;
    duration?: GraphicFunctionValueType<number>;
    delay?: GraphicFunctionValueType<number>;
    delayAfter?: GraphicFunctionValueType<number>;
    oneByOne?: GraphicFunctionValueType<boolean | number>;
    startTime?: GraphicFunctionValueType<number>;
    totalTime?: GraphicFunctionValueType<number>;
    loop?: boolean | number;
    options?: GraphicFunctionValueType<any>;
    controlOptions?: IAnimationControlOptions;
    selfOnly?: boolean;
}
export interface TypeAnimationConfig extends CommonAnimationConfigItem {
    type: string;
}
export type IAnimationChannelFunction = (datum: any, g: IGraphic, mark: IMark) => any;
export type IAnimationChannelAttrs = Record<string, {
    from?: any | IAnimationChannelFunction;
    to?: any | IAnimationChannelFunction;
}>;
export interface ChannelAnimationConfig extends CommonAnimationConfigItem {
    channel: IAnimationChannelAttrs | string[];
}
export type IAnimationTypeConfig = TypeAnimationConfig | ChannelAnimationConfig | CommonAnimationConfigItem;
export interface IAnimationCustomConstructor {
    new (from: any, to: any, duration: number, ease: EasingType, parameters?: any): ACustomAnimate<any>;
}
export type IAnimationEffect = {
    type?: string;
    channel?: IAnimationChannelAttrs | string[];
    custom?: IAnimationChannelInterpolator | IAnimationCustomConstructor;
    customParameters?: GraphicFunctionValueType<any>;
    easing?: EasingType;
    options?: GraphicFunctionValueType<any>;
};
export interface IAnimationTimeSlice {
    effects: IAnimationEffect | IAnimationEffect[];
    duration?: GraphicFunctionValueType<number>;
    delay?: GraphicFunctionValueType<number>;
    delayAfter?: GraphicFunctionValueType<number>;
}
export interface IAnimationTimeline {
    id?: string;
    timeSlices: IAnimationTimeSlice | IAnimationTimeSlice[];
    startTime?: GraphicFunctionValueType<number>;
    totalTime?: GraphicFunctionValueType<number>;
    oneByOne?: GraphicFunctionValueType<number | boolean>;
    loop?: GraphicFunctionValueType<number | boolean>;
    partitioner?: GraphicFunctionCallback<boolean>;
    sort?: (datumA: any, datumB: any, graphicA: IGraphic, graphicB: IGraphic) => number;
    controlOptions?: IAnimationControlOptions;
}
export type IAnimationConfig = IAnimationTimeline | IAnimationTypeConfig;
export type IStageAnimationCallback = (stage: IStage, canvas: HTMLCanvasElement, ratio: number, time: number) => void;
export interface MarkAnimationSpec {
    disappear?: IAnimationConfig & {
        callBack?: IStageAnimationCallback | AStageAnimate<any>;
    };
    appear?: IAnimationConfig | IAnimationConfig[];
    enter?: IAnimationConfig | IAnimationConfig[];
    exit?: IAnimationConfig | IAnimationConfig[];
    update?: IAnimationConfig | IAnimationConfig[];
    normal?: IAnimationConfig | IAnimationConfig[];
    state?: IStateAnimationConfig;
}
export type MarkAnimationType = keyof MarkAnimationSpec;
export interface IAnimationSplitStrategy {
    name: string;
    shouldApply: (mark: BaseMark<any>, graphic: IMarkGraphic) => boolean;
    split: (mark: BaseMark<any>, graphic: IMarkGraphic) => Array<{
        attrs: Record<string, any>;
        order: number;
    }>;
}
