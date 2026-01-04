import BaseFoundation, { DefaultAdapter, noopFunction } from '../base/foundation';
import isEnterPress from '../utils/isEnterPress';
import warning from '../utils/warning';

export interface BasicTargetObject {
    [x: string]: any;
    checked?: boolean
}
export interface BasicCheckboxEvent {
    target: BasicTargetObject;
    stopPropagation: () => void;
    preventDefault: () => void;
    [x: string]: any
    // nativeEvent: {
    //     stopImmediatePropagation: () => void;
    // }
}
export interface CheckboxAdapter<P = Record<string, any>, S = Record<string, any>> extends DefaultAdapter<P, S> {
    getIsInGroup: () => boolean;
    getGroupValue: () => any[];
    notifyGroupChange: (e: any) => void;
    getGroupDisabled: () => boolean;
    setNativeControlChecked: (checked: boolean) => void;
    getState: noopFunction;
    notifyChange: (e: any) => void;
    setAddonId: () => void;
    setExtraId: () => void;
    setFocusVisible: (focusVisible: boolean) => void;
    focusCheckboxEntity: () => void;
    generateEvent: (checked: boolean, e: any) => any // 1.modify checked value 2.add nativeEvent on react adapter
}

class CheckboxFoundation<P = Record<string, any>, S = Record<string, any>> extends BaseFoundation<CheckboxAdapter<P, S>, P, S> {

    constructor(adapter: CheckboxAdapter<P, S>) {
        super({ ...adapter });
    }

    clickState = false;

    init() {
        const { children, extra, extraId, addonId } = this.getProps();
        if (children && !addonId) {
            this._adapter.setAddonId();
        }
        if (extra && !extraId) {
            this._adapter.setExtraId();
        }
    }

    notifyChange(checked: boolean, e: any) {
        const cbValue = this._adapter.generateEvent(checked, e);
        this._adapter.notifyChange(cbValue);
    }

    handleChange(e: any) {
        const disabled = this.getProp('disabled');

        if (disabled) {
            return;
        }

        if (e?.type === 'click') {
            this.clickState = true;
        }

        this._adapter.focusCheckboxEntity();

        const isInGroup = this._adapter.getIsInGroup();

        if (isInGroup) {
            const groupDisabled = this._adapter.getGroupDisabled();
            if (!groupDisabled) {
                this.handleChangeInGroup(e);
            }
            return;
        }

        const checked = this.getState('checked');

        const newChecked = !checked;
        if (this._isControlledComponent('checked')) {
            this.notifyChange(newChecked, e);
        } else {
            this.setChecked(newChecked);
            this.notifyChange(newChecked, e);
        }
    }

    handleChangeInGroup(e: any) {
        const { value } = this.getProps();
        const groupValue = this._adapter.getGroupValue();
        const checked = groupValue.includes(value);
        const newChecked = !checked;
        const event = this._adapter.generateEvent(newChecked, e);
        this._adapter.notifyChange(event);
        this._adapter.notifyGroupChange(event);
    }

    handleEnterPress(e: any) {
        if (isEnterPress(e)) {
            this.handleChange(e);
        }
    }

    setChecked(checked: boolean) {
        this._adapter.setNativeControlChecked(checked);
    }

    handleFocusVisible = (event: any) => {
        const { target } = event;
        try {
            if (this.clickState) {
                this.clickState = false;
                return;
            } 
            if (target.matches(':focus-visible')) {
                this._adapter.setFocusVisible(true);
            }
        } catch (error) {
            warning(true, 'Warning: [Semi Checkbox] The current browser does not support the focus-visible');
        }
    }

    handleBlur = () => {
        this.clickState = false;
        this._adapter.setFocusVisible(false);
    }

    destroy() {}
}

export interface BaseCheckboxProps {
    id?: string;
    autoFocus?: boolean;
    checked?: boolean;
    defaultChecked?: boolean;
    disabled?: boolean;
    indeterminate?: boolean;
    onChange?: (e: any) => any;
    value?: any;
    style?: Record<string, any>;
    className?: string;
    prefixCls?: string;
    onMouseEnter?: (e: any) => void;
    onMouseLeave?: (e: any) => void;
    extra?: any;
    addonId?: string;
    extraId?: string;
    preventScroll?: boolean
}

export default CheckboxFoundation;
