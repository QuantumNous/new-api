import BaseFoundation, { DefaultAdapter } from '../base/foundation';
import warning from '../utils/warning';

export interface SwitchAdapter<P = Record<string, any>, S = Record<string, any>> extends DefaultAdapter<P, S> {
    setNativeControlChecked: (nativeControlChecked: boolean | undefined) => void;
    setNativeControlDisabled: (nativeControlDisabled: boolean | undefined) => void;
    setFocusVisible: (focusVisible: boolean) => void;
    notifyChange: (checked: boolean, e: any) => void
}

export default class SwitchFoundation<P = Record<string, any>, S = Record<string, any>> extends BaseFoundation<SwitchAdapter<P, S>, P, S> {

    constructor(adapter: SwitchAdapter<P, S>) {
        super({ ...adapter });
    }

    init(): void {
        const { disabled } = this.getProps();
        this.setDisabled(disabled);
    }

    setChecked(checked: boolean | undefined): void {
        this._adapter.setNativeControlChecked(checked);
    }

    setDisabled(disabled: boolean | undefined): void {
        this._adapter.setNativeControlDisabled(disabled);
    }

    handleChange(checked: boolean, e: any): void {
        const propChecked = this.getProps().checked;
        const isControlledComponent = typeof propChecked !== 'undefined';
        if (isControlledComponent) {
            this._adapter.notifyChange(checked, e);
        } else {
            this._adapter.setNativeControlChecked(checked);
            this._adapter.notifyChange(checked, e);
        }
    }

    handleFocusVisible = (event: any) => {
        const { target } = event;
        try {
            if (target.matches(':focus-visible')) {
                this._adapter.setFocusVisible(true);
            }
        } catch (error) {
            warning(true, 'Warning: [Semi Switch] The current browser does not support the focus-visible');
        }
    }

    handleBlur = () => {
        this._adapter.setFocusVisible(false);
    }

    destroy(): void {}
}
