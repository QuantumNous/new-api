import { SeriesTypeEnum } from '../interface/type';
import type { IWordCloud3dSeriesSpec } from './interface';
import { BaseWordCloudSeries } from './base';
export declare class WordCloud3dSeries<T extends IWordCloud3dSeriesSpec = IWordCloud3dSeriesSpec> extends BaseWordCloudSeries<T> {
    static readonly type: string;
    type: SeriesTypeEnum;
    protected _wordCloudTransformOption(): {
        postProjection: "StereographicProjection";
        depth_3d: number;
        constructor: Function;
        toString(): string;
        toLocaleString(): string;
        valueOf(): Object;
        hasOwnProperty(v: PropertyKey): boolean;
        isPrototypeOf(v: Object): boolean;
        propertyIsEnumerable(v: PropertyKey): boolean;
    };
    protected _wordCloudShapeTransformOption(): {
        postProjection: "StereographicProjection";
        depth_3d: number;
        constructor: Function;
        toString(): string;
        toLocaleString(): string;
        valueOf(): Object;
        hasOwnProperty(v: PropertyKey): boolean;
        isPrototypeOf(v: Object): boolean;
        propertyIsEnumerable(v: PropertyKey): boolean;
    };
    initMark(): void;
    initMarkStyle(): void;
    initAnimation(): void;
}
export declare const registerWordCloud3dSeries: () => void;
export declare const registerWordCloudShape3dSeries: () => void;
