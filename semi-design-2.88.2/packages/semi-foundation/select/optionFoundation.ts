import BaseFoundation, { DefaultAdapter } from '../base/foundation';


export interface BasicOptionProps {
    [x: string]: any;
    value?: string | number;
    label?: string | number | unknown;
    children?: unknown;
    disabled?: boolean;
    showTick?: boolean;
    className?: string;
    style?: Record<string, any>
}
export interface OptionDefaultAdapter extends Partial<DefaultAdapter> {
    notifyClick(option: BasicOptionProps): void
}


export default class OptionFoundation extends BaseFoundation<OptionDefaultAdapter> {

    constructor(adapter: OptionDefaultAdapter) {
        super({ ...adapter });
    }

    init() {}

    destroy() {}

    onOptionClick(option: BasicOptionProps) {
        const isDisabled = this._isDisabled();
        if (!isDisabled) {
            this._adapter.notifyClick(option);
        }
    }

    _isDisabled() {
        return this.getProp('disabled');
    }
}