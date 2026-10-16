import type { IGlobalScale } from '../../scale/interface';
import type { ICommonSpec, VisualType, ValueType, FunctionType } from '../../typings/visual';
import type { IModel } from '../../model/interface';
import type { IBaseScale } from '@visactor/vscale';
import type { MarkType, MarkTypeEnum } from './type';
import type { ICompilableMark, ICompilableMarkOption, IMarkConfig, IModelMarkAttributeContext, StateValueType } from '../../compile/mark/interface';
import type { Datum, StringOrNumber } from '../../typings';
import type { IGraphic } from '@visactor/vrender-core';
import type { IGroupMark } from './mark';
import type { IAnimationConfig } from '../../animation/interface';
import type { ICompiler } from '../../compile/interface';
export interface VisualScaleType {
    scale: IBaseScale;
    field: StringOrNumber;
    changeDomain?: 'none' | 'replace' | 'expand';
}
export type MarkInputStyle<T> = StyleConvert<T> | VisualType<T>;
export type StyleConvert<T> = ValueType<T> | FunctionType<T> | VisualScaleType;
export interface IAttrConfig<A, R extends ICommonSpec> {
    level: number;
    style: StyleConvert<A>;
    referer?: IMarkRaw<R>;
    postProcess?: (result: A, ...args: Parameters<FunctionType<A>>) => A;
}
export type IAttrs<T extends ICommonSpec> = {
    [K in keyof T]: IAttrConfig<T[K], T>;
};
export type IMarkProgressiveConfig = {
    large?: boolean;
    largeThreshold?: number;
    progressiveStep?: number;
    progressiveThreshold?: number;
};
export type IMarkStateStyle<T extends ICommonSpec> = Record<StateValueType, Partial<IAttrs<T>>>;
export type IMarkStyle<T extends ICommonSpec> = {
    [key in keyof T]: MarkInputStyle<T[key]>;
};
export type DiffStateValues = 'update' | 'enter' | 'exit';
export type AnimationStateValues = 'appear' | 'enter' | 'update' | 'exit' | 'disappear' | 'none' | 'state';
export interface IGraphicContext {
    compiler: ICompiler;
    markType: MarkTypeEnum;
    markId: number;
    modelId: number;
    markUserId?: number | string;
    modelUserId?: number | string;
    diffState?: DiffStateValues;
    reusing?: boolean;
    lastAttrs?: Record<string, any>;
    indexKey?: string;
    diffAttrs?: Record<string, any>;
    finalAttrs?: Record<string, any>;
    fieldX?: string[];
    originalFieldX?: string[];
    fieldY?: string[];
    originalFieldY?: string[];
    animationState?: AnimationStateValues;
    data?: Datum[];
    uniqueKey?: string;
    key?: string;
    groupKey?: string;
    states?: string[];
    graphicCount?: number;
    graphicIndex?: number;
    stateAnimateConfig?: IAnimationConfig | IAnimationConfig[];
}
export interface IMarkGraphic extends IGraphic {
    runtimeStateCache?: Record<string, any>;
    context?: IGraphicContext;
    isExiting?: boolean;
}
export interface IMarkRaw<T extends ICommonSpec> extends ICompilableMark {
    readonly stateStyle: IMarkStateStyle<T>;
    getAttributesOfState: (datum: Datum, state?: StateValueType) => Partial<T>;
    getAttribute: <U extends keyof T>(key: U, datum: any, state?: StateValueType) => unknown;
    setAttribute: <U extends keyof T>(attr: U, style: StyleConvert<T[U]>, state?: StateValueType, level?: number) => void;
    setStyle: (style: Partial<IMarkStyle<T>>, state?: StateValueType, level?: number) => void;
    setSimpleStyle: (s: T) => void;
    getSimpleStyle: () => T;
    setReferer: (mark: IMarkRaw<T>, styleKey?: string, state?: StateValueType) => void;
    initStyleWithSpec: (spec: any) => void;
    created: () => void;
    setPostProcess: <U extends keyof T, A>(key: U, postProcessFunc: IAttrConfig<A, T>['postProcess'], state?: StateValueType) => void;
    updateMarkState: (key: string) => void;
    render: () => void;
    renderInner: () => void;
    getGraphics: () => IMarkGraphic[];
    reuse: (mark: IMark) => void;
    prepareMorph: (mark: IMark) => void;
    clearExitGraphics: () => void;
    isProgressive: () => boolean;
    isDoingProgressive: () => boolean;
    clearProgressive: () => void;
    restartProgressive: () => void;
    renderProgressive: () => void;
    canAnimateAfterProgressive: () => boolean;
    runAnimation: () => void;
    getAnimationState: () => AnimationStateValues;
    needClear?: boolean;
    disableAnimationByState: (state: string | string[]) => void;
    enableAnimationByState: (state: string | string[]) => void;
    clearBeforeReInit: () => void;
}
export type IMark = IMarkRaw<ICommonSpec>;
export interface ICompileMarkConfig extends IMarkConfig {
    morph?: boolean;
    morphElementKey?: string;
    support3d?: boolean;
    clip?: boolean;
    skipTheme?: boolean;
}
export interface IMarkOption extends ICompilableMarkOption {
    model: IModel;
    map: Map<StringOrNumber, IModel | IMark>;
    globalScale: IGlobalScale;
    seriesId?: number;
    componentType?: string;
    attributeContext?: IModelMarkAttributeContext;
    parent?: IGroupMark | false;
}
export interface IMarkConstructor {
    type: MarkType;
    constructorType?: MarkType;
    new (name: string, options: IMarkOption): IMark;
}
export interface IComponentMarkConstructor {
    type: MarkType;
    constructorType?: MarkType;
    new (componentType: string, name: string, options: IMarkOption): IMark;
}
export type MarkConstructor = IMarkConstructor | IComponentMarkConstructor;
export interface IMarkDataInitOption extends IMarkOption {
    mark: IMark;
}
export type ISamplingMethod = 'lttb' | 'min' | 'max' | 'sum' | 'average';
export interface IDataSamping {
    activePoint?: boolean;
    sampling?: ISamplingMethod;
    samplingFactor?: number;
}
export interface IMarkOverlap {
    pointDis?: number;
    pointDisMul?: number;
    markOverlap?: boolean;
}
export type GroupedData<T> = {
    keys: string[];
    data: Map<string, T[]>;
};
export interface IProgressiveTransformResult<Output = any> {
    unfinished: () => boolean;
    output: () => Output;
    progressiveOutput: () => Output;
    progressiveRun: () => void;
    release: () => void;
    canAnimate?: () => boolean;
}
export type IMarkDataTransform<Options = any, Input = any, Output = any> = (options: Options, data: Input) => Output | IProgressiveTransformResult<Output>;
export interface ProgressiveContext {
    currentIndex: number;
    totalStep: number;
    step: number;
    data: any[];
    groupKeys?: string[];
    groupedData?: Map<string, any[]>;
}
