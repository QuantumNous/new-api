import BaseFoundation, { DefaultAdapter } from '../base/foundation';
import { BaseRowKeyType } from './foundation';

export interface TableRowAdapter<P = Record<string, any>, S = Record<string, any>> extends DefaultAdapter<P, S> {
    notifyClick: (rowKey: BaseRowKeyType, e: any, expand: boolean) => void;
    notifyDoubleClick: (record: Record<string, any>, e: any) => void;
    notifyMouseEnter: (record: Record<string, any>, e: any) => void;
    notifyMouseLeave: (record: Record<string, any>, e: any) => void
}

export default class TableRowFoundation<P = Record<string, any>, S = Record<string, any>> extends BaseFoundation<TableRowAdapter<P, S>, P, S> {
    handleClick(e: any) {
        const { expanded, rowKey } = this.getProps();
        this._adapter.notifyClick(rowKey, e, expanded);
    }

    handleDoubleClick(e: any) {
        this._adapter.notifyDoubleClick(this.getProp('record'), e);
    }

    handleMouseEnter(e: any) {
        const record = this.getProp('record');
        this._adapter.notifyMouseEnter(record, e);
    }

    handleMouseLeave(e: any) {
        const record = this.getProp('record');
        this._adapter.notifyMouseLeave(record, e);
    }
}
