import type { DataView } from '@visactor/vdataset';
export interface IBoxPlotOutlierOpt {
    dimensionField: string[];
    outliersField: string;
    seriesField?: string;
}
type BoxPlotOutlierOption = IBoxPlotOutlierOpt | (() => IBoxPlotOutlierOpt);
export declare const foldOutlierData: (data: Array<DataView>, op: BoxPlotOutlierOption) => Record<string, unknown>[];
export {};
