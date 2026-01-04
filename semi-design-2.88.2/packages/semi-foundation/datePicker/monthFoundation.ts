import BaseFoundation, { DefaultAdapter } from '../base/foundation';
// import { cssClasses, strings } from './constants';
import getMonthTable, { WeekStartNumber } from './_utils/getMonthTable';
import getDayOfWeek from './_utils/getDayOfWeek';
import { format } from 'date-fns';
import isNullOrUndefined from '../utils/isNullOrUndefined';

export interface MonthFoundationProps {
    forwardRef: any;
    month: Date;
    selected: Set<string>;
    rangeStart: string;
    rangeEnd: string;
    offsetRangeStart: string;
    offsetRangeEnd: string;
    onDayClick: (day: MonthDayInfo) => void;
    onDayHover: (day: MonthDayInfo) => void;
    weekStartsOn: WeekStartNumber;
    disabledDate: (day: Date, options?: { rangeStart: string; rangeEnd: string }) => boolean;
    weeksRowNum: number;
    onWeeksRowNumChange: (weeksRowNum: number) => void;
    renderDate: () => void;
    renderFullDate: () => void;
    hoverDay: string; // Real-time hover date
    startDateOffset: () => void;
    endDateOffset: () => void;
    rangeInputFocus: string | boolean;
    focusRecordsRef: any;
    locale: any;
    localeCode: string;
    multiple: boolean
}

export type MonthDayInfo = {
    dayNumber: number;
    dayNumberFull?: string;
    fullDate: string
} | {
    dayNumber: string;
    dayNumberFull?: string;
    fullDate: string
};

export interface MonthInfo {
    weeks: Array<MonthDayInfo[]>;
    monthText: string ;
    month?: Date
}

export interface MonthFoundationState {
    weekdays: string[];
    month: MonthInfo;
    todayText: string;
    weeksRowNum: number
}

export interface MonthTable {
    monthText: string;
    weeks: unknown;
    month: unknown
}

export interface MonthAdapter extends DefaultAdapter<MonthFoundationProps, MonthFoundationState>{
    updateToday: (todayText: string) => void;
    setWeekDays: (weekdays: string[]) => void;
    setWeeksRowNum: (weeksRowNum: number, callback?: () => void) => void;
    updateMonthTable: (month: MonthInfo) => void;
    notifyDayClick: MonthFoundationProps['onDayClick'];
    notifyDayHover: MonthFoundationProps['onDayHover'];
    notifyWeeksRowNumChange: MonthFoundationProps['onWeeksRowNumChange']
}

export default class CalendarMonthFoundation extends BaseFoundation<MonthAdapter> {

    constructor(adapter: MonthAdapter) {
        super({ ...adapter });
    }

    init() {
        this._getToday();
        this.getMonthTable();
    }

    _getToday() {
        const today = new Date();
        const todayText = format(today, 'yyyy-MM-dd');

        this._adapter.updateToday(todayText);
    }

    getMonthTable() {
        const month: Date = this._adapter.getProp('month');
        const weeksRowNum = this.getState('weeksRowNum');
        if (month) {
            this.updateWeekDays();
            const weekStartsOn: WeekStartNumber = this._adapter.getProp('weekStartsOn');
            const monthTable = getMonthTable(month, weekStartsOn);
            const { weeks } = monthTable;
            this._adapter.updateMonthTable(monthTable);

            if (isNullOrUndefined(weeksRowNum)) {
                this._adapter.setWeeksRowNum(weeks.length);
            } else if (Array.isArray(weeks) && weeks.length !== weeksRowNum) {
                this._adapter.setWeeksRowNum(weeks.length, () => {
                    this._adapter.notifyWeeksRowNumChange(weeks.length);
                });
            }
        }
    }

    updateWeekDays() {
        const weekStartsOn = this._adapter.getProp('weekStartsOn');
        const weekdays = getDayOfWeek({ weekStartsOn });
        this._adapter.setWeekDays(weekdays);
    }

    destroy() {}

    handleClick(day: MonthDayInfo) {
        this._adapter.notifyDayClick(day);
    }

    handleHover(day?: MonthDayInfo) {
        this._adapter.notifyDayHover(day);
    }
}
