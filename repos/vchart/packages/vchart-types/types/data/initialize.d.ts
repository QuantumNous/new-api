import { DataSet, DataView } from '@visactor/vdataset';
import type { IDataViewOptions } from '@visactor/vdataset';
import type { IDataValues } from '../typings/spec/common';
export declare function initializeData(): void;
export declare function initCSVData(): void;
export declare function initData(): void;
export declare function initFoldData(): void;
export declare function dataViewFromDataView(rawData: DataView, dataSet?: DataSet, op?: IDataViewOptions): DataView;
export declare function dataToDataView(data: DataView | IDataValues, dataSet: DataSet, sourceDataViews?: DataView[]): DataView;
export declare function updateDataViewInData(dataView: DataView, data: IDataValues, forceMerge: boolean): void;
export declare enum TransformLevel {
    copyDataView = -10,
    treemapFilter = -8,
    treemapFlatten = -7,
    dotObjFlat = -7,
    linkDotInfo = -7,
    sankeyLayout = -7,
    dataZoomFilter = -6,
    legendFilter = -5
}
