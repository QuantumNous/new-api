import BaseFoundation, { DefaultAdapter } from '../base/foundation';

export interface TableCellAdapter extends DefaultAdapter {
    notifyClick: (record: Record<string, any>, e: any) => void
}

export default class TableCellFoundation extends BaseFoundation<TableCellAdapter> {
    handleClick(e: any) {
        this._adapter.notifyClick(this.getProp('record'), e);
    }
}
