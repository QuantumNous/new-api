import type { DataView } from '@visactor/vdataset';
import type { IGrammarItem } from '../interface';
import type { ICompilableMark } from '../mark';
export interface ICompilableData extends IGrammarItem {
    getDataView: () => DataView;
    setDataView: (d?: DataView) => void;
    getProduct: () => any;
    updateData: (noRender?: boolean) => void;
    getLatestData: () => any;
    addRelatedMark: (mark: ICompilableMark) => void;
}
