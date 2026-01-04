/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-static-element-interactions */
import React from 'react';
import cls from 'classnames';
import PropTypes from 'prop-types';
import { get } from 'lodash';

import DateInputFoundation, {
    DateInputAdapter,
    DateInputFoundationProps,
    RangeType,
    InsetInputChangeProps,
    InsetInputChangeFoundationProps,
    InsetInputProps
} from '@douyinfe/semi-foundation/datePicker/inputFoundation';
import { cssClasses, strings } from '@douyinfe/semi-foundation/datePicker/constants';
import { noop } from '@douyinfe/semi-foundation/utils/function';
import isNullOrUndefined from '@douyinfe/semi-foundation/utils/isNullOrUndefined';
import { IconCalendar, IconCalendarClock, IconClear } from '@douyinfe/semi-icons';
import { BaseValueType, ValueType } from '@douyinfe/semi-foundation/datePicker/foundation';

import BaseComponent, { BaseProps } from '../_base/baseComponent';
import Input from '../input/index';
import { InsetDateInput, InsetTimeInput } from './insetInput';

export interface DateInputProps extends DateInputFoundationProps, BaseProps {
    insetLabel?: React.ReactNode;
    prefix?: React.ReactNode;
    onClick?: (e: React.MouseEvent<HTMLInputElement>) => void;
    onChange?: (value: string, e: React.MouseEvent<HTMLInputElement>) => void;
    onEnterPress?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    onBlur?: (e: React.MouseEvent<HTMLInputElement>) => void;
    onFocus?: (e: React.MouseEvent<HTMLInputElement>, rangeType?: RangeType) => void;
    onClear?: (e: React.MouseEvent<HTMLDivElement>) => void;
    onInsetInputChange?: (options: InsetInputChangeProps) => void;
    value?: Date[];
    inputRef?: React.RefObject<HTMLInputElement>;
    rangeInputStartRef?: React.RefObject<HTMLInputElement>;
    rangeInputEndRef?: React.RefObject<HTMLInputElement>;
    showClearIgnoreDisabled?: boolean
}

// eslint-disable-next-line @typescript-eslint/ban-types
export default class DateInput extends BaseComponent<DateInputProps, {}> {
    static propTypes = {
        borderless: PropTypes.bool,
        onClick: PropTypes.func,
        onChange: PropTypes.func,
        onEnterPress: PropTypes.func,
        onBlur: PropTypes.func,
        onClear: PropTypes.func,
        onFocus: PropTypes.func,
        value: PropTypes.array,
        disabled: PropTypes.bool,
        type: PropTypes.oneOf(strings.TYPE_SET),
        showClear: PropTypes.bool,
        format: PropTypes.string, // Attributes not used
        inputStyle: PropTypes.object,
        inputReadOnly: PropTypes.bool, // Text box can be entered
        insetLabel: PropTypes.node,
        validateStatus: PropTypes.string,
        prefix: PropTypes.node,
        prefixCls: PropTypes.string,
        dateFnsLocale: PropTypes.object.isRequired, // Foundation useful to
        placeholder: PropTypes.oneOfType([PropTypes.string, PropTypes.array]),
        rangeInputFocus: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]),
        rangeInputStartRef: PropTypes.object,
        rangeInputEndRef: PropTypes.object,
        rangeSeparator: PropTypes.string,
        insetInput: PropTypes.oneOfType([PropTypes.bool, PropTypes.object]),
        insetInputValue: PropTypes.object,
        defaultPickerValue: PropTypes.oneOfType([
            PropTypes.string,
            PropTypes.number,
            PropTypes.object,
            PropTypes.array,
        ]),
    };

    static defaultProps = {
        borderless: false,
        showClear: true,
        onClick: noop,
        onChange: noop,
        onEnterPress: noop,
        onBlur: noop,
        onClear: noop,
        onFocus: noop,
        type: 'date',
        inputStyle: {},
        inputReadOnly: false,
        prefixCls: cssClasses.PREFIX,
        rangeSeparator: strings.DEFAULT_SEPARATOR_RANGE,
    };
    foundation: DateInputFoundation;

    constructor(props: DateInputProps) {
        super(props);
        this.foundation = new DateInputFoundation(this.adapter);
    }

    get adapter(): DateInputAdapter {
        return {
            ...super.adapter,
            updateIsFocusing: isFocusing => this.setState({ isFocusing }),
            notifyClick: (...args) => this.props.onClick(...args),
            notifyChange: (...args) => this.props.onChange(...args),
            notifyEnter: (...args) => this.props.onEnterPress(...args),
            notifyBlur: (...args) => this.props.onBlur(...args),
            notifyClear: (...args) => this.props.onClear(...args),
            notifyFocus: (...args) => this.props.onFocus(...args),
            notifyRangeInputClear: (...args) => this.props.onRangeClear(...args),
            notifyRangeInputFocus: (...args) => this.props.onFocus(...args),
            notifyTabPress: (...args) => this.props.onRangeEndTabPress(...args),
            notifyInsetInputChange: options => this.props.onInsetInputChange(options),
        };
    }

    componentDidMount() {
        this.foundation.init();
    }

    componentWillUnmount() {
        this.foundation.destroy();
    }

    formatText(value: ValueType) {
        return value && (value as BaseValueType[]).length ? this.foundation.formatShowText(value as BaseValueType[]) : '';
    }

    handleChange = (value: string, e: React.ChangeEvent<HTMLInputElement>) => this.foundation.handleChange(value, e);

    handleEnterPress = (e: React.KeyboardEvent<HTMLInputElement>) => this.foundation.handleInputComplete(e);

    handleInputClear = (e: React.MouseEvent<HTMLDivElement>) => this.foundation.handleInputClear(e);

    handleRangeInputChange = (rangeStart: string, rangeEnd: string, e: React.ChangeEvent) => {
        const rangeInputValue = this.getRangeInputValue(rangeStart, rangeEnd);
        this.foundation.handleChange(rangeInputValue, e);
    };

    handleRangeInputClear: React.MouseEventHandler<HTMLDivElement> = e => {
        this.foundation.handleRangeInputClear(e);
    };

    handleRangeInputEnterPress = (e: React.KeyboardEvent<HTMLInputElement>, rangeStart: string, rangeEnd: string) => {
        const rangeInputValue = this.getRangeInputValue(rangeStart, rangeEnd);
        this.foundation.handleRangeInputEnterPress(e, rangeInputValue);
    };

    handleRangeInputEndKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        this.foundation.handleRangeInputEndKeyPress(e);
    };

    handleRangeInputFocus = (e: React.MouseEvent<HTMLElement>, rangeType: RangeType) => {
        this.foundation.handleRangeInputFocus(e, rangeType);
    };

    handleRangeStartFocus: React.MouseEventHandler<HTMLElement> = e => {
        this.handleRangeInputFocus(e, 'rangeStart');
    };

    handleInsetInputChange = (options: InsetInputChangeFoundationProps) => {
        this.foundation.handleInsetInputChange(options);
    };

    getRangeInputValue = (rangeStart: string, rangeEnd: string) => {
        const { rangeSeparator } = this.props;
        const rangeInputValue = `${rangeStart}${rangeSeparator}${rangeEnd}`;
        return rangeInputValue;
    };

    renderRangePrefix() {
        const { prefix, insetLabel, prefixCls, disabled, rangeInputFocus } = this.props;
        const labelNode = prefix || insetLabel;
        return labelNode ? (
            <div
                className={`${prefixCls}-range-input-prefix`}
                onClick={e => !disabled && !rangeInputFocus && this.handleRangeStartFocus(e)}
                x-semi-prop="prefix,insetLabel"
            >
                {labelNode}
            </div>
        ) : null;
    }

    renderRangeSeparator(rangeStart: string, rangeEnd: string) {
        const { disabled, rangeSeparator } = this.props;
        const separatorCls = cls({
            [`${cssClasses.PREFIX}-range-input-separator`]: true,
            [`${cssClasses.PREFIX}-range-input-separator-active`]: (rangeStart || rangeEnd) && !disabled,
        });
        return (
            <span onClick={e => !disabled && this.handleRangeStartFocus(e)} className={separatorCls}>
                {rangeSeparator}
            </span>
        );
    }

    renderRangeClearBtn(rangeStart: string, rangeEnd: string) {
        const { showClear, prefixCls, disabled, clearIcon, showClearIgnoreDisabled } = this.props;
        const isRealDisabled = disabled && !showClearIgnoreDisabled;
        const allowClear = (rangeStart || rangeEnd) && showClear && !isRealDisabled;
        return allowClear ? (
            <div
                role="button"
                tabIndex={0}
                aria-label="Clear range input value"
                className={`${prefixCls}-range-input-clearbtn`}
                onMouseDown={e => this.handleRangeInputClear(e)}>
                {clearIcon ? clearIcon : <IconClear aria-hidden />}
            </div>
        ) : null;
    }

    renderRangeSuffix(suffix: React.ReactNode) {
        const { prefixCls, disabled, rangeInputFocus } = this.props;
        const rangeSuffix = suffix ? (
            <div
                className={`${prefixCls}-range-input-suffix`}
                onClick={e => !disabled && !rangeInputFocus && this.handleRangeStartFocus(e)}
            >
                {suffix}
            </div>
        ) : null;
        return rangeSuffix;
    }

    renderRangeInput(rangeProps: DateInputProps) {
        const {
            // this.props
            placeholder,
            inputStyle,
            disabled,
            inputReadOnly,
            autofocus,
            size,
            // compute props
            text,
            suffix,
            inputCls,
            // range only props
            rangeInputStartRef,
            rangeInputEndRef,
            rangeInputFocus,
            prefixCls,
            rangeSeparator,
            borderless
        } = rangeProps;

        const [rangeStart, rangeEnd = ''] = text.split(rangeSeparator) || [];
        const rangeSize = size === 'large' ? 'default' : 'small';
        const rangePlaceholder = Array.isArray(placeholder) ? placeholder : [placeholder, placeholder];
        const [rangeStartPlaceholder, rangeEndPlaceholder] = rangePlaceholder;
        const inputLeftWrapperCls = cls(`${prefixCls}-range-input-wrapper-start`, `${prefixCls}-range-input-wrapper`, {
            [`${prefixCls}-range-input-wrapper-active`]: rangeInputFocus === 'rangeStart' && !disabled,
            [`${prefixCls}-range-input-wrapper-start-with-prefix`]: this.props.prefix || this.props.insetLabel,
            [`${prefixCls}-borderless`]: borderless
        });
        const inputRightWrapperCls = cls(`${prefixCls}-range-input-wrapper-end`, `${prefixCls}-range-input-wrapper`, {
            [`${prefixCls}-range-input-wrapper-active`]: rangeInputFocus === 'rangeEnd' && !disabled,
            [`${prefixCls}-borderless`]: borderless
        });
        return (
            <>
                {this.renderRangePrefix()}
                <div
                    onClick={e => !disabled && this.handleRangeInputFocus(e, 'rangeStart')}
                    className={`${inputCls} ${inputLeftWrapperCls}`}
                >
                    <Input
                        borderless={borderless}
                        size={rangeSize}
                        style={inputStyle}
                        disabled={disabled}
                        readonly={inputReadOnly}
                        placeholder={rangeStartPlaceholder}
                        value={rangeStart}
                        // range input onBlur function is called when panel is closed
                        // onBlur={noop}
                        onChange={(rangeStartValue, e) => this.handleRangeInputChange(rangeStartValue, rangeEnd, e)}
                        onEnterPress={e => this.handleRangeInputEnterPress(e, rangeStart, rangeEnd)}
                        onFocus={e => this.handleRangeInputFocus(e as any, 'rangeStart')}
                        autoFocus={autofocus} // autofocus moved to range start
                        ref={rangeInputStartRef}
                    />
                </div>
                {this.renderRangeSeparator(rangeStart, rangeEnd)}
                <div
                    className={`${inputCls} ${inputRightWrapperCls}`}
                    onClick={e => !disabled && this.handleRangeInputFocus(e, 'rangeEnd')}
                >
                    <Input
                        borderless={borderless}
                        size={rangeSize}
                        style={inputStyle}
                        disabled={disabled}
                        readonly={inputReadOnly}
                        placeholder={rangeEndPlaceholder}
                        value={rangeEnd}
                        // range input onBlur function is called when panel is closed
                        // onBlur={noop}
                        onChange={(rangeEndValue, e) => this.handleRangeInputChange(rangeStart, rangeEndValue, e)}
                        onEnterPress={e => this.handleRangeInputEnterPress(e, rangeStart, rangeEnd)}
                        onFocus={e => this.handleRangeInputFocus(e as any, 'rangeEnd')}
                        onKeyDown={this.handleRangeInputEndKeyPress} // only monitor tab button on range end
                        ref={rangeInputEndRef}
                    />
                </div>
                {this.renderRangeClearBtn(rangeStart, rangeEnd)}
                {this.renderRangeSuffix(suffix)}
            </>
        );
    }

    isRenderMultipleInputs() {
        const { type } = this.props;
        // isRange and not monthRange render multiple inputs
        return type.includes('Range') && type !== 'monthRange';
    }

    renderInputInset() {
        const {
            type,
            handleInsetDateFocus,
            handleInsetTimeFocus,
            value,
            insetInputValue,
            prefixCls,
            rangeInputStartRef,
            rangeInputEndRef,
            density,
            insetInput,
        } = this.props;

        const newInsetInputValue = this.foundation.getInsetInputValue({ value, insetInputValue });
        const { dateStart, dateEnd, timeStart, timeEnd } = get(insetInput, 'placeholder', {}) as InsetInputProps['placeholder'];
        const { datePlaceholder, timePlaceholder } = this.foundation.getInsetInputPlaceholder();

        const insetInputWrapperCls = `${prefixCls}-inset-input-wrapper`;
        const separatorCls = `${prefixCls}-inset-input-separator`;

        return (
            <div className={insetInputWrapperCls} x-type={type}>
                <InsetDateInput
                    forwardRef={rangeInputStartRef}
                    insetInputValue={newInsetInputValue}
                    placeholder={dateStart ?? datePlaceholder}
                    valuePath={'monthLeft.dateInput'}
                    onChange={this.handleInsetInputChange}
                    onFocus={e => handleInsetDateFocus(e, 'rangeStart')}
                />
                <InsetTimeInput
                    disabled={!newInsetInputValue.monthLeft.dateInput}
                    insetInputValue={newInsetInputValue}
                    placeholder={timeStart ?? timePlaceholder}
                    type={type}
                    valuePath={'monthLeft.timeInput'}
                    onChange={this.handleInsetInputChange}
                    onFocus={handleInsetTimeFocus}
                />
                {this.isRenderMultipleInputs() && (
                    <>
                        <div className={separatorCls}>{density === 'compact' ? null : '-'}</div>
                        <InsetDateInput
                            forwardRef={rangeInputEndRef}
                            insetInputValue={newInsetInputValue}
                            placeholder={dateEnd ?? datePlaceholder}
                            valuePath={'monthRight.dateInput'}
                            onChange={this.handleInsetInputChange}
                            onFocus={e => handleInsetDateFocus(e, 'rangeEnd')}
                        />
                        <InsetTimeInput
                            disabled={!newInsetInputValue.monthRight.dateInput}
                            insetInputValue={newInsetInputValue}
                            placeholder={timeEnd ?? timePlaceholder}
                            type={type}
                            valuePath={'monthRight.timeInput'}
                            onChange={this.handleInsetInputChange}
                            onFocus={handleInsetTimeFocus}
                        />
                    </>
                )}
            </div>
        );
    }

    renderTriggerInput() {
        const {
            placeholder,
            type,
            value,
            inputValue,
            inputStyle,
            disabled,
            showClear,
            inputReadOnly,
            insetLabel,
            validateStatus,
            block,
            prefixCls,
            multiple, // Whether to allow multiple values for email and file types
            dateFnsLocale, // No need to pass to input
            onBlur,
            onClear,
            onFocus,
            prefix,
            autofocus,
            size,
            inputRef,
            // range input support props, no need passing to not range type
            rangeInputStartRef,
            rangeInputEndRef,
            onRangeClear,
            onRangeBlur,
            onRangeEndTabPress,
            rangeInputFocus,
            rangeSeparator,
            insetInput,
            insetInputValue,
            defaultPickerValue,
            showClearIgnoreDisabled,
            ...rest
        } = this.props;
        const dateIcon = <IconCalendar aria-hidden />;
        const dateTimeIcon = <IconCalendarClock aria-hidden />;
        const suffix = type.includes('Time') ? dateTimeIcon : dateIcon;
        let text = '';

        if (!isNullOrUndefined(inputValue)) {
            text = inputValue;
        } else if (value) {
            text = this.formatText(value);
        }

        const inputCls = cls({
            [`${prefixCls}-input-readonly`]: inputReadOnly,
            [`${prefixCls}-monthRange-input`]: type === 'monthRange',
        });

        const rangeProps = { ...this.props, text, suffix, inputCls };

        return this.isRenderMultipleInputs() ? (
            this.renderRangeInput(rangeProps)
        ) : (
            <Input
                {...rest}
                ref={inputRef}
                insetLabel={insetLabel}
                disabled={disabled}
                showClearIgnoreDisabled={showClearIgnoreDisabled}
                readonly={inputReadOnly}
                className={inputCls}
                style={inputStyle}
                hideSuffix={showClear}
                placeholder={type === 'monthRange' && Array.isArray(placeholder) ? placeholder[0] + rangeSeparator + placeholder[1] : placeholder}
                onEnterPress={this.handleEnterPress}
                onChange={this.handleChange}
                onClear={this.handleInputClear}
                suffix={suffix}
                showClear={showClear}
                value={text}
                validateStatus={validateStatus}
                prefix={prefix}
                autoFocus={autofocus}
                size={size}
                onBlur={onBlur as any}
                onFocus={onFocus as any}
            />
        );
    }

    render() {
        const { insetInput } = this.props;
        return insetInput ? this.renderInputInset() : this.renderTriggerInput();
    }
}
