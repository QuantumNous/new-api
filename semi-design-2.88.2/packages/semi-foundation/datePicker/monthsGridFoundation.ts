import BaseFoundation, { DefaultAdapter } from '../base/foundation';
import { strings } from './constants';
import {
    format,
    set,
    addMonths,
    subMonths,
    subYears,
    addYears,
    differenceInCalendarMonths,
    differenceInCalendarYears,
    isSameDay,
    parseISO
} from 'date-fns';
import { isBefore, isValidDate, getDefaultFormatToken, getFullDateOffset } from './_utils/index';
import { formatFullDate, WeekStartNumber } from './_utils/getMonthTable';
import { compatibleParse } from './_utils/parser';
import { includes, isSet, isEqual, isFunction } from 'lodash';
import { zonedTimeToUtc } from '../utils/date-fns-extra';
import { getDefaultFormatTokenByType } from './_utils/getDefaultFormatToken';
import isNullOrUndefined from '../utils/isNullOrUndefined';
import { BaseValueType, DateInputFoundationProps, PresetPosition, ValueType } from './foundation';
import { MonthDayInfo } from './monthFoundation';
import { ArrayElement } from '../utils/type';
import isValidTimeZone from './_utils/isValidTimeZone';
import { YearAndMonthFoundationProps } from './yearAndMonthFoundation';

const dateDiffFns = {
    month: differenceInCalendarMonths,
    year: differenceInCalendarYears,
};

const dateCalcFns = {
    prevMonth: subMonths,
    nextMonth: addMonths,
    prevYear: subYears,
    nextYear: addYears,
};


type Type = ArrayElement<typeof strings.TYPE_SET>;

interface MonthsGridElementProps {
    // navPrev?: React.ReactNode;
    navPrev?: any;
    // navNext?: React.ReactNode;
    navNext?: any;
    // renderDate?: () => React.ReactNode;
    renderDate?: () => any;
    // renderFullDate?: () => React.ReactNode;
    renderFullDate?: () => any
}

export type PanelType = 'left' | 'right';
export type YearMonthChangeType = 'prevMonth' | 'nextMonth' | 'prevYear' | 'nextYear';

export interface MonthsGridFoundationProps extends MonthsGridElementProps, Pick<YearAndMonthFoundationProps, 'startYear' | 'endYear'> {
    type?: Type;
    /** may be null if selection is not complete when type is dateRange or dateTimeRange */
    defaultValue?: (Date | null)[];
    defaultPickerValue?: ValueType;
    multiple?: boolean;
    max?: number;
    splitPanels?: boolean;
    weekStartsOn?: WeekStartNumber;
    disabledDate?: (date: Date, options?: { rangeStart: string; rangeEnd: string }) => boolean;
    disabledTime?: (date: Date | Date[], panelType: PanelType) => void;
    disabledTimePicker?: boolean;
    hideDisabledOptions?: boolean;
    onMaxSelect?: (v?: any) => void;
    timePickerOpts?: any;
    isControlledComponent?: boolean;
    rangeStart?: string;
    rangeInputFocus?: boolean | string;
    locale?: any;
    localeCode?: string;
    format?: string;
    startDateOffset?: () => void;
    endDateOffset?: () => void;
    autoSwitchDate?: boolean;
    density?: string;
    dateFnsLocale?: any;
    timeZone?: string | number;
    syncSwitchMonth?: boolean;
    onChange?: (
        value: [Date] | [Date, Date],
        options?: { closePanel?: boolean; needCheckFocusRecord?: boolean }
    ) => void;
    onPanelChange?: (date: Date | Date[], dateString: string | string[]) => void;
    setRangeInputFocus?: (rangeInputFocus: 'rangeStart' | 'rangeEnd') => void;
    isAnotherPanelHasOpened?: (currentRangeInput: 'rangeStart' | 'rangeEnd') => boolean;
    focusRecordsRef?: any;
    triggerRender?: (props: Record<string, any>) => any;
    insetInput: DateInputFoundationProps['insetInput'];
    presetPosition?: PresetPosition;
    renderQuickControls?: any;
    renderDateInput?: any
}

export interface MonthInfo {
    /** The date displayed in the current date panel, update when switching year and month */
    pickerDate: Date;
    /**
     * Default date or selected date (when selected)
     */
    showDate: Date;
    isTimePickerOpen: boolean;
    isYearPickerOpen: boolean
}

export interface MonthsGridFoundationState {
    selected: Set<string>;
    monthLeft: MonthInfo;
    monthRight: MonthInfo;
    maxWeekNum: number; // Maximum number of weeks left and right for manual height adjustment
    hoverDay: string; // Real-time hover date
    rangeStart: string; // Start date for range selection
    rangeEnd: string; // End date of range selection
    currentPanelHeight: number; // current month panel height,
    offsetRangeStart: string;
    offsetRangeEnd: string;
    weeksRowNum?: number
}

export interface MonthsGridDateAdapter {
    updateDaySelected: (selected: Set<string>) => void
}
export interface MonthsGridRangeAdapter {
    setRangeStart: (rangeStart: string) => void;
    setRangeEnd: (rangeEnd: string) => void;
    setHoverDay: (hoverDay: string) => void;
    setWeeksHeight: (maxWeekNum: number) => void;
    setOffsetRangeStart: (offsetRangeStart: string) => void;
    setOffsetRangeEnd: (offsetRangeEnd: string) => void
}

export interface MonthsGridAdapter extends DefaultAdapter<MonthsGridFoundationProps, MonthsGridFoundationState>, MonthsGridRangeAdapter, MonthsGridDateAdapter {
    updateMonthOnLeft: (v: MonthInfo) => void;
    updateMonthOnRight: (v: MonthInfo) => void;
    notifySelectedChange: MonthsGridFoundationProps['onChange'];
    notifyMaxLimit: MonthsGridFoundationProps['onMaxSelect'];
    notifyPanelChange: MonthsGridFoundationProps['onPanelChange'];
    setRangeInputFocus: MonthsGridFoundationProps['setRangeInputFocus'];
    isAnotherPanelHasOpened: MonthsGridFoundationProps['isAnotherPanelHasOpened']
}

export default class MonthsGridFoundation extends BaseFoundation<MonthsGridAdapter> {
    newBiMonthPanelDate: [Date, Date];

    constructor(adapter: MonthsGridAdapter) {
        super({ ...adapter });
        // Date change data when double panels
        this.newBiMonthPanelDate = [this.getState('monthLeft').pickerDate, this.getState('monthRight').pickerDate];
    }

    init() {
        const defaultValue = this.getProp('defaultValue');
        this.initDefaultPickerValue();
        this.updateSelectedFromProps(defaultValue);
    }

    initDefaultPickerValue() {
        const defaultPickerValue = compatibleParse(this.getProp('defaultPickerValue'));

        if (defaultPickerValue && isValidDate(defaultPickerValue)) {
            this._updatePanelDetail(strings.PANEL_TYPE_LEFT, {
                pickerDate: defaultPickerValue,
            });

            this._updatePanelDetail(strings.PANEL_TYPE_RIGHT, {
                pickerDate: addMonths(defaultPickerValue, 1),
            });
        }
    }

    updateSelectedFromProps(values: (Date | null)[], refreshPicker = true) {
        const type: Type = this.getProp('type');
        const { selected, rangeStart, rangeEnd } = this.getStates();
        if (values && values?.length) {
            switch (type) {
                case 'date':
                    this._initDatePickerFromValue(values, refreshPicker);
                    break;
                case 'dateRange':
                    this._initDateRangePickerFromValue(values);
                    break;
                case 'dateTime':
                    this._initDateTimePickerFromValue(values);
                    break;
                case 'dateTimeRange':
                    this._initDateTimeRangePickerFormValue(values);
                    break;
                default:
                    break;
            }
        } else if (Array.isArray(values) && !values.length || !values) {
            // Empty panel when value is empty Select date
            if (isSet(selected) && selected.size) {
                this._adapter.updateDaySelected(new Set());
            }
            if (rangeStart) {
                this._adapter.setRangeStart('');
            }
            if (rangeEnd) {
                this._adapter.setRangeEnd('');
            }
        }
    }

    calcDisabledTime(panelType: PanelType) {
        const { disabledTime, type } = this.getProps();
        if (typeof disabledTime === 'function' && panelType && ['dateTime', 'dateTimeRange'].includes(type)) {
            const { rangeStart, rangeEnd, monthLeft } = this.getStates();
            const selected = [];
            if (type === 'dateTimeRange') {
                if (rangeStart) {
                    selected.push(rangeStart);
                }
                if (rangeStart && rangeEnd) {
                    selected.push(rangeEnd);
                }
            } else if (monthLeft && monthLeft.showDate) {
                selected.push(monthLeft.showDate);
            }
            const selectedDates = selected.map(str => (str instanceof Date ? str : parseISO(str)));
            const cbDates = type === 'dateTimeRange' ? selectedDates : selectedDates[0];
            return disabledTime(cbDates, panelType);
        }
    }

    _initDatePickerFromValue(values: Date[], refreshPicker = true) {
        const { monthLeft } = this._adapter.getStates();
        const newMonthLeft = { ...monthLeft };
        // REMOVE:
        this._adapter.updateMonthOnLeft(newMonthLeft);
        const newSelected = new Set<string>();
        const isMultiple = this._isMultiple();
        if (!isMultiple) {
            values[0] && newSelected.add(format(values[0] as Date, strings.FORMAT_FULL_DATE));
        } else {
            values.forEach(date => {
                date && newSelected.add(format(date as Date, strings.FORMAT_FULL_DATE));
            });
        }
        if (refreshPicker) {
            if (isMultiple) {
                const leftPickerDateInSelected = values?.some(item => item && differenceInCalendarMonths(item, monthLeft.pickerDate) === 0);
                !leftPickerDateInSelected && this.handleShowDateAndTime(strings.PANEL_TYPE_LEFT, values[0] || newMonthLeft.pickerDate);
            } else {
                this.handleShowDateAndTime(strings.PANEL_TYPE_LEFT, values[0] || newMonthLeft.pickerDate);
            }
        } else {
            // FIXME:
            this.handleShowDateAndTime(strings.PANEL_TYPE_LEFT, newMonthLeft.pickerDate);
        }
        this._adapter.updateDaySelected(newSelected);
    }

    _initDateRangePickerFromValue(values: (Date | null)[], withTime = false) {
        // init month panel
        const monthLeft = this.getState('monthLeft') as MonthsGridFoundationState['monthLeft'];
        const monthRight = this.getState('monthRight') as MonthsGridFoundationState['monthRight'];
        const adjustResult = this._autoAdjustMonth(
            { ...monthLeft, pickerDate: values[0] || monthLeft.pickerDate },
            { ...monthRight, pickerDate: values[1] || monthRight.pickerDate }
        );

        const validValue = Array.isArray(values) && values.filter(item => item).length > 1;
        if (validValue) {
            this.handleShowDateAndTime(strings.PANEL_TYPE_LEFT, adjustResult.monthLeft.pickerDate);
            this.handleShowDateAndTime(strings.PANEL_TYPE_RIGHT, adjustResult.monthRight.pickerDate);
        } else {
            const selectedDate = values.find(item => item) as Date;
            // 如果日期不完整且输入日期不在面板范围内，则更新面板
            if (selectedDate) {                
                const notLeftPanelDate = Math.abs(differenceInCalendarMonths(selectedDate, monthLeft.pickerDate)) > 0;
                const notRightPanelDate = Math.abs(differenceInCalendarMonths(selectedDate, monthRight.pickerDate)) > 0;
    
                if (notLeftPanelDate && notRightPanelDate) {
                    this.handleShowDateAndTime(strings.PANEL_TYPE_LEFT, adjustResult.monthLeft.pickerDate);
                    this.handleShowDateAndTime(strings.PANEL_TYPE_RIGHT, adjustResult.monthRight.pickerDate);
                }
            }
        }

        // init range
        const formatToken = withTime ? strings.FORMAT_DATE_TIME : strings.FORMAT_FULL_DATE;
        let rangeStart = values[0] && format(values[0] as Date, formatToken);
        let rangeEnd = values[1] && format(values[1] as Date, formatToken);

        if (this._isNeedSwap(rangeStart, rangeEnd)) {
            [rangeStart, rangeEnd] = [rangeEnd, rangeStart];
        }
        this._adapter.setRangeStart(rangeStart);
        this._adapter.setRangeEnd(rangeEnd);
        this._adapter.setHoverDay(rangeEnd);
    }

    _initDateTimePickerFromValue(values: Date[]) {
        this._initDatePickerFromValue(values);
    }

    _initDateTimeRangePickerFormValue(values: (Date | null)[]) {
        this._initDateRangePickerFromValue(values, true);
    }

    destroy() { }

    /**
     * sync change another panel month when change months from the else yam panel
     * call it when
     *  - current change panel targe date month is same with another panel date
     *
     * @example
     *  - panelType=right, target=new Date('2022-09-01') and left panel is in '2022-09' => call it, left panel minus one month to '2022-08'
     *  - panelType=left, target=new Date('2021-12-01') and right panel is in '2021-12' => call it, right panel add one month to '2021-01'
     */
    handleSyncChangeMonths(options: { panelType: PanelType; target: Date }) {
        const { panelType, target } = options;
        const { type } = this._adapter.getProps();
        const { monthLeft, monthRight } = this._adapter.getStates();
        if (this.isRangeType(type)) {
            if (panelType === 'right' && differenceInCalendarMonths(target, monthLeft.pickerDate) === 0) {
                this.handleYearOrMonthChange('prevMonth', 'left', 1, true);
            } else if (panelType === 'left' && differenceInCalendarMonths(monthRight.pickerDate, target) === 0) {
                this.handleYearOrMonthChange('nextMonth', 'right', 1, true);
            }
        }
    }

    /**
     * Get the target date based on the panel type and switch type
     */
    getTargetChangeDate(options: { panelType: PanelType; switchType: YearMonthChangeType }) {
        const { panelType, switchType } = options;
        const { monthRight, monthLeft } = this._adapter.getStates();
        const currentDate = panelType === 'left' ? monthLeft.pickerDate : monthRight.pickerDate;
        let target: Date;

        switch (switchType) {
            case 'prevMonth':
                target = addMonths(currentDate, -1);
                break;
            case 'nextMonth':
                target = addMonths(currentDate, 1);
                break;
            case 'prevYear':
                target = addYears(currentDate, -1);
                break;
            case 'nextYear':
                target = addYears(currentDate, 1);
                break;
        }
        return target;
    }

    /**
     * Change month by yam panel
     */
    toMonth(panelType: PanelType, target: Date) {
        const { type } = this._adapter.getProps();
        const diff = this._getDiff('month', target, panelType);
        this.handleYearOrMonthChange(diff < 0 ? 'prevMonth' : 'nextMonth', panelType, Math.abs(diff), false);

        if (this.isRangeType(type)) {
            this.handleSyncChangeMonths({ panelType, target });
        }
    }

    toYear(panelType: PanelType, target: Date) {
        const diff = this._getDiff('year', target, panelType);
        this.handleYearOrMonthChange(diff < 0 ? 'prevYear' : 'nextYear', panelType, Math.abs(diff), false);
    }

    toYearMonth(panelType: PanelType, target: Date) {
        this.toYear(panelType, target);
        this.toMonth(panelType, target);
    }

    isRangeType(type?: Type) {
        const { type: typeFromProp } = this.getProps();
        const realType = type ? type : typeFromProp;
        return typeof realType === 'string' && /range/i.test(realType);
    }

    handleSwitchMonthOrYear(switchType: YearMonthChangeType, panelType: PanelType) {
        const { type, syncSwitchMonth } = this.getProps();
        const rangeType = this.isRangeType(type);

        // range type and syncSwitchMonth, we should change panels at same time
        if (rangeType && syncSwitchMonth) {
            this.handleYearOrMonthChange(switchType, 'left', 1, true);
            this.handleYearOrMonthChange(switchType, 'right', 1, true);
        } else {
            this.handleYearOrMonthChange(switchType, panelType);

            /**
             * default behavior (v2.2.0)
             * In order to prevent the two panels from being the same month, this will confuse the user when selecting the range
             * https://github.com/DouyinFE/semi-design/issues/260
             */
            if (rangeType) {
                const target = this.getTargetChangeDate({ panelType, switchType });
                this.handleSyncChangeMonths({ panelType, target });
            }
        }
    }

    prevMonth(panelType: PanelType) {
        this.handleSwitchMonthOrYear('prevMonth', panelType);
    }

    nextMonth(panelType: PanelType) {
        this.handleSwitchMonthOrYear('nextMonth', panelType);
    }

    prevYear(panelType: PanelType) {
        this.handleSwitchMonthOrYear('prevYear', panelType);
    }

    nextYear(panelType: PanelType) {
        this.handleSwitchMonthOrYear('nextYear', panelType);
    }

    /**
     * Calculate the year and month difference
     */
    _getDiff(type: 'month' | 'year', target: Date, panelType: PanelType) {
        const panelDetail = this._getPanelDetail(panelType);
        const diff = dateDiffFns[type] && dateDiffFns[type](target, panelDetail.pickerDate);
        return diff;
    }

    _getPanelDetail(panelType: PanelType) {
        return panelType === strings.PANEL_TYPE_RIGHT ? this.getState('monthRight') : this.getState('monthLeft');
    }


    /**
     * Format locale date
     * locale get from LocaleProvider
     * @param {Date} date
     * @param {String} token
     * @returns
     */
    localeFormat(date: Date, token: string) {
        const dateFnsLocale = this._adapter.getProp('dateFnsLocale');
        return format(date, token, { locale: dateFnsLocale });
    }

    /**
     * 根据 type 处理 onChange 返回的参数
     *
     *  - 返回的日期需要把用户时间转换为设置的时区时间
     *      - 用户时间：用户计算机系统时间
     *      - 时区时间：通过 ConfigProvider 设置的 timeZone
     *  - 例子：用户设置时区为+9，计算机所在时区为+8区，然后用户选择了22:00
     *      - DatePicker 内部保存日期 state 为 +8 的 22:00 => a = new Date("2021-05-25 22:00:00")
     *      - 传出去时，需要把 +8 的 22:00 => +9 的 22:00 => b = zonedTimeToUtc(a, "+09:00");
     *
     * The parameters returned by onChange are processed according to type
     *
     *  -The returned date needs to convert the user time to the set time zone time
     *      -User time: user computer system time
     *      -Time zone: timeZone set by ConfigProvider
     *  -Example: The user sets the time zone to + 9, and the time zone where the computer is located is + 8, and then the user selects 22:00
     *      -DatePicker internal save date state is + 8 22:00 = > a = new Date ("2021-05-25 22:00:00")
     *      -When passing out, you need to put + 8's 22:00 = > + 9's 22:00 = > b = zonedTimeToUtc (a, "+ 09:00");
     *
     *  e.g.
     *  let a = new Date ("2021-05-25 22:00:00");
     *       = > Tue May 25 2021 22:00:00 GMT + 0800 (China Standard Time)
     *  let b = zonedTimeToUtc (a, "+ 09:00");
     *       = > Tue May 25 2021 21:00:00 GMT + 0800 (China Standard Time)
     *
     * @param {Date|Date[]} value
     */
    disposeCallbackArgs(value: Date | Date[]) {
        let _value = Array.isArray(value) ? value : (value && [value]) || [];
        const timeZone = this.getProp('timeZone');

        if (isValidTimeZone(timeZone)) {
            _value = _value.map(date => zonedTimeToUtc(date, timeZone));
        }
        const type = this.getProp('type');
        const formatToken = this.getProp('format') || getDefaultFormatTokenByType(type);

        let notifyValue,
            notifyDate;
        switch (type) {
            case 'date':
            case 'dateTime':
            case 'month':
                if (!this._isMultiple()) {
                    notifyValue = _value[0] && this.localeFormat(_value[0], formatToken);
                    [notifyDate] = _value;
                } else {
                    notifyValue = _value.map(v => v && this.localeFormat(v, formatToken));
                    notifyDate = [..._value];
                }
                break;
            case 'dateRange':
            case 'dateTimeRange':
                notifyValue = _value.map(v => v && this.localeFormat(v, formatToken));
                notifyDate = [..._value];
                break;
            default:
                break;
        }
        return {
            notifyValue,
            notifyDate,
        };
    }

    handleYearOrMonthChange(
        type: YearMonthChangeType,
        panelType: PanelType = strings.PANEL_TYPE_LEFT,
        step = 1,
        notSeparateInRange = false
    ) {
        const { autoSwitchDate, type: datePanelType } = this.getProps();
        const { monthLeft, monthRight } = this.getStates();
        const isRangeType = this.isRangeType(datePanelType);
        const isLeftPanelInRange = isRangeType && panelType === strings.PANEL_TYPE_LEFT;
        const panelDetail = this._getPanelDetail(panelType);
        const { pickerDate } = panelDetail;
        const fn = dateCalcFns[type];
        const targetMonth = fn(pickerDate, step);
        // Determine if the date has changed
        const panelDateHasUpdate = (panelType === strings.PANEL_TYPE_LEFT && !isEqual(targetMonth, monthLeft.pickerDate)) ||
            (panelType === strings.PANEL_TYPE_RIGHT && !isEqual(targetMonth, monthRight.pickerDate));
        this._updatePanelDetail(panelType, { pickerDate: targetMonth });
        if (panelDateHasUpdate) { // When the date changes
            if (!isRangeType) { // Single Panel Type
                const { notifyValue, notifyDate } = this.disposeCallbackArgs(targetMonth);
                this._adapter.notifyPanelChange(notifyDate, notifyValue);
            } else { // Double Panel Type
                if (isLeftPanelInRange) { // Left panel
                    this.newBiMonthPanelDate[0] = targetMonth;
                } else { // Right panel
                    this.newBiMonthPanelDate[1] = targetMonth;
                }
                if (!(isLeftPanelInRange && notSeparateInRange)) { // Not synchronously switching the left panel in the scene
                    const { notifyValue, notifyDate } = this.disposeCallbackArgs(this.newBiMonthPanelDate);
                    this._adapter.notifyPanelChange(notifyDate, notifyValue);
                }
            }
        }
        if (autoSwitchDate) {
            this.updateDateAfterChangeYM(type, targetMonth);
        }
    }

    /**
     * You have chosen to switch the year and month in the future to directly update the Date without closing the date panel
     * @param {*} type
     * @param {*} targetDate
     */
    updateDateAfterChangeYM(
        type: YearMonthChangeType,
        targetDate: Date
    ) {
        const { multiple, disabledDate, type: dateType } = this.getProps();
        const { selected: selectedSet, rangeStart, rangeEnd, monthLeft } = this.getStates();
        // FIXME:
        const includeRange = ['dateRange', 'dateTimeRange'].includes(type);
        const options = { closePanel: false };
        if (!multiple && !includeRange && selectedSet.size) {
            const selectedStr = Array.from(selectedSet)[0] as string;
            const selectedDate = new Date(selectedStr);
            const year = targetDate.getFullYear();
            const month = targetDate.getMonth();
            let fullDate = set(selectedDate, { year, month });
            if (dateType === 'dateTime') {
                /**
                 * 如果是 type dateTime 切换月份要读取只取的time
                 * 无论 monthLeft 还是 monthRight 他们的 time 是不变的，所以只取 monthLeft 即可
                 */
                fullDate = this._mergeDateAndTime(fullDate, monthLeft.pickerDate);
            }
            if (disabledDate(fullDate, { rangeStart, rangeEnd })) {
                return;
            }
            this._adapter.notifySelectedChange([fullDate], options);
        }
    }

    _isMultiple() {
        return Boolean(this.getProp('multiple')) && this.getProp('type') === 'date';
    }

    _isRange() {
        // return this._adapter.getProp('type') === dateRangeTypeKey;
    }

    handleDayClick(day: MonthDayInfo, panelType: PanelType) {
        const type = this.getProp('type');
        switch (true) {
            case type === 'date' || type === 'dateTime':
                this.handleDateSelected(day, panelType);
                break;
            case type === 'dateRange' || type === 'dateTimeRange':
                this.handleRangeSelected(day);
                break;
            default:
                break;
        }
    }

    handleDateSelected(day: { fullDate: string; fullValidDate?: Date }, panelType: PanelType) {
        const { max, type, isControlledComponent, dateFnsLocale } = this.getProps();
        const multiple = this._isMultiple();
        const { selected } = this.getStates();
        const monthDetail = this._getPanelDetail(panelType);
        const newSelected = new Set<string>(multiple ? [...selected] : []);

        const { fullDate } = day;
        const time = monthDetail.pickerDate;
        const dateStr = fullDate;

        if (!multiple) {
            newSelected.add(dateStr);
        } else {
            if (newSelected.has(dateStr)) {
                newSelected.delete(dateStr);
            } else if (max && newSelected.size === max) {
                this._adapter.notifyMaxLimit();
            } else {
                newSelected.add(dateStr);
            }
        }

        // When passed to the upper layer, it is converted into a Date object to ensure that the input parameter format of initFormDefaultValue is consistent
        const newSelectedDates = [...newSelected].map(_dateStr => type === 'dateTime' ? this._mergeDateAndTime(_dateStr, time) : compatibleParse(_dateStr, strings.FORMAT_FULL_DATE, undefined, dateFnsLocale));

        this.handleShowDateAndTime(panelType, time);

        if (!isControlledComponent) {
            // Uncontrolled components, update internal values when operating, and notify external
            // MonthGrid internally uses string to represent fullDate for easy rendering
            this._adapter.updateDaySelected(newSelected);
        }

        this._adapter.notifySelectedChange(newSelectedDates as [Date]);
    }

    handleShowDateAndTime(panelType: PanelType, pickerDate: number | Date, showDate?: Date) {
        const _showDate = showDate || pickerDate;
        this._updatePanelDetail(panelType, { showDate: _showDate, pickerDate });
    }

    /**
     * link date and time
     *
     * @param {Date|string} date
     * @param {Date|string} time
     * @returns {Date}
     */
    _mergeDateAndTime(date: Date | string, time: Date | string) {
        const dateFnsLocale = this._adapter.getProp('dateFnsLocale');
        const dateStr = format(
            isValidDate(date) ? date as Date : compatibleParse(date as string, strings.FORMAT_FULL_DATE, undefined, dateFnsLocale),
            strings.FORMAT_FULL_DATE
        );
        const timeStr = format(
            isValidDate(time) ? time as Date : compatibleParse(time as string, strings.FORMAT_TIME_PICKER, undefined, dateFnsLocale),
            strings.FORMAT_TIME_PICKER
        );
        const timeFormat = this.getValidTimeFormat();
        return compatibleParse(`${dateStr} ${timeStr}`, timeFormat, undefined, dateFnsLocale);
    }

    handleRangeSelected(day: MonthDayInfo) {
        let { rangeStart, rangeEnd } = this.getStates();
        const { startDateOffset, endDateOffset, type, dateFnsLocale, rangeInputFocus, triggerRender } = this._adapter.getProps();
        const { fullDate } = day;
        let rangeStartReset = false;
        let rangeEndReset = false;

        const isDateRangeAndHasOffset = (startDateOffset || endDateOffset) && type === 'dateRange';
        if (isDateRangeAndHasOffset) {
            rangeStart = getFullDateOffset(startDateOffset, fullDate);
            rangeEnd = getFullDateOffset(endDateOffset, fullDate);
        } else {
            if (rangeInputFocus === 'rangeEnd') {
                rangeEnd = fullDate;
                // rangStart Parten in dateTime: 'yyyy-MM-dd HH:MM:SS', rangeEnd parten: 'yyyy-MM-dd'
                if ((rangeStart && rangeEnd) && isBefore(rangeEnd, rangeStart.trim().split(/\s+/)[0])) {
                    rangeStart = null;
                    rangeStartReset = true;
                }
                // Compatible to select date after opening the panel without click input
            } else if (rangeInputFocus === 'rangeStart' || !rangeInputFocus) {
                rangeStart = fullDate;
                // rangEnd Parten in dateTime: 'yyyy-MM-dd HH:MM:SS', rangeStart parten: 'yyyy-MM-dd'
                if ((rangeStart && rangeEnd) && isBefore(rangeEnd.trim().split(/\s+/)[0], rangeStart)) {
                    rangeEnd = null;
                    rangeEndReset = true;
                }
            }
        }

        // next focus logic
        const isRangeType = /range/i.test(type);
        if (isRangeType) {
            if (isDateRangeAndHasOffset) {
                this._adapter.setRangeStart(rangeStart);
                this._adapter.setRangeEnd(rangeEnd);
            } else {
                if (rangeInputFocus === 'rangeEnd') {
                    this._adapter.setRangeEnd(rangeEnd);
                    if (rangeStartReset) {
                        this._adapter.setRangeStart(rangeStart);
                    }
                    if (!this._adapter.isAnotherPanelHasOpened('rangeEnd') || !rangeStart) {
                        this._adapter.setRangeInputFocus('rangeStart');
                    }
                } else if (rangeInputFocus === 'rangeStart' || !rangeInputFocus) {
                    this._adapter.setRangeStart(rangeStart);
                    if (rangeEndReset) {
                        this._adapter.setRangeEnd(rangeEnd);
                    }
                    if (!this._adapter.isAnotherPanelHasOpened('rangeStart') || !rangeEnd) {
                        this._adapter.setRangeInputFocus('rangeEnd');
                    }
                }
            }
        }

        const dateFormat = this.getValidDateFormat();
        // only notify when choose completed
        if (rangeStart || rangeEnd) {
            const [startDate, endDate] = [
                compatibleParse(rangeStart, dateFormat, undefined, dateFnsLocale),
                compatibleParse(rangeEnd, dateFormat, undefined, dateFnsLocale),
            ];
            let date: [Date, Date] = [startDate, endDate];

            // If the type is dateRangeTime, add the value of time
            if (type === 'dateTimeRange') {
                const startTime = this.getState('monthLeft').pickerDate;
                const endTime = this.getState('monthRight').pickerDate;
                const start = rangeStart ? this._mergeDateAndTime(rangeStart, startTime) : null;
                const end = rangeEnd ? this._mergeDateAndTime(rangeEnd, endTime) : null;
                if (isSameDay(startDate, endDate) && isBefore(end, start)) {
                    date = [start, start];
                } else {
                    date = [start, end];
                }
            }
            /**
             * no need to check focus then
             *  - dateRange and isDateRangeAndHasOffset
             */
            const needCheckFocusRecord = !(type === 'dateRange' && isDateRangeAndHasOffset);
            this._adapter.notifySelectedChange(date, { needCheckFocusRecord });
        }
    }

    _isNeedSwap(rangeStart: Date | string, rangeEnd: Date | string) {
        // Check whether the start and end are reasonable and whether they need to be reversed
        return rangeStart && rangeEnd && isBefore(rangeEnd, rangeStart);
    }

    /**
     * Day may be empty, this is unhover state
     * @param {*} day
     */
    handleDayHover(day = { fullDate: '' }, panelType?: PanelType) {
        const { fullDate } = day;
        const { startDateOffset, endDateOffset, type } = this.getProps();

        this._adapter.setHoverDay(fullDate);

        if ((startDateOffset || endDateOffset) && type === 'dateRange') {
            const offsetRangeStart = getFullDateOffset(startDateOffset, fullDate);
            const offsetRangeEnd = getFullDateOffset(endDateOffset, fullDate);
            this._adapter.setOffsetRangeStart(offsetRangeStart);
            this._adapter.setOffsetRangeEnd(offsetRangeEnd);
        }
    }

    // Guarantee that monthLeft, monthRight will not appear in the same month or monthLeft is greater than MonthRight
    _autoAdjustMonth(monthLeft: MonthInfo, monthRight: MonthInfo) {
        let newMonthLeft = monthLeft;
        let newMonthRight = monthRight;
        const difference = differenceInCalendarMonths(monthLeft.pickerDate, monthRight.pickerDate);
        if (difference > 0) {
            // The month on the left is larger than the month on the right, swap
            newMonthLeft = { ...monthRight };
            newMonthRight = { ...monthLeft };
        } else if (difference === 0) {
            // Around the same month, the number of months on the right + 1
            newMonthLeft = monthLeft;
            newMonthRight = { ...monthRight, pickerDate: addMonths(monthRight.pickerDate, 1) };
        }
        return { monthLeft: newMonthLeft, monthRight: newMonthRight };
    }

    getValidTimeFormat() {
        const formatProp = this.getProp('format') || strings.FORMAT_TIME_PICKER;

        const timeFormatTokens = [];
        if (includes(formatProp, 'h') || includes(formatProp, 'H')) {
            timeFormatTokens.push('HH');
        }

        if (includes(formatProp, 'm')) {
            timeFormatTokens.push('mm');
        }

        if (includes(formatProp, 's')) {
            timeFormatTokens.push('ss');
        }

        return timeFormatTokens.join(':');
    }

    getValidDateFormat() {
        return this.getProp('format') || getDefaultFormatToken(this.getProp('type'));
    }

    handleTimeChange(newTime: { timeStampValue: number }, panelType: PanelType) {
        const { rangeEnd, rangeStart } = this.getStates();
        const dateFnsLocale = this.getProp('dateFnsLocale');
        const ts = newTime.timeStampValue;
        const type = this.getProp('type');
        const panelDetail = this._getPanelDetail(panelType);
        const { showDate } = panelDetail;
        const timeDate = new Date(ts);
        const dateFormat = this.getValidDateFormat();

        const destRange = panelType === strings.PANEL_TYPE_RIGHT ? rangeEnd : rangeStart;

        let year,
            monthNo,
            date;

        // if (pickerDate && isValidDate(pickerDate)) {
        //     year = pickerDate.getFullYear();
        //     monthNo = pickerDate.getMonth();
        //     date = pickerDate.getDate();
        // } else
        if (type === 'dateTimeRange' && destRange) {
            const rangeDate = compatibleParse(destRange, dateFormat, undefined, dateFnsLocale);
            year = rangeDate.getFullYear();
            monthNo = rangeDate.getMonth();
            date = rangeDate.getDate();
        } else {
            year = showDate.getFullYear();
            monthNo = showDate.getMonth();
            date = showDate.getDate();
        }

        const hours = timeDate.getHours();
        const minutes = timeDate.getMinutes();
        const seconds = timeDate.getSeconds();
        const milSeconds = timeDate.getMilliseconds();

        const dateArgs = [year, monthNo, date, hours, minutes, seconds, milSeconds] as const;
        const fullValidDate = new Date(...dateArgs);

        if (type === 'dateTimeRange') {
            this.handleShowDateAndTime(panelType, fullValidDate, showDate);
            this._updateTimeInDateRange(panelType, fullValidDate);
        } else {
            const fullDate = formatFullDate(year, monthNo + 1, date);
            this.handleDateSelected(
                {
                    fullDate,
                    fullValidDate,
                },
                panelType
            );
            this.handleShowDateAndTime(panelType, fullValidDate);
            this._adapter.notifySelectedChange([fullValidDate]);
        }
    }

    /**
     * Update the time part in the range
     * @param {string} panelType
     * @param {Date} timeDate
     */
    _updateTimeInDateRange(panelType: PanelType, timeDate: Date) {
        const { isControlledComponent, dateFnsLocale } = this.getProps();
        let rangeStart = this.getState('rangeStart');
        let rangeEnd = this.getState('rangeEnd');
        const dateFormat = this.getValidDateFormat();
        // TODO: Modify a time individually
        if (rangeStart && rangeEnd) {
            let startDate = compatibleParse(rangeStart, dateFormat, undefined, dateFnsLocale);
            let endDate = compatibleParse(rangeEnd, dateFormat, undefined, dateFnsLocale);
            // console.log('_updateTimeInDateRange()', rangeStart, rangeEnd, startDate, endDate);

            if (panelType === strings.PANEL_TYPE_RIGHT) {
                endDate = this._mergeDateAndTime(timeDate, timeDate);
                rangeEnd = format(endDate, strings.FORMAT_DATE_TIME);
                if (this._isNeedSwap(rangeStart, rangeEnd)) {
                    [rangeStart, rangeEnd] = [rangeEnd, rangeStart];
                    [startDate, endDate] = [endDate, startDate];
                }
                if (!isControlledComponent) {
                    this._adapter.setRangeEnd(rangeEnd);
                }
            } else {
                startDate = this._mergeDateAndTime(timeDate, timeDate);
                rangeStart = format(startDate, strings.FORMAT_DATE_TIME);
                if (this._isNeedSwap(rangeStart, rangeEnd)) {
                    [rangeStart, rangeEnd] = [rangeEnd, rangeStart];
                    [startDate, endDate] = [endDate, startDate];
                }
                if (!isControlledComponent) {
                    this._adapter.setRangeStart(rangeStart);
                }
            }
            // console.log('_updateTimeInDateRange()', rangeStart, rangeEnd, startDate, endDate);
            this._adapter.notifySelectedChange([startDate, endDate]);
        }
    }

    _updatePanelDetail(
        panelType: PanelType,
        kvs: {
            showDate?: number | Date;
            pickerDate?: number | Date;
            isTimePickerOpen?: boolean;
            isYearPickerOpen?: boolean
        }
    ) {
        const { monthLeft, monthRight } = this.getStates();
        if (panelType === strings.PANEL_TYPE_RIGHT) {
            this._adapter.updateMonthOnRight({ ...monthRight, ...kvs });
        } else {
            this._adapter.updateMonthOnLeft({ ...monthLeft, ...kvs });
        }
    }

    showYearPicker(panelType: PanelType) {
        this._updatePanelDetail(panelType, { isTimePickerOpen: false, isYearPickerOpen: true });
    }

    showTimePicker(panelType: PanelType, opt?: boolean) {
        if (this.getProp('disabledTimePicker')) {
            return;
        }
        this._updatePanelDetail(panelType, { isTimePickerOpen: true, isYearPickerOpen: false });
    }

    showDatePanel(panelType: PanelType) {
        this._updatePanelDetail(panelType, { isTimePickerOpen: false, isYearPickerOpen: false });
    }

    /**
     * Get year and month panel open type
     *
     * It is useful info to set minHeight of weeks.
     *  - When yam open type is 'left' or 'right', weeks minHeight should be set
     *    If the minHeight is not set, the change of the number of weeks will cause the scrollList to be unstable
     */
    getYAMOpenType() {
        const { monthLeft, monthRight } = this._adapter.getStates();
        const leftYearPickerOpen = monthLeft.isYearPickerOpen;
        const rightYearPickerOpen = monthRight.isYearPickerOpen;

        if (leftYearPickerOpen && rightYearPickerOpen) {
            return 'both';
        } else if (leftYearPickerOpen) {
            return 'left';
        } else if (rightYearPickerOpen) {
            return 'right';
        } else {
            return 'none';
        }
    }
}
