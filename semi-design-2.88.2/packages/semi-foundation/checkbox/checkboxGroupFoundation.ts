import BaseFoundation, { DefaultAdapter } from '../base/foundation';
import warning from '../utils/warning';
import { BasicCheckboxEvent } from './checkboxFoundation';

export interface CheckboxGroupAdapter extends DefaultAdapter{
    updateGroupValue: (value: any[]) => void;
    notifyChange: (value: any[]) => void
}
class CheckboxGroupFoundation extends BaseFoundation<CheckboxGroupAdapter> {
    static get checkboxGroupDefaultAdapter() {
        return {};
    }

    constructor(adapter: CheckboxGroupAdapter) {
        super({ ...CheckboxGroupFoundation.checkboxGroupDefaultAdapter, ...adapter });
    }

    init() {
        const { defaultValue, value } = this.getProps();
        if (typeof defaultValue !== 'undefined' && !Array.isArray(defaultValue)) {
            warning(true, 'Warning: [Semi CheckboxGroup] defaultValue should be an Array');
        }

        if (typeof value !== 'undefined' && !Array.isArray(value)) {
            warning(true, 'Warning: [Semi CheckboxGroup] value should be an Array');
        }
    }

    notifyChange(value: any[]) {
        this._adapter.notifyChange(value);
    }

    handleChange(evt: BasicCheckboxEvent) {
        const prevValue: any[] = this.getState('value');
        let newValue = [];

        if (!Array.isArray(prevValue)) {
            newValue = [prevValue];
        }

        if (evt.target.checked) {
            newValue = [...prevValue, evt.target.value];
        } else {
            newValue = prevValue.filter((itm, idx) => itm !== evt.target.value);
        }

        const isControlledMode = 'value' in this.getProps();

        if (isControlledMode) {
            // Controlled mode only needs to notify
            this.notifyChange(newValue);
        } else {
            // In uncontrolled mode, update the value in the state, and then notify
            this._adapter.updateGroupValue(newValue);
            this.notifyChange(newValue);
        }
    }

    getFormatName() {
        const propName = this.getProp('name');
        const defaultName = 'default';
        return propName || defaultName;
    }

    handlePropValueChange(newPropValue: any[]) {
        if (Array.isArray(newPropValue)) {
            this._adapter.updateGroupValue(newPropValue);
        } else {
            // to adjust reset in Form.CheckboxGroup
            if (typeof newPropValue === 'undefined') {
                this._adapter.updateGroupValue([]);
            }
            warning(true, 'Warning: [Semi CheckboxGroup] value should be an Array');
        }
    }

    destroy() {}
}

export default CheckboxGroupFoundation;
