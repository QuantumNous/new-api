import type { IMark, IMarkGraphic, IMarkStateStyle, MarkType } from '../../mark/interface';
import type { IModel } from '../../model/interface';
import type { GrammarItemCompileOption, GrammarItemInitOption, IGrammarItem, StateValueMap } from '../interface';
import type { DataView } from '@visactor/vdataset';
import type { Maybe, Datum, StringOrNumber } from '../../typings';
import type { IRegion } from '../../region/interface';
import type { ICompilableData } from '../data/interface';
import type { ICustomPath2D, IGraphic, IGroup } from '@visactor/vrender-core';
import type { MarkAnimationSpec } from '../../animation/interface';
export interface IMarkConfig {
    clipPath?: IGraphic[] | ((graphics: IGraphic[]) => IGraphic[]);
    clip?: boolean;
    zIndex?: number;
    interactive?: boolean;
    setCustomizedShape?: (datum: any[], attrs: any, path: ICustomPath2D) => ICustomPath2D;
    large?: boolean;
    largeThreshold?: number;
    progressiveStep?: number;
    progressiveThreshold?: number;
    support3d?: boolean;
    graphicName?: string | ((g: IMarkConfig) => string);
    morph?: boolean;
    morphKey?: string;
    morphElementKey?: string;
    overflow?: 'scroll' | 'hidden' | 'scroll-x' | 'scroll-y';
    skipTheme?: boolean;
    useSequentialAnimation?: boolean;
}
export interface IMarkStateManager {
    getStateInfoList: () => IStateInfo[];
    getStateInfo: (stateValue: StateValue) => IStateInfo;
    addStateInfo: (stateInfo: IStateInfo) => void;
    changeStateInfo: (stateInfo: Partial<IStateInfo>) => void;
    clearStateInfo: (stateValues: StateValue[]) => void;
    clearAllStateInfo: () => void;
    checkOneState: (renderNode: IMarkGraphic, datum: Datum[], state: IStateInfo) => 'in' | 'out' | 'skip';
    checkState: (renderNode: IMarkGraphic, datum: Datum[]) => StateValue[];
    getStateMap: () => StateValueMap;
    updateState: (newState: Partial<StateValueMap>, noRender?: boolean) => void;
    release: () => void;
}
export interface IMarkData extends ICompilableData {
    setCompiledProductId: (name: string) => any;
    generateProductId: () => string;
}
export interface ICompilableMarkOption extends GrammarItemInitOption {
    key?: string | ((datum: Datum) => string);
    groupKey?: string;
    skipBeforeLayouted?: boolean;
    mode?: '2d' | '3d';
    noSeparateStyle?: boolean;
}
export interface ICompilableMark extends IGrammarItem {
    readonly type: MarkType;
    readonly id: number;
    readonly name: string;
    readonly key?: string | ((datum: Datum) => string);
    readonly model: IModel;
    commit: (render?: boolean, recursion?: boolean) => void;
    uncommit: () => void;
    isCommited: () => boolean;
    getData: () => ICompilableData | undefined;
    setData: (d: ICompilableData) => void;
    getDataView: () => DataView | undefined;
    setDataView: (d: DataView) => void;
    state: IMarkStateManager;
    readonly stateStyle: IMarkStateStyle<any>;
    hasState: (state: string) => boolean;
    getState: (state: string) => any;
    updateState: (newState: Record<string, unknown>) => void;
    compileEncode: () => void;
    setAnimationConfig: (config: Partial<MarkAnimationSpec>) => void;
    getAnimationConfig: () => Partial<MarkAnimationSpec>;
    getVisible: () => boolean;
    setVisible: (visible: boolean) => void;
    setGroupKey: (groupKey: string) => void;
    getUserId: () => StringOrNumber | undefined;
    setUserId: (id: StringOrNumber) => void;
    compile: (option?: IMarkCompileOption) => void;
    getProduct: () => Maybe<IGroup>;
    getMarks: () => ICompilableMark[];
    setSkipBeforeLayouted: (skip: boolean) => void;
    getMarkConfig: () => IMarkConfig;
    setMarkConfig: (config: IMarkConfig) => void;
    getContext: () => any;
    layout: (layoutCallback: () => void) => void;
    setDataLabelType?: () => string;
}
export interface IMarkCompileOption extends GrammarItemCompileOption {
    group?: IGroup;
    context?: any;
}
export interface IStateInfo {
    stateValue: StateValue;
    fields?: any | null | undefined;
    datums?: any[] | null | undefined;
    datumKeys?: string[] | null | undefined;
    items?: any[] | null | undefined;
    filter?: ((datum: any, options: {
        mark?: IMark;
        type?: string;
        renderNode?: IGraphic;
    }) => boolean) | null | undefined;
    cache?: {
        [key: string]: {
            [key: string]: boolean;
        };
    };
    level?: number | undefined;
}
export interface IStateSpec {
    stateValue: StateValue;
    datums?: any[] | null | undefined;
    datumKeys?: string[] | null | undefined;
    level?: number | undefined;
}
export interface IMarkState {
    readonly id: number;
    getStates: () => IStateInfo[];
    getState: (stateValue: StateValue) => IStateInfo | undefined;
    addState: (stateInfo: IStateInfo) => void;
    changeState: (stateInfo: Partial<IStateInfo>, update?: boolean) => void;
    checkState: (item: any, datum: any) => string[];
    clearState: (stateValues: StateValue[], update?: boolean) => void;
    update: () => void;
}
export declare enum STATE_VALUE_ENUM {
    STATE_NORMAL = "normal",
    STATE_HOVER = "hover",
    STATE_HOVER_REVERSE = "hover_reverse",
    STATE_DIMENSION_HOVER = "dimension_hover",
    STATE_DIMENSION_HOVER_REVERSE = "dimension_hover_reverse",
    STATE_SELECTED = "selected",
    STATE_SELECTED_REVERSE = "selected_reverse",
    STATE_SANKEY_EMPHASIS = "selected",
    STATE_SANKEY_EMPHASIS_REVERSE = "blur",
    STATE_HIGHLIGHT = "highlight",
    STATE_BLUR = "blur",
    STATE_ACTIVE = "active"
}
export declare enum STATE_VALUE_ENUM_REVERSE {
    STATE_HOVER_REVERSE = "hover_reverse",
    STATE_DIMENSION_HOVER_REVERSE = "dimension_hover_reverse",
    STATE_SELECTED_REVERSE = "selected_reverse"
}
export type STATE_NORMAL = typeof STATE_VALUE_ENUM.STATE_NORMAL;
export type STATE_HOVER = typeof STATE_VALUE_ENUM.STATE_HOVER;
export type STATE_HOVER_REVERSE = typeof STATE_VALUE_ENUM.STATE_HOVER_REVERSE;
export type STATE_CUSTOM = string;
export type StateValueNot = STATE_HOVER_REVERSE | STATE_CUSTOM;
export type StateValue = STATE_NORMAL | STATE_HOVER | STATE_CUSTOM;
export type StateValueType = StateValue | StateValueNot;
export interface IModelMarkAttributeContext {
    [key: string]: unknown;
}
export interface ISeriesMarkAttributeContext extends IModelMarkAttributeContext {
    globalScale: (scaleKey: string, value: string | number) => unknown;
    seriesColor: (seriesValue?: string | number) => string;
    getRegion: () => IRegion;
}
