import BaseFoundation, { DefaultAdapter } from '../base/foundation';


export interface SpinAdapter extends Partial<DefaultAdapter> {
    setLoading: (val: boolean) => void
}

class SpinFoundation extends BaseFoundation<SpinAdapter> {
    _timer: ReturnType<typeof setTimeout>;

    static get spinDefaultAdapter(): SpinAdapter {
        return {
            getProp: () => undefined,
            setLoading: val => undefined
        };
    }

    constructor(adapter: SpinAdapter) {
        super({ ...SpinFoundation.spinDefaultAdapter, ...adapter });
    }

    updateLoadingIfNeedDelay() {
        const { spinning: propsSpinning, delay: propsDelay } = this._adapter.getProps();
        const { delay } = this._adapter.getStates();
        if (delay) {
            const self = this;
            this._timer = setTimeout(() => {
                self._adapter.setState({
                    loading: propsSpinning,
                    delay: 0
                });
            }, propsDelay);
        }
    }

    destroy() {
        if (this._timer) {
            clearTimeout(this._timer);
            this._timer = null;
        }
    }
}

export default SpinFoundation;
