import BaseFoundation, { DefaultAdapter } from '../base/foundation';
import warning from '../utils/warning';

export interface RatingAdapter<P = Record<string, any>, S = Record<string, any>> extends DefaultAdapter<P, S> {
    focus: () => void;
    getStarDOM: (index: number) => Element;
    notifyHoverChange: (hoverValue: number, clearedValue: number) => void;
    updateValue: (value: number) => void;
    clearValue: (clearedValue: number) => void;
    notifyFocus: (e: any) => void;
    notifyBlur: (e: any) => void;
    notifyKeyDown: (e: any) => void;
    setEmptyStarFocusVisible: (focusVisible: boolean) => void
}

export default class RatingFoundation<P = Record<string, any>, S = Record<string, any>> extends BaseFoundation<RatingAdapter<P, S>, P, S> {

    constructor(adapter: RatingAdapter<P, S>) {
        super({ ...RatingFoundation.defaultAdapter, ...adapter });
    }

    init() {
        const { autoFocus, disabled } = this.getProps();
        if (autoFocus && !disabled) {
            this._adapter.focus();
        }
    }

    _getScroll(w: Window, top?: boolean) {
        let ret = top ? w.pageYOffset : w.pageXOffset;
        const method = top ? 'scrollTop' : 'scrollLeft';
        if (typeof ret !== 'number') {
            const d = w.document;
            // ie6,7,8 standard mode
            ret = d.documentElement[method];
            if (typeof ret !== 'number') {
                // quirks mode
                ret = d.body[method];
            }
        }
        return ret;
    }

    _getClientPosition(elem: Element) {
        let x, y;
        const doc = elem.ownerDocument;
        const { body } = doc;
        const docElem = doc && doc.documentElement;
        const box = elem.getBoundingClientRect();
        x = box.left;
        y = box.top;
        x -= docElem.clientLeft || body.clientLeft || 0;
        y -= docElem.clientTop || body.clientTop || 0;
        return {
            left: x,
            top: y,
        };
    }

    _getOffsetLeft(el: Element) {
        const pos = this._getClientPosition(el);
        const doc = el.ownerDocument;
        const w: Window = doc.defaultView || (doc as any).parentWindow;
        pos.left += this._getScroll(w);
        return pos.left;
    }

    getStarValue(index: number, pos: number) {
        const { allowHalf } = this.getProps();
        const direction = this._adapter.getContext('direction');
        const reverse = direction === 'rtl';
        let value = index + 1;
        if (allowHalf) {
            const starEle = this._adapter.getStarDOM(index);
            const leftDis = this._getOffsetLeft(starEle);
            const width = starEle.clientWidth;
            if (reverse && pos - leftDis > width / 2) {
                value -= 0.5;
            } else if (!reverse && pos - leftDis < width / 2) {
                value -= 0.5;
            }
        }
        return value;
    }

    handleHover(event: any, index: number) {
        const currValue = this.getStarValue(index, event.pageX);
        const { clearedValue, hoverValue } = this.getStates();
        if ((currValue !== hoverValue) && (currValue !== clearedValue)) {
            this._adapter.notifyHoverChange(currValue, null);
        }
    }

    handleMouseLeave() {
        this._adapter.notifyHoverChange(undefined, null);
    }

    handleClick(event: any, index: number) {
        const { allowClear } = this.getProps();
        const { value } = this.getStates();
        const newValue = this.getStarValue(index, event.pageX);
        const isReset = allowClear ? newValue === value : false;
        this._adapter.updateValue(isReset ? 0 : newValue);
        if (isReset) {
            this._adapter.notifyHoverChange(undefined, newValue);
        } else {
            this._adapter.clearValue(null);
        }
    }

    handleFocus(e: any) {
        this._adapter.notifyFocus(e);
    }

    handleBlur(e: any) {
        this._adapter.notifyBlur(e);
    }

    handleKeyDown(event: any, value: number) {
        const { key } = event;
        const { count, allowHalf } = this.getProps();
        const direction = this._adapter.getContext('direction');
        const reverse = direction === 'rtl';
        const step = allowHalf ? 0.5 : 1;
        let tempValue: number;
        let newValue: number;
        if (key === 'ArrowRight' || key === 'ArrowUp') {
            tempValue = value + (reverse ? - step : step);
        } else if (key === 'ArrowLeft' || key === 'ArrowDown') {
            tempValue = value + (reverse ? step : - step);
        }
        if (tempValue > count) {
            newValue = 0;
        } else if (tempValue < 0) {
            newValue = count;
        } else {
            newValue = tempValue;
        }
        if (['ArrowRight', 'ArrowUp', 'ArrowLeft', 'ArrowDown'].includes(key)) {
            this._adapter.notifyKeyDown(event);
            this._adapter.updateValue(newValue);
            this.changeFocusStar(newValue, event);
            event.preventDefault();
            this._adapter.notifyHoverChange(undefined, null);
        }
    }

    changeFocusStar(value: number, event: any) {
        const { count, allowHalf, preventScroll, tooltips } = this.getProps();
        const index = Math.ceil(value) - 1;
        const starElement = [...event.currentTarget.childNodes].map(item => 
            tooltips ? item.childNodes[0].childNodes[0].childNodes : item.childNodes[0].childNodes
        );
        if (index < 0) {
            starElement[count][0].focus({ preventScroll });
        } else {
            starElement[index][allowHalf ? (value * 10 % 10 === 5 ? 0 : 1) : 0].focus({ preventScroll });
        }
    }

    handleStarFocusVisible = (event: any) => {
        const { target } = event;
        const { count } = this.getProps();
        // when rating 0 is focus visible
        try {
            if (target.matches(':focus-visible')) {
                this._adapter.setEmptyStarFocusVisible(true);
            }
        } catch (error) {
            warning(true, 'Warning: [Semi Rating] The current browser does not support the focus-visible'); 
        }
    }

    // e: FocusEvent
    handleStarBlur = (e: any) => {
        const { emptyStarFocusVisible } = this.getStates();
        if (emptyStarFocusVisible) {
            this._adapter.setEmptyStarFocusVisible(false);
        } 
    }
}

export interface RatingItemAdapter<P = Record<string, any>, S = Record<string, any>> extends DefaultAdapter<P, S> {
    setFirstStarFocus: (value: boolean) => void;
    setSecondStarFocus: (value: boolean) => void
}

export class RatingItemFoundation<P = Record<string, any>, S = Record<string, any>> extends BaseFoundation<RatingItemAdapter<P, S>, P, S> {

    constructor(adapter: RatingItemAdapter<P, S>) {
        super({ ...RatingItemFoundation.defaultAdapter, ...adapter });
    }

    handleFocusVisible = (event: any, star: string) => {
        const { target } = event;
        // when rating 0 is focus visible
        try {
            if (target.matches(':focus-visible')) {
                if (star === 'first') {
                    this._adapter.setFirstStarFocus(true);
                } else {
                    this._adapter.setSecondStarFocus(true);
                }
            }
        } catch (error) {
            warning(true, 'Warning: [Semi Rating] The current browser does not support the focus-visible'); 
        }
    }

    // e: FocusEvent
    handleBlur = (e: any, star: string) => {
        const { firstStarFocus, secondStarFocus } = this.getStates();
        if (star === 'first') {
            firstStarFocus && this._adapter.setFirstStarFocus(false);
        } else {
            secondStarFocus && this._adapter.setSecondStarFocus(false);
        }
    }
}