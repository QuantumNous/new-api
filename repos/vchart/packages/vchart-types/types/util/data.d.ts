import type { DataView } from '@visactor/vdataset';
import type { StatisticOperations } from '../data/transforms/interface';
import type { ISeries, ISeriesStackDataMeta } from '../series/interface';
import type { IRegion } from '../region/interface';
export declare function mergeFields(targetFields: {
    key: string;
    operations: StatisticOperations;
}[], mergeFields: {
    key: string;
    operations: StatisticOperations;
}[]): {
    key: string;
    operations: StatisticOperations;
}[];
export declare function getFieldAlias(dataView: DataView, field: string): any;
export interface IStackCacheNode {
    groupField?: string;
    values: any[];
    series: {
        s: ISeries;
        values: any[];
    }[];
    sortDatums: {
        datum: any;
        index: number;
        series: ISeries;
    }[];
    nodes: {
        [key: string]: IStackCacheNode;
    };
    key: string;
    total?: number;
}
export interface IStackCacheRoot {
    groupField?: string;
    total?: number;
    nodes: {
        [key: string]: IStackCacheNode;
    };
}
export interface IStackSortCache {
    [key: string]: {
        lastIndex: number;
        sort: {
            [key: string]: number;
        };
    };
}
export declare function getRegionStackGroup(region: IRegion, setInitialValue: boolean, filter?: (s: any) => boolean): {
    [key: string]: IStackCacheRoot;
};
export declare function sortStackValueGroup(stackValueGroup: {
    [key: string]: IStackCacheNode;
}, stackSortCache: IStackSortCache): {
    [key: string]: IStackCacheNode;
};
export declare function stackTotal(stackData: IStackCacheNode, valueField: string): void;
export interface IMosaicData {
    groupField?: string;
    groupValue?: string;
    value?: number;
    end?: number;
    start?: number;
    startPercent?: number;
    endPercent?: number;
}
export declare function stackMosaicTotal(stackData: IStackCacheNode, valueField: string): void;
export declare function stackMosaic(s: ISeries, stackCache: IStackCacheNode, mosaicData?: IMosaicData[]): void;
export declare function stackOffsetSilhouette(stackCache: IStackCacheNode): void;
export declare function stack(stackCache: IStackCacheNode, stackInverse: boolean, hasPercent?: boolean, hasMinMax?: boolean, fields?: {
    key: string;
    start: string;
    end: string;
    startPercent: string;
    endPercent: string;
    min?: string;
    max?: string;
}): void;
export declare function stackGroup(s: ISeries, stackData: ISeriesStackDataMeta, stackCache: IStackCacheNode, valueField: string, setInitialValue: boolean, stackSortCache: IStackSortCache, stackKey?: string): void;
