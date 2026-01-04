import BaseFoundation, { DefaultAdapter } from '../base/foundation';
import isNullOrUndefined from '../utils/isNullOrUndefined';

export interface TimeInputAdapter extends DefaultAdapter{
    notifyChange: (e: any) => void;
    notifyFocus: (e: any) => void;
    notifyBlur: (e: any) => void
}

class TimePickerFoundation extends BaseFoundation<TimeInputAdapter> {

    constructor(adapter: TimeInputAdapter) {
        super({ ...adapter });
    }

    init() {}

    destroy() {}

    handleFocus(e: any) {
        this.storeCursor();
        this._adapter.notifyFocus(e);
    }

    handleChange(v: string) {
        this.storeCursor();
        this._adapter.notifyChange(v);
    }

    handleBlur(e: any) {
        this.clearCursor();
        this._adapter.notifyBlur(e);
    }

    storeCursor() {
        const inputNode = this.getCache('inputNode');
        if (inputNode) {
            const { selectionStart: start } = inputNode;

            // const beforeStr = typeof value === 'string' ? value.substr(0, start) : null;
            // const afterStr = typeof value === 'string' ? value.substr(start, value.length - start + 1) : null;

            // console.log(start, beforeStr, afterStr);

            this.setCache('cursorIndex', start);
        }
    }

    restoreCursor() {
        const inputNode = this.getCache('inputNode');
        const cursorIndex = this.getCache('cursorIndex');
        if (inputNode && !isNullOrUndefined(cursorIndex)) {
            inputNode.selectionStart = cursorIndex;
            inputNode.selectionEnd = cursorIndex;
        }
    }

    clearCursor() {
        this.setCache('cursorIndex', null);
        this.setCache('beforeStr', null);
        this.setCache('afterStr', null);
    }
}

export default TimePickerFoundation;
