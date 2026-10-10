import type { DataView } from '@visactor/vdataset';
import type { IWaterfallSeriesSpec } from '../../series/waterfall/interface';
import type { Datum } from '../../typings';
export interface IWaterfallOpt {
    indexField: string;
    valueField: string;
    seriesField?: string;
    startAs: string;
    endAs: string;
    total: IWaterfallSeriesSpec['total'];
    calculationMode: 'increase' | 'decrease';
    seriesFieldName: {
        total: string;
        increase: string;
        decrease: string;
    };
    stackInverse: boolean;
    groupData: () => DataView;
}
export type WaterfallOption = IWaterfallOpt | (() => IWaterfallOpt);
export declare const waterfall: (lastData: Array<Datum>, op: WaterfallOption) => Datum[];
export interface IWaterfallFillEndOpt {
    indexField: string;
    valueField: string;
    seriesField?: string;
    total: IWaterfallSeriesSpec['total'];
    calculationMode: IWaterfallSeriesSpec['calculationMode'];
}
export type WaterfallFillEndOption = IWaterfallFillEndOpt | (() => IWaterfallFillEndOpt);
export declare const waterfallFillTotal: (data: Array<Datum>, op: WaterfallFillEndOption) => Datum[];
