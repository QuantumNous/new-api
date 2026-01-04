import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { noop, get } from 'lodash';

import ConfigContext from '../configProvider/context';
import BaseComponent, { ValidateStatus } from '../_base/baseComponent';
import { strings, cssClasses } from '@douyinfe/semi-foundation/timePicker/constants';
import Popover, { PopoverProps } from '../popover';
import { numbers as popoverNumbers } from '@douyinfe/semi-foundation/popover/constants';
import TimePickerFoundation, { TimePickerAdapter } from '@douyinfe/semi-foundation/timePicker/foundation';
import isNullOrUndefined from '@douyinfe/semi-foundation/utils/isNullOrUndefined';
import Combobox from './Combobox';
import TimeInput from './TimeInput';

import { PanelShape, PanelShapeDefaults } from './PanelShape';
import { TimeShape } from './TimeShape';

import '@douyinfe/semi-foundation/timePicker/timePicker.scss';
import Trigger from '../trigger';

import { InputSize } from '../input';
import { Position } from '../tooltip';
import { ScrollItemProps } from '../scrollList/scrollItem';
import { Locale } from '../locale/interface';

export interface Panel {
    panelHeader?: React.ReactNode | React.ReactNode[];
    panelFooter?: React.ReactNode | React.ReactNode[]
}

export type BaseValueType = string | number | Date | undefined;

export type Type = 'time' | 'timeRange';

export type TimePickerProps = {
    'aria-describedby'?: React.AriaAttributes['aria-describedby'];
    'aria-errormessage'?: React.AriaAttributes['aria-errormessage'];
    'aria-invalid'?: React.AriaAttributes['aria-invalid'];
    'aria-labelledby'?: React.AriaAttributes['aria-labelledby'];
    'aria-required'?: React.AriaAttributes['aria-required'];
    autoAdjustOverflow?: boolean;
    autoFocus?: boolean; // TODO: autoFocus did not take effect
    borderless?: boolean;
    className?: string;
    clearText?: string;
    clearIcon?: React.ReactNode;
    dateFnsLocale?: Locale['dateFnsLocale'];
    defaultOpen?: boolean;
    defaultValue?: BaseValueType | BaseValueType[];
    disabled?: boolean;
    disabledHours?: () => number[];
    disabledMinutes?: (selectedHour: number) => number[];
    disabledSeconds?: (selectedHour: number, selectedMinute: number) => number[];
    dropdownMargin?: PopoverProps['margin'];
    focusOnOpen?: boolean;
    format?: string;
    getPopupContainer?: () => HTMLElement;
    hideDisabledOptions?: boolean;
    hourStep?: number;
    id?: string;
    inputReadOnly?: boolean;
    inputStyle?: React.CSSProperties;
    insetLabel?: React.ReactNode;
    insetLabelId?: string;
    locale?: Locale['TimePicker'];
    localeCode?: string;
    minuteStep?: number;
    motion?: boolean;
    open?: boolean;
    panelFooter?: React.ReactNode | React.ReactNode[];
    panelHeader?: React.ReactNode | React.ReactNode[];
    panels?: Panel[]; // FIXME:
    placeholder?: string;
    popupClassName?: string;
    popupStyle?: React.CSSProperties;
    position?: Position;
    prefixCls?: string;
    preventScroll?: boolean;
    rangeSeparator?: string;
    scrollItemProps?: ScrollItemProps<any>;
    secondStep?: number;
    showClear?: boolean;
    size?: InputSize;
    stopPropagation?: boolean;
    style?: React.CSSProperties;
    timeZone?: string | number;
    triggerRender?: (props?: any) => React.ReactNode;
    type?: Type;
    use12Hours?: boolean;
    validateStatus?: ValidateStatus;
    value?: BaseValueType | BaseValueType[];
    zIndex?: number | string;
    onBlur?: React.FocusEventHandler<HTMLInputElement>;
    onChange?: TimePickerAdapter['notifyChange'];
    onChangeWithDateFirst?: boolean;
    onFocus?: React.FocusEventHandler<HTMLInputElement>;
    onOpenChange?: (open: boolean) => void
};

export interface TimePickerState {
    open: boolean;
    value: Date[];
    inputValue: string;
    currentSelectPanel: string | number;
    isAM: [boolean, boolean];
    showHour: boolean;
    showMinute: boolean;
    showSecond: boolean;
    invalid: boolean
}

export default class TimePicker extends BaseComponent<TimePickerProps, TimePickerState> {
    static contextType = ConfigContext;
    static propTypes = {
        'aria-labelledby': PropTypes.string,
        'aria-invalid': PropTypes.bool,
        'aria-errormessage': PropTypes.string,
        'aria-describedby': PropTypes.string,
        'aria-required': PropTypes.bool,
        prefixCls: PropTypes.string,
        borderless: PropTypes.bool,
        clearText: PropTypes.string,
        clearIcon: PropTypes.node,
        value: TimeShape,
        inputReadOnly: PropTypes.bool,
        disabled: PropTypes.bool,
        showClear: PropTypes.bool,
        defaultValue: TimeShape,
        open: PropTypes.bool,
        defaultOpen: PropTypes.bool,
        onOpenChange: PropTypes.func,
        position: PropTypes.any,
        getPopupContainer: PropTypes.func,
        placeholder: PropTypes.string,
        format: PropTypes.string,
        style: PropTypes.object,
        className: PropTypes.string,
        popupClassName: PropTypes.string,
        popupStyle: PropTypes.object,
        disabledHours: PropTypes.func,
        disabledMinutes: PropTypes.func,
        disabledSeconds: PropTypes.func,
        dropdownMargin: PropTypes.oneOfType([PropTypes.number, PropTypes.object]),
        hideDisabledOptions: PropTypes.bool,
        onChange: PropTypes.func,
        use12Hours: PropTypes.bool,
        hourStep: PropTypes.number,
        minuteStep: PropTypes.number,
        secondStep: PropTypes.number,
        focusOnOpen: PropTypes.bool,
        autoFocus: PropTypes.bool,
        size: PropTypes.oneOf(strings.SIZE),
        stopPropagation: PropTypes.bool,
        panels: PropTypes.arrayOf(PropTypes.shape(PanelShape)),
        onFocus: PropTypes.func,
        onBlur: PropTypes.func,
        locale: PropTypes.object,
        localeCode: PropTypes.string,
        dateFnsLocale: PropTypes.object,
        zIndex: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
        insetLabel: PropTypes.node,
        insetLabelId: PropTypes.string,
        validateStatus: PropTypes.oneOf(strings.STATUS),
        type: PropTypes.oneOf<TimePickerProps['type']>(strings.TYPES),
        rangeSeparator: PropTypes.string,
        triggerRender: PropTypes.func,
        timeZone: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        scrollItemProps: PropTypes.object,
        motion: PropTypes.oneOfType([PropTypes.bool, PropTypes.func, PropTypes.object]),
        autoAdjustOverflow: PropTypes.bool,
        ...PanelShape,
        inputStyle: PropTypes.object,
        preventScroll: PropTypes.bool,
    };

    static defaultProps = {
        autoAdjustOverflow: true,
        borderless: false,
        getPopupContainer: () => document.body,
        showClear: true,
        zIndex: popoverNumbers.DEFAULT_Z_INDEX,
        rangeSeparator: strings.DEFAULT_RANGE_SEPARATOR,
        onOpenChange: noop,
        clearText: 'clear',
        prefixCls: cssClasses.PREFIX,
        inputReadOnly: false,
        style: {},
        stopPropagation: true,
        className: '',
        popupClassName: '',
        popupStyle: { left: '0px', top: '0px' },
        disabledHours: () => [] as number[],
        disabledMinutes: () => [] as number[],
        disabledSeconds: () => [] as number[],
        hideDisabledOptions: false,
        // position: 'bottomLeft',
        onFocus: noop,
        onBlur: noop,
        onChange: noop,
        onChangeWithDateFirst: true,
        use12Hours: false,
        focusOnOpen: false,
        onKeyDown: noop,
        size: 'default' as const,
        type: strings.DEFAULT_TYPE,
        motion: true,
        ...PanelShapeDefaults,
        // format: strings.DEFAULT_FORMAT,
        // open and value controlled
    };

    foundation: TimePickerFoundation;
    timePickerRef: React.MutableRefObject<HTMLDivElement>;
    savePanelRef: React.RefObject<HTMLDivElement>;
    useCustomTrigger: boolean;

    clickOutSideHandler: (e: MouseEvent) => void;


    constructor(props: TimePickerProps) {
        super(props);
        const { format = strings.DEFAULT_FORMAT } = props;

        this.state = {
            open: props.open || props.defaultOpen || false,
            value: [], // Date[]
            inputValue: '', // time string
            currentSelectPanel: 0,
            isAM: [true, false],
            showHour: Boolean(format.match(/HH|hh|H|h/g)),
            showMinute: Boolean(format.match(/mm/g)),
            showSecond: Boolean(format.match(/ss/g)),
            invalid: undefined
        };

        this.foundation = new TimePickerFoundation(this.adapter);
        this.timePickerRef = React.createRef();
        this.savePanelRef = React.createRef();
        this.useCustomTrigger = typeof this.props.triggerRender === 'function';
    }

    get adapter(): TimePickerAdapter<TimePickerProps, TimePickerState> {
        return {
            ...super.adapter,
            togglePanel: show => {
                this.setState({ open: show });
            },
            registerClickOutSide: () => {
                if (this.clickOutSideHandler) {
                    this.adapter.unregisterClickOutSide();
                }
                this.clickOutSideHandler = e => {
                    const panel = this.savePanelRef && this.savePanelRef.current;
                    const trigger = this.timePickerRef && this.timePickerRef.current;
                    const target = e.target as Element;
                    const path = e.composedPath && e.composedPath() || [target];

                    if (!(panel && panel.contains(target)) &&
                        !(trigger && trigger.contains(target)) &&
                        !(path.includes(trigger) || path.includes(panel))
                    ) {
                        this.foundation.handlePanelClose(true, e);
                    }
                };
                document.addEventListener('mousedown', this.clickOutSideHandler);
            },
            setInputValue: (inputValue, cb) => this.setState({ inputValue }, cb),
            unregisterClickOutSide: () => {
                if (this.clickOutSideHandler) {
                    document.removeEventListener('mousedown', this.clickOutSideHandler);
                    this.clickOutSideHandler = null;
                }
            },
            notifyOpenChange: (...args) => this.props.onOpenChange(...args),
            notifyChange: (agr1, arg2) => this.props.onChange && this.props.onChange(agr1, arg2),
            notifyFocus: (...args) => this.props.onFocus && this.props.onFocus(...args),
            notifyBlur: (...args) => this.props.onBlur && this.props.onBlur(...args),
            isRangePicker: () => this.props.type === strings.TYPE_TIME_RANGE_PICKER,
        };
    }

    static getDerivedStateFromProps(nextProps: TimePickerProps, prevState: TimePickerState) {
        if ('open' in nextProps && nextProps.open !== prevState.open) {
            return {
                open: nextProps.open,
            };
        }
        return null;
    }

    componentDidUpdate(prevProps: TimePickerProps) {
        // if (this.isControlled('open') && this.props.open != null && this.props.open !== prevProps.open) {
        //     this.foundation.setPanel(this.props.open);
        // }

        if (this.isControlled('value') && this.props.value !== prevProps.value) {
            this.foundation.refreshProps({
                ...this.props,
            });
        } else if (this.props.timeZone !== prevProps.timeZone) {
            this.foundation.refreshProps({
                timeZone: this.props.timeZone,
                __prevTimeZone: prevProps.timeZone,
                value: this.state.value,
            });
        }
    }

    onCurrentSelectPanelChange = (currentSelectPanel: string) => {
        this.setState({ currentSelectPanel });
    };

    handlePanelChange = (
        value: { isAM: boolean; value: string; timeStampValue: number },
        index: number
    ) => this.foundation.handlePanelChange(value, index);

    handleInput = (value: string) => this.foundation.handleInputChange(value);

    createPanelProps = (index = 0) => {
        const { panels, panelFooter, panelHeader, locale } = this.props;

        const panelProps = {
            panelHeader,
            panelFooter,
        };

        if (this.adapter.isRangePicker()) {
            const defaultHeaderMap = {
                0: locale.begin,
                1: locale.end,
            };

            panelProps.panelHeader = get(
                panels,
                index,
                isNullOrUndefined(panelHeader) ? get(defaultHeaderMap, index, null) : Array.isArray(panelHeader) ? panelHeader[index] : panelHeader
            );
            panelProps.panelFooter = get(panels, index, Array.isArray(panelFooter) ? panelFooter[index] : panelFooter) as React.ReactNode;
        }

        return panelProps;
    };

    getPanelElement() {
        const { prefixCls, type } = this.props;
        const { isAM, value } = this.state;

        const format = this.foundation.getDefaultFormatIfNeed();

        const timePanels = [
            <Combobox
                {...this.props}
                key={0}
                format={format}
                isAM={isAM[0]}
                timeStampValue={value[0]}
                prefixCls={`${prefixCls}-panel`}
                onChange={v => this.handlePanelChange(v, 0)}
                onCurrentSelectPanelChange={this.onCurrentSelectPanelChange}
                {...this.createPanelProps(0)}
            />,
        ];

        if (type === strings.TYPE_TIME_RANGE_PICKER) {
            timePanels.push(
                <Combobox
                    {...this.props}
                    key={1}
                    format={format}
                    isAM={isAM[1]}
                    timeStampValue={value[1]}
                    prefixCls={`${prefixCls}-panel`}
                    onChange={v => this.handlePanelChange(v, 1)}
                    onCurrentSelectPanelChange={this.onCurrentSelectPanelChange}
                    {...this.createPanelProps(1)}
                />
            );
        }

        const wrapCls = classNames({
            [cssClasses.RANGE_PANEL_LISTS]: this.adapter.isRangePicker(),
        });

        return (
            <div ref={this.savePanelRef} className={wrapCls}>
                {timePanels.map(panel => panel)}
            </div>
        );
    }

    getPopupClassName() {
        const { use12Hours, prefixCls, popupClassName } = this.props;
        const { showHour, showMinute, showSecond } = this.state;
        let selectColumnCount = 0;
        if (showHour) {
            selectColumnCount += 1;
        }
        if (showMinute) {
            selectColumnCount += 1;
        }
        if (showSecond) {
            selectColumnCount += 1;
        }
        if (use12Hours) {
            selectColumnCount += 1;
        }
        return classNames(
            `${prefixCls}-panel`,
            popupClassName,
            {
                [`${prefixCls}-panel-narrow`]: (!showHour || !showMinute || !showSecond) && !use12Hours,
                [cssClasses.RANGE_PICKER]: this.adapter.isRangePicker(),
            },
            `${prefixCls}-panel-column-${selectColumnCount}`
        );
    }

    focus() {
        // TODO this.picker is undefined, confirm keep this func or not
        // this.picker.focus();
    }

    blur() {
        // TODO this.picker is undefined, confirm keep this func or not
        // this.picker.blur();
    }

    /* istanbul ignore next */
    handlePanelVisibleChange = (visible: boolean) => this.foundation.handleVisibleChange(visible);

    openPanel = () => {
        this.foundation.handlePanelOpen();
    };

    handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        this.foundation.handleFocus(e);
    };

    handleBlur = (e: React.FocusEvent<HTMLInputElement>) => this.foundation.handleInputBlur(e);

    setTimePickerRef: React.LegacyRef<HTMLDivElement> = node => (this.timePickerRef.current = node);

    render() {
        const {
            prefixCls,
            placeholder,
            disabled,
            defaultValue,
            dropdownMargin,
            className,
            popupStyle,
            size,
            style,
            locale,
            localeCode,
            zIndex,
            getPopupContainer,
            insetLabel,
            insetLabelId,
            inputStyle,
            showClear,
            panelHeader,
            panelFooter,
            rangeSeparator,
            onOpenChange,
            onChangeWithDateFirst,
            popupClassName: propPopupClassName,
            hideDisabledOptions,
            use12Hours,
            minuteStep,
            hourStep,
            secondStep,
            scrollItemProps,
            triggerRender,
            motion,
            autoAdjustOverflow,
            stopPropagation,
            ...rest
        } = this.props;
        const format = this.foundation.getDefaultFormatIfNeed();
        const position = this.foundation.getPosition();

        const { open, inputValue, invalid, value } = this.state;
        const popupClassName = this.getPopupClassName();

        const headerPrefix = classNames({
            [`${prefixCls}-header`]: true,
        });

        const panelPrefix = classNames({
            [`${prefixCls}-panel`]: true,
            [`${prefixCls}-panel-${size}`]: size,
        });

        const inputProps = {
            ...rest,
            disabled,
            prefixCls,
            size,
            showClear: disabled ? false : showClear,
            style: inputStyle,
            value: inputValue,
            onFocus: this.handleFocus,
            insetLabel,
            insetLabelId,
            format,
            locale,
            localeCode,
            invalid,
            placeholder,
            onChange: this.handleInput,
            onBlur: this.handleBlur,
        };

        const outerProps = {} as { onClick: () => void };

        if (this.useCustomTrigger) {
            outerProps.onClick = this.openPanel;
        }

        return (
            <div
                ref={this.setTimePickerRef}
                className={classNames({ [prefixCls]: true }, className)}
                style={style}
                {...outerProps}
            >
                <Popover
                    getPopupContainer={getPopupContainer}
                    zIndex={zIndex as number}
                    prefixCls={panelPrefix}
                    contentClassName={popupClassName}
                    style={popupStyle}
                    content={this.getPanelElement()}
                    trigger={'custom'}
                    position={position}
                    visible={disabled ? false : Boolean(open)}
                    motion={motion}
                    margin={dropdownMargin}
                    autoAdjustOverflow={autoAdjustOverflow}
                    stopPropagation={stopPropagation}
                >
                    {this.useCustomTrigger ? (
                        <Trigger
                            triggerRender={triggerRender}
                            disabled={disabled}
                            value={value}
                            inputValue={inputValue}
                            onChange={this.handleInput}
                            placeholder={placeholder}
                            componentName={'TimePicker'}
                            componentProps={{ ...this.props }}
                        />
                    ) : (
                        <span className={headerPrefix}>
                            <TimeInput {...inputProps} />
                        </span>
                    )}
                </Popover>
            </div>
        );
    }
}
