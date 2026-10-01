import type { IData } from './../../typings/spec/common';
import { DataView } from '@visactor/vdataset';
import type { DataSet } from '@visactor/vdataset';
import type { StringOrNumber } from '../../typings';
export declare class ChartData {
    protected _dataArr: DataView[];
    get dataList(): DataView[];
    protected _dataSet: DataSet;
    constructor(dataSet: DataSet);
    parseData(dataSpec: IData): void;
    updateData(dataSpec: IData, fullUp?: boolean, forceMerge?: boolean): boolean;
    private _dataValueForEach;
    getSeriesData(id: StringOrNumber | undefined, index: number | undefined): DataView | undefined;
}
