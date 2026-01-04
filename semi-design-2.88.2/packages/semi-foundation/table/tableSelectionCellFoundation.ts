import BaseFoundation, { DefaultAdapter } from '../base/foundation';

export interface TableSelectionCellEvent {
    [x: string]: any;
    target?: {
        checked?: boolean
    }
}
export interface TableSelectionCellAdapter extends DefaultAdapter {
    notifyChange: (value: any, e: TableSelectionCellEvent) => void
}

export default class TableSelectionCellFoundation extends BaseFoundation<TableSelectionCellAdapter> {
    handleChange(e: TableSelectionCellEvent) {
        const value = e.target.checked;
        this._adapter.notifyChange(value, e);
    }
}
