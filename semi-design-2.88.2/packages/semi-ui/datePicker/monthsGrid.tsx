/* eslint-disable jsx-a11y/interactive-supports-focus */
import React from 'react';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import { format as formatFn, addMonths, isSameDay } from 'date-fns';

import MonthsGridFoundation, { MonthInfo, MonthsGridAdapter, MonthsGridDateAdapter, MonthsGridFoundationProps, MonthsGridFoundationState, MonthsGridRangeAdapter, PanelType } from '@douyinfe/semi-foundation/datePicker/monthsGridFoundation';
import { strings, numbers, cssClasses } from '@douyinfe/semi-foundation/datePicker/constants';
import { compatibleParse } from '@douyinfe/semi-foundation/datePicker/_utils/parser';
import { noop, stubFalse } from 'lodash';
import BaseComponent, { BaseProps } from '../_base/baseComponent';
import Navigation from './navigation';
import Month from './month';
import Combobox from '../timePicker/Combobox';
import YearAndMonth from './yearAndMonth';
import { IconClock, IconCalendar } from '@douyinfe/semi-icons';
import { getDefaultFormatTokenByType } from '@douyinfe/semi-foundation/datePicker/_utils/getDefaultFormatToken';
import getDefaultPickerDate from '@douyinfe/semi-foundation/datePicker/_utils/getDefaultPickerDate';
import { ScrollItemProps } from '../scrollList/scrollItem';

const prefixCls = cssClasses.PREFIX;

export interface MonthsGridProps extends MonthsGridFoundationProps, BaseProps {
    navPrev?: React.ReactNode;
    navNext?: React.ReactNode;
    renderDate?: () => React.ReactNode;
    renderFullDate?: () => React.ReactNode;
    focusRecordsRef?: React.RefObject<{ rangeStart: boolean; rangeEnd: boolean }>;
    yearAndMonthOpts?: ScrollItemProps<any>
}

export type MonthsGridState = MonthsGridFoundationState;

export default class MonthsGrid extends BaseComponent<MonthsGridProps, MonthsGridState> {
    static propTypes = {
        type: PropTypes.oneOf(strings.TYPE_SET),
        defaultValue: PropTypes.array,
        defaultPickerValue: PropTypes.oneOfType([
            PropTypes.string,
            PropTypes.number,
            PropTypes.object,
            PropTypes.array,
        ]),
        multiple: PropTypes.bool,
        max: PropTypes.number, // only work when multiple is true
        weekStartsOn: PropTypes.number,
        disabledDate: PropTypes.func,
        disabledTime: PropTypes.func,
        disabledTimePicker: PropTypes.bool,
        hideDisabledOptions: PropTypes.bool,
        navPrev: PropTypes.node,
        navNext: PropTypes.node,
        onMaxSelect: PropTypes.func,
        timePickerOpts: PropTypes.object,
        // Whether the outer datePicker is a controlled component
        isControlledComponent: PropTypes.bool,
        rangeStart: PropTypes.oneOfType([PropTypes.string]),
        rangeInputFocus: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
        locale: PropTypes.object,
        localeCode: PropTypes.string,
        format: PropTypes.string,
        renderDate: PropTypes.func,
        renderFullDate: PropTypes.func,
        startDateOffset: PropTypes.func,
        endDateOffset: PropTypes.func,
        autoSwitchDate: PropTypes.bool,
        density: PropTypes.string,
        dateFnsLocale: PropTypes.object.isRequired,
        timeZone: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        // Support synchronous switching of months
        syncSwitchMonth: PropTypes.bool,
        // Callback function for panel date switching
        onPanelChange: PropTypes.func,
        focusRecordsRef: PropTypes.object,
        triggerRender: PropTypes.func,
        presetPosition: PropTypes.oneOf(strings.PRESET_POSITION_SET),
        renderQuickControls: PropTypes.node,
        renderDateInput: PropTypes.node
    };

    static defaultProps = {
        type: 'date',
        rangeStart: '',
        multiple: false,
        weekStartsOn: numbers.WEEK_START_ON,
        disabledDate: stubFalse,
        onMaxSelect: noop,
        locale: {},
    };
    foundation: MonthsGridFoundation;

    constructor(props: MonthsGridProps) {
        super(props);
        const validFormat = props.format || getDefaultFormatTokenByType(props.type);
        const { nowDate, nextDate } = getDefaultPickerDate({ defaultPickerValue: props.defaultPickerValue, format: validFormat, dateFnsLocale: props.dateFnsLocale });

        const dateState = {
            // Direct use of full date string storage, mainly considering the month rendering comparison to save a conversion
            // The selected value for single or multiple selection, full date string, eg. {'2019-10-01', '2019-10-02'}
            selected: new Set<string>(),
        };

        const rangeState = {
            monthLeft: {
                pickerDate: nowDate,
                showDate: nowDate,
                isTimePickerOpen: false,
                isYearPickerOpen: false,
            },
            monthRight: {
                pickerDate: nextDate,
                showDate: nextDate,
                isTimePickerOpen: false,
                isYearPickerOpen: false,
            },
            maxWeekNum: 0, // Maximum number of weeks left and right for manual height adjustment
            hoverDay: '', // Real-time hover date
            rangeStart: props.rangeStart, // Start date for range selection
            rangeEnd: '', // End date of range selection
            currentPanelHeight: 0, // current month panel height,
            offsetRangeStart: '',
            offsetRangeEnd: '',
        };
        this.state = {
            ...dateState,
            ...rangeState,
        };

        this.foundation = new MonthsGridFoundation(this.adapter);
    }

    get dateAdapter(): MonthsGridDateAdapter {
        return {
            updateDaySelected: selected => this.setState({ selected }),
        };
    }

    get rangeAdapter(): MonthsGridRangeAdapter {
        return {
            setRangeStart: rangeStart => this.setState({ rangeStart }),
            setRangeEnd: rangeEnd => this.setState({ rangeEnd }),
            setHoverDay: hoverDay => this.setState({ hoverDay }),
            setWeeksHeight: maxWeekNum => this.setState({ maxWeekNum }),
            setOffsetRangeStart: offsetRangeStart => this.setState({ offsetRangeStart }),
            setOffsetRangeEnd: offsetRangeEnd => this.setState({ offsetRangeEnd }),
        };
    }

    get adapter(): MonthsGridAdapter {
        return {
            ...super.adapter,
            ...this.dateAdapter,
            ...this.rangeAdapter,
            updateMonthOnLeft: v => this.setState({ monthLeft: v }),
            updateMonthOnRight: v => this.setState({ monthRight: v }),
            notifySelectedChange: (value, options) => this.props.onChange(value, options),
            notifyMaxLimit: v => this.props.onMaxSelect(v),
            notifyPanelChange: (date, dateString) => this.props.onPanelChange(date, dateString),
            setRangeInputFocus: rangeInputFocus => this.props.setRangeInputFocus(rangeInputFocus),
            isAnotherPanelHasOpened: currentRangeInput => this.props.isAnotherPanelHasOpened(currentRangeInput)
        };
    }

    componentDidMount() {
        super.componentDidMount();
    }

    componentDidUpdate(prevProps: MonthsGridProps, prevState: MonthsGridState) {
        const { defaultValue, defaultPickerValue } = this.props;
        if (prevProps.defaultValue !== defaultValue) {
            // we should always update panel state when value changes
            this.foundation.updateSelectedFromProps(defaultValue);
        }

        if (prevProps.defaultPickerValue !== defaultPickerValue) {
            this.foundation.initDefaultPickerValue();
        }


        const isRange = this.foundation.isRangeType();
        if (isRange) {
            /**
             * we have to add these code to ensure that scroll list's selector places center
             */
            const prevAll = this.leftIsYearOrTime(prevState) && this.rightIsYearOrTime(prevState);
            const prevSome =
                (this.leftIsYearOrTime(prevState) && !this.rightIsYearOrTime(prevState)) ||
                (!this.leftIsYearOrTime(prevState) && this.rightIsYearOrTime(prevState));
            const nowAll = this.leftIsYearOrTime() && this.rightIsYearOrTime();
            const nowSome =
                (this.leftIsYearOrTime() && !this.rightIsYearOrTime()) ||
                (!this.leftIsYearOrTime() && this.rightIsYearOrTime());
            const prevAllToSome = prevAll && nowSome;
            const prevSomeToAll = prevSome && nowAll;

            if (prevSomeToAll) {
                this.setState({ currentPanelHeight: this.calcScrollListHeight() }, this.reselect);
            } else if (prevAllToSome) {
                this.reselect();
            }
        }
    }

    cacheRefCurrent = (key: string, current: Combobox | YearAndMonth | HTMLDivElement) => {
        if (typeof key === 'string' && key.length) {
            this.adapter.setCache(key, current);
        }
    };

    leftIsYearOrTime = (state?: MonthsGridState) => {
        const { monthLeft } = state || this.state;

        if (monthLeft && (monthLeft.isTimePickerOpen || monthLeft.isYearPickerOpen)) {
            return true;
        } else {
            return false;
        }
    };

    rightIsYearOrTime = (state?: MonthsGridState) => {
        const { monthRight } = state || this.state;

        if (monthRight && (monthRight.isTimePickerOpen || monthRight.isYearPickerOpen)) {
            return true;
        } else {
            return false;
        }
    };

    /**
     * Calculate the height of the scrolling list, if the animation is not over, return 0
     */
    calcScrollListHeight = () => {
        const wrapLeft = this.adapter.getCache(`wrap-${strings.PANEL_TYPE_LEFT}`);
        const wrapRight = this.adapter.getCache(`wrap-${strings.PANEL_TYPE_RIGHT}`);
        const switchLeft = this.adapter.getCache(`switch-${strings.PANEL_TYPE_LEFT}`);
        const switchRight = this.adapter.getCache(`switch-${strings.PANEL_TYPE_RIGHT}`);

        const leftRect = wrapLeft && wrapLeft.getBoundingClientRect();
        const rightRect = wrapRight && wrapRight.getBoundingClientRect();

        let leftHeight = (leftRect && leftRect.height) || 0;
        let rightHeight = (rightRect && rightRect.height) || 0;


        if (switchLeft) {
            leftHeight += switchLeft.getBoundingClientRect().height;
        }
        if (switchRight) {
            rightHeight += switchRight.getBoundingClientRect().height;
        }

        return Math.max(leftHeight, rightHeight);
    };

    renderPanel(month: Date, panelType: PanelType) {
        let monthCls = classnames(`${prefixCls}-month-grid-${panelType}`);
        const { monthLeft, monthRight, currentPanelHeight } = this.state;
        const { insetInput } = this.props;
        const panelDetail = panelType === strings.PANEL_TYPE_RIGHT ? monthRight : monthLeft;
        const { isTimePickerOpen, isYearPickerOpen } = panelDetail;

        const panelContent = this.renderMonth(month, panelType);

        const yearAndMonthLayer = isYearPickerOpen ? (
            <div className={`${prefixCls}-yam`}>{this.renderYearAndMonth(panelType, panelDetail)}</div>
        ) : null;
        const timePickerLayer = isTimePickerOpen ? (
            <div className={`${prefixCls}-tpk`}>{this.renderTimePicker(panelType, panelDetail)}</div>
        ) : null;

        const style: React.CSSProperties = {};
        const wrapLeft = this.adapter.getCache(`wrap-${strings.PANEL_TYPE_LEFT}`);
        const wrapRight = this.adapter.getCache(`wrap-${strings.PANEL_TYPE_RIGHT}`);
        const wrap = panelType === strings.PANEL_TYPE_RIGHT ? wrapRight : wrapLeft;

        if (this.foundation.isRangeType()) {
            if (isYearPickerOpen || isTimePickerOpen) {
                style.minWidth = wrap.getBoundingClientRect().width;
            }

            if (this.leftIsYearOrTime() && this.rightIsYearOrTime() && !insetInput) {
                /**
                 * left和right同时为tpk时，panel会有一个minHeight
                 * 如果缓存的currentPanelHeight为0，则需要计算滚动列表的高度
                 * 如果有缓存的值则使用currentPanelHeight（若此高度<实际值，则会影响ScrollList中渲染列表的循环次数）
                 * 详见 packages/semi-foundation/scrollList/itemFoundation.js initWheelList函数
                 * 
                 * When left and right are tpk at the same time, the panel will have a minHeight
                 * If the cached currentPanelHeight is 0, you need to calculate the height of the scrolling list
                 * If there is a cached value, use currentPanelHeight (if this height is less than the actual value, it will affect the number of cycles in the ScrollList to render the list)
                 * See packages/semi-foundation/scrollList/itemFoundation.js initWheelList function
                 */

                style.minHeight = currentPanelHeight ? currentPanelHeight : this.calcScrollListHeight();
            }
        } else if (
            this.props.type !== 'year' &&
            this.props.type !== 'month' &&
            (isTimePickerOpen || isYearPickerOpen)
        ) {
            monthCls = classnames(monthCls, `${prefixCls}-yam-showing`);
        }

        const _isDatePanelOpen = !(isYearPickerOpen || isTimePickerOpen);
        const xOpenType = _isDatePanelOpen ? 'date' : isYearPickerOpen ? 'year' : 'time';

        return (
            <div className={monthCls} key={panelType} style={style} x-open-type={xOpenType}>
                {yearAndMonthLayer}
                {timePickerLayer}
                {/* {isYearPickerOpen || isTimePickerOpen ? null : panelContent} */}
                {this.foundation.isRangeType() ? panelContent : isYearPickerOpen || isTimePickerOpen ? null : panelContent}
                {this.renderSwitch(panelType)}
            </div>
        );
    }

    showYearPicker(panelType: PanelType, e: React.MouseEvent) {
        // e.stopPropagation();
        // When switching to the year and month, the e.target at this time is generated from Navigation, and the Navigation module will be removed from the DOM after switching
        // If you do not prevent the event from spreading to index.jsx, panel.contain (e.target) in clickOutSide will call closePanel because there is no Nav in the Panel and think this click is clickOutSide
        // Cause the entire component pop-up window to be closed by mistake
        // console.log(this.navRef.current.clientHeight, this.monthRef.current.clientHeight);
        // this.wrapRef.current.style.height = this.wrapRef.current.clientHeight + 'px';
        // this.wrapRef.current.style.overflow = 'hidden';
        e.nativeEvent.stopImmediatePropagation();
        this.foundation.showYearPicker(panelType);
    }

    renderMonth(month: Date, panelType: PanelType) {
        const { selected, rangeStart, rangeEnd, hoverDay, maxWeekNum, offsetRangeStart, offsetRangeEnd } = this.state;
        const { weekStartsOn, disabledDate, locale, localeCode, renderDate, renderFullDate, startDateOffset, endDateOffset, density, rangeInputFocus, syncSwitchMonth, multiple } = this.props;
        let monthText = '';
        // i18n monthText
        if (month) {
            // Get the absolute value of the year and month
            const yearNumber = month ? formatFn(month, 'yyyy') : '';
            const monthNumber = month ? formatFn(month, 'L') : '';
            // Display the month as the corresponding language text
            const mText = locale.months[monthNumber];
            const monthFormatToken = locale.monthText;
            // Display the year and month in a specific language format order
            monthText = monthFormatToken.replace('${year}', yearNumber).replace('${month}', mText);
        }

        let style = {};
        const detail = panelType === strings.PANEL_TYPE_RIGHT ? this.state.monthRight : this.state.monthLeft;
        // Whether to select type for range
        const isRangeType = this.foundation.isRangeType();
        // Whether to switch synchronously for two panels
        const shouldBimonthSwitch = isRangeType && syncSwitchMonth;

        if (isRangeType && detail && (detail.isYearPickerOpen || detail.isTimePickerOpen)) {
            style = {
                visibility: 'hidden',
                position: 'absolute',
                pointerEvents: 'none',
            };
        }

        return (
            <div ref={current => this.cacheRefCurrent(`wrap-${panelType}`, current)} style={style}>
                <Navigation
                    forwardRef={current => this.cacheRefCurrent(`nav-${panelType}`, current)}
                    monthText={monthText}
                    density={density}
                    onMonthClick={e => this.showYearPicker(panelType, e)}
                    onPrevMonth={() => this.foundation.prevMonth(panelType)}
                    onNextMonth={() => this.foundation.nextMonth(panelType)}
                    onNextYear={() => this.foundation.nextYear(panelType)}
                    onPrevYear={() => this.foundation.prevYear(panelType)}
                    shouldBimonthSwitch={shouldBimonthSwitch}
                    panelType={panelType}
                />
                <Month
                    locale={locale}
                    localeCode={localeCode}
                    forwardRef={current => this.cacheRefCurrent(`month-${panelType}`, current)}
                    disabledDate={disabledDate}
                    weekStartsOn={weekStartsOn}
                    month={month}
                    selected={selected}
                    rangeStart={rangeStart}
                    rangeEnd={rangeEnd}
                    rangeInputFocus={rangeInputFocus}
                    offsetRangeStart={offsetRangeStart}
                    offsetRangeEnd={offsetRangeEnd}
                    hoverDay={hoverDay}
                    weeksRowNum={maxWeekNum}
                    renderDate={renderDate}
                    renderFullDate={renderFullDate}
                    onDayClick={day => this.foundation.handleDayClick(day, panelType)}
                    onDayHover={day => this.foundation.handleDayHover(day, panelType)}
                    onWeeksRowNumChange={weeksRowNum => this.handleWeeksRowNumChange(weeksRowNum, panelType)}
                    startDateOffset={startDateOffset}
                    endDateOffset={endDateOffset}
                    focusRecordsRef={this.props.focusRecordsRef}
                    multiple={multiple}
                />
            </div>
        );
    }

    handleWeeksRowNumChange = (weeksRowNum: number, panelType: PanelType) => {
        const isLeft = panelType === strings.PANEL_TYPE_RIGHT;
        const isRight = panelType === strings.PANEL_TYPE_RIGHT;
        const allIsYearOrTime = this.leftIsYearOrTime() && this.rightIsYearOrTime();

        if (this.foundation.isRangeType() && !allIsYearOrTime) {
            const states = { weeksRowNum, currentPanelHeight: this.calcScrollListHeight() };

            this.setState(states, () => {
                if ((this.leftIsYearOrTime() && isRight) || (this.rightIsYearOrTime() && isLeft)) {
                    this.reselect();
                }
            });
        }
    };

    reselect = () => {
        const refKeys = [
            `timepicker-${strings.PANEL_TYPE_LEFT}`,
            `timepicker-${strings.PANEL_TYPE_RIGHT}`,
            `yam-${strings.PANEL_TYPE_LEFT}`,
            `yam-${strings.PANEL_TYPE_RIGHT}`,
        ];

        refKeys.forEach(key => {
            const current = this.adapter.getCache(key);

            if (current && typeof current.reselect === 'function') {
                current.reselect();
            }
        });
    };

    getYAMOpenType = () => {
        return this.foundation.getYAMOpenType();
    }

    renderTimePicker(panelType: PanelType, panelDetail: MonthInfo) {
        const { type, locale, format, hideDisabledOptions, timePickerOpts, dateFnsLocale } = this.props;
        const { pickerDate } = panelDetail;
        const timePanelCls = classnames(`${prefixCls}-time`);
        const restProps = {
            ...timePickerOpts,
            hideDisabledOptions,
        };

        const disabledOptions = this.foundation.calcDisabledTime(panelType);

        if (disabledOptions) {
            ['disabledHours', 'disabledMinutes', 'disabledSeconds'].forEach(key => {
                if (disabledOptions[key]) {
                    restProps[key] = disabledOptions[key];
                }
            });
        }

        const { rangeStart, rangeEnd } = this.state;
        const dateFormat = this.foundation.getValidDateFormat();
        let startDate,
            endDate;
        if (
            type === 'dateTimeRange' &&
            rangeStart &&
            rangeEnd &&
            isSameDay(
                (startDate = compatibleParse(rangeStart, dateFormat, undefined, dateFnsLocale)),
                (endDate = compatibleParse(rangeEnd, dateFormat, undefined, dateFnsLocale))
            )
        ) {
            if (panelType === strings.PANEL_TYPE_RIGHT) {
                rangeStart && (restProps.startDate = startDate);
            } else {
                rangeEnd && (restProps.endDate = endDate);
            }
        }
        // i18n placeholder
        const placeholder = locale.selectTime;
        return (
            <div className={timePanelCls}>
                <Combobox
                    ref={current => this.cacheRefCurrent(`timepicker-${panelType}`, current)}
                    panelHeader={placeholder}
                    format={format || strings.FORMAT_TIME_PICKER}
                    timeStampValue={pickerDate}
                    onChange={(newTime: { timeStampValue: number }) => this.foundation.handleTimeChange(newTime, panelType)}
                    {...restProps}
                />
            </div>
        );
    }

    renderYearAndMonth(panelType: PanelType, panelDetail: MonthInfo) {
        const { pickerDate } = panelDetail;
        const { locale, localeCode, density, yearAndMonthOpts, startYear, endYear } = this.props;
        const y = pickerDate.getFullYear();
        const m = pickerDate.getMonth() + 1;
        return (
            <YearAndMonth
                ref={current => this.cacheRefCurrent(`yam-${panelType}`, current)}
                locale={locale}
                localeCode={localeCode}
                // currentYear={y}
                // currentMonth={m}
                currentYear={{ left: y, right: 0 }}
                currentMonth={{ left: m, right: 0 }}
                onSelect={item =>
                    this.foundation.toYearMonth(panelType, new Date(item.currentYear.left, item.currentMonth.left - 1))
                }
                onBackToMain={() => {
                    this.foundation.showDatePanel(panelType);
                    const wrapCurrent = this.adapter.getCache(`wrap-${panelType}`);
                    if (wrapCurrent) {
                        wrapCurrent.style.height = 'auto';
                    }
                }}
                density={density}
                yearAndMonthOpts={yearAndMonthOpts}
                startYear={startYear}
                endYear={endYear}
            />
        );
    }

    renderSwitch(panelType: PanelType) {
        const { rangeStart, rangeEnd, monthLeft, monthRight } = this.state;
        const { type, locale, disabledTimePicker, density, dateFnsLocale, insetInput } = this.props;
        // Type: date, dateRange, year, month, inset input no rendering required
        if (!type.includes('Time') || insetInput) {
            return null;
        }

        // switch year/month & time
        let panelDetail,
            dateText;

        // i18n
        const { FORMAT_SWITCH_DATE } = locale.localeFormatToken;
        // Timepicker format is constant and does not change with language
        // const FORMAT_TIME_PICKER = strings.FORMAT_TIME_PICKER;
        const formatTimePicker = this.foundation.getValidTimeFormat();
        const dateFormat = this.foundation.getValidDateFormat();

        if (panelType === strings.PANEL_TYPE_LEFT) {
            panelDetail = monthLeft;
            dateText = rangeStart ? formatFn(compatibleParse(rangeStart, dateFormat, undefined, dateFnsLocale), FORMAT_SWITCH_DATE) : '';
        } else {
            panelDetail = monthRight;
            dateText = rangeEnd ? formatFn(compatibleParse(rangeEnd, dateFormat, undefined, dateFnsLocale), FORMAT_SWITCH_DATE) : '';
        }

        const { isTimePickerOpen, showDate } = panelDetail;
        const monthText = showDate ? formatFn(showDate, FORMAT_SWITCH_DATE) : '';

        const timeText = showDate ? formatFn(showDate, formatTimePicker) : '';

        const showSwitchIcon = ['default'].includes(density);

        const switchCls = classnames(`${prefixCls}-switch`);
        const dateCls = classnames({
            [`${prefixCls}-switch-date`]: true,
            [`${prefixCls}-switch-date-active`]: !isTimePickerOpen,
        });
        const timeCls = classnames({
            [`${prefixCls}-switch-time`]: true,
            [`${prefixCls}-switch-time-disabled`]: disabledTimePicker,
            [`${prefixCls}-switch-date-active`]: isTimePickerOpen,
        });
        const textCls = classnames(`${prefixCls}-switch-text`);

        return (
            <div className={switchCls} ref={current => this.adapter.setCache(`switch-${panelType}`, current)}>
                <div
                    role="button"
                    aria-label="Switch to date panel"
                    className={dateCls}
                    onClick={e => this.foundation.showDatePanel(panelType)}
                >
                    {showSwitchIcon && <IconCalendar aria-hidden />}
                    <span className={textCls}>{dateText || monthText}</span>
                </div>
                <div
                    role="button"
                    aria-label="Switch to time panel"
                    className={timeCls}
                    onClick={e => this.foundation.showTimePicker(panelType, true)}
                >
                    {showSwitchIcon && <IconClock aria-hidden />}
                    <span className={textCls}>{timeText}</span>
                </div>
            </div>
        );
    }


    render() {
        const { monthLeft, monthRight } = this.state;
        const { type, insetInput, presetPosition, renderQuickControls, renderDateInput } = this.props;
        const monthGridCls = classnames({
            [`${prefixCls}-month-grid`]: true,
        });
        const panelTypeLeft = strings.PANEL_TYPE_LEFT;
        const panelTypeRight = strings.PANEL_TYPE_RIGHT;
        let content = null;
        if (type === 'date' || type === 'dateTime') {
            content = this.renderPanel(monthLeft.pickerDate, panelTypeLeft);
        } else if (type === 'dateRange' || type === 'dateTimeRange') {
            content = [
                this.renderPanel(monthLeft.pickerDate, panelTypeLeft),
                this.renderPanel(monthRight.pickerDate, panelTypeRight),
            ];
        } else if (type === 'year' || type === 'month') {
            content = 'year month';
        }
        const yearOpenType = this.getYAMOpenType();

        return (
            <div style={{ display: 'flex' }}>
                {presetPosition === "left" && renderQuickControls}
                <div>
                    {renderDateInput}
                    <div
                        className={monthGridCls}
                        x-type={type}
                        x-panel-yearandmonth-open-type={yearOpenType}
                        // FIXME:
                        x-insetinput={insetInput ? "true" : "false"}
                        x-preset-position={renderQuickControls === null ? 'null' : presetPosition}
                        ref={current => this.cacheRefCurrent('monthGrid', current)}
                    >
                        {content}
                    </div>
                </div>
                {presetPosition === "right" && renderQuickControls}
            </div>
        );
    }
}
