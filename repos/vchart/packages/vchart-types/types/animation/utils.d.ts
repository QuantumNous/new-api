import type { MarkAnimationSpec, IAnimationState, IAnimationConfig } from './interface';
import type { IStateAnimateSpec, IAnimationSpec } from './spec';
import type { SeriesMarkNameEnum } from '../series/interface/type';
import type { ISeries } from '../series';
import type { ISeriesSpec } from '../typings';
import type { IModelMarkAttributeContext } from '../compile/mark';
export declare const AnimationStates: string[];
export declare function animationConfig<Preset extends string>(defaultConfig?: MarkAnimationSpec, userConfig?: Partial<Record<IAnimationState, boolean | IStateAnimateSpec<Preset> | IAnimationConfig | IAnimationConfig[]>>, params?: {
    dataIndex: (datum: any, params: any) => number;
    dataCount: () => number;
}): MarkAnimationSpec;
export declare function userAnimationConfig<M extends string, Preset extends string>(markName: SeriesMarkNameEnum | string, spec: IAnimationSpec<M, Preset>, ctx: IModelMarkAttributeContext): Partial<Record<"none" | "normal" | "state" | "update" | "appear" | "disappear" | "enter" | "exit", boolean | IAnimationConfig | IAnimationConfig[] | IStateAnimateSpec<Preset>>>;
export declare function shouldMarkDoMorph(spec: ISeriesSpec & IAnimationSpec<string, string>, markName: string): boolean;
export declare function isTimeLineAnimation(animationConfig: IAnimationConfig): boolean;
export declare function isChannelAnimation(animationConfig: IAnimationConfig): boolean;
export declare function uniformAnimationConfig<Preset extends string>(config: Partial<Record<IAnimationState, boolean | IStateAnimateSpec<Preset> | IAnimationConfig | IAnimationConfig[]>>, ctx: IModelMarkAttributeContext): Partial<Record<"none" | "normal" | "state" | "update" | "appear" | "disappear" | "enter" | "exit", boolean | IAnimationConfig | IAnimationConfig[] | IStateAnimateSpec<Preset>>>;
export declare function isAnimationEnabledForSeries(series: ISeries): boolean;
