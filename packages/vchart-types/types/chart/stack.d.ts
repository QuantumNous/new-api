import type { IRegion } from '../region/interface';
import type { IChart } from './interface';
import type { IStackCacheRoot } from '../util';
import type { DataSet } from '@visactor/vdataset';
export declare class Stack {
    protected _chart: IChart;
    protected _options?: {
        afterStackRegion?: (region: IRegion, stackValueGroup: {
            [key: string]: IStackCacheRoot;
        }) => void;
    };
    constructor(chart: IChart, options?: {
        afterStackRegion?: (region: IRegion, stackValueGroup: {
            [key: string]: IStackCacheRoot;
        }) => void;
    });
    init(): void;
    stackAll(): void;
    stackRegion: ({ model }: {
        model: IRegion;
    }) => void;
}
export declare class StackChartMixin {
    protected _stack: Stack;
    protected _dataSet: DataSet;
    protected _beforeInit(): void;
    protected _initStack(): void;
}
