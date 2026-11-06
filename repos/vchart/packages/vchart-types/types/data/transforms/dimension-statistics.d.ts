import type { IFieldsMeta } from '../../typings/spec';
import type { DataView } from '@visactor/vdataset';
import type { Datum } from '../../typings';
import type { IStatisticsOption, StatisticOperations } from './interface';
export declare const dimensionStatistics: (data: Array<DataView>, op: IStatisticsOption) => {};
export declare const dimensionStatisticsOfSimpleData: (latestData: Datum[], fields: {
    key: string;
    operations: StatisticOperations;
    filter?: (fv: any) => boolean;
    customize?: {
        max: number;
        min: number;
    } | any[];
}[], dataFields?: Record<string, IFieldsMeta>) => {};
