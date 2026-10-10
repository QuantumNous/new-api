import { DataSet, DataView } from '@visactor/vdataset';
import type { IGroup } from '../../typings';
export declare class Group implements IGroup {
    protected _fields: string[];
    get fields(): string[];
    protected _groupData?: DataView;
    get groupData(): DataView;
    constructor(fields: string[]);
    initData(viewData: DataView, dataSet: DataSet): void;
    groupDataUpdate(): void;
    getGroupValueInField(field: string): unknown[];
}
