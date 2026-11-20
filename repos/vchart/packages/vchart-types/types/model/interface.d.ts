import type { IBoundsLike } from '@visactor/vutils';
import type { DataSet, DataView } from '@visactor/vdataset';
import type { IEvent, IEventDispatcher } from '../event/interface';
import type { AnimationStateValues, IMark, IMarkGraphic, IMarkRaw, IMarkStyle, MarkTypeEnum } from '../mark/interface';
import type { RenderMode } from '../typings/spec/common';
import type { StringOrNumber } from '../typings/common';
import type { IGroupMarkSpec, ConvertToMarkStyleSpec, ICommonSpec } from '../typings/visual';
import type { IRect } from '../typings/space';
import type { IPoint, CoordinateType } from '../typings/coordinate';
import type { StateValueType } from '../typings/spec';
import type { ICompilable, ICompilableInitOption } from '../compile/interface';
import type { IGlobalScale } from '../scale/interface';
import type { IChart, IChartSpecInfo, IChartSpecTransformerOption } from '../chart/interface';
import type { IThemeColorScheme } from '../theme/color-scheme/interface';
import type { ILayoutItem, ILayoutItemSpec } from '../layout/interface';
import type { ILayoutPoint, ILayoutRect } from '../typings/layout';
import type { ComponentTypeEnum } from '../component/interface';
import type { SeriesTypeEnum } from '../series/interface';
import type { ITooltipSpec } from '../component/tooltip/interface';
import type { TooltipActiveType } from '../typings';
import type { IVChart } from '../core/interface';
import type { ICompilableData } from '../compile/data/interface';
import type { IDimensionData, IDimensionInfo } from '../event/events/dimension/interface';
import type { IAxis } from '../component/axis';
export interface IModelInitOption {
}
export interface IModelLayoutOption {
}
export interface IModelEvaluateOption {
}
export interface IModelRenderOption {
}
export interface IEffect {
    [key: string]: (e?: any) => any;
}
export interface IUpdateSpecEffects {
    remake?: boolean;
    compile?: boolean;
    render?: boolean;
    layout?: boolean;
    data?: boolean;
    scaleDomain?: boolean;
    series?: boolean;
    component?: boolean;
    animation?: boolean;
    localOnly?: boolean;
}
export interface IMarkTreeGroup extends Partial<IMarkStyle<IGroupMarkSpec>> {
    type: 'group';
    name: string;
    marks: (IMarkTreeGroup | IMark)[];
}
export type IMarkTree = IMarkTreeGroup | IMark | (IMarkTreeGroup | IMark)[];
export interface IUpdateSpecResult {
    change: boolean;
    reMake: boolean;
    reRender?: boolean;
    reSize?: boolean;
    reCompile?: boolean;
    reTransformSpec?: boolean;
    effects?: IUpdateSpecEffects;
    reAnimate?: boolean;
    changeTheme?: boolean;
    changeBackground?: boolean;
}
export interface IUpdateDataResult {
    reAnimate?: boolean;
}
export interface IModel extends ICompilable {
    readonly modelType: string;
    readonly type: string;
    readonly specKey: string;
    readonly transformerConstructor: new (option: IBaseModelSpecTransformerOption) => IBaseModelSpecTransformer;
    readonly id: number;
    readonly userId?: StringOrNumber;
    readonly event: IEvent;
    readonly effect: IEffect;
    coordinate?: CoordinateType;
    layout?: ILayoutItem;
    getVisible: () => boolean;
    getOption: () => IModelOption;
    getMarks: () => IMark[];
    getMarkNameMap: () => Record<string, IMark>;
    getData: () => ICompilableData;
    getChart: () => IChart;
    created: () => void;
    init: (option: IModelInitOption) => void;
    reInit: (spec?: any) => void;
    beforeRelease: () => void;
    onEvaluateEnd: (ctx: IModelEvaluateOption) => void;
    onDataUpdate: () => void;
    onBeforeRender: () => void;
    updateSpec: (spec: any, totalSpec?: any) => IUpdateSpecResult;
    getSpec?: () => any;
    getSpecIndex: () => number;
    getSpecPath: () => Array<string | number>;
    onLayoutStart: (layoutRect: IRect, viewRect: ILayoutRect) => void;
    onLayoutEnd: () => void;
    getColorScheme: () => IThemeColorScheme | undefined;
    setMarkStyle: <T extends ICommonSpec>(mark?: IMarkRaw<T>, style?: Partial<IMarkStyle<T> | ConvertToMarkStyleSpec<T>>, state?: StateValueType, level?: number) => void;
    initMarkStyleWithSpec: (mark?: IMark, spec?: any) => void;
    getSpecInfo: () => IModelSpecInfo;
    updateAnimateStateCallback: (callback: (graphic: IMarkGraphic) => AnimationStateValues) => void;
    getAnimationStateCallback: () => (graphic: IMarkGraphic) => AnimationStateValues;
}
export interface ILayoutModel extends IModel {
    getLayoutStartPoint: () => IPoint;
    setLayoutStartPosition: (pos: Partial<IPoint>) => void;
    getLayoutRect: () => ILayoutRect;
    setLayoutRect: (rect: Partial<ILayoutRect>, levelMap?: Partial<ILayoutRect>) => void;
    getLastComputeOutBounds: () => IBoundsLike;
    getBoundsInRect: (rect: ILayoutRect, fullRect: ILayoutRect) => IBoundsLike;
    afterSetLayoutStartPoint: (pos: ILayoutPoint) => void;
}
export interface IModelOption extends ICompilableInitOption {
    type: string;
    eventDispatcher: IEventDispatcher;
    dataSet: DataSet;
    map: Map<StringOrNumber, IModel | IMark>;
    mode: RenderMode;
    globalInstance: IVChart;
    regionIndexes?: Array<number>;
    specKey?: string;
    specPath?: Array<string | number>;
    specInfoPath?: Array<string | number>;
    getTheme?: (...keys: string[]) => any;
    getSpecInfo?: () => IChartSpecInfo;
    getChartLayoutRect: () => IRect;
    getChartViewRect: () => ILayoutRect;
    getChart: () => IChart;
    getSeriesData: (id: StringOrNumber | undefined, index: number | undefined) => DataView | undefined;
    globalScale: IGlobalScale;
    animation?: boolean;
    onError: (...args: any[]) => void;
    disableTriggerEvent?: boolean;
    componentShowContent?: {
        tooltip?: boolean | Partial<Record<TooltipActiveType, boolean>>;
        crosshair?: boolean;
    };
    getDimensionInfo?: (chart: IChart | undefined, pos: ILayoutPoint, isTooltip?: boolean) => IDimensionInfo[] | null;
    getDimensionInfoByValue?: (axis: IAxis, value: any) => IDimensionInfo | null;
    getRectByDimensionData?: (dimensionData: IDimensionData, layoutStartPoint: ILayoutPoint) => any;
    dispatchEvent?: (key: string, params?: any) => void;
}
export interface IModelSpecInfo<T extends Record<string, unknown> = any> {
    type: string | ComponentTypeEnum | SeriesTypeEnum;
    spec: T;
    specPath?: Array<string | number>;
    specInfoPath?: Array<string | number>;
    theme?: any;
    regionIndexes?: number[];
    seriesIndexes?: number[];
}
export interface IModelConstructor {
    readonly builtInTheme?: any;
    readonly transformerConstructor: new (option: IBaseModelSpecTransformerOption) => IBaseModelSpecTransformer;
}
export type ILayoutModelState = {
    layoutUpdateRank: number;
    [key: string]: unknown;
};
export type IModelSpec = ILayoutItemSpec & {
    id?: StringOrNumber;
};
export interface IModelMarkInfo {
    type: MarkTypeEnum | string | (MarkTypeEnum | string)[];
    name: string;
}
export type IBaseModelSpecTransformerOption = IChartSpecTransformerOption;
export interface IBaseModelSpecTransformerResult<T, K> {
    spec: T;
    theme: K;
}
export interface IBaseModelSpecTransformer {
    getTheme: (spec: any, chartSpec: any) => any;
    transformSpec: (spec: any, chartSpec: any, chartSpecInfo?: IChartSpecInfo) => IBaseModelSpecTransformerResult<any, any>;
}
export interface ITooltipHelper {
    spec: ITooltipSpec | undefined;
    activeType: TooltipActiveType[];
    activeTriggerSet: {
        mark?: Set<IMark>;
        group?: Set<IMark>;
    };
    ignoreTriggerSet: {
        mark?: Set<IMark>;
    };
    updateTooltipSpec: () => void;
}
