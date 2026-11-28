import type { DataSet, DataView } from '@visactor/vdataset';
export interface IGroup {
    fields?: string[];
    groupData?: DataView;
    initData?: (viewData: DataView, dataSet: DataSet) => void;
    groupDataUpdate?: () => void;
    getGroupValueInField?: (field: string) => any[];
}
