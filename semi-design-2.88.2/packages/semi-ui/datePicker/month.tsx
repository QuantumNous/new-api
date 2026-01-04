/* eslint-disable jsx-a11y/click-events-have-key-events,jsx-a11y/no-noninteractive-element-interactions */
import React from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import MonthFoundation, { MonthAdapter, MonthDayInfo, MonthFoundationProps, MonthFoundationState } from '@douyinfe/semi-foundation/datePicker/monthFoundation';
import { cssClasses, numbers } from '@douyinfe/semi-foundation/datePicker/constants';
import BaseComponent, { BaseProps } from '../_base/baseComponent';
import { isBefore, isAfter, isBetween, isSameDay } from '@douyinfe/semi-foundation/datePicker/_utils/index';
import { noop, stubFalse, isFunction } from 'lodash';
import { parseISO } from 'date-fns';
import { Locale } from '../locale/interface';

const prefixCls = cssClasses.PREFIX;

export interface MonthProps extends MonthFoundationProps, BaseProps {
    forwardRef: React.Ref<any>;
    locale: Locale['DatePicker'];
    focusRecordsRef: React.RefObject<{ rangeStart: boolean; rangeEnd: boolean }>
}

export type MonthState = MonthFoundationState;

export default class Month extends BaseComponent<MonthProps, MonthState> {
    static propTypes = {
        month: PropTypes.object,
        selected: PropTypes.object,
        rangeStart: PropTypes.string,
        rangeEnd: PropTypes.string,
        offsetRangeStart: PropTypes.string,
        offsetRangeEnd: PropTypes.string,
        onDayClick: PropTypes.func,
        onDayHover: PropTypes.func,
        weekStartsOn: PropTypes.number,
        disabledDate: PropTypes.func,
        weeksRowNum: PropTypes.number,
        onWeeksRowNumChange: PropTypes.func,
        renderDate: PropTypes.func,
        renderFullDate: PropTypes.func,
        hoverDay: PropTypes.string, // Real-time hover date
        startDateOffset: PropTypes.func,
        endDateOffset: PropTypes.func,
        rangeInputFocus: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]),
        focusRecordsRef: PropTypes.object,
        multiple: PropTypes.bool,
    };

    static defaultProps = {
        month: new Date(),
        selected: new Set(),
        rangeStart: '',
        rangeEnd: '',
        onDayClick: noop,
        onDayHover: noop,
        onWeeksRowNumChange: noop,
        weekStartsOn: numbers.WEEK_START_ON,
        disabledDate: stubFalse,
        weeksRowNum: 0,
    };
    monthRef: React.RefObject<HTMLDivElement>;
    foundation: MonthFoundation;

    constructor(props: MonthProps) {
        super(props);
        this.state = {
            weekdays: [],
            month: { weeks: [], monthText: '' },
            todayText: '',
            weeksRowNum: props.weeksRowNum,
        };
        this.monthRef = React.createRef();
    }

    get adapter(): MonthAdapter {
        return {
            ...super.adapter,
            updateToday: todayText => this.setState({ todayText }),
            setWeekDays: weekdays => this.setState({ weekdays }),
            setWeeksRowNum: (weeksRowNum, callback) => this.setState({ weeksRowNum }, callback),
            updateMonthTable: month => this.setState({ month }),
            notifyDayClick: day => this.props.onDayClick(day),
            notifyDayHover: day => this.props.onDayHover(day),
            notifyWeeksRowNumChange: weeksRowNum => this.props.onWeeksRowNumChange(weeksRowNum),
        };
    }

    componentDidMount() {
        this.foundation = new MonthFoundation(this.adapter);
        this.foundation.init();
    }

    componentWillUnmount() {
        this.foundation.destroy();
    }

    componentDidUpdate(prevProps: MonthProps, prevState: MonthState) {
        if (prevProps.month !== this.props.month) {
            this.foundation.getMonthTable();
        }
    }

    getSingleDayStatus(options: Partial<MonthProps> & { fullDate: string; todayText: string }) {
        const { rangeInputFocus } = this.props;
        const { fullDate, todayText, selected, disabledDate, rangeStart, rangeEnd } = options;
        const disabledOptions = { rangeStart, rangeEnd, rangeInputFocus };
        const isToday = fullDate === todayText;
        const isSelected = selected.has(fullDate);

        let isDisabled = disabledDate && disabledDate(parseISO(fullDate), disabledOptions);
        if (
            !isDisabled &&
            this.props.rangeInputFocus === 'rangeStart' &&
            rangeEnd &&
            this.props.focusRecordsRef &&
            this.props.focusRecordsRef.current.rangeEnd
        ) {
            // The reason for splitting is that the dateRangeTime format: 'yyyy-MM-dd HH:MM:SS'
            isDisabled = isAfter(fullDate, rangeEnd.trim().split(/\s+/)[0]);
        }
        if (
            !isDisabled &&
            this.props.rangeInputFocus === 'rangeEnd' &&
            rangeStart &&
            this.props.focusRecordsRef &&
            this.props.focusRecordsRef.current.rangeStart
        ) {
            // The reason for splitting is that the dateRangeTime format: 'yyyy-MM-dd HH:MM:SS'
            isDisabled = isBefore(fullDate, rangeStart.trim().split(/\s+/)[0]);
        }

        return {
            isToday, // Today
            isSelected, // Selected
            isDisabled // Disabled
        };
    }

    getDateRangeStatus(options: Partial<MonthProps> & { fullDate: string }) {
        const { rangeStart, rangeEnd, fullDate, hoverDay, offsetRangeStart, offsetRangeEnd, rangeInputFocus } = options;

        // If no item is selected, return the empty object directly
        const _isDateRangeAnySelected = Boolean(rangeStart || rangeEnd);
        const _isDateRangeSelected = Boolean(rangeStart && rangeEnd);
        const _isOffsetDateRangeAnyExist = offsetRangeStart || offsetRangeEnd;
        if (!_isDateRangeAnySelected) {
            return ({});
        }

        // The range selects the hover date, and the normal hover is .semi-datepicker-main: hover
        const _isHoverDay = isSameDay(hoverDay, fullDate);

        // When one is selected
        let _isHoverAfterStart, _isHoverBeforeEnd, isSelectedStart, isSelectedEnd, isHoverDayAroundOneSelected;
        if (rangeStart) {
            isSelectedStart = isSameDay(fullDate, rangeStart);
            if (rangeInputFocus === 'rangeEnd') {
                _isHoverAfterStart = isBetween(fullDate, { start: rangeStart, end: hoverDay });
            }
        }
        if (rangeEnd) {
            isSelectedEnd = isSameDay(fullDate, rangeEnd);
            if (rangeInputFocus === 'rangeStart') {
                _isHoverBeforeEnd = isBetween(fullDate, { start: hoverDay, end: rangeEnd });
            }
        }

        if (!_isDateRangeSelected && _isDateRangeAnySelected) {
            isHoverDayAroundOneSelected = _isHoverDay;
        }

        let isHover;
        if (!_isOffsetDateRangeAnyExist) {
            isHover = _isHoverAfterStart || _isHoverBeforeEnd || _isHoverDay;
        }

        // Select all
        let isInRange, isSelectedStartAfterHover, isSelectedEndBeforeHover, isHoverDayInStartSelection, isHoverDayInEndSelection, isHoverDayInRange;
        if (_isDateRangeSelected) {
            isInRange = isBetween(fullDate, { start: rangeStart, end: rangeEnd });
            if (!_isOffsetDateRangeAnyExist) {
                isSelectedStartAfterHover = isSelectedStart && isAfter(rangeStart, hoverDay);
                isSelectedEndBeforeHover = isSelectedEnd && isBefore(rangeEnd, hoverDay);
                isHoverDayInStartSelection = _isHoverDay && rangeInputFocus === 'rangeStart';
                isHoverDayInEndSelection = _isHoverDay && rangeInputFocus === 'rangeEnd';
                isHoverDayInRange = _isHoverDay && isBetween(hoverDay, { start: rangeStart, end: rangeEnd });
            }
        }

        return {
            isHoverDay: _isHoverDay, // Is the current hover date
            isSelectedStart, // Select Start
            isSelectedEnd, // End of selection
            isInRange, // Range within the selected date
            isHover, // Date between selection and hover date
            isSelectedStartAfterHover, // Choose to start behind the hover
            isSelectedEndBeforeHover, // Choose to end in front of the hover
            isHoverDayInRange, // Hover date within range
            isHoverDayInStartSelection, // Hover date when starting Date is selected
            isHoverDayInEndSelection, // Hover date when endDate is selected
            isHoverDayAroundOneSelected, // Hover date and select a date
        };
    }

    getOffsetDateStatus(options: Partial<MonthProps> & { fullDate: string }) {
        const { offsetRangeStart, offsetRangeEnd, rangeStart, rangeEnd, fullDate, hoverDay } = options;

        // When there is no offset, return the empty object directly
        const _isOffsetDateRangeNull = !(offsetRangeStart || offsetRangeEnd);
        if (_isOffsetDateRangeNull) {
            return ({});
        }

        // Range Select base date
        const _isInRange = isBetween(fullDate, { start: rangeStart, end: rangeEnd });
        const _isHoverDay = isSameDay(hoverDay, fullDate);
        const _isSelectedStart = rangeStart && isSameDay(fullDate, rangeStart);
        const _isSelectedEnd = rangeEnd && isSameDay(fullDate, rangeEnd);
        const _isDateRangeSelected = Boolean(rangeStart && rangeEnd);

        // Determine whether it is offsetStart or offsetRangeEnd
        const isOffsetRangeStart = isSameDay(fullDate, offsetRangeStart);
        const isOffsetRangeEnd = isSameDay(fullDate, offsetRangeEnd);
        const isHoverDayOffset = _isHoverDay;

        // When selected
        let isHoverInOffsetRange, isInOffsetRange;
        if (_isDateRangeSelected) {
            isHoverInOffsetRange = _isInRange && _isHoverDay;
        }

        // When there is an offset area
        const _isOffsetDateRangeSelected = Boolean(offsetRangeStart && offsetRangeEnd);
        if (_isOffsetDateRangeSelected) {
            isInOffsetRange = (_isSelectedStart || isBetween(fullDate, { start: offsetRangeStart, end: offsetRangeEnd }) || _isSelectedEnd);
        }

        return {
            isOffsetRangeStart, // Week selection start
            isOffsetRangeEnd, // End of week selection
            isHoverInOffsetRange, // Hover in the week selection
            isHoverDayOffset, // Week selection hover day
            isInOffsetRange // Include start and end within the week selection (start and end styles are the same as other dates, so start and end are included)
        };
    }

    /**
     * get day current status
     * @param {Object} fullDate
     * @param {Object} options
     * @returns {Object}
     */
    getDayStatus(currentDay: MonthDayInfo, options: MonthProps & { todayText: string }) {
        const { fullDate } = currentDay;
        const { hoverDay, rangeStart, rangeEnd, todayText, offsetRangeStart, offsetRangeEnd, disabledDate, selected, rangeInputFocus } = options;

        const singleDayStatus = this.getSingleDayStatus({ fullDate, todayText, hoverDay, selected, disabledDate, rangeStart, rangeEnd });
        const dateRangeStatus = this.getDateRangeStatus({ fullDate, rangeStart, rangeEnd, hoverDay, offsetRangeStart, offsetRangeEnd, rangeInputFocus, ...singleDayStatus });
        const offsetDataStatus = this.getOffsetDateStatus({ offsetRangeStart, offsetRangeEnd, rangeStart, rangeEnd, fullDate, hoverDay, ...singleDayStatus, ...dateRangeStatus });

        // this parameter will pass to the user when given renderFullDate function, do not delete or modify its key
        const dayStatus = {
            ...singleDayStatus,
            ...dateRangeStatus,
            ...offsetDataStatus,
        };

        return dayStatus;
    }

    renderDayOfWeek() {
        const { locale } = this.props;
        const weekdayCls = classNames(cssClasses.WEEKDAY);
        const weekdayItemCls = classNames(`${prefixCls}-weekday-item`);
        const { weekdays } = this.state;
        // i18n
        const weekdaysText = weekdays.map(key => locale.weeks[key]);
        return (
            <div role="row" className={weekdayCls}>
                {weekdaysText.map((E, i) => (
                    <div role="columnheader" key={E + i} className={weekdayItemCls}>
                        {E}
                    </div>
                ))}
            </div>
        );
    }

    renderWeeks() {
        const { month } = this.state;
        const { weeks } = month;
        const { weeksRowNum } = this.props;
        let style = {};
        if (weeksRowNum) {
            const height = weeksRowNum * numbers.WEEK_HEIGHT;
            style = { height };
        }
        const weeksCls = classNames(cssClasses.WEEKS);
        return (
            <div className={weeksCls} style={style}>
                {weeks.map((week, weekIndex) => this.renderWeek(week, weekIndex))}
            </div>
        );
    }

    renderWeek(week: MonthDayInfo[], weekIndex: number) {
        const weekCls = cssClasses.WEEK;
        return (
            <div role="row" className={weekCls} key={weekIndex}>
                {week.map((day, dayIndex) => this.renderDay(day, dayIndex))}
            </div>
        );
    }

    renderDay(day: MonthDayInfo, dayIndex: number) {
        const { todayText } = this.state;
        const { renderFullDate, renderDate } = this.props;
        const { fullDate, dayNumber } = day;
        if (!fullDate) {
            return (
                <div role="gridcell" tabIndex={-1} key={(dayNumber as number) + dayIndex} className={cssClasses.DAY}>
                    <span />
                </div>
            );
        }

        const dayStatus = this.getDayStatus(day, { todayText, ...this.props });

        const dayCls = classNames(cssClasses.DAY, {
            [cssClasses.DAY_TODAY]: dayStatus.isToday,
            [cssClasses.DAY_IN_RANGE]: dayStatus.isInRange,
            [cssClasses.DAY_HOVER]: dayStatus.isHover,
            [cssClasses.DAY_SELECTED]: dayStatus.isSelected,
            [cssClasses.DAY_SELECTED_START]: dayStatus.isSelectedStart,
            [cssClasses.DAY_SELECTED_END]: dayStatus.isSelectedEnd,
            [cssClasses.DAY_DISABLED]: dayStatus.isDisabled,
            // offsetDate class
            [cssClasses.DAY_HOVER_DAY]: dayStatus.isHoverDayOffset,
            [cssClasses.DAY_IN_OFFSET_RANGE]: dayStatus.isInOffsetRange,
            [cssClasses.DAY_SELECTED_RANGE_HOVER]: dayStatus.isHoverInOffsetRange,
            [cssClasses.DAY_OFFSET_RANGE_START]: dayStatus.isOffsetRangeStart,
            [cssClasses.DAY_OFFSET_RANGE_END]: dayStatus.isOffsetRangeEnd,
            // range input class
            [cssClasses.DAY_SELECTED_START_AFTER_HOVER]: dayStatus.isSelectedStartAfterHover,
            [cssClasses.DAY_SELECTED_END_BEFORE_HOVER]: dayStatus.isSelectedEndBeforeHover,
            [cssClasses.DAY_HOVER_DAY_BEFORE_RANGE]: dayStatus.isHoverDayInStartSelection,
            [cssClasses.DAY_HOVER_DAY_AFTER_RANGE]: dayStatus.isHoverDayInEndSelection,
            [cssClasses.DAY_HOVER_DAY_AROUND_SINGLE_SELECTED]: dayStatus.isHoverDayAroundOneSelected,
        });

        const dayMainCls = classNames({
            [`${cssClasses.DAY}-main`]: true,
        });

        const fullDateArgs = [dayNumber, fullDate, dayStatus];
        const customRender = isFunction(renderFullDate);

        return (
            <div
                role="gridcell"
                tabIndex={dayStatus.isDisabled ? -1 : 0}
                aria-disabled={dayStatus.isDisabled}
                aria-selected={dayStatus.isSelected}
                aria-label={fullDate}
                className={!customRender ? dayCls : cssClasses.DAY}
                title={fullDate}
                key={(dayNumber as number) + dayIndex}
                onClick={e => !dayStatus.isDisabled && this.foundation.handleClick(day)}
                onMouseEnter={() => this.foundation.handleHover(day)}
                onMouseLeave={() => this.foundation.handleHover()}
            >
                {customRender ? renderFullDate(...fullDateArgs) : (
                    <div className={dayMainCls}>
                        {isFunction(renderDate) ? renderDate(dayNumber, fullDate) : <span>{dayNumber}</span>}
                    </div>
                )}
            </div>
        );
    }

    render() {
        const { forwardRef, multiple } = this.props;
        const weekday = this.renderDayOfWeek();
        const weeks = this.renderWeeks();
        const monthCls = classNames(cssClasses.MONTH);
        const ref = forwardRef || this.monthRef;
        return (
            <div role="grid" aria-multiselectable={multiple} ref={ref} className={monthCls} >
                {weekday}
                {weeks}
            </div>
        );
    }
}
