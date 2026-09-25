import type { ISeriesTooltipSpec, ITooltipSpec, TooltipHandlerParams } from '../../component/tooltip/interface';
import type { Datum, ITooltipActual, ITooltipLineActual, ITooltipLinePattern, ITooltipPattern, MaybeArray, ShapeType, TooltipActiveType, TooltipContentProperty, TooltipData, TooltipPatternProperty } from '../../typings';
import type { ISeries, ISeriesTooltipHelper } from '../interface';
import type { IMark } from '../../mark/interface/common';
interface ISeriesCacheInfo {
    seriesFields: string[];
    dimensionFields: string[];
    measureFields: string[];
    type: string;
}
export declare class BaseSeriesTooltipHelper implements ISeriesTooltipHelper {
    series: ISeries;
    spec: ISeriesTooltipSpec | undefined;
    activeType: TooltipActiveType[];
    activeTriggerSet: {
        mark: Set<IMark>;
        group: Set<IMark>;
    };
    ignoreTriggerSet: {
        mark: Set<IMark>;
    };
    protected _seriesCacheInfo: ISeriesCacheInfo;
    constructor(series: ISeries);
    updateTooltipSpec(): void;
    protected _getSeriesCacheInfo: () => ISeriesCacheInfo;
    protected _getDimensionData: (datum: any) => any;
    protected _getMeasureData: (datum: any) => any;
    protected _getSeriesFieldData: (datum: any) => any;
    protected _getSeriesStyle: (datum: any, styleKey: string | string[], defaultValue?: any) => any;
    markTooltipKeyCallback: (datum: Datum, params?: TooltipHandlerParams) => string | undefined;
    markTooltipValueCallback: (datum: Datum, params?: TooltipHandlerParams) => string | undefined;
    shapeTypeCallback: (datum: Datum, params?: TooltipHandlerParams) => ShapeType | undefined;
    shapeColorCallback: (datum: Datum, params?: TooltipHandlerParams) => string | undefined;
    shapeStrokeCallback: (datum: Datum, params?: TooltipHandlerParams) => string | undefined;
    dimensionTooltipTitleCallback: (datum: Datum, params?: TooltipHandlerParams) => string | undefined;
    groupTooltipTitleCallback: (datum: Datum, params?: TooltipHandlerParams) => string | undefined;
    groupTooltipKeyCallback: (datum: Datum, params?: TooltipHandlerParams) => string | undefined;
    getHasShape: (isContent: boolean) => boolean;
    protected getShapeAttrs(activeType: TooltipActiveType, isContent: boolean, chartTooltipSpec?: ITooltipSpec): {
        shapeType: TooltipContentProperty<string>;
        shapeFill: TooltipContentProperty<string>;
        shapeStroke: TooltipContentProperty<string>;
        shapeHollow: TooltipContentProperty<boolean>;
        shapeLineWidth: TooltipContentProperty<number>;
        shapeSize: any;
        hasShape: boolean;
    };
    protected enableByType(activeType: TooltipActiveType): boolean;
    protected getDefaultContentList(activeType: TooltipActiveType): MaybeArray<TooltipPatternProperty<MaybeArray<ITooltipLinePattern>>>;
    protected getContentList(activeType: TooltipActiveType, spec: ITooltipPattern, shapeAttrs: Record<string, TooltipContentProperty<any>>, data?: TooltipData, datum?: Datum[], params?: TooltipHandlerParams): ITooltipLineActual[];
    protected getTitleResult(activeType: TooltipActiveType, titleSpec: TooltipPatternProperty<ITooltipLinePattern>, shapeAttrs: Record<string, TooltipContentProperty<any>>, data?: TooltipData, params?: TooltipHandlerParams): ITooltipLineActual;
    getTooltipData(activeType: TooltipActiveType, chartTooltipSpec?: ITooltipSpec, data?: TooltipData, datum?: Datum[], params?: TooltipHandlerParams): ITooltipActual | null;
    protected getDefaultTitlePattern(activeType: TooltipActiveType): ITooltipLinePattern;
    protected getDefaultContentPattern(activeType: TooltipActiveType): ITooltipLinePattern;
}
export {};
