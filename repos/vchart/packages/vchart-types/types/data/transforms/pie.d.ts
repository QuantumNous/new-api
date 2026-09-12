import type { DataView } from '@visactor/vdataset';
import type { Datum } from '../../typings';
export interface IPieOpt {
    angleField: () => string;
    startAngle: () => number;
    endAngle: () => number;
    minAngle: () => number;
    asStartAngle: string;
    asEndAngle: string;
    asMiddleAngle: string;
    asRadian: string;
    asRatio: string;
    asQuadrant: string;
    asK: string;
    showAllZero: boolean;
    supportNegative: boolean;
    showEmptyCircle: boolean;
}
export declare const pie: (originData: Array<DataView>, op: IPieOpt) => {
    [x: string]: any;
}[];
export declare const isDataEmpty: (data: Datum[], angleField: string, supportNegative: boolean) => boolean;
