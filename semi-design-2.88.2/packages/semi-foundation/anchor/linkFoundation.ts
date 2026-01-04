import BaseFoundation, { DefaultAdapter } from '../base/foundation';
import { AnchorAdapter } from './foundation';

export interface LinkAdapter extends DefaultAdapter {
    addLink: AnchorAdapter['addLink'];
    removeLink: AnchorAdapter['removeLink']
}

export default class LinkFoundation extends BaseFoundation<LinkAdapter> {

    constructor(adapter: LinkAdapter) {
        super({ ...adapter });
    }

    init() {
        // this.setInitValue();
    }

    destroy() {}

    handleAddLink() {
        const href = this._adapter.getProp('href');
        this._adapter.addLink(href);
    }

    handleUpdateLink(href: string, prevHref: string) {
        if (href !== prevHref) {
            this._adapter.removeLink(prevHref);
            this._adapter.addLink(href);
        }
    }

    handleRemoveLink() {
        const href = this._adapter.getProp('href');
        this._adapter.removeLink(href);
    }
}
