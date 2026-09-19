import type { DataView } from '@visactor/vdataset';
export interface IDimensionTreeOpt {
    fields: string[];
}
export declare const dimensionTree: (data: Array<DataView>, op: IDimensionTreeOpt) => DataView[] | {
    dimensionValues: {};
    dimensionData: any;
};
export declare function mapValues(target: object, fn: (value: any, key: string) => any): {};
export declare function findDataInFields(data: any, fields: string[]): any;
