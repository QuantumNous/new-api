import type { DataSet, IParserOptions } from '@visactor/vdataset';
import type { Datum, IDataValues, IInitOption, IMarkStateSpec, IPoint, IRegionQuerier, IShowTooltipOption, ISpec, ITooltipHandler, Maybe, MaybeArray, StringOrNumber } from '../typings';
import type { IMorphConfig } from '../animation/spec';
import type { IBoundsLike } from '@visactor/vutils';
import type { EventCallback, EventParamsDefinition, EventQuery, EventType, ExtendEventParam } from '../event/interface';
import type { IMark, IMarkDataTransform } from '../mark/interface';
import type { ISeries } from '../series/interface/series';
import type { ITheme } from '../theme/interface';
import type { IComponent } from '../component/interface';
import type { LayoutCallBack } from '../layout/interface';
import type { DimensionIndexOption, IChart, IChartSpecInfo } from '../chart/interface';
import type { IEventTarget, IStage } from '@visactor/vrender-core';
import type { IContainerSize } from '@visactor/vrender-components';
import type { IBaseScale } from '@visactor/vscale';
import type { IUpdateSpecResult } from '../model/interface';
import type { ICompiler } from '../compile/interface';
export type DataLinkSeries = {
    seriesId?: StringOrNumber;
    seriesIndex?: number;
};
export type DataLinkAxis = {
    axisId?: StringOrNumber;
    axisIndex?: number;
};
export interface IVChartConstructor {
    new (spec: ISpec, options: IInitOption): IVChart;
    useRegisters: (comps: (() => void)[]) => any;
}
export interface IVChart {
    readonly id: number;
    renderSync: (morphConfig?: IMorphConfig) => IVChart;
    renderAsync: (morphConfig?: IMorphConfig) => Promise<IVChart>;
    updateData: (id: StringOrNumber, data: Datum[] | string, options?: IParserOptions) => Promise<IVChart>;
    updateDataInBatches: (list: {
        id: string;
        data: Datum[];
        options?: IParserOptions;
    }[]) => Promise<IVChart>;
    updateDataSync: (id: StringOrNumber, data: Datum[], options?: IParserOptions) => IVChart;
    updateFullDataSync: (data: IDataValues | IDataValues[], reRender?: boolean) => IVChart;
    updateFullData: (data: IDataValues | IDataValues[], reRender?: boolean) => Promise<IVChart>;
    updateSpec: (spec: ISpec, forceMerge?: boolean, morphConfig?: IMorphConfig, userUpdateOptions?: IUpdateSpecResult) => Promise<IVChart>;
    updateSpecSync: (spec: ISpec, forceMerge?: boolean, morphConfig?: IMorphConfig, userUpdateOptions?: IUpdateSpecResult) => void;
    updateModelSpecSync: (filter: string | {
        type: string;
        index: number;
    }, spec: unknown, forceMerge?: boolean, morphConfig?: IMorphConfig) => IVChart;
    updateModelSpec: (filter: string | {
        type: string;
        index: number;
    }, spec: unknown, forceMerge?: boolean, morphConfig?: IMorphConfig) => Promise<IVChart>;
    updateSpecAndRecompile: (spec: ISpec, forceMerge: boolean, option: IVChartRenderOption) => boolean;
    updateViewBox: (viewBox: IBoundsLike, reRender?: boolean) => IVChart;
    resize: (width: number, height: number) => Promise<IVChart>;
    release: () => void;
    on: ((eType: EventType, handler: EventCallback<ExtendEventParam>) => void) & ((eType: EventType, query: EventQuery, handler: EventCallback<ExtendEventParam>) => void);
    off: (eType: EventType, handler?: EventCallback<ExtendEventParam>) => void;
    updateState: (state: Record<string, Omit<IMarkStateSpec<unknown>, 'style'>>, filter?: (series: ISeries, mark: IMark, stateKey: string) => boolean) => void;
    setSelected: (datum: MaybeArray<any> | null, filter?: (series: ISeries, mark: IMark) => boolean, region?: IRegionQuerier) => void;
    setHovered: (datum: MaybeArray<Datum> | null, filter?: (series: ISeries, mark: IMark) => boolean, region?: IRegionQuerier) => void;
    clearState: (state: string) => void;
    clearSelected: () => void;
    clearHovered: () => void;
    getCurrentTheme: () => ITheme;
    getCurrentThemeName: () => string;
    setCurrentTheme: (name: string) => Promise<IVChart>;
    setTooltipHandler: (tooltipHandler: ITooltipHandler) => void;
    getTooltipHandlerByUser: () => ITooltipHandler | undefined;
    getTooltipHandler: () => ITooltipHandler | undefined;
    showTooltip: (datum: Datum, options: IShowTooltipOption) => boolean;
    hideTooltip: () => boolean;
    getLegendDataById: (id: string) => Datum[];
    getLegendDataByIndex: (index?: number) => Datum[];
    getLegendSelectedDataById: (id: string) => StringOrNumber[];
    getLegendSelectedDataByIndex: (index?: number) => StringOrNumber[];
    setLegendSelectedDataById: (id: string, selectedData: StringOrNumber[]) => void;
    setLegendSelectedDataByIndex: (index: number, selectedData: StringOrNumber[]) => void;
    getDataURL: () => Promise<any>;
    exportImg: (name?: string) => Promise<void>;
    exportCanvas: () => HTMLCanvasElement | undefined;
    getImageBuffer: () => void;
    setLayout: (layout: LayoutCallBack) => void;
    reLayout: () => void;
    getCompiler: () => ICompiler;
    getChart: () => Maybe<IChart>;
    getStage: () => IStage;
    getCanvas: () => HTMLCanvasElement | undefined;
    getContainer: () => Maybe<HTMLElement>;
    getComponents: () => IComponent[];
    getDataSet: () => Maybe<DataSet>;
    getScale: (scaleId: string) => IBaseScale | null;
    setDimensionIndex: (value: StringOrNumber, options?: DimensionIndexOption) => void;
    disableDimensionHoverEvent: (disabled?: boolean) => void;
    disableCrossHair: (disabled: boolean) => void;
    disableTooltip: (disabled: boolean) => void;
    convertDatumToPosition: (datum: Datum, dataLinkInfo?: DataLinkSeries, isRelativeToCanvas?: boolean, checkInViewData?: boolean) => IPoint | null;
    convertValueToPosition: ((value: StringOrNumber, dataLinkInfo: DataLinkAxis, isRelativeToCanvas?: boolean) => number | null) & ((value: [StringOrNumber, StringOrNumber], dataLinkInfo: DataLinkSeries, isRelativeToCanvas?: boolean) => IPoint | null);
    updateIndicatorDataById: (id: string, datum?: Datum) => void;
    updateIndicatorDataByIndex: (index?: number, datum?: Datum) => void;
    geoZoomByIndex: (regionIndex: number, zoom: number, center?: {
        x: number;
        y: number;
    }) => void;
    geoZoomById: (regionId: string | number, zoom: number, center?: {
        x: number;
        y: number;
    }) => void;
    isAnimationEnable: () => boolean;
    stopAnimation: () => void;
    pauseAnimation: () => void;
    resumeAnimation: () => void;
    registerFunction: (key: string, fun: Function) => void;
    unregisterFunction: (key: string) => void;
    getFunction: (key: string) => Function | null;
    getFunctionList: () => string[] | null;
    getSpecInfo: () => IChartSpecInfo;
    setRuntimeSpec: (spec: any) => void;
    getSpec: () => any;
    getCurrentSize: () => IContainerSize;
    rotate90WithTransform?: (rotateDom: HTMLElement) => void;
    cancelTransform?: (rotateDom: HTMLElement) => void;
}
export interface IGlobalConfig {
    uniqueTooltip?: boolean;
}
export interface IVChartRenderOption {
    morphConfig?: IMorphConfig;
    transformSpec?: boolean;
    actionSource?: VChartRenderActionSource;
}
export type VChartRenderActionSource = 'render' | 'updateSpec' | 'updateModelSpec' | 'setCurrentTheme' | 'updateSpecAndRecompile';
export interface VRenderComponentOptions {
    skipDefault?: boolean;
    mode?: '2d' | '3d';
}
export interface IStageEventPlugin<T> {
    new (taget: IEventTarget, cfg?: T): {
        release: () => void;
    };
}
export interface GrammarTransformOption {
    canProgressive?: boolean;
    transform: IMarkDataTransform;
    runType?: 'beforeJoin' | 'afterEncode';
}
export interface UserEvent {
    eType: EventType;
    query: EventQuery | EventCallback<EventParamsDefinition[EventType]>;
    handler?: EventCallback<EventParamsDefinition[EventType]>;
}
