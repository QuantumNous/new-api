import type { Datum } from '../../typings/common';
export declare const dataSampling: (options: {
    size: number | (() => number);
    factor?: number;
    skipfirst?: boolean;
    yfield?: string;
    groupBy?: string;
    mode?: 'lttb' | 'min' | 'max' | 'average' | 'sum';
}, upstreamData: Datum[]) => Datum[];
export declare const registerDataSamplingTransform: () => void;
