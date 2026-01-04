import BaseFoundation, { DefaultAdapter } from '../base/foundation';

export interface BannerAdapter<P = Record<string, any>, S = Record<string, any>> extends DefaultAdapter<P, S> {
    setVisible: () => void;
    notifyClose: (e: any) => void
}

export default class BannerFoundation<P = Record<string, any>, S = Record<string, any>> extends BaseFoundation<BannerAdapter<P, S>, P, S> {

    constructor(adapter: BannerAdapter<P, S>) {
        super({ ...BannerFoundation.defaultAdapter, ...adapter });
    }

    removeBanner(e: any) {
        this._adapter.notifyClose(e);
        this._adapter.setVisible();
    }
}
