import BaseFoundation, { DefaultAdapter } from '../base/foundation';
import isEnterPress from '../utils/isEnterPress';
import { BreadcrumbItemInfo, Route } from './itemFoundation';
export interface BreadcrumbAdapter<P = Record<string, any>, S = Record<string, any>> extends DefaultAdapter<P, S> {
    notifyClick: (itemInfo: BreadcrumbItemInfo, event: any) => void;
    expandCollapsed: (clickEvent?: any) => void
}

export default class BreadcrumbFoundation<P = Record<string, any>, S = Record<string, any>> extends BaseFoundation<BreadcrumbAdapter<P, S>, P, S> {

    constructor(adapter: BreadcrumbAdapter<P, S>) {
        super({ ...adapter });
    }

    handleClick(info: BreadcrumbItemInfo, event: any) {
        this._adapter.notifyClick(info, event);
    }

    handleExpand(clickEvent: any) {
        this._adapter.expandCollapsed(clickEvent);
    }

    /**
     * A11y: simulate clear button click
     */
    handleExpandEnterPress(keyboardEvent: any) {
        if (isEnterPress(keyboardEvent)) {
            this.handleExpand(keyboardEvent);
        }
    }

    genRoutes(routes: Array<Route>) {
        return routes.map(route => {
            if (typeof route !== 'object') {
                return {
                    name: route,
                    _origin: {
                        name: route
                    }
                };
            }
            let config: Record<string, any> = {};
            config._origin = route;
            return { ...config, ...route };
        });
    }
}