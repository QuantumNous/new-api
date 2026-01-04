import BaseFoundation, { DefaultAdapter } from '../base/foundation';
import touchEventPolyfill from '../utils/touchPolyfill';
import warning from '../utils/warning';
import { handlePrevent } from '../utils/a11y';

export interface Marks{
    [key: number]: string
}

export type tipFormatterBasicType = string | number | boolean | null;

export interface SliderProps{
    defaultValue?: number | number[];
    disabled?: boolean;
    showMarkLabel?: boolean;
    included?: boolean; // Whether to juxtapose. Allow dragging
    marks?: Marks; // Scale
    max?: number;
    min?: number;
    range?: boolean; // Whether both sides
    step?: number;
    tipFormatter?: (value: tipFormatterBasicType | tipFormatterBasicType[]) => any;
    value?: number | number[];
    vertical?: boolean;
    onAfterChange?: (value: SliderProps['value']) => void; // triggered when mouse up and clicked
    onChange?: (value: SliderProps['value']) => void;
    onMouseUp?: (e: any) => void;
    tooltipOnMark?: boolean;
    tooltipVisible?: boolean;
    style?: Record<string, any>;
    showArrow?: boolean; 
    className?: string;
    showBoundary?: boolean;
    railStyle?: Record<string, any>;
    verticalReverse?: boolean;
    'aria-label'?: string;
    'aria-labelledby'?: string;
    'aria-valuetext'?: string;
    getAriaValueText?: (value: number, index?: number) => string;
    handleDot?: {
        size?: string;
        color?: string
    } | ({
        size?: string;
        color?: string
    }[])
}

export interface SliderState {
    currentValue: number | number[];
    min: number;
    max: number;
    focusPos: 'min' | 'max' | '';
    onChange: (value: SliderProps['value']) => void;
    disabled: SliderProps['disabled'];
    chooseMovePos: 'min' | 'max' | '';
    isDrag: boolean;
    clickValue: 0;
    showBoundary: boolean;
    isInRenderTree: boolean;
    firstDotFocusVisible: boolean;
    secondDotFocusVisible: boolean
}

export interface SliderLengths{
    sliderX: number;
    sliderY: number;
    sliderWidth: number;
    sliderHeight: number
}

export interface ScrollParentVal{
    scrollTop: number;
    scrollLeft: number
}

export interface OverallVars{
    dragging: boolean[]
}

export interface SliderAdapter extends DefaultAdapter<SliderProps, SliderState>{
    getSliderLengths: () => SliderLengths;
    getParentRect: () => DOMRect | void;
    getScrollParentVal: () => ScrollParentVal;
    isEventFromHandle: (e: any) => boolean;
    getOverallVars: () => OverallVars;
    updateDisabled: (disabled: SliderState['disabled']) => void;
    transNewPropsToState: <K extends keyof SliderState>(stateObj: Pick<SliderState, K>, callback?: () => void) => void;
    notifyChange: (callbackValue: number | number[]) => void;
    setDragging: (value: boolean[]) => void;
    updateCurrentValue: (value: SliderState['currentValue']) => void;
    setOverallVars: (key: string, value: any) => void;
    getMinHandleEl: () => HTMLSpanElement;
    getMaxHandleEl: () => HTMLSpanElement;
    onHandleDown: (e: any) => any;
    onHandleMove: (mousePos: number, isMin: boolean, stateChangeCallback?: () => void, clickTrack?: boolean, outPutValue?: number | number[]) => boolean | void;
    setEventDefault: (e: any) => void;
    setStateVal: (state: keyof SliderState, value: any) => void;
    onHandleEnter: (position: SliderState['focusPos']) => void;
    onHandleLeave: () => void;
    onHandleUpBefore: (e: any) => void;
    onHandleUpAfter: () => void;
    unSubscribeEventListener: () => void;
    checkAndUpdateIsInRenderTreeState: () => boolean
}

export default class SliderFoundation extends BaseFoundation<SliderAdapter> {
    private _dragOffset: number;

    constructor(adapter: SliderAdapter) {
        super({ ...SliderFoundation.defaultAdapter, ...adapter });
    }

    init() {
        this._checkCurrentValue();
        this._dragOffset = 0;
    }

    _checkCurrentValue() {
        const { currentValue, min, max } = this.getStates();
        let checked;
        if (Array.isArray(currentValue)) {
            checked = [];
            checked[0] = this._checkValidity(currentValue[0], min, max);
            checked[1] = this._checkValidity(currentValue[1], min, max);
        } else {
            checked = this._checkValidity(currentValue, min, max);
        }
        this._adapter.updateCurrentValue(checked);
    }

    /**
     * Untie event
     * @memberof SliderFoundation
     */
    destroy() {
        // debugger
        this._adapter.unSubscribeEventListener();
    }

    /**
     * Calculate the percentage corresponding to the current value for style calculation
     * @{}
     *
     * @memberof SliderFoundation
     */
    getMinAndMaxPercent = (value: number | number[]) => {
        // debugger
        const { range, min, max } = this._adapter.getProps();
        const minPercent = range ? (value[0] - min) / (max - min) : (value as number - min) / (max - min);
        const maxPercent = range ? (value[1] - min) / (max - min) : 1;
        return { min: this._checkValidity(minPercent), max: this._checkValidity(maxPercent) };
    };

    /**
     * Check if value is out of range
     * @memberof SliderFoundation
     */
    _checkValidity = (value: number, min = 0, max = 1) => {
        const checked = value > max ?
            max :
            value < min ?
                min :
                value;
        return checked;
    };


    /**
     * When render handle, the display and content of the tooltip are calculated according to the conditions
     * @visible:  props passed in by the component
     * @formatter: tooltip content formatting function
     * @memberof SliderFoundation
     */
    computeHandleVisibleVal = (visible: SliderProps['tooltipVisible'], formatter: SliderProps['tipFormatter'], range: SliderProps['range']) => {
        // debugger;
        const { focusPos, currentValue } = this._adapter.getStates();
        const tipVisible = { min: false, max: false };
        let tipChildren;
        if (formatter) {
            tipChildren = {
                min: range ?
                    formatter(this.outPutValue(currentValue[0])) :
                    formatter(this.outPutValue(currentValue)),
                max: range ? formatter(this.outPutValue(currentValue[1])) : null,
            };
        } else {
            tipChildren = {
                min: range ? this.outPutValue(currentValue[0]) : this.outPutValue(currentValue),
                max: range ? this.outPutValue(currentValue[1]) : null,
            };
        }

        if (visible) {
            tipVisible.min = true;
            tipVisible.max = true;
        } else if (typeof visible === 'undefined' && formatter) {
            if (focusPos === 'min') {
                tipVisible.min = true;
            } else if (focusPos === 'max') {
                tipVisible.max = true;
            }
        }
        const result = {
            tipVisible,
            tipChildren,
        };
        return result;
    };

    /**
     * Calculate whether the value passed in is valid
     *
     * @memberof SliderFoundation
     */
    valueFormatIsCorrect = (value: SliderProps['value']) => {
        if (Array.isArray(value)) {
            return typeof value[0] === 'number' && typeof value[0] === 'number';
        } else {
            return typeof value === 'number';
        }
    };


    /**
     * Fix the mouse position to position the parent container relative to the position
     *
     * @memberof SliderFoundation
     */
    handleMousePos = (clientX: number, clientY: number) => {
        const parentRect = this._adapter.getParentRect();
        const parentX = parentRect ? parentRect.left : 0;
        const parentY = parentRect ? parentRect.top : 0;
        return { x: clientX - parentX, y: clientY - parentY };
    };

    /**
     * Provides the nearest scrollable parent node of the current node, which is used to calculate the scrollTop and scrollLeft attributes
     *
     * @memberof SliderFoundation
     */
    getScrollParent = (element: HTMLElement) => {
        // TODO: move window document out of foundation.
        const el = element;
        const regex = /(auto|scroll)/;

        const style = (node: Element, prop: string) => window.getComputedStyle(node, null).getPropertyValue(prop);

        const scroll = (node: Element) => regex.test(style(node, 'overflow') + style(node, 'overflow-y') + style(node, 'overflow-x'));

        const scrollParent = (node: Element): Element => (
            !node || (node === document.body || !(node instanceof Element)) ? document.body : scroll(node) ? node : scrollParent(node.parentNode as Element)
        );

        return scrollParent(el);
    };

    /**
     * Fixed the event location, beyond the maximum, minimum, left and right, etc. directly modified to the effective location
     *
     * @memberof SliderFoundation
     */
    checkMeetMinMax = (position: number) => {

        // Returns the length of the distance to the left
        const { vertical, verticalReverse, range } = this._adapter.getProps();
        const value = this._adapter.getState('currentValue');
        const currentPos = this.transValueToPos(value);
        const { sliderX, sliderY, sliderWidth, sliderHeight } = this._adapter.getSliderLengths();
        const { chooseMovePos, isDrag } = this._adapter.getStates();
        const len = vertical ? sliderHeight : sliderWidth;
        let startPos;
        if (vertical && verticalReverse) {
            startPos = sliderY + len;
        } else {
            startPos = vertical ? sliderY : sliderX;
        }
        //  startPos = chooseMovePos === 'max' && isDrag ? currentPos[0] : startPos;
        let endPos;
        if (vertical && verticalReverse) {
            endPos = sliderY;
        } else {
            endPos = vertical ? sliderY + sliderHeight : sliderX + sliderWidth;
        }
        //   endPos = chooseMovePos === 'min' && isDrag && range ? currentPos[1] : endPos;


        if (vertical && verticalReverse) {
            if (position >= startPos) {
                position = startPos;
            } else if (position <= endPos) {
                position = endPos;
            }
        } else {
            if (position <= startPos) {
                position = startPos;
            } else if (position >= endPos) {
                position = endPos;
            }
        }
        return position;
    };

    /**
     * Converting location information to value requires processing if step is not 1 (invalid move returns false)
     *
     * @memberof SliderFoundation
     */
    transPosToValue = (mousePos: number, isMin: boolean) => {
        const pos = this.checkMeetMinMax(mousePos);
        const { min, max, currentValue } = this._adapter.getStates();
        const { range, vertical, step, verticalReverse } = this._adapter.getProps();
        const { sliderX, sliderY, sliderWidth, sliderHeight } = this._adapter.getSliderLengths();
        const startPos = vertical ? sliderY : sliderX;
        const len = vertical ? sliderHeight : sliderWidth;
        let stepValue;
        if (vertical && verticalReverse) {
            //isMin = !isMin;
            stepValue = ((startPos + len - pos) / len) * (max - min) + min;
        } else {
            stepValue = ((pos - startPos) / len) * (max - min) + min;
        }
        let compareValue;
        if (range) {
            compareValue = isMin ? currentValue[0] : currentValue[1];
        } else {
            compareValue = currentValue;
        }
        if (step !== 1) { // Find nearest step point
            stepValue = Math.round(stepValue / step) * step;
        }
        if (range && stepValue !== compareValue) {
            return isMin ? [stepValue, currentValue[1]] : [currentValue[0], stepValue];

        } else if (!range && stepValue !== compareValue) {
            return (stepValue);
        } else {
            return false;
        }
    };

    /**
     * Convert value values into location information
     *
     * @memberof SliderFoundation
     */
    transValueToPos = (value: SliderProps['value']) => {
        const { min, max } = this._adapter.getStates();
        const { vertical, range, verticalReverse } = this._adapter.getProps();
        const { sliderX, sliderY, sliderWidth, sliderHeight } = this._adapter.getSliderLengths();
        const startPos = vertical ? sliderY : sliderX;
        const len = vertical ? sliderHeight : sliderWidth;
        if (range) {
            return [((value[0] - min) * len) / (max - min) + startPos, ((value[1] - min) * len) / (max - min) + startPos];
        } else {
            return ((value as number - min) * len) / (max - min) + startPos;
        }
    };

    /**
     * Determine whether the mark should be highlighted: valid interval and include = false
     *
     * @memberof SliderFoundation
     */
    isMarkActive = (mark: number) => {
        const { min, max, range, included } = this._adapter.getProps();
        const currentValue = this._adapter.getState('currentValue');
        if (typeof (mark / 1) === 'number' && mark >= min && mark <= max) {
            if (range) {
                return (mark > currentValue[1] || mark < currentValue[0]) && included ? 'unActive' : 'active';
            } else {
                return mark <= currentValue && included ? 'active' : 'unActive';
            }
        } else {
            return false;
        }
    };

    /**
     * onchange output conversion, default rounding without decimal, step less than 1 has decimal
     *
     * @memberof SliderFoundation
     */
    outPutValue = (inputValue: SliderProps['value']) => {
        const checkHowManyDecimals = (num: number) => {
            const reg = /^\d+(\.\d+)?$/;
            if (reg.test(String(num))) {
                return num.toString().split('.')[1]?.length ?? 0;
            }
            return 0;
        };
        const step = this._adapter.getProp('step');
        const transWay = (() => {
            const decimals = checkHowManyDecimals(step);
            const multipler = Math.pow(10, decimals);
            return (value: number) => {
                return Math.round(value * multipler) / multipler;
            };
        })();
        
        if (Array.isArray(inputValue)) {
            const min = transWay(inputValue[0]);
            const max = transWay(inputValue[1]);
            if (min > max) {
                return this.getState("focusPos") === "min" ? [max, max] : [min, min];
            }
            return [min, max];
        } else {
            return transWay(inputValue);
        }
    };

    handleDisabledChange = (disabled: SliderState['disabled']) => {
        this._adapter.updateDisabled(disabled);
    };

    checkAndUpdateIsInRenderTreeState = () => this._adapter.checkAndUpdateIsInRenderTreeState();

    calculateOutputValue = (position: number, isMin: boolean): undefined | number | number[] => {
        const moveValue = this.transPosToValue(position, isMin);
        if (moveValue === false) {
            return undefined;
        }
        return this.outPutValue(moveValue);
    }

    /**
     *
     *
     * @memberof SliderFoundation
     */
    handleValueChange = (prevValue: SliderProps['value'], nextValue: SliderProps['value']) => {
        const { min, max } = this._adapter.getStates();
        let resultState = null;
        const disableState = {};
        if (this.valueFormatIsCorrect(nextValue)) {
            if (Array.isArray(prevValue) && Array.isArray(nextValue)) {
                nextValue = [
                    nextValue[0] < min ? min : nextValue[0], // Math.round(nextValue[0]),
                    nextValue[1] > max ? max : nextValue[1], // Math.round(nextValue[1])
                ];
                // this._adapter.notifyChange(this.outPutValue(nextValue));
                resultState = Object.assign(disableState, {
                    currentValue: nextValue,
                });
            }
            if (typeof prevValue === 'number' && typeof nextValue === 'number') {
                if (nextValue > max) {
                    nextValue = max;
                } else {
                    nextValue = nextValue < min ? min : nextValue; // Math.round(nextValue);
                }
                // this._adapter.notifyChange(this.outPutValue(nextValue));
                resultState = Object.assign(disableState, {
                    currentValue: nextValue,
                });
            }
        } else {
            resultState = disableState;
        }
        if (resultState) {
            this._adapter.transNewPropsToState(resultState);

        }
    };

    onHandleDown = (e: any, handler: any) => {
        this._adapter.onHandleDown(e);
        const disabled = this._adapter.getState('disabled');
        const { vertical } = this._adapter.getProps();
        const { dragging } = this._adapter.getOverallVars();
        if (disabled) {
            return false;
        }
        this._adapter.setStateVal('isDrag', true);
        this._adapter.setStateVal('chooseMovePos', handler);
        if (handler === 'min') {
            this._adapter.setDragging([true, dragging[1]]);
        } else {
            this._adapter.setDragging([dragging[0], true]);
        }

        const mousePos = this.handleMousePos(e.clientX, e.clientY);
        let pos = vertical ? mousePos.y : mousePos.x;
        if (!this._adapter.isEventFromHandle(e)) {
            this._dragOffset = 0;
        } else {
            const handlePosition = this._getHandleCenterPosition(vertical, e.target);
            this._dragOffset = vertical ? pos - handlePosition : pos - handlePosition;
            pos = handlePosition;
        }
        return true;
    };

    onHandleMove = (e: any) => {
        this._adapter.setEventDefault(e);
        const { disabled, chooseMovePos } = this._adapter.getStates();
        const { vertical } = this._adapter.getProps();
        const { dragging } = this._adapter.getOverallVars();
        if (disabled) {
            return false;
        }
        this.onHandleEnter(chooseMovePos);
        const mousePos = this.handleMousePos(e.clientX, e.clientY);
        let pagePos = vertical ? mousePos.y : mousePos.x;
        pagePos = pagePos - this._dragOffset;
        if ((chooseMovePos === 'min' && dragging[0]) || (chooseMovePos === 'max' && dragging[1])) {
            const outPutValue = this.calculateOutputValue(pagePos, chooseMovePos === 'min' );
            
            if (outPutValue === undefined) {
                return false;
            }
            
            this._adapter.notifyChange(outPutValue);

            // allow drag for controlled component, so no _isControlledComponent check
            this._adapter.onHandleMove(pagePos, chooseMovePos === 'min', undefined, false, outPutValue);
        }
        return true;
    };

    // run when user touch left or right handle.
    onHandleTouchStart = (e: any, handler: 'min' | 'max') => {
        const handleMinDom = this._adapter.getMinHandleEl();
        const handleMaxDom = this._adapter.getMaxHandleEl();
        if (e.target === handleMinDom || e.target === handleMaxDom) {
            handlePrevent(e);
            const touch = touchEventPolyfill(e.touches[0], e);
            this.onHandleDown(touch, handler);
        }

    };

    onHandleTouchMove = (e: any) => {
        const handleMinDom = this._adapter.getMinHandleEl();
        const handleMaxDom = this._adapter.getMaxHandleEl();
        if (e.target === handleMinDom || e.target === handleMaxDom) {
            const touch = touchEventPolyfill(e.touches[0], e);
            this.onHandleMove(touch);
        }
    };

    onHandleEnter = (pos: SliderState['focusPos']) => {
        // debugger;
        // this._adapter.setEventDefault(e);
        const { disabled, focusPos } = this._adapter.getStates();
        if (!disabled) {
            if (!focusPos && pos !== focusPos) {
                this._adapter.onHandleEnter(pos);
            }
        }
    };

    onHandleLeave = () => {
        // this._adapter.setEventDefault(e);
        const disabled = this._adapter.getState('disabled');
        const isDrag = this._adapter.getState('isDrag');
        if (!disabled && !isDrag) {
            this._adapter.onHandleLeave();
        }
    };

    onHandleUp = (e: any) => {
        this._adapter.onHandleUpBefore(e);
        // const value = this._adapter.getProp('value');
        const { disabled, chooseMovePos } = this._adapter.getStates();
        const { dragging } = this._adapter.getOverallVars();
        if (disabled) {
            return false;
        }
        if (chooseMovePos === 'min') {
            this._adapter.setDragging([false, dragging[1]]);
        } else {
            this._adapter.setDragging([dragging[0], false]);
        }
        this._adapter.setStateVal('isDrag', false);
        this._adapter.onHandleLeave();
        this._adapter.onHandleUpAfter();
        return true;
    };

    _handleValueDecreaseWithKeyBoard = (step: number, handler: 'min'| 'max') => {
        const { min, currentValue } = this.getStates();
        const { range } = this.getProps();
        if (handler === 'min') {
            if (range) {
                let newMinValue = currentValue[0] - step;
                newMinValue = newMinValue < min ? min : newMinValue;
                return [newMinValue, currentValue[1]];
            } else {
                let newMinValue = currentValue - step;
                newMinValue = newMinValue < min ? min : newMinValue;
                return newMinValue;
            }
        } else {
            let newMaxValue = currentValue[1] - step;
            newMaxValue = newMaxValue < currentValue[0] ? currentValue[0] : newMaxValue;
            return [currentValue[0], newMaxValue];
        }
    }

    _handleValueIncreaseWithKeyBoard = (step: number, handler: 'min'| 'max') => {
        const { max, currentValue } = this.getStates();
        const { range } = this.getProps();
        if (handler === 'min') {
            if (range) {
                let newMinValue = currentValue[0] + step;
                newMinValue = newMinValue > currentValue[1] ? currentValue[1] : newMinValue;
                return [newMinValue, currentValue[1]];
            } else {
                let newMinValue = currentValue + step;
                newMinValue = newMinValue > max ? max : newMinValue;
                return newMinValue;
            }
        } else {
            let newMaxValue = currentValue[1] + step;
            newMaxValue = newMaxValue > max ? max : newMaxValue;
            return [currentValue[0], newMaxValue];
        }
    }

    _handleHomeKey = (handler: 'min'| 'max') => {
        const { min, currentValue } = this.getStates();
        const { range } = this.getProps();
        if (handler === 'min') {
            if (range) {
                return [min, currentValue[1]];
            } else {
                return min;
            }
        } else {
            return [currentValue[0], currentValue[0]];
        }
    }

    _handleEndKey = (handler: 'min'| 'max') => {
        const { max, currentValue } = this.getStates();
        const { range } = this.getProps();
        if (handler === 'min') {
            if (range) {
                return [currentValue[1], currentValue[1]];
            } else {
                return max;
            }
        } else {
            return [currentValue[0], max];
        }
    }

    handleKeyDown = (event: any, handler: 'min'| 'max') => {
        const { min, max, currentValue } = this.getStates();
        const { step, range } = this.getProps();
        let outputValue;
        switch (event.key) {
            case "ArrowLeft":
            case "ArrowDown":
                outputValue = this._handleValueDecreaseWithKeyBoard(step, handler);
                break;
            case "ArrowRight":
            case "ArrowUp":
                outputValue = this._handleValueIncreaseWithKeyBoard(step, handler);
                break;
            case "PageUp":
                outputValue = this._handleValueIncreaseWithKeyBoard(10 * step, handler);
                break;
            case "PageDown":
                outputValue = this._handleValueDecreaseWithKeyBoard(10 * step, handler);
                break;
            case "Home":
                outputValue = this._handleHomeKey(handler);
                break;
            case "End":
                outputValue = this._handleEndKey(handler);
                break;
            case 'default':
                break;
        }
        if (["ArrowLeft", "ArrowDown", "ArrowRight", "ArrowUp", "PageUp", "PageDown", "Home", "End"].includes(event.key)) {
            let update = true;
            if (Array.isArray(currentValue)) {
                update = !(currentValue[0] === outputValue[0] && currentValue[1] === outputValue[1]);
            } else {
                update = currentValue !== outputValue;
            }
            if (update) {
                this._adapter.updateCurrentValue(outputValue);
                this._adapter.notifyChange(outputValue);
            }
            handlePrevent(event);
        }
    }

    _noTooltip = () => {
        const { tipFormatter, tooltipVisible } = this.getProps();
        return tipFormatter === null || tooltipVisible === false;
    }

    onFocus = (e: any, handler: 'min'| 'max') => {
        const noTooltip = this._noTooltip();
        if (noTooltip) {
            return;
        }
        handlePrevent(e);
        const { target } = e;
        try {
            if (target.matches(':focus-visible')) {
                if (handler === 'min') {
                    this._adapter.setStateVal('firstDotFocusVisible', true);
                } else {
                    this._adapter.setStateVal('secondDotFocusVisible', true);
                }
            }
        } catch (error) {
            warning(true, 'Warning: [Semi Slider] The current browser does not support the focus-visible'); 
        }
    }

    onBlur = (e: any, handler: 'min'| 'max') => {
        const noTooltip = this._noTooltip();
        if (noTooltip) {
            return;
        }
        const { firstDotFocusVisible, secondDotFocusVisible } = this.getStates();
        if (handler === 'min') {
            firstDotFocusVisible && this._adapter.setStateVal('firstDotFocusVisible', false);
        } else {
            secondDotFocusVisible && this._adapter.setStateVal('secondDotFocusVisible', false);
        }
    }

    handleWrapClick = (e: any) => {
        const { disabled, isDrag } = this._adapter.getStates();
        if (isDrag || disabled || this._adapter.isEventFromHandle(e)) {
            return;
        }
        const { vertical } = this.getProps();
        const mousePos = this.handleMousePos(e.clientX, e.clientY);
        const position = vertical ? mousePos.y : mousePos.x;
        const isMin = this.checkWhichHandle(position);

        const outPutValue = this.calculateOutputValue(position, isMin);
        if (outPutValue === undefined) {
            return;
        }

        this._adapter.notifyChange(outPutValue);

        // check if is controlled component
        if (this._isControlledComponent()) {
            // only perform callback ops, skip UI update
            return;
        }

        // trigger UI state update
        this.setHandlePos(position, isMin, true, outPutValue);
    };

    /**
     * Move the slider to the current click position
     *
     * @memberof SliderFoundation
     */
    setHandlePos = (position: number, isMin: boolean, clickTrack = false, outPutValue: number | number[]) => {
        this._adapter.onHandleMove(position, isMin, () => this._adapter.onHandleUpAfter(), clickTrack, outPutValue);
    };

    /**
     * Determine which slider should be moved currently
     *
     * @memberof SliderFoundation
     */
    checkWhichHandle = (pagePos: number) => {
        const { vertical, verticalReverse } = this.getProps();
        const { currentValue } = this._adapter.getStates();
        const currentPos = this.transValueToPos(currentValue);
        let isMin = true;
        if (Array.isArray(currentPos)) {
            // Slide on both sides
            if (
                pagePos > currentPos[1] ||
                Math.abs(pagePos - currentPos[0]) > Math.abs(pagePos - currentPos[1])
            ) {
                isMin = false;
            }
        }
        if (vertical && verticalReverse) {
            isMin = !isMin;
        }
        return isMin;
    };

    handleWrapperEnter = () => {
        this._adapter.setStateVal('showBoundary', true);
    };

    handleWrapperLeave = () => {
        this._adapter.setStateVal('showBoundary', false);
    };

    private _getHandleCenterPosition(vertical: boolean, handle: HTMLElement) {
        const pos = handle.getBoundingClientRect();
        const { x, y } = this.handleMousePos(pos.left + (pos.width * 0.5), pos.top + (pos.height * 0.5));
        return vertical ? y : x;
    }

}
