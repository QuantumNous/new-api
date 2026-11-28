import type { DataView } from '@visactor/vdataset';
import type { StringOrNumber } from '../../typings';
import type { IOption, IOptionAggr, IOptionCallback, IOptionWithCoordinates } from './interface';
export declare const markerMin: (_data: Array<DataView>, opt: IOption) => number;
export declare const markerMax: (_data: Array<DataView>, opt: IOption) => number;
export declare function markerSum(_data: Array<DataView>, opt: IOption): number;
export declare function markerAverage(_data: Array<DataView>, opt: IOption): number;
export declare function markerVariance(_data: Array<DataView>, opt: IOption): number;
export declare function markerStandardDeviation(_data: Array<DataView>, opt: IOption): number;
export declare function markerMedian(_data: Array<DataView>, opt: IOption): number;
export declare function markerAggregation(_data: Array<DataView>, options: IOptionWithCoordinates | IOptionAggr[]): {
    x: StringOrNumber[] | StringOrNumber | IOptionCallback | null;
    y: StringOrNumber[] | StringOrNumber | IOptionCallback | null;
    angle: StringOrNumber[] | StringOrNumber | IOptionCallback | null;
    radius: StringOrNumber[] | StringOrNumber | IOptionCallback | null;
    areaName: string | IOptionCallback | null;
}[];
