import type { DataView } from '@visactor/vdataset';
type FunnelOptionValue<T> = T | (() => T);
export interface IFunnelOpt {
    valueField: FunnelOptionValue<string>;
    asTransformRatio: string;
    asReachRatio: string;
    asHeightRatio: string;
    asValueRatio: string;
    asLastValueRatio: string;
    asNextValueRatio: string;
    asCurrentValue: string;
    asLastValue: string;
    asNextValue: string;
    isCone?: FunnelOptionValue<boolean | undefined>;
    heightVisual?: FunnelOptionValue<boolean | undefined>;
    range?: FunnelOptionValue<{
        min?: number;
        max?: number;
    } | undefined>;
}
export declare const funnel: (originData: Array<DataView>, op: IFunnelOpt) => {
    dataSet: import("@visactor/vdataset").DataSet;
    options?: import("@visactor/vdataset").IDataViewOptions;
    isDataView: boolean;
    type: import("@visactor/vdataset/es/constants").DATAVIEW_TYPE;
    name: string | number;
    target: any;
    parseOption: import("@visactor/vdataset").IParserOptions;
    transformsArr: import("@visactor/vdataset").ITransformOptions[];
    isRunning: boolean;
    rawData: any;
    history: boolean;
    historyData: any[];
    parserData: any;
    latestData: any;
    latestDataAUD: {
        add: any;
        update: any;
        del: any;
    };
    reRunAllTransform: (opt?: import("@visactor/vdataset/es/data-view").DataViewTransformOptions) => DataView;
    markRunning: () => void;
}[];
export interface IFunnelTransformOpt {
    asIsTransformLevel: string;
}
export declare const funnelTransform: (originData: Array<DataView>, op: IFunnelTransformOpt) => Record<string, unknown>[];
export {};
