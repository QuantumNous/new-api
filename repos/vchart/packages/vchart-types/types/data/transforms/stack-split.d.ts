import type { ISeriesStackDataNode } from '../../series/interface';
import type { DataView } from '@visactor/vdataset';
export interface IStackOption {
    fields: string[];
}
export type StackOption = IStackOption | (() => IStackOption);
export declare const stackSplit: (data: Array<DataView>, op: StackOption) => ISeriesStackDataNode;
