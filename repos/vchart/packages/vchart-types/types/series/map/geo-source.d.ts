import { DataView } from '@visactor/vdataset';
import type { GeoSourceType } from '../../typings/geo';
export interface IGeoJsonOption {
    type?: 'geojson';
    centroid?: boolean;
    simplify?: boolean | {
        tolerance: number;
    };
    rewind?: boolean | {
        reverse?: boolean;
    };
}
export interface ITopoJsonOption extends Omit<IGeoJsonOption, 'type'> {
    type: 'topojson';
    object: string;
}
export type GeoSourceOption = IGeoJsonOption | ITopoJsonOption;
export declare const geoSourceMap: Map<string, DataView>;
export declare function registerMapSource(key: string, source: GeoSourceType, option?: GeoSourceOption): void;
export declare function unregisterMapSource(key: string): void;
export declare function getMapSource(type: string): DataView;
export declare function clearMapSource(): void;
