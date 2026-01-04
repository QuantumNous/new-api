import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { strings } from '@douyinfe/semi-foundation/timePicker/constants';
import { noop } from 'lodash';

import Input from '../input';
import BaseComponent, { BaseProps } from '../_base/baseComponent';
import InputFoundation, { TimeInputAdapter } from '@douyinfe/semi-foundation/timePicker/inputFoundation';
import { IconClock } from '@douyinfe/semi-icons';
import { TimePickerProps } from './TimePicker';


export type TimeInputProps = Pick<TimePickerProps,
'value' |
'format' |
'prefixCls' |
'placeholder' |
'clearText' |
'inputReadOnly' |
'disabled' |
'type' |
'timeZone' | 
'defaultOpen' |
'disabledHours' |
'disabledMinutes' |
'disabledSeconds' |
'dateFnsLocale' |
'onFocus' |
'onBlur' |
'focusOnOpen' |
'locale' |
'localeCode' |
'insetLabel' |
'validateStatus' |
'borderless'|
'preventScroll'> & BaseProps & {
    onChange?: (value: string) => void;
    onEsc?: () => void;
    onClick?: React.MouseEventHandler;
    defaultOpenValue?: boolean;
    currentSelectPanel?: string;
    timeStampValue?: any;
    invalid?: boolean
};

class TimeInput extends BaseComponent<TimeInputProps, any> {
    static propTypes = {
        borderless: PropTypes.bool,
        format: PropTypes.string,
        prefixCls: PropTypes.string,
        placeholder: PropTypes.string,
        clearText: PropTypes.string,
        inputReadOnly: PropTypes.bool,
        hourOptions: PropTypes.array,
        minuteOptions: PropTypes.array,
        secondOptions: PropTypes.array,
        disabledHours: PropTypes.func,
        disabledMinutes: PropTypes.func,
        disabledSeconds: PropTypes.func,
        onChange: PropTypes.func,
        onFocus: PropTypes.func,
        onBlur: PropTypes.func,
        onEsc: PropTypes.func,
        onClick: PropTypes.func,
        defaultOpenValue: PropTypes.object,
        currentSelectPanel: PropTypes.string,
        focusOnOpen: PropTypes.bool,
        timeStampValue: PropTypes.any,
        locale: PropTypes.object,
        localeCode: PropTypes.string,
        insetLabel: PropTypes.node,
        validateStatus: PropTypes.string,
        preventScroll: PropTypes.bool,
    };

    static defaultProps = {
        borderless: false,
        inputReadOnly: false,
        onChange: noop,
        onBlur: noop,
        onFocus: noop,
        onClick: noop,
        disabledHours: noop,
        disabledMinutes: noop,
        disabledSeconds: noop,
        format: strings.DEFAULT_FORMAT,
    };
    foundation: InputFoundation;

    constructor(props: TimeInputProps) {
        super(props);

        this.foundation = new InputFoundation(this.adapter);

        this.state = {
            // focusing: props.focusOnOpen,
        };
    }

    componentDidMount() {
        super.componentDidMount();
        const { focusOnOpen, preventScroll } = this.props;
        if (focusOnOpen) {
            const requestAnimationFrame = window.requestAnimationFrame || window.setTimeout;
            requestAnimationFrame(() => {
                const inputNode = this.adapter.getCache('inputNode');
                if (inputNode) {
                    inputNode.focus({ preventScroll });
                    inputNode.select();
                }
            });
        }
    }

    componentDidUpdate(prevProps: TimeInputProps) {
        const { timeStampValue } = this.props;

        if (this.isControlled('timeStampValue') && timeStampValue !== this.state.timeStampValue) {
            this.foundation.restoreCursor();
        }

        if (this.props.value !== prevProps.value) {
            this.foundation.restoreCursor();
        }
    }

    get adapter(): TimeInputAdapter {
        return {
            ...super.adapter,
            notifyChange: (...args) => this.props.onChange(...args),
            notifyFocus: (...args) => this.props.onFocus(...args),
            notifyBlur: (...args) => this.props.onBlur(...args),
        };
    }

    setRef = (node: HTMLElement) => this.adapter.setCache('inputNode', node);

    handleClick: React.MouseEventHandler = e => this.props.onClick(e);

    handleFocus: React.FocusEventHandler = e => this.foundation.handleFocus(e);

    handleBlur: React.FocusEventHandler = e => this.foundation.handleBlur(e);

    handleChange = (v: string) => this.foundation.handleChange(v);

    getInput() {
        const {
            prefixCls,
            placeholder,
            inputReadOnly,
            onFocus,
            disabled,
            type,
            locale,
            localeCode,
            insetLabel,
            validateStatus,
            value,
            onChange,
            invalid,
            format,
            clearText,
            disabledHours,
            disabledMinutes,
            disabledSeconds,
            onEsc,
            defaultOpenValue,
            currentSelectPanel,
            focusOnOpen,
            timeStampValue,
            timeZone,
            defaultOpen,
            dateFnsLocale,
            ...rest
        } = this.props;
        // const { focusing } = this.state;
        const inputCls = classNames(`${prefixCls}-input`, {
            [`${prefixCls}-input-invalid`]: invalid,
            [`${prefixCls}-input-readonly`]: inputReadOnly,
        });
        const mergeValidateStatus = invalid ? 'error' : validateStatus;
        return (
            <Input
                {...rest}
                hideSuffix
                className={inputCls}
                ref={this.setRef as any}
                value={value as any}
                placeholder={placeholder || locale.placeholder[type]}
                readonly={Boolean(inputReadOnly)}
                onChange={this.handleChange}
                onFocus={this.handleFocus}
                onBlur={this.handleBlur}
                suffix={<IconClock onClick={this.handleClick} />}
                validateStatus={mergeValidateStatus}
                disabled={disabled}
                insetLabel={insetLabel}
            />
        );
    }

    render() {
        const { prefixCls } = this.props;
        return <div className={`${prefixCls}-input-wrap`}>{this.getInput()}</div>;
    }
}

export default TimeInput;
