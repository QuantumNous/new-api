import type { IVChart } from './../../core/interface';
import type { IImageMarkSpec } from '../visual';
import type { LayoutCallBack } from '../../layout/interface';
import type { DataSet, DataView, ISimplifyOptions, IFieldsOptions, IFilterOptions, IFoldOptions, IDsvParserOptions } from '@visactor/vdataset';
import type { RegionSpec } from '../../region/interface';
import type { IHoverSpec, ISelectSpec, IInteractionSpec } from '../../interaction/interface/spec';
import type { IRenderOption } from '../../compile/interface';
import type { ISeriesTooltipSpec, ITooltipSpec } from '../../component/tooltip/interface';
import type { ILayoutSpec } from '../../layout/interface';
import type { ConvertToMarkStyleSpec, IArcMarkSpec, IAreaMarkSpec, IBoxPlotMarkSpec, ICommonSpec, IGroupMarkSpec, ILineMarkSpec, ILinkPathMarkSpec, IPathMarkSpec, IPolygonMarkSpec, IRectMarkSpec, IRuleMarkSpec, ISymbolMarkSpec, IRippleMarkSpec, ITextMarkSpec, IVisualSpecScale } from '../visual';
import type { ISeriesStyle, SeriesType } from '../../series/interface';
import type { Datum, StringOrNumber } from '../common';
import type { IInvalidType } from '../data';
import type { IAnimationSpec, IMorphSeriesSpec } from '../../animation/spec';
import type { IPlayer } from '../../component/player/interface';
import type { IMark, IMarkProgressiveConfig, MarkTypeEnum } from '../../mark/interface';
import type { IDataZoomSpec } from '../../component/data-zoom/data-zoom/interface';
import type { IScrollBarSpec } from '../../component/data-zoom/scroll-bar/interface';
import type { ICrosshairSpec } from '../../component/crosshair/interface';
import type { ITheme } from '../../theme/interface';
import type { ITitleSpec } from '../../component/title/interface';
import type { IBrushSpec } from '../../component/brush/interface';
import type { ITotalLabelSpec } from '../../component/label/interface';
import type { ILegendSpec } from '../../component/legend/interface';
import type { ILayoutOrientPadding, ILayoutPaddingSpec } from '../layout';
import type { IColor, ICustomPath2D, IGraphic, IRichTextCharacter } from '@visactor/vrender-core';
import type { ICommonAxisSpec } from '../../component/axis/interface';
import type { IMediaQuerySpec } from './media-query';
import type { IModelSpec } from '../../model/interface';
import type { TooltipActiveType } from '../tooltip/handler';
export type IChartPadding = ILayoutOrientPadding | number;
export interface IInitOption extends Omit<IRenderOption, 'pluginList'> {
    dom?: string | HTMLElement;
    renderCanvas?: string | HTMLCanvasElement;
    dataSet?: DataSet;
    autoFit?: boolean;
    animation?: boolean;
    layout?: LayoutCallBack;
    poptip?: boolean;
    onError?: (...args: any[]) => void;
    theme?: string | ITheme;
    disableTriggerEvent?: boolean;
    componentShowContent?: {
        tooltip?: boolean | Partial<Record<TooltipActiveType, boolean>>;
        crosshair?: boolean;
    };
    resizeDelay?: number;
}
export declare enum RenderModeEnum {
    'desktop-browser' = "desktop-browser",
    'mobile-browser' = "mobile-browser",
    'node' = "node",
    'worker' = "worker",
    'miniApp' = "miniApp",
    'wx' = "wx",
    'tt' = "tt",
    'harmony' = "harmony",
    'desktop-miniApp' = "desktop-miniApp",
    'lynx' = "lynx"
}
export type RenderMode = keyof typeof RenderModeEnum;
export interface IChartSpec {
    type: string;
    data?: IData;
    width?: number;
    height?: number;
    autoFit?: boolean;
    padding?: ILayoutPaddingSpec;
    color?: string[] | Omit<IVisualSpecScale<unknown, string>, 'id'>;
    series?: ISeriesSpec[];
    seriesStyle?: ISeriesStyle;
    animationThreshold?: number;
    hover?: boolean | IHoverSpec;
    select?: boolean | ISelectSpec;
    region?: RegionSpec[];
    title?: ITitleSpec;
    layout?: ILayoutSpec;
    legends?: ILegendSpec | ILegendSpec[];
    crosshair?: ICrosshairSpec | ICrosshairSpec[];
    tooltip?: ITooltipSpec;
    player?: IPlayer;
    dataZoom?: IDataZoomSpec | IDataZoomSpec[];
    scrollBar?: IScrollBarSpec | IScrollBarSpec[];
    brush?: IBrushSpec;
    scales?: IVisualSpecScale<unknown, unknown>[];
    customMark?: ICustomMarkSpec<EnableMarkType>[];
    axes?: ICommonAxisSpec[];
    theme?: Omit<ITheme, 'name'> | string;
    background?: IBackgroundSpec;
    stackInverse?: boolean;
    stackSort?: boolean;
    media?: IMediaQuerySpec;
}
export type IBackgroundSpec = IColor | ConvertToMarkStyleSpec<IGroupMarkSpec>;
export type IDataType = IDataValues | DataView;
export type IData = IDataType | IDataType[];
export type DataKeyType = string | string[] | ((data: Datum, index: number) => string);
export type BuildInTransformOptions = {
    type: 'simplify';
    options: ISimplifyOptions;
} | {
    type: 'fields';
    options: IFieldsOptions;
} | {
    type: 'filter';
    options: IFilterOptions;
} | {
    type: 'fold';
    options: IFoldOptions;
};
export interface IFieldsMeta {
    alias?: string;
    domain?: StringOrNumber[];
    lockStatisticsByDomain?: boolean | 'onlyFull';
    type?: 'ordinal' | 'linear';
    sortIndex?: number;
    sortReverse?: boolean;
    sort?: 'desc' | 'asc';
}
export interface SheetParseOptions extends CommonParseOptions {
    type: 'csv' | 'dsv' | 'tsv';
    options?: IDsvParserOptions;
}
export interface CommonParseOptions {
    clone?: boolean;
}
export interface IDataValues {
    id?: StringOrNumber;
    values: Datum[] | string;
    fromDataIndex?: number;
    fromDataId?: StringOrNumber;
    transforms?: BuildInTransformOptions[];
    fields?: Record<string, IFieldsMeta>;
    parser?: SheetParseOptions | CommonParseOptions;
}
export type IHierarchyNodeData = {
    value?: number;
    children?: IHierarchyNodeData[];
} & Datum;
export interface IHierarchyDataValues extends Omit<IDataValues, 'values'> {
    values: IHierarchyNodeData;
}
export type IHierarchyData = DataView | IHierarchyDataValues;
export interface ISeriesSpec extends IInteractionSpec {
    type: SeriesType;
    name?: string;
    id?: StringOrNumber;
    data?: IDataType;
    dataIndex?: number;
    dataId?: StringOrNumber;
    dataKey?: DataKeyType;
    regionIndex?: number;
    regionId?: StringOrNumber;
    seriesField?: string;
    seriesStyle?: ISeriesStyle;
    stack?: boolean;
    stackValue?: StringOrNumber;
    totalLabel?: ITotalLabelSpec;
    percent?: boolean;
    stackOffsetSilhouette?: boolean;
    invalidType?: IInvalidType;
    tooltip?: ISeriesTooltipSpec;
    animation?: boolean;
    animationThreshold?: number;
    support3d?: boolean;
    morph?: IMorphSeriesSpec;
    extensionMark?: (IExtensionMarkSpec<Exclude<EnableMarkType, 'group'>> | IExtensionGroupMarkSpec)[];
    zIndex?: number;
}
export type IChartExtendsSeriesSpec<T extends ISeriesSpec> = Omit<T, 'data' | 'morph' | 'stackValue' | 'tooltip'>;
export type AdaptiveSpec<T, K extends keyof any> = {
    [key in Exclude<keyof T, K>]: T[key];
} & {
    [key in K]: any;
};
export interface IMarkStateFullSpec<T> extends Record<string, IMarkStateSpec<T> | IMarkStateStyleSpec<T>> {
    normal?: IMarkStateSpec<T> | IMarkStateStyleSpec<T>;
    hover?: IMarkStateSpec<T> | IMarkStateStyleSpec<T>;
    hover_reverse?: IMarkStateSpec<T> | IMarkStateStyleSpec<T>;
    selected?: IMarkStateSpec<T> | IMarkStateStyleSpec<T>;
    selected_reverse?: IMarkStateSpec<T> | IMarkStateStyleSpec<T>;
}
export type IMarkSpec<T extends ICommonSpec = ICommonSpec> = {
    id?: StringOrNumber;
    interactive?: boolean;
    zIndex?: number;
    visible?: boolean;
    style?: ConvertToMarkStyleSpec<T>;
    state?: IMarkStateFullSpec<T>;
    stateSort?: (stateA: string, stateB: string) => number;
    support3d?: boolean;
    customShape?: (datum: any[], attrs: any, path: ICustomPath2D) => ICustomPath2D;
} & IMarkProgressiveConfig;
export type IMarkStateFilter = {
    fields: {
        [key in string]: {
            type: 'ordinal' | 'linear';
            domain: StringOrNumber[];
        };
    };
} | {
    datums: Datum[];
    datumKeys: string[];
} | {
    items: IGraphic[];
} | ((datum: Datum, options: {
    mark?: IMark;
    type?: string;
    renderNode?: IGraphic;
}) => boolean);
export interface IMarkStateSpec<T> {
    filter?: IMarkStateFilter;
    level?: number | undefined;
    style: ConvertToMarkStyleSpec<T>;
}
export type IMarkStateStyleSpec<T> = ConvertToMarkStyleSpec<T>;
export interface IMarkStateTheme<T> extends Record<string, T> {
    normal?: T;
    hover?: T;
    hover_reverse?: T;
    selected?: T;
    selected_reverse?: T;
}
export type IMarkTheme<T> = {
    visible?: boolean;
    style?: T;
    state?: IMarkStateTheme<T>;
    interactive?: boolean;
};
export interface IPerformanceHook {
    afterCreateVChart?: (vchart?: IVChart) => void;
    beforeInitializeChart?: (vchart?: IVChart) => void;
    afterInitializeChart?: (vchart?: IVChart) => void;
    beforeCompileToVGrammar?: (vchart?: IVChart) => void;
    afterCompileToVGrammar?: (vchart?: IVChart) => void;
    beforeRegionCompile?: (vchart?: IVChart) => void;
    afterRegionCompile?: (vchart?: IVChart) => void;
    beforeSeriesCompile?: (vchart?: IVChart) => void;
    afterSeriesCompile?: (vchart?: IVChart) => void;
    beforeComponentCompile?: (vchart?: IVChart) => void;
    afterComponentCompile?: (vchart?: IVChart) => void;
    beforeResizeWithUpdate?: (vchart?: IVChart) => void;
    afterResizeWithUpdate?: (vchart?: IVChart) => void;
    beforeLayoutWithSceneGraph?: (vchart?: IVChart) => void;
    afterLayoutWithSceneGraph?: (vchart?: IVChart) => void;
    beforeParseView?: (vchart?: IVChart) => void;
    afterParseView?: (vchart?: IVChart) => void;
    beforeCreateRuntime?: (vchart?: IVChart) => void;
    afterCreateRuntime?: (vchart?: IVChart) => void;
    beforeSrViewEvaluateAsync?: (vchart?: IVChart) => void;
    afterSrViewEvaluateAsync?: (vchart?: IVChart) => void;
    beforeSrViewRunAsync?: (vchart?: IVChart) => void;
    afterSrViewRunAsync?: (vchart?: IVChart) => void;
    beforeTransform?: (name: string, vchart?: IVChart) => void;
    afterTransform?: (name: string, vchart?: IVChart) => void;
    beforeCreateVRenderStage?: (vchart?: IVChart) => void;
    afterCreateVRenderStage?: (vchart?: IVChart) => void;
    beforeCreateVRenderMark?: (vchart?: IVChart) => void;
    afterCreateVRenderMark?: (vchart?: IVChart) => void;
    beforeDoRender?: (vchart?: IVChart) => void;
    beforeVRenderDraw?: (vchart?: IVChart) => void;
    afterVRenderDraw?: (vchart?: IVChart) => void;
    afterWordcloudShapeDraw?: (vchart?: IVChart) => void;
}
export type IBuildinMarkSpec = {
    group: IGroupMarkSpec;
    symbol: ISymbolMarkSpec;
    rule: IRuleMarkSpec;
    line: ILineMarkSpec;
    text: ITextMarkSpec;
    rect: IRectMarkSpec;
    image: IImageMarkSpec;
    path: IPathMarkSpec;
    area: IAreaMarkSpec;
    arc: IArcMarkSpec;
    polygon: IPolygonMarkSpec;
    boxPlot: IBoxPlotMarkSpec;
    linkPath: ILinkPathMarkSpec;
    ripple: IRippleMarkSpec;
};
export type EnableMarkType = keyof IBuildinMarkSpec;
export interface ICustomMarkSpec<T extends EnableMarkType> extends IModelSpec, IMarkSpec<IBuildinMarkSpec[T]>, IAnimationSpec<string, string> {
    type: T;
    name?: string;
    dataIndex?: number;
    dataKey?: string | ((datum: any) => string);
    dataId?: StringOrNumber;
    componentType?: string;
    animation?: boolean;
    parent?: string;
}
export interface ICustomMarkGroupSpec extends ICustomMarkSpec<MarkTypeEnum.group> {
    children?: ICustomMarkSpec<EnableMarkType>[];
}
export interface IExtensionMarkSpec<T extends Exclude<EnableMarkType, 'group'>> extends ICustomMarkSpec<T> {
    dataIndex?: number;
    dataKey?: string | ((datum: any) => string);
    dataId?: StringOrNumber;
    componentType?: string;
}
export interface IExtensionGroupMarkSpec extends ICustomMarkSpec<MarkTypeEnum.group> {
    children?: ICustomMarkSpec<EnableMarkType>[];
}
export type ITextFormatMethod<T extends any[]> = (...args: T) => ITextMarkSpec['text'] | {
    type: 'text';
    text: ITextMarkSpec['text'];
};
export type IRichTextFormatMethod<T extends any[]> = (...args: T) => {
    type: 'rich';
    text: IRichTextCharacter[];
} | IRichTextCharacter[];
export type IFormatMethod<T extends any[]> = (...args: T) => ReturnType<ITextFormatMethod<T>> | ReturnType<IRichTextFormatMethod<T>>;
