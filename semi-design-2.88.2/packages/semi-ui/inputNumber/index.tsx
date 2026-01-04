/* eslint-disable jsx-a11y/no-static-element-interactions */
import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import Input, { InputProps } from '../input';
import { forwardStatics } from '@douyinfe/semi-foundation/utils/object';
import isNullOrUndefined from '@douyinfe/semi-foundation/utils/isNullOrUndefined';
import isBothNaN from '@douyinfe/semi-foundation/utils/isBothNaN';
import InputNumberFoundation, { BaseInputNumberState, InputNumberAdapter } from '@douyinfe/semi-foundation/inputNumber/foundation';
import BaseComponent from '../_base/baseComponent';
import { cssClasses, numbers, strings } from '@douyinfe/semi-foundation/inputNumber/constants';
import { IconChevronUp, IconChevronDown } from '@douyinfe/semi-icons';

import '@douyinfe/semi-foundation/inputNumber/inputNumber.scss';
import { isNaN, isString, noop } from 'lodash';
import { ArrayElement } from '../_base/base';
import LocaleConsumer from '../locale/localeConsumer';
import { Locale } from '../locale/interface';

export interface InputNumberProps extends InputProps {
    autofocus?: boolean;
    className?: string;
    clearIcon?: React.ReactNode;
    currency?: string | boolean;
    currencyDisplay?: 'code' | 'symbol' | 'name';
    defaultValue?: number | string;
    defaultCurrency?: string;
    disabled?: boolean;
    formatter?: (value: number | string) => string;
    forwardedRef?: React.MutableRefObject<HTMLInputElement> | ((instance: HTMLInputElement) => void);
    hideButtons?: boolean;
    innerButtons?: boolean;
    insetLabel?: React.ReactNode;
    insetLabelId?: string;
    keepFocus?: boolean;
    localeCode?: string;
    max?: number;
    min?: number;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    parser?: (value: string) => string;
    precision?: number;
    prefixCls?: string;
    pressInterval?: number;
    pressTimeout?: number;
    shiftStep?: number;
    showClear?: boolean;
    showCurrencySymbol?: boolean;
    size?: ArrayElement<typeof strings.SIZE>;
    step?: number;
    style?: React.CSSProperties;
    suffix?: React.ReactNode;
    value?: number | string;
    onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
    onChange?: (value: number | string, e?: React.ChangeEvent) => void;
    onDownClick?: (value: string, e: React.MouseEvent<HTMLButtonElement>) => void;
    onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
    onKeyDown?: React.KeyboardEventHandler;
    onNumberChange?: (value: number, e?: React.ChangeEvent) => void;
    onUpClick?: (value: string, e: React.MouseEvent<HTMLButtonElement>) => void
}

export interface InputNumberState extends BaseInputNumberState {}

class InputNumber extends BaseComponent<InputNumberProps, InputNumberState> {
    static propTypes = {
        'aria-label': PropTypes.string,
        'aria-labelledby': PropTypes.string,
        'aria-invalid': PropTypes.bool,
        'aria-errormessage': PropTypes.string,
        'aria-describedby': PropTypes.string,
        'aria-required': PropTypes.bool,
        autofocus: PropTypes.bool,
        clearIcon: PropTypes.node,
        className: PropTypes.string,
        defaultValue: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
        disabled: PropTypes.bool,
        formatter: PropTypes.func,
        forwardedRef: PropTypes.any,
        hideButtons: PropTypes.bool,
        innerButtons: PropTypes.bool,
        insetLabel: PropTypes.node,
        insetLabelId: PropTypes.string,
        keepFocus: PropTypes.bool,
        max: PropTypes.number,
        min: PropTypes.number,
        parser: PropTypes.func,
        precision: PropTypes.number,
        prefixCls: PropTypes.string,
        pressInterval: PropTypes.number,
        pressTimeout: PropTypes.number,
        preventScroll: PropTypes.bool,
        shiftStep: PropTypes.number,
        showCurrencySymbol: PropTypes.bool,
        step: PropTypes.number,
        style: PropTypes.object,
        suffix: PropTypes.any,
        value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
        onBlur: PropTypes.func,
        onChange: PropTypes.func,
        onDownClick: PropTypes.func,
        onKeyDown: PropTypes.func,
        onNumberChange: PropTypes.func,
        onUpClick: PropTypes.func,
    };

    static defaultProps: InputNumberProps = {
        forwardedRef: noop,
        innerButtons: false,
        keepFocus: false,
        max: Infinity,
        min: -Infinity,
        prefixCls: cssClasses.PREFIX,
        pressInterval: numbers.DEFAULT_PRESS_TIMEOUT,
        pressTimeout: numbers.DEFAULT_PRESS_TIMEOUT,
        shiftStep: numbers.DEFAULT_SHIFT_STEP,
        showCurrencySymbol: true,
        size: strings.DEFAULT_SIZE,
        step: numbers.DEFAULT_STEP,
        onBlur: noop,
        onChange: noop,
        onDownClick: noop,
        onFocus: noop,
        onKeyDown: noop,
        onNumberChange: noop,
        onUpClick: noop,
    };

    get adapter(): InputNumberAdapter {
        return {
            ...super.adapter,
            setValue: (value, cb) => this.setState({ value }, cb),
            setNumber: (number, cb) => this.setState({ number }, cb),
            setFocusing: (focusing, cb) => this.setState({ focusing }, cb),
            setHovering: hovering => this.setState({ hovering }),
            notifyChange: (...args) => this.props.onChange(...args),
            notifyNumberChange: (...args) => this.props.onNumberChange(...args),
            notifyBlur: e => this.props.onBlur(e),
            notifyFocus: e => this.props.onFocus(e),
            notifyUpClick: (value, e) => this.props.onUpClick(value, e),
            notifyDownClick: (value, e) => this.props.onDownClick(value, e),
            notifyKeyDown: e => this.props.onKeyDown(e),
            registerGlobalEvent: (eventName, handler) => {
                if (eventName && typeof handler === 'function') {
                    this.adapter.unregisterGlobalEvent(eventName);
                    this.adapter.setCache(eventName, handler);

                    document.addEventListener(eventName, handler);
                }
            },
            unregisterGlobalEvent: eventName => {
                if (eventName) {
                    const handler = this.adapter.getCache(eventName);
                    document.removeEventListener(eventName, handler);
                    this.adapter.setCache(eventName, null);
                }
            },
            getInputCharacter: (index: number) => {
                return this.inputNode.value[index];
            },
            recordCursorPosition: () => {
                // Record position
                try {
                    if (this.inputNode) {
                        this.cursorStart = this.inputNode.selectionStart;
                        this.cursorEnd = this.inputNode.selectionEnd;
                        this.currentValue = this.inputNode.value;
                        this.cursorBefore = this.inputNode.value.substring(0, this.cursorStart);
                        this.cursorAfter = this.inputNode.value.substring(this.cursorEnd);
                    }
                } catch (e) {
                    console.warn(e);
                    // Fix error in Chrome:
                    // Failed to read the 'selectionStart' property from 'HTMLInputElement'
                    // http://stackoverflow.com/q/21177489/3040605
                }
            },
            restoreByAfter: str => {
                if (isNullOrUndefined(str)) {
                    return false;
                }

                const fullStr = this.inputNode.value;
                const index = fullStr.lastIndexOf(str);

                if (index === -1) {
                    return false;
                }

                if (index + str.length === fullStr.length) {
                    this.adapter.fixCaret(index, index);

                    return true;
                }
                return false;
            },
            restoreCursor: (str = this.cursorAfter) => {
                if (isNullOrUndefined(str)) {
                    return false;
                }

                // For loop from full str to the str with last char to map. e.g. 123
                // -> 123
                // -> 23
                // -> 3
                return Array.prototype.some.call(str, (_: any, start: number) => {
                    const partStr = str.substring(start);

                    return this.adapter.restoreByAfter(partStr);
                });
            },
            fixCaret: (start, end) => {
                if (start === undefined || end === undefined || !this.inputNode || !this.inputNode.value) {
                    return;
                }

                try {
                    const currentStart = this.inputNode.selectionStart;
                    const currentEnd = this.inputNode.selectionEnd;

                    if (start !== currentStart || end !== currentEnd) {
                        this.inputNode.setSelectionRange(start, end);
                    }
                } catch (e) {
                    // Fix error in Chrome:
                    // Failed to read the 'selectionStart' property from 'HTMLInputElement'
                    // http://stackoverflow.com/q/21177489/3040605
                }
            },
            setClickUpOrDown: value => {
                this.clickUpOrDown = value;
            },
            updateStates: (states, callback) => {
                this.setState(states, callback);
            },
        };
    }

    inputNode: HTMLInputElement;
    clickUpOrDown: boolean;
    cursorStart!: number;
    cursorEnd!: number;
    currentValue!: number | string;
    cursorBefore!: string;
    cursorAfter!: string;
    foundation: InputNumberFoundation;
    constructor(props: InputNumberProps) {
        super(props);
        this.state = {
            value: '',
            number: null, // Current parsed numbers
            focusing: Boolean(props.autofocus) || false,
            hovering: false,
        };
        this.inputNode = null;
        this.foundation = new InputNumberFoundation(this.adapter);
        this.clickUpOrDown = false;
    }

    componentDidUpdate(prevProps: InputNumberProps) {
        const { value, preventScroll } = this.props;
        const { focusing } = this.state;
        let newValue;
        /**
         * To determine whether the front and back are equal
         * NaN need to check whether both are NaN
         */
        if (value !== prevProps.value && !isBothNaN(value, prevProps.value)) {
            if (isNullOrUndefined(value) || value === '') {
                newValue = '';
                this.foundation.updateStates({ value: newValue, number: null });
            } else {
                let valueStr = value;
                if (typeof value === 'number') {
                    valueStr = this.foundation.doFormat(value);
                }

                const parsedNum = this.foundation.doParse(valueStr, false, true, true);
                const toNum = typeof value === 'number' ? value : this.foundation.doParse(valueStr, false, false, false);

                /**
                 * focusing 状态为输入状态，输入状态的受控值要特殊处理
                 * 如：
                 *  - 输入合法值
                 *      123 => input value 也应该是 123，同时需要设置 number 为 123
                 *  - 输入非法值，只设置 input value，不设置非法的number
                 *      abc => input value 这时是 abc，但失焦后会进行格式化
                 *      100（超出范围） => input value 应该是 100，但不设置 number
                 *
                 * 保持输入态有三种方式
                 * 1. 输入框输入
                 *  - 输入可以解析为合法数字，input value根据输入值确定，失焦时更新input value
                 *  - 输入不可解析为合法数字，进行格式化后显示在input框
                 * 2. 键盘点击上下按钮（input value根据受控值进行更改）
                 * 3. keepFocus+鼠标点击上下按钮（input value根据受控值进行更改）
                 *
                 * The focusing state is the input state, and the controlled value of the input state needs special treatment
                 * For example:
                 *  - input legal value
                 *      123 = > input value should also be 123, and the number should be set to 123
                 *  - input illegal value, only set the input value, do not set the illegal number
                 *      abc = > input value This is abc at this time, but it will be formatted after being out of focus
                 *      100 (out of range) = > input value should be 100, but no number
                 *
                 * There are three ways to maintain the input state
                 * 1. input box input
                 *  - input can be resolved into legal numbers, input value is determined according to the input value, and input value is updated when out of focus
                 *  - input cannot be resolved into legal numbers, and it will be displayed in the input box after formatting
                 * 2. Keyboard click on the up and down button (input value is changed according to the controlled value)
                 * 3.keepFocus + mouse click on the up and down button (input value is changed according to the controlled value)
                 */
                if (focusing) {
                    if (this.foundation.isValidNumber(parsedNum) && parsedNum !== this.state.number) {
                        const obj: { number?: number; value?: string } = { number: parsedNum };
                        /**
                         * If you are clicking the button, it will automatically format once
                         * We need to set the status to false after trigger focus event
                         */
                        if (this.clickUpOrDown) {
                            obj.value = this.foundation.doFormat(obj.number, true);
                            newValue = obj.value;
                        }
                        this.foundation.updateStates(obj, () => this.adapter.restoreCursor());
                    } else if (!isNaN(toNum)) {
                        // Update input content when controlled input is illegal and not NaN
                        newValue = this.foundation.doFormat(toNum, false);
                        this.foundation.updateStates({ value: newValue });
                    } else {
                        // Update input content when controlled input NaN
                        this.foundation.updateStates({ value: valueStr });
                    }
                } else if (this.foundation.isValidNumber(parsedNum)) {
                    newValue = this.foundation.doFormat(parsedNum, true, true);
                    this.foundation.updateStates({ number: parsedNum, value: newValue });
                } else {
                    // Invalid digital analog blurring effect instead of controlled failure
                    newValue = '';
                    this.foundation.updateStates({ number: null, value: newValue });
                }
            }
            if (newValue && isString(newValue) && newValue !== String(this.props.value)) {
                if (this.foundation._isCurrency()) {
                    // 仅在解析后的数值而不是格式化的字符串变化时 notifyChange
                    // notifyChange only when the parsed value changes, not the formatted string
                    const parsedNewValue = this.foundation.doParse(newValue);
                    const parsedPropValue = typeof this.props.value === 'string' ? 
                        this.foundation.doParse(this.props.value) : this.props.value;
                    
                    if (parsedNewValue !== parsedPropValue) {
                        this.foundation.notifyChange(newValue, null);
                    }
                } else {
                    this.foundation.notifyChange(newValue, null);
                }
            }
        }

        if (!this.clickUpOrDown) {
            return;
        }

        if (this.props.keepFocus && this.state.focusing) {
            if (document.activeElement !== this.inputNode) {
                this.inputNode.focus({ preventScroll });
            }
        }
    }

    setInputRef = (node: HTMLInputElement) => {
        const { forwardedRef } = this.props;
        this.inputNode = node;

        if (forwardedRef && typeof forwardedRef === 'object') {
            forwardedRef.current = node;
        } else if (typeof forwardedRef === 'function') {
            forwardedRef(node);
        }
    };

    handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => this.foundation.handleInputFocus(e);

    handleInputChange = (value: string, event: React.ChangeEvent<HTMLInputElement>) => this.foundation.handleInputChange(value, event);

    handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => this.foundation.handleInputBlur(e);

    handleInputKeyDown = (e: React.KeyboardEvent) => this.foundation.handleInputKeyDown(e);

    handleInputMouseEnter = (e: React.MouseEvent) => this.foundation.handleInputMouseEnter(e);

    handleInputMouseLeave = (e: React.MouseEvent) => this.foundation.handleInputMouseLeave(e);

    handleInputMouseMove = (e: React.MouseEvent) => this.foundation.handleInputMouseMove(e);

    handleUpClick = (e: React.KeyboardEvent) => this.foundation.handleUpClick(e);

    handleDownClick = (e: React.KeyboardEvent) => this.foundation.handleDownClick(e);

    handleMouseUp = (e: React.MouseEvent) => this.foundation.handleMouseUp(e);

    handleMouseLeave = (e: React.MouseEvent) => this.foundation.handleMouseLeave(e);

    renderButtons = () => {
        const { prefixCls, disabled, innerButtons, max, min } = this.props;
        const { hovering, focusing, number } = this.state;
        const notAllowedUp = disabled ? disabled : number === max;
        const notAllowedDown = disabled ? disabled : number === min;
        const suffixChildrenCls = classnames(`${prefixCls}-number-suffix-btns`, {
            [`${prefixCls}-number-suffix-btns-inner`]: innerButtons,
            [`${prefixCls}-number-suffix-btns-inner-hover`]: innerButtons && hovering && !focusing
        });
        const upClassName = classnames(`${prefixCls}-number-button`, `${prefixCls}-number-button-up`, {
            [`${prefixCls}-number-button-up-disabled`]: disabled,
            [`${prefixCls}-number-button-up-not-allowed`]: notAllowedUp,
        });
        const downClassName = classnames(`${prefixCls}-number-button`, `${prefixCls}-number-button-down`, {
            [`${prefixCls}-number-button-down-disabled`]: disabled,
            [`${prefixCls}-number-button-down-not-allowed`]: notAllowedDown,
        });

        return (
            <div className={suffixChildrenCls}>
                <span
                    className={upClassName}
                    onMouseDown={notAllowedUp ? noop : this.handleUpClick}
                    onMouseUp={this.handleMouseUp}
                    onMouseLeave={this.handleMouseLeave}
                >
                    <IconChevronUp size="extra-small" />
                </span>
                <span
                    className={downClassName}
                    onMouseDown={notAllowedDown ? noop : this.handleDownClick}
                    onMouseUp={this.handleMouseUp}
                    onMouseLeave={this.handleMouseLeave}
                >
                    <IconChevronDown size="extra-small" />
                </span>
            </div>
        );
    };

    renderSuffix = () => {
        const { innerButtons, suffix } = this.props;
        const { hovering, focusing } = this.state;

        if (innerButtons && (hovering || focusing)) {
            const buttons = this.renderButtons();
            return buttons;
        }
        return suffix;
    };

    render() {
        const {
            disabled,
            className,
            prefixCls,
            min,
            max,
            step,
            shiftStep,
            precision,
            formatter,
            parser,
            forwardedRef,
            onUpClick,
            onDownClick,
            pressInterval,
            pressTimeout,
            suffix,
            size,
            hideButtons,
            innerButtons,
            style,
            onNumberChange,
            keepFocus,
            defaultValue,
            defaultCurrency,
            currency,
            currencyDisplay,
            minimumFractionDigits,
            maximumFractionDigits,
            showCurrencySymbol,
            localeCode,
            ...rest
        } = this.props;
        const { value, number } = this.state;

        const inputNumberCls = classnames(className, `${prefixCls}-number`, {
            [`${prefixCls}-number-size-${size}`]: size,
        });

        const buttons = this.renderButtons();
        const ariaProps = {
            'aria-disabled': disabled,
            step,
        };
        if (number) {
            ariaProps['aria-valuenow'] = number;
        }
        if (max !== Infinity) {
            ariaProps['aria-valuemax'] = max;
        }
        if (min !== -Infinity) {
            ariaProps['aria-valuemin'] = min;
        }

        const input = (
            <div
                className={inputNumberCls}
                style={style}
                onMouseMove={e => this.handleInputMouseMove(e)}
                onMouseEnter={e => this.handleInputMouseEnter(e)}
                onMouseLeave={e => this.handleInputMouseLeave(e)}
            >
                <Input
                    role="spinbutton"
                    {...ariaProps}
                    {...rest}
                    size={size}
                    disabled={disabled}
                    ref={this.setInputRef}
                    value={value}
                    onFocus={this.handleInputFocus}
                    onChange={this.handleInputChange}
                    onBlur={this.handleInputBlur}
                    onKeyDown={this.handleInputKeyDown}
                    suffix={this.renderSuffix()}
                />
                {(hideButtons || innerButtons) ? null : (
                    buttons
                )}
            </div>
        );
        return input;
    }
}

export default forwardStatics(
    React.forwardRef<HTMLInputElement, InputNumberProps>(function SemiInputNumber(props, ref) {
        return (
            <LocaleConsumer<Locale['InputNumber']> componentName="InputNumber">
                {(locale: Locale['InputNumber'], localeCode: string, dateFnsLocale, currency: string) => (
                    <InputNumber localeCode={localeCode} defaultCurrency={currency} {...props} forwardedRef={ref}/>
                )}
            </LocaleConsumer>
        );
    }),
    InputNumber
);

export { InputNumber };
