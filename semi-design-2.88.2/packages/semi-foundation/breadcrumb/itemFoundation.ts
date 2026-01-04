import BaseFoundation, { DefaultAdapter } from '../base/foundation';

export interface BreadcrumbItemInfo {
    name?: any; // maybe reactNode, string, number
    href?: string;
    icon?: any;
    path?: string
}

export interface Route {
    [x: string]: any;
    path?: string;
    href?: string;
    name?: string;
    icon?: any
}

export interface BreadcrumbItemAdapter<P = Record<string, any>, S = Record<string, any>> extends DefaultAdapter<P, S> {
    notifyClick: (item: BreadcrumbItemInfo, e: any) => void;
    notifyParent: (item: BreadcrumbItemInfo, e: any) => void
}

export default class BreadcrumbItemFoundation<P = Record<string, any>, S = Record<string, any>> extends BaseFoundation<BreadcrumbItemAdapter<P, S>, P, S> {

    constructor(adapter: BreadcrumbItemAdapter<P, S>) {
        super({ ...adapter });
    }

    handleClick(item: BreadcrumbItemInfo, e: any) {
        // Trigger its own onClick first, then trigger the parent
        this._adapter.notifyClick(item, e);
        this._adapter.notifyParent(item, e);
    }
}
