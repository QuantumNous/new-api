import BaseFoundation, { DefaultAdapter } from '../base/foundation';

export interface RadioChangeEvent {
    target: {
        [x: string]: any;
        checked: boolean;
        value: any
    };
    stopPropagation: () => void;
    preventDefault: () => void
}

export interface RadioInnerAdapter extends DefaultAdapter {
    notifyChange?: (e: RadioChangeEvent) => void;
    setNativeControlChecked?: (checked: boolean) => void
}

export default class RadioInnerFoundation extends BaseFoundation<RadioInnerAdapter> {
    constructor(adapter: RadioInnerAdapter) {
        super({ ...adapter });
    }

    init() {
        const checked = this._adapter.getProp('checked');
        const defaultChecked = this._adapter.getProp('defaultChecked');
        this.setChecked(checked || defaultChecked);
    }

    setChecked(checked: boolean) {
        this._adapter.setNativeControlChecked(checked);
    }

    getChecked() {
        return this._adapter.getProp('checked');
    }

    handleChange(e: any) {
        const isControlledMode = 'checked' in this.getProps();
        const { checked } = e.target;

        const stopPropagation = () => {
            e.stopPropagation();
        };
        const preventDefault = () => {
            e.preventDefault();
        };
        const cbValue = {
            target: {
                ...this.getProps(),
                checked,
            },
            stopPropagation,
            preventDefault
        };
        if (isControlledMode) {
            this._adapter.notifyChange(cbValue);
        } else {
            this.setChecked(checked);
            this._adapter.notifyChange(cbValue);
        }
    }

    destroy() {}
}
