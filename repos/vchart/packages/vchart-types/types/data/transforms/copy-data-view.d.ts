import { DataView } from '@visactor/vdataset';
export declare const copyDataView: (data: Array<DataView>, options?: ICopyDataViewOption) => any;
export interface ICopyDataViewOption {
    deep?: boolean;
}
