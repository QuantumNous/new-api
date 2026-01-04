import BaseFoundation, { DefaultAdapter } from '../base/foundation';
import { RadioChangeEvent } from './radioInnerFoundation';

export interface RadioGroupAdapter extends DefaultAdapter {
    isInProps?: (name: string) => boolean;
    notifyChange?: (e: RadioChangeEvent) => void;
    setValue?: (value: any) => void
}

export default class RadioGroupFoundation extends BaseFoundation<RadioGroupAdapter> {
    constructor(adapter: RadioGroupAdapter) {
        super({ ...adapter });
    }

    init() {
        const displayValue = this._getDisplayValue();
        this._setValue(displayValue);
    }

    _getDisplayValue() {
        const { value, defaultValue } = this.getProps();
        let displayValue;

        if ('value' in this.getProps()) {
            displayValue = value;
        } else if ('defaultValue' in this.getProps()) {
            displayValue = defaultValue;
        }
        return displayValue;
    }

    handleChange(evt: any) {
        const mode = this.getProp('mode');
        const lastValue = this.getState('value');
        const { checked, value } = evt.target;
        const isControlledComponent = this._adapter.isInProps('value');

        const cbValue = {
            ...evt,
            target: {
                ...evt.target,
                value,
            }
        };

        if (mode === 'advanced' && !checked) {
            cbValue.target.value = undefined;
        }

        if (!isControlledComponent) {
            if (mode === 'advanced' && !checked) {
                this._setValue(undefined);
            } else {
                this._setValue(value);
            }
        }

        if (mode === 'advanced' || lastValue !== value) {
            this._adapter.notifyChange(cbValue);
        }
    }

    // call when prop.value change
    handlePropValueChange(propValue: any) {
        this._setValue(propValue);
    }

    _setValue(value: any) {
        this._adapter.setValue(value);
    }

    destroy() {}
}
