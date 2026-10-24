import type { IBaseScale } from '@visactor/vscale';
import type { CartesianAxis, ICartesianBandAxisSpec } from '../axis/cartesian';
export interface IDataFilterWithNewDomainOption {
    getNewDomain: () => any[];
    isContinuous: () => boolean;
    field: () => string;
}
export declare const lockStatisticsFilter: (statisticsData: any, op: IDataFilterWithNewDomainOption & {
    originalFields: () => Record<string, any>;
}) => any;
export declare const dataFilterWithNewDomain: (data: Array<any>, op: IDataFilterWithNewDomainOption) => any[];
export interface IDataFilterComputeDomainOption {
    input: {
        dataCollection: any[];
        stateFields: string[];
        valueFields: string[];
        isCategoryState?: boolean;
        seriesCollection: any[];
        method: 'sum';
    };
    output: {
        stateField: string;
        valueField: string;
    };
}
export declare const dataFilterComputeDomain: (data: Array<any>, op: IDataFilterComputeDomainOption) => any[];
export declare const statePointToData: (state: number, scale: IBaseScale, reverse: boolean) => any;
export declare const dataToStatePoint: (data: number | string, scale: IBaseScale, isHorizontal: boolean) => number;
export declare const isReverse: (axisComponent: CartesianAxis<any>, isHorizontal: boolean) => boolean;
export declare const getAxisBandSize: (axisSpec?: ICartesianBandAxisSpec) => {
    bandSize: number;
    maxBandSize: number;
    minBandSize: number;
};
export declare const modeCheck: (statePoint: 'start' | 'end', mode: string, spec: any) => any;
export declare const parseDomainFromState: (startValue: number | string, endValue: number | string, scale: IBaseScale) => any;
export declare const parseDomainFromStateAndValue: (start: number, startValue: number | string, end: number, endValue: number | string, scale: IBaseScale) => any;
