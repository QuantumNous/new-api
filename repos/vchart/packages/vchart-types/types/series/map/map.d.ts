import { DataView } from '@visactor/vdataset';
import type { StringOrNumber } from '../../typings';
import { GeoSeries } from '../geo/geo';
import type { SeriesMarkMap } from '../interface';
import { SeriesTypeEnum } from '../interface/type';
import type { IMapSeriesSpec } from './interface';
import type { PanEventParam, ZoomEventParam } from '../../event/interface';
import type { ILabelMark, IMark } from '../../mark/interface';
import { MapSeriesSpecTransformer } from './map-transformer';
export declare class MapSeries<T extends IMapSeriesSpec = IMapSeriesSpec> extends GeoSeries<T> {
    static readonly type: string;
    type: SeriesTypeEnum;
    static readonly mark: SeriesMarkMap;
    static readonly builtInTheme: {
        map: import("./interface").IMapSeriesTheme;
    };
    static readonly transformerConstructor: any;
    readonly transformerConstructor: typeof MapSeriesSpecTransformer;
    map: string;
    protected _nameMap: {
        [key: StringOrNumber]: StringOrNumber;
    };
    getNameMap(): {
        [key: string]: StringOrNumber;
        [key: number]: StringOrNumber;
    };
    private _areaCache;
    get areaPath(): Map<string, {
        shape: string;
    }>;
    private _pathMark;
    private _labelMark;
    setAttrFromSpec(): void;
    initData(): void;
    compileData(): void;
    initMark(): void;
    initMarkStyle(): void;
    initLabelMarkStyle(labelMark: ILabelMark): void;
    initAnimation(): void;
    protected initTooltip(): void;
    protected getPath(datum: any): string;
    onEvaluateEnd(): void;
    getDimensionField(): string[];
    getMeasureField(): string[];
    release(): void;
    handleZoom(e: ZoomEventParam): void;
    handlePan(e: PanEventParam): void;
    getDatumCenter(datum: any): [number, number];
    getDatumName(datum: any): string;
    dataToPositionX(data: any): number;
    dataToPositionY(data: any): number;
    viewDataUpdate(d: DataView): void;
    protected _getDataIdKey(): string;
    getActiveMarks(): IMark[];
}
export declare const registerMapSeries: () => void;
