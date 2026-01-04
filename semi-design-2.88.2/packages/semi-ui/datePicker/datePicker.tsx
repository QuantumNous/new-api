/* eslint-disable jsx-a11y/click-events-have-key-events,jsx-a11y/interactive-supports-focus */
import React from 'react';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import { noop, stubFalse, isDate, get, isFunction, isEqual, pick } from 'lodash';
import ConfigContext, { ContextValue } from '../configProvider/context';
import DatePickerFoundation, {
    DatePickerAdapter,
    DatePickerFoundationProps,
    DatePickerFoundationState,
    DayStatusType,
    PresetType,
    Type,
    RangeType
} from '@douyinfe/semi-foundation/datePicker/foundation';
import MonthGridFoundation from '@douyinfe/semi-foundation/datePicker/monthsGridFoundation';
import { cssClasses, strings, numbers } from '@douyinfe/semi-foundation/datePicker/constants';
import { strings as popoverStrings, numbers as popoverNumbers } from '@douyinfe/semi-foundation/popover/constants';
import BaseComponent from '../_base/baseComponent';
import Popover, { PopoverProps } from '../popover/index';
import DateInput, { DateInputProps } from './dateInput';
import MonthsGrid, { MonthsGridProps } from './monthsGrid';
import QuickControl from './quickControl';
import Footer from './footer';
import Trigger from '../trigger';
import YearAndMonth, { YearAndMonthProps } from './yearAndMonth';
import '@douyinfe/semi-foundation/datePicker/datePicker.scss';
import { Locale } from '../locale/interface';
import { TimePickerProps } from '../timePicker/TimePicker';
import { ScrollItemProps } from '../scrollList/scrollItem';
import { InsetInputValue, InsetInputChangeProps } from '@douyinfe/semi-foundation/datePicker/inputFoundation';
import { getDefaultPropsFromGlobalConfig } from "../_utils";

export interface DatePickerProps extends DatePickerFoundationProps {
    'aria-describedby'?: React.AriaAttributes['aria-describedby'];
    'aria-errormessage'?: React.AriaAttributes['aria-errormessage'];
    'aria-invalid'?: React.AriaAttributes['aria-invalid'];
    'aria-labelledby'?: React.AriaAttributes['aria-labelledby'];
    'aria-required'?: React.AriaAttributes['aria-required'];
    clearIcon?: React.ReactNode;
    timePickerOpts?: TimePickerProps;
    bottomSlot?: React.ReactNode;
    insetLabel?: React.ReactNode;
    insetLabelId?: string;
    prefix?: React.ReactNode;
    topSlot?: React.ReactNode;
    rightSlot?: React.ReactNode;
    renderDate?: (dayNumber?: number, fullDate?: string) => React.ReactNode;
    renderFullDate?: (dayNumber?: number, fullDate?: string, dayStatus?: DayStatusType) => React.ReactNode;
    triggerRender?: (props: DatePickerProps) => React.ReactNode;
    /**
     * There are multiple input boxes when selecting a range, and the input boxes will be out of focus multiple times.
     *
     * Use `onOpenChange` or `onClickOutSide` instead
     */
    onBlur?: React.MouseEventHandler<HTMLInputElement>;
    onClear?: React.MouseEventHandler<HTMLDivElement>;
    /**
     * There are multiple input boxes when selecting a range, and the input boxes will be focused multiple times.
     *
     * Use `onOpenChange` or `triggerRender` instead
     */
    onFocus?: (e: React.MouseEvent, rangeType: RangeType) => void;
    onPresetClick?: (item: PresetType, e: React.MouseEvent<HTMLDivElement>) => void;
    onClickOutSide?: (e: React.MouseEvent) => void;
    locale?: Locale['DatePicker'];
    leftSlot?: React.ReactNode;
    dateFnsLocale?: Locale['dateFnsLocale'];
    yearAndMonthOpts?: ScrollItemProps<any>;
    dropdownMargin?: PopoverProps['margin']
}

export type DatePickerState = DatePickerFoundationState;

export default class DatePicker extends BaseComponent<DatePickerProps, DatePickerState> {
    static contextType = ConfigContext;
    static propTypes = {
        'aria-describedby': PropTypes.string,
        'aria-errormessage': PropTypes.string,
        'aria-invalid': PropTypes.bool,
        'aria-labelledby': PropTypes.string,
        'aria-required': PropTypes.bool,
        borderless: PropTypes.bool,
        type: PropTypes.oneOf(strings.TYPE_SET),
        size: PropTypes.oneOf(strings.SIZE_SET),
        clearIcon: PropTypes.node,
        density: PropTypes.oneOf(strings.DENSITY_SET),
        defaultValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.object, PropTypes.array]),
        value: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.object, PropTypes.array]),
        defaultPickerValue: PropTypes.oneOfType([
            PropTypes.string,
            PropTypes.number,
            PropTypes.object,
            PropTypes.array,
        ]),
        disabledTime: PropTypes.func,
        disabledTimePicker: PropTypes.bool,
        hideDisabledOptions: PropTypes.bool,
        format: PropTypes.string,
        disabled: PropTypes.bool,
        multiple: PropTypes.bool,
        max: PropTypes.number, // only work when multiple is true
        placeholder: PropTypes.oneOfType([PropTypes.string, PropTypes.array]),
        presets: PropTypes.array,
        presetPosition: PropTypes.oneOf(strings.PRESET_POSITION_SET),
        onChange: PropTypes.func,
        onChangeWithDateFirst: PropTypes.bool,
        weekStartsOn: PropTypes.number,
        disabledDate: PropTypes.func,
        timePickerOpts: PropTypes.object, // When dateTime, dateTimeRange, pass through the props to timePicker
        showClear: PropTypes.bool, // Whether to show the clear button
        onOpenChange: PropTypes.func,
        open: PropTypes.bool,
        defaultOpen: PropTypes.bool,
        motion: PropTypes.oneOfType([PropTypes.bool, PropTypes.func, PropTypes.object]),
        className: PropTypes.string,
        prefixCls: PropTypes.string,
        prefix: PropTypes.node,
        insetLabel: PropTypes.node,
        insetLabelId: PropTypes.string,
        zIndex: PropTypes.number,
        position: PropTypes.oneOf(popoverStrings.POSITION_SET),
        getPopupContainer: PropTypes.func,
        onCancel: PropTypes.func,
        onConfirm: PropTypes.func,
        needConfirm: PropTypes.bool,
        inputStyle: PropTypes.object,
        timeZone: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        triggerRender: PropTypes.func,
        stopPropagation: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
        autoAdjustOverflow: PropTypes.bool,
        onBlur: PropTypes.func,
        onFocus: PropTypes.func,
        onClear: PropTypes.func,
        style: PropTypes.object,
        autoFocus: PropTypes.bool,
        inputReadOnly: PropTypes.bool, // Text box can be entered
        validateStatus: PropTypes.oneOf(strings.STATUS),
        renderDate: PropTypes.func,
        renderFullDate: PropTypes.func,
        spacing: PropTypes.oneOfType([PropTypes.number, PropTypes.object]),
        startDateOffset: PropTypes.func,
        endDateOffset: PropTypes.func,
        autoSwitchDate: PropTypes.bool,
        dropdownClassName: PropTypes.string,
        dropdownStyle: PropTypes.object,
        dropdownMargin: PropTypes.oneOfType([PropTypes.number, PropTypes.object]),
        topSlot: PropTypes.node,
        bottomSlot: PropTypes.node,
        dateFnsLocale: PropTypes.object, // isRequired, but no need to add isRequired key. ForwardStatics function pass static properties to index.jsx, so there is no need for user to pass the prop.
        // Support synchronous switching of months
        syncSwitchMonth: PropTypes.bool,
        // Callback function for panel date switching
        onPanelChange: PropTypes.func,
        rangeSeparator: PropTypes.string,
        preventScroll: PropTypes.bool,
        yearAndMonthOpts: PropTypes.object,
        onClickOutSide: PropTypes.func,
    };
    static __SemiComponentName__ = "DatePicker";
    static defaultProps = getDefaultPropsFromGlobalConfig(DatePicker.__SemiComponentName__, {
        onChangeWithDateFirst: true,
        borderless: false,
        autoAdjustOverflow: true,
        stopPropagation: true,
        motion: true,
        prefixCls: cssClasses.PREFIX,
        presetPosition: 'bottom',
        // position: 'bottomLeft',
        zIndex: popoverNumbers.DEFAULT_Z_INDEX,
        type: 'date',
        size: 'default',
        density: 'default',
        multiple: false,
        defaultOpen: false,
        disabledHours: noop,
        disabledMinutes: noop,
        disabledSeconds: noop,
        hideDisabledOptions: false,
        onBlur: noop,
        onFocus: noop,
        onClear: noop,
        onCancel: noop,
        onConfirm: noop,
        onChange: noop,
        onOpenChange: noop,
        onPanelChange: noop,
        onPresetClick: noop,
        weekStartsOn: numbers.WEEK_START_ON,
        disabledDate: stubFalse,
        disabledTime: stubFalse,
        inputReadOnly: false,
        spacing: numbers.SPACING,
        autoSwitchDate: true,
        syncSwitchMonth: false,
        rangeSeparator: strings.DEFAULT_SEPARATOR_RANGE,
        insetInput: false,
        onClickOutSide: noop,
    });

    triggerElRef: React.MutableRefObject<HTMLElement>;
    panelRef: React.RefObject<HTMLDivElement>;
    monthGrid: React.RefObject<MonthsGrid>;
    inputRef: DateInputProps['inputRef'];
    rangeInputStartRef: DateInputProps['rangeInputStartRef'];
    rangeInputEndRef: DateInputProps['rangeInputEndRef'];
    focusRecordsRef: React.RefObject<{ rangeStart: boolean; rangeEnd: boolean }>;
    clickOutSideHandler: (e: MouseEvent) => void;
    _mounted: boolean;

    foundation: DatePickerFoundation;
    context: ContextValue;

    constructor(props: DatePickerProps) {
        super(props);
        this.state = {
            panelShow: props.open || props.defaultOpen,
            isRange: false,
            inputValue: null, // Staging input values
            value: [], // The currently selected date, each date is a Date object
            cachedSelectedValue: [], // Save last selected date, maybe include null
            prevTimeZone: null,
            rangeInputFocus: undefined, // Optional'rangeStart ',' rangeEnd ', false
            autofocus: props.autoFocus || (this.isRangeType(props.type, props.triggerRender) && (props.open || props.defaultOpen)),
            insetInputValue: null,
            triggerDisabled: undefined,
        };

        this.triggerElRef = React.createRef();
        this.panelRef = React.createRef();
        this.monthGrid = React.createRef();
        this.inputRef = React.createRef();
        this.rangeInputStartRef = React.createRef();
        this.rangeInputEndRef = React.createRef();
        this.focusRecordsRef = React.createRef();
        // @ts-ignore ignore readonly
        this.focusRecordsRef.current = {
            rangeStart: false,
            rangeEnd: false
        };

        this.foundation = new DatePickerFoundation(this.adapter);
    }

    get adapter(): DatePickerAdapter {
        return {
            ...super.adapter,
            togglePanel: (panelShow, cb) => {
                this.setState({ panelShow }, cb);
                if (!panelShow) {
                    this.focusRecordsRef.current.rangeEnd = false;
                    this.focusRecordsRef.current.rangeStart = false;
                }
            },
            registerClickOutSide: () => {
                if (this.clickOutSideHandler) {
                    this.adapter.unregisterClickOutSide();
                    this.clickOutSideHandler = null;
                }
                this.clickOutSideHandler = e => {
                    const triggerEl = this.triggerElRef && this.triggerElRef.current;
                    const panelEl = this.panelRef && this.panelRef.current;
                    const target = e.target as Element;
                    const path = e.composedPath && e.composedPath() || [target];
                    if (
                        !(triggerEl && triggerEl.contains(target)) &&
                        !(panelEl && panelEl.contains(target)) &&
                        !(path.includes(triggerEl) || path.includes(panelEl))
                    ) {
                        this.props.onClickOutSide(e as any);
                        if (!this.adapter.needConfirm()) {
                            this.foundation.closePanel();
                        }
                    }
                };
                document.addEventListener('mousedown', this.clickOutSideHandler);
            },
            unregisterClickOutSide: () => {
                document.removeEventListener('mousedown', this.clickOutSideHandler);
            },
            notifyBlur: (...args) => this.props.onBlur(...args),
            notifyFocus: (...args) => this.props.onFocus(...args),
            notifyClear: (...args) => this.props.onClear(...args),
            notifyChange: (...args) => this.props.onChange(...args),
            notifyCancel: (...args) => this.props.onCancel(...args),
            notifyConfirm: (...args) => this.props.onConfirm(...args),
            notifyOpenChange: (...args) => this.props.onOpenChange(...args),
            notifyPresetsClick: (...args) => this.props.onPresetClick(...args),
            updateValue: value => this.setState({ value }),
            updatePrevTimezone: prevTimeZone => this.setState({ prevTimeZone }),
            updateCachedSelectedValue: cachedSelectedValue => {
                let _cachedSelectedValue = cachedSelectedValue;
                if (cachedSelectedValue && !Array.isArray(cachedSelectedValue)) {
                    _cachedSelectedValue = [...cachedSelectedValue as any];
                }
                this.setState({ cachedSelectedValue: _cachedSelectedValue });
            },
            updateInputValue: inputValue => {
                this.setState({ inputValue });
            },
            updateInsetInputValue: (insetInputValue: InsetInputValue) => {
                const { insetInput } = this.props;
                if (insetInput && !isEqual(insetInputValue, this.state.insetInputValue)) {
                    this.setState({ insetInputValue });
                }
            },
            needConfirm: () =>
                ['dateTime', 'dateTimeRange'].includes(this.props.type) && this.props.needConfirm === true,
            typeIsYearOrMonth: () => ['month', 'year', 'monthRange'].includes(this.props.type),
            setRangeInputFocus: rangeInputFocus => {
                const { preventScroll } = this.props;
                if (rangeInputFocus !== this.state.rangeInputFocus) {
                    this.setState({ rangeInputFocus });
                }
                switch (rangeInputFocus) {
                    case 'rangeStart':
                        const inputStartNode = get(this, 'rangeInputStartRef.current') as HTMLInputElement;
                        inputStartNode && inputStartNode.focus({ preventScroll });
                        /**
                         * 解决选择完startDate，切换到endDate后panel被立马关闭的问题。
                         * 用户打开panel，选了startDate后，会执行setRangeInputFocus('rangeEnd'),focus到endDateInput，
                         * 同时会走到datePicker/foundation.js中的handleSelectedChange方法，在这个方法里会根据focusRecordsRef来判断是否可以关闭panel。
                         * 如果在setRangeInputFocus里同步修改了focusRecordsRef的状态为true，那在handleSelectedChange里会误判startDate和endDate都已经完成选择，
                         * 导致endDate还没选就关闭了panel
                         *
                         * Fix the problem that the panel is closed immediately after switching to endDate after starting Date is selected.
                         * The user opens the panel and after starting Date is selected, setRangeInputFocus ('rangeEnd') will be executed, focus to endDateInput,
                         * At the same time, it will go to the handleSelectedChange method in datePicker/foundation.js, where it will be determined whether the panel can be closed according to focusRecordsRef.
                         * If the status of focusRecordsRef is modified synchronously in setRangeInputFocus to true, then in handleSelectedChange it will be misjudged that both begDate and endDate have completed the selection,
                         * resulting in the panel being closed before endDate is selected
                         */
                        setTimeout(() => {
                            this.focusRecordsRef.current.rangeStart = true;
                        }, 0);
                        break;
                    case 'rangeEnd':
                        const inputEndNode = get(this, 'rangeInputEndRef.current') as HTMLInputElement;
                        inputEndNode && inputEndNode.focus({ preventScroll });
                        /**
                         * 解决选择完startDate，切换到endDate后panel被立马关闭的问题。
                         * 用户打开panel，选了startDate后，会执行setRangeInputFocus('rangeEnd'),focus到endDateInput，
                         * 同时会走到datePicker/foundation.js中的handleSelectedChange方法，在这个方法里会根据focusRecordsRef来判断是否可以关闭panel。
                         * 如果在setRangeInputFocus里同步修改了focusRecordsRef的状态为true，那在handleSelectedChange里会误判startDate和endDate都已经完成选择，
                         * 导致endDate还没选就关闭了panel
                         *
                         * Fix the problem that the panel is closed immediately after switching to endDate after starting Date is selected.
                         * The user opens the panel and after starting Date is selected, setRangeInputFocus ('rangeEnd') will be executed, focus to endDateInput,
                         * At the same time, it will go to the handleSelectedChange method in datePicker/foundation.js, where it will be determined whether the panel can be closed according to focusRecordsRef.
                         * If the status of focusRecordsRef is modified synchronously in setRangeInputFocus to true, then in handleSelectedChange it will be misjudged that both begDate and endDate have completed the selection,
                         * resulting in the panel being closed before endDate is selected
                         */
                        setTimeout(() => {
                            this.focusRecordsRef.current.rangeEnd = true;
                        }, 0);
                        break;
                    default:
                        return;
                }
            },
            couldPanelClosed: () => this.focusRecordsRef.current.rangeStart && this.focusRecordsRef.current.rangeEnd,
            isEventTarget: e => e && e.target === e.currentTarget,
            setInsetInputFocus: () => {
                const { preventScroll } = this.props;
                const { rangeInputFocus } = this.state;
                switch (rangeInputFocus) {
                    case 'rangeEnd':
                        if (document.activeElement !== this.rangeInputEndRef.current) {
                            const inputEndNode = get(this, 'rangeInputEndRef.current') as HTMLInputElement;
                            inputEndNode && inputEndNode.focus({ preventScroll });
                        }
                        break;
                    case 'rangeStart':
                    default:
                        if (document.activeElement !== this.rangeInputStartRef.current) {
                            const inputStartNode = get(this, 'rangeInputStartRef.current') as HTMLInputElement;
                            inputStartNode && inputStartNode.focus({ preventScroll });
                        }
                        break;
                }
            },
            setInputFocus: () => {
                const { preventScroll } = this.props;
                const inputNode = get(this, 'inputRef.current') as HTMLInputElement;
                inputNode && inputNode.focus({ preventScroll });
            },
            setInputBlur: () => {
                const inputNode = get(this, 'inputRef.current') as HTMLInputElement;
                inputNode && inputNode.blur();
            },
            setRangeInputBlur: () => {
                const { rangeInputFocus } = this.state;
                if (rangeInputFocus === 'rangeStart') {
                    const inputStartNode = get(this, 'rangeInputStartRef.current') as HTMLInputElement;
                    inputStartNode && inputStartNode.blur();
                } else if (rangeInputFocus === 'rangeEnd') {
                    const inputEndNode = get(this, 'rangeInputEndRef.current') as HTMLInputElement;
                    inputEndNode && inputEndNode.blur();
                }
                this.adapter.setRangeInputFocus(false);
            },
            setTriggerDisabled: (disabled: boolean) => {
                this.setState({ triggerDisabled: disabled });
            }
        };
    }

    isRangeType(type: Type, triggerRender: DatePickerProps['triggerRender']) {
        return /range/i.test(type) && !isFunction(triggerRender);
    }

    componentDidUpdate(prevProps: DatePickerProps) {
        if (!isEqual(prevProps.value, this.props.value)) {
            this.foundation.initFromProps({
                ...this.props,
            });
        } else if (this.props.timeZone !== prevProps.timeZone) {
            this.foundation.initFromProps({
                value: this.state.value,
                timeZone: this.props.timeZone,
                prevTimeZone: prevProps.timeZone,
            });
        }

        if (prevProps.open !== this.props.open) {
            this.foundation.initPanelOpenStatus();
            if (!this.props.open) {
                this.foundation.clearRangeInputFocus();
            }
        }
    }

    componentDidMount() {
        this._mounted = true;
        super.componentDidMount();
    }

    componentWillUnmount() {
        this._mounted = false;
        super.componentWillUnmount();
    }

    open() {
        this.foundation.open();
    }

    close() {
        this.foundation.close();
    }

    /**
     *
     * When selecting a range, the default focus is on the start input box, passing in `rangeEnd` can focus on the end input box
     *
     * When `insetInput` is `true`, due to trigger disabled, the cursor will focus on the input box of the popup layer panel
     *
     * 范围选择时，默认聚焦在开始输入框，传入 `rangeEnd` 可以聚焦在结束输入框
     *
     * `insetInput` 打开时，由于 trigger 禁用，会把焦点放在弹出面板的输入框上
     */
    focus(focusType?: Exclude<RangeType, false>) {
        this.foundation.focus(focusType);
    }

    blur() {
        this.foundation.blur();
    }

    setTriggerRef = (node: HTMLDivElement) => (this.triggerElRef.current = node);

    // Called when changes are selected by clicking on the selected date
    handleSelectedChange: MonthsGridProps['onChange'] = (v, options) => this.foundation.handleSelectedChange(v, options);

    // Called when the year and month change
    handleYMSelectedChange: YearAndMonthProps['onSelect'] = item => this.foundation.handleYMSelectedChange(item);

    disabledDisposeDate: MonthsGridProps['disabledDate'] = (date, ...rest) => this.foundation.disabledDisposeDate(date, ...rest);
    disabledDisposeTime: MonthsGridProps['disabledTime'] = (date, ...rest) => this.foundation.disabledDisposeTime(date, ...rest);

    renderMonthGrid(locale: Locale['DatePicker'], localeCode: string, dateFnsLocale: Locale['dateFnsLocale']) {
        const {
            type,
            multiple,
            max,
            weekStartsOn,
            timePickerOpts,
            defaultPickerValue,
            format,
            hideDisabledOptions,
            disabledTimePicker,
            renderDate,
            renderFullDate,
            startDateOffset,
            endDateOffset,
            autoSwitchDate,
            density,
            syncSwitchMonth,
            onPanelChange,
            timeZone,
            triggerRender,
            insetInput,
            presetPosition,
            yearAndMonthOpts,
            startYear,
            endYear
        } = this.props;
        const { cachedSelectedValue, rangeInputFocus } = this.state;

        const defaultValue = cachedSelectedValue;
        return (
            <MonthsGrid
                ref={this.monthGrid}
                locale={locale}
                localeCode={localeCode}
                dateFnsLocale={dateFnsLocale}
                weekStartsOn={weekStartsOn}
                type={type}
                multiple={multiple}
                max={max}
                format={format}
                disabledDate={this.disabledDisposeDate}
                hideDisabledOptions={hideDisabledOptions}
                disabledTimePicker={disabledTimePicker}
                disabledTime={this.disabledDisposeTime}
                defaultValue={defaultValue}
                defaultPickerValue={defaultPickerValue}
                timePickerOpts={timePickerOpts}
                isControlledComponent={!this.adapter.needConfirm() && this.isControlled('value')}
                onChange={this.handleSelectedChange}
                renderDate={renderDate}
                renderFullDate={renderFullDate}
                startDateOffset={startDateOffset}
                endDateOffset={endDateOffset}
                autoSwitchDate={autoSwitchDate}
                density={density}
                rangeInputFocus={rangeInputFocus}
                setRangeInputFocus={this.handleSetRangeFocus}
                isAnotherPanelHasOpened={this.isAnotherPanelHasOpened}
                syncSwitchMonth={syncSwitchMonth}
                onPanelChange={onPanelChange}
                timeZone={timeZone}
                focusRecordsRef={this.focusRecordsRef}
                triggerRender={triggerRender}
                insetInput={insetInput}
                presetPosition={presetPosition}
                renderQuickControls={this.renderQuickControls()}
                renderDateInput={this.renderDateInput()}
                yearAndMonthOpts={yearAndMonthOpts}
                startYear={startYear}
                endYear={endYear}
            />
        );
    }

    renderQuickControls() {
        const { presets, type, presetPosition, insetInput, locale } = this.props;
        return (
            <QuickControl
                type={type}
                presets={presets}
                insetInput={insetInput}
                presetPosition={presetPosition}
                onPresetClick={(item, e) => this.foundation.handlePresetClick(item, e)}
                locale={locale}
            />
        );
    }

    renderDateInput() {
        const { insetInput, dateFnsLocale, density, type, format, rangeSeparator, defaultPickerValue } = this.props;
        const { insetInputValue, value } = this.state;

        const props = {
            dateFnsLocale,
            format,
            insetInputValue,
            rangeSeparator,
            type,
            value: value as Date[],
            handleInsetDateFocus: this.handleInsetDateFocus,
            handleInsetTimeFocus: this.handleInsetTimeFocus,
            onInsetInputChange: this.handleInsetInputChange,
            rangeInputStartRef: this.rangeInputStartRef,
            rangeInputEndRef: this.rangeInputEndRef,
            density,
            defaultPickerValue
        };

        return insetInput ? <DateInput {...props} insetInput={insetInput} /> : null;
    }

    handleOpenPanel = () => this.foundation.openPanel();
    handleInputChange: DatePickerFoundation['handleInputChange'] = (...args) => this.foundation.handleInputChange(...args);
    handleInsetInputChange = (options: InsetInputChangeProps) => this.foundation.handleInsetInputChange(options);
    handleInputComplete: DatePickerFoundation['handleInputComplete'] = v => this.foundation.handleInputComplete(v);
    handleInputBlur: DateInputProps['onBlur'] = e => this.foundation.handleInputBlur(get(e, 'nativeEvent.target.value'), e);
    handleInputFocus: DatePickerFoundation['handleInputFocus'] = (...args) => this.foundation.handleInputFocus(...args);
    handleInputClear: DatePickerFoundation['handleInputClear'] = e => this.foundation.handleInputClear(e);
    handleTriggerWrapperClick: DatePickerFoundation['handleTriggerWrapperClick'] = e => this.foundation.handleTriggerWrapperClick(e);
    handleSetRangeFocus: DatePickerFoundation['handleSetRangeFocus'] = rangeInputFocus => this.foundation.handleSetRangeFocus(rangeInputFocus);
    handleRangeInputBlur = (value: any, e: any) => this.foundation.handleRangeInputBlur(value, e);
    handleRangeInputClear: DatePickerFoundation['handleRangeInputClear'] = e => this.foundation.handleRangeInputClear(e);
    handleRangeEndTabPress: DatePickerFoundation['handleRangeEndTabPress'] = e => this.foundation.handleRangeEndTabPress(e);
    isAnotherPanelHasOpened = (currentRangeInput: RangeType) => {
        if (currentRangeInput === 'rangeStart') {
            return this.focusRecordsRef.current.rangeEnd;
        } else {
            return this.focusRecordsRef.current.rangeStart;
        }
    };
    handleInsetDateFocus = (e: React.FocusEvent, rangeType: 'rangeStart' | 'rangeEnd') => {
        const monthGridFoundation = get(this, 'monthGrid.current.foundation') as MonthGridFoundation;
        if (monthGridFoundation) {
            monthGridFoundation.showDatePanel(strings.PANEL_TYPE_LEFT);
            monthGridFoundation.showDatePanel(strings.PANEL_TYPE_RIGHT);
        }
        this.handleInputFocus(e, rangeType);
    }

    handleInsetTimeFocus = () => {
        const monthGridFoundation = get(this, 'monthGrid.current.foundation') as MonthGridFoundation;
        if (monthGridFoundation) {
            monthGridFoundation.showTimePicker(strings.PANEL_TYPE_LEFT);
            monthGridFoundation.showTimePicker(strings.PANEL_TYPE_RIGHT);
        }
    }
    handlePanelVisibleChange = (visible: boolean) => {
        this.foundation.handlePanelVisibleChange(visible);
    }

    renderInner(extraProps?: Partial<DatePickerProps>) {
        const {
            clearIcon,
            type,
            format,
            multiple,
            disabled,
            showClear,
            insetLabel,
            insetLabelId,
            placeholder,
            validateStatus,
            inputStyle,
            prefix,
            locale,
            dateFnsLocale,
            triggerRender,
            size,
            inputReadOnly,
            rangeSeparator,
            insetInput,
            defaultPickerValue,
            borderless
        } = this.props;
        const { value, inputValue, rangeInputFocus, triggerDisabled } = this.state;
        // This class is not needed when triggerRender is function
        const isRangeType = this.isRangeType(type, triggerRender);
        const inputDisabled = disabled || insetInput && triggerDisabled;
        const inputCls = classnames(`${cssClasses.PREFIX}-input`, {
            [`${cssClasses.PREFIX}-range-input`]: isRangeType,
            [`${cssClasses.PREFIX}-range-input-${size}`]: isRangeType && size,
            [`${cssClasses.PREFIX}-range-input-active`]: isRangeType && rangeInputFocus && !inputDisabled,
            [`${cssClasses.PREFIX}-range-input-disabled`]: isRangeType && inputDisabled,
            [`${cssClasses.PREFIX}-range-input-${validateStatus}`]: isRangeType && validateStatus,
            [`${cssClasses.PREFIX}-borderless`]: borderless
        });
        const phText = placeholder || locale.placeholder[type]; // i18n
        // These values should be passed to triggerRender, do not delete any key if it is not necessary
        const props = {
            ...extraProps,
            showClearIgnoreDisabled: Boolean(insetInput),
            placeholder: phText,
            clearIcon,
            disabled: inputDisabled,
            inputValue,
            value: value as Date[],
            defaultPickerValue,
            onChange: this.handleInputChange,
            onEnterPress: this.handleInputComplete,
            // TODO: remove in next major version
            block: true,
            inputStyle,
            showClear,
            insetLabel,
            insetLabelId,
            type,
            format,
            multiple,
            validateStatus,
            inputReadOnly: inputReadOnly || Boolean(insetInput),
            // onClick: this.handleOpenPanel,
            onBlur: this.handleInputBlur,
            onFocus: this.handleInputFocus,
            onClear: this.handleInputClear,
            prefix,
            size,
            autofocus: this.state.autofocus,
            dateFnsLocale,
            rangeInputFocus,
            rangeSeparator,
            onRangeBlur: this.handleRangeInputBlur,
            onRangeClear: this.handleRangeInputClear,
            onRangeEndTabPress: this.handleRangeEndTabPress,
            rangeInputStartRef: insetInput ? null : this.rangeInputStartRef,
            rangeInputEndRef: insetInput ? null : this.rangeInputEndRef,
            inputRef: this.inputRef,
        };

        return (
            <div
                // tooltip will mount a11y props to children
                // eslint-disable-next-line jsx-a11y/role-has-required-aria-props
                role="combobox"
                aria-label={Array.isArray(value) && value.length ? "Change date" : "Choose date"}
                aria-disabled={disabled}
                onClick={this.handleTriggerWrapperClick}
                className={inputCls}>
                {typeof triggerRender === 'function' ? (
                    <Trigger
                        {...props}
                        triggerRender={triggerRender}
                        componentName="DatePicker"
                        componentProps={{ ...this.props }}
                    />
                ) : (
                    <DateInput {...props} />
                )}
            </div>
        );
    }

    handleConfirm = (e: React.MouseEvent) => this.foundation.handleConfirm();

    handleCancel = (e: React.MouseEvent) => this.foundation.handleCancel();

    renderFooter = (locale: Locale['DatePicker'], localeCode: string) => {
        if (this.adapter.needConfirm()) {
            return (
                <Footer
                    {...this.props}
                    locale={locale}
                    localeCode={localeCode}
                    onConfirmClick={this.handleConfirm}
                    onCancelClick={this.handleCancel}
                />
            );
        }

        return null;
    };

    renderPanel = (locale: Locale['DatePicker'], localeCode: string, dateFnsLocale: Locale['dateFnsLocale']) => {
        const { dropdownClassName, dropdownStyle, density, topSlot, bottomSlot, presetPosition, type, leftSlot, rightSlot } = this.props;
        const wrapCls = classnames(
            cssClasses.PREFIX,
            {
                [cssClasses.PANEL_YAM]: this.adapter.typeIsYearOrMonth(),
                [`${cssClasses.PREFIX}-compact`]: density === 'compact',
            },
            dropdownClassName
        );

        return (
            <div ref={this.panelRef} className={wrapCls} style={dropdownStyle} x-type={type}>
                <div className={`${cssClasses.PREFIX}-container`}>
                    {leftSlot && (
                        <div className={`${cssClasses.PREFIX}-leftSlot`} x-semi-prop="leftSlot">
                            {leftSlot}
                        </div>
                    )}
                    <div>
                        {topSlot && (
                            <div className={`${cssClasses.PREFIX}-topSlot`} x-semi-prop="topSlot">
                                {topSlot}
                            </div>
                        )}
                        {/* todo: monthRange does not support presetPosition temporarily */}
                        {presetPosition === "top" && type !== 'monthRange' && this.renderQuickControls()}
                        {this.adapter.typeIsYearOrMonth()
                            ? this.renderYearMonthPanel(locale, localeCode)
                            : this.renderMonthGrid(locale, localeCode, dateFnsLocale)}
                        {presetPosition === "bottom" && type !== 'monthRange' && this.renderQuickControls()}
                        {bottomSlot && (
                            <div className={`${cssClasses.PREFIX}-bottomSlot`} x-semi-prop="bottomSlot">
                                {bottomSlot}
                            </div>
                        )}
                    </div>
                    {rightSlot && (
                        <div className={`${cssClasses.PREFIX}-rightSlot`} x-semi-prop="rightSlot">
                            {rightSlot}
                        </div>
                    )}
                </div>
                {this.renderFooter(locale, localeCode)}
            </div>
        );
    };

    renderYearMonthPanel = (locale: Locale['DatePicker'], localeCode: string) => {
        const { density, presetPosition, yearAndMonthOpts, type, startYear, endYear } = this.props;

        const date = this.state.value[0];
        const year = { left: 0, right: 0 };
        const month = { left: 0, right: 0 };

        if (isDate(date)) {
            year.left = date.getFullYear();
            month.left = date.getMonth() + 1;
        }

        if (type === 'monthRange') {
            const dateRight = this.state.value[1];
            if (isDate(dateRight)) {
                year.right = dateRight.getFullYear();
                month.right = dateRight.getMonth() + 1;
            }
        }

        return (
            <YearAndMonth
                locale={locale}
                localeCode={localeCode}
                disabledDate={this.disabledDisposeDate}
                noBackBtn
                monthCycled
                onSelect={this.handleYMSelectedChange}
                currentYear={year}
                currentMonth={month}
                density={density}
                presetPosition={presetPosition}
                renderQuickControls={this.renderQuickControls()}
                renderDateInput={this.renderDateInput()}
                type={type}
                yearAndMonthOpts={yearAndMonthOpts}
                startYear={startYear}
                endYear={endYear}
            />
        );
    };

    wrapPopover = (children: React.ReactNode) => {
        const { panelShow } = this.state;
        // rtl changes the default position
        const { direction } = this.context;
        const defaultPosition = direction === 'rtl' ? 'bottomRight' : 'bottomLeft';
        const {
            motion,
            zIndex,
            position = defaultPosition,
            getPopupContainer,
            locale,
            localeCode,
            dateFnsLocale,
            stopPropagation,
            autoAdjustOverflow,
            spacing,
            dropdownMargin
        } = this.props;
        return (
            <Popover
                getPopupContainer={getPopupContainer}
                // wrapWhenSpecial={false}
                autoAdjustOverflow={autoAdjustOverflow}
                zIndex={zIndex}
                motion={motion}
                margin={dropdownMargin}
                content={this.renderPanel(locale, localeCode, dateFnsLocale)}
                trigger="custom"
                position={position}
                visible={panelShow}
                stopPropagation={stopPropagation}
                spacing={spacing}
                onVisibleChange={this.handlePanelVisibleChange}
            >
                {children}
            </Popover>
        );
    };

    render() {
        const { style, className, prefixCls, type, ...rest } = this.props;
        const outerProps = {
            style,
            className: classnames(className, { [prefixCls]: true }),
            ref: this.setTriggerRef,
            'aria-invalid': this.props['aria-invalid'],
            'aria-errormessage': this.props['aria-errormessage'],
            'aria-labelledby': this.props['aria-labelledby'],
            'aria-describedby': this.props['aria-describedby'],
            'aria-required': this.props['aria-required'],
            ...this.getDataAttr(rest)
        };

        const innerPropKeys: string[] = [];
        if (!type.toLowerCase().includes("range")) {
            innerPropKeys.push("borderless");
        }
        const inner = this.renderInner(pick(this.props, innerPropKeys));
        const wrappedInner = this.wrapPopover(inner);

        return <div {...outerProps}>
            {wrappedInner}
        </div>;
    }
}
