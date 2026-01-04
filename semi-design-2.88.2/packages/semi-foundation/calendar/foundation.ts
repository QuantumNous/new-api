import BaseFoundation, { DefaultAdapter } from '../base/foundation';
import { format,
    getWeeksInMonth,
    getWeekOfMonth,
    isSameMonth,
    startOfMonth,
    endOfMonth,
    isBefore,
    isAfter,
    addDays,
    startOfWeek,
    differenceInCalendarDays,
    isSameDay,
    startOfDay,
    isSameWeek,
    Locale } from 'date-fns';
import {
    parseEvent,
    parseAllDayEvent,
    calcWeekData,
    getCurrDate,
    parseWeeklyAllDayEvent,
    sortDate,
    collectDailyEvents,
    round,
    getPos,
    convertEventsArrToMap,
    filterWeeklyEvents,
    renderDailyEvent,
    calcRangeData,
    filterEvents,
    parseRangeAllDayEvent,
    DateObj,
    checkWeekend,
} from './eventUtil';
import type { weekStartsOnEnum } from './eventUtil';

export { weekStartsOnEnum };
export interface EventObject {
    [x: string]: any;
    key: string;
    allDay?: boolean;
    start?: Date;
    end?: Date;
    // children?: React.ReactNode;
    children?: any
}

export interface ParsedEventsWithArray {
    day: Array<any>;
    allDay: Array<any>
}

export interface ParsedEvents {
    day?: Map<string, Array<EventObject>>;
    allDay?: Map<string, Array<EventObject>>
}

export interface ParsedRangeEvent extends EventObject {
    leftPos?: number;
    width?: number;
    topInd?: number
}

export interface MonthlyEvent {
    day: ParsedRangeEvent[][];
    display: ParsedRangeEvent[]
}

export interface RangeData {
    month: string;
    week: any[]
}

export interface WeeklyData {
    month: string;
    week: DateObj[]
}

export type MonthData = Record<number, DateObj[]>;

// export interface CalendarAdapter extends DefaultAdapter {
//     updateScrollHeight: (scrollHeight: number) => void;
//     setParsedEvents: (parsedEvents: ParsedEvents) => void;
//     cacheEventKeys: (cachedKeys: Array<string>) => void;
// }

export type ParsedEventsType = ParsedEvents | ParsedEventsWithArray | MonthlyEvent;

export interface CalendarAdapter<P = Record<string, any>, S = Record<string, any>> extends DefaultAdapter<P, S> {
    updateCurrPos?: (currPos: number) => void;
    updateShowCurrTime?: () => void;
    updateScrollHeight?: (scrollHeight: number) => void;
    setParsedEvents?: (parsedEvents: ParsedEventsType) => void;
    cacheEventKeys?: (cachedKeys: Array<string>) => void;
    setRangeData?: (data: RangeData) => void;
    getRangeData?: () => RangeData;
    setWeeklyData?: (data: WeeklyData) => void;
    getWeeklyData?: () => WeeklyData;
    registerClickOutsideHandler?: (key: string, cb: () => void) => void;
    unregisterClickOutsideHandler?: () => void;
    setMonthlyData?: (data: MonthData) => void;
    getMonthlyData?: () => MonthData;
    notifyClose?: (e: any, key: string) => void;
    openCard?: (key: string, spacing: boolean) => void;
    setItemLimit?: (itemLimit: number) => void
}

export default class CalendarFoundation<P = Record<string, any>, S = Record<string, any>> extends BaseFoundation<CalendarAdapter<P, S>, P, S> {

    raf: number;

    constructor(adapter: CalendarAdapter<P, S>) {
        super({ ...adapter });
    }

    init() {

    }

    destroy() {
        this.raf && cancelAnimationFrame(this.raf);
    }

    initCurrTime() {
        const { showCurrTime, displayValue } = this.getProps();
        if (showCurrTime && isSameDay(displayValue, getCurrDate())) {
            this._adapter.updateShowCurrTime();
            this.getCurrLocation();
        }
    }

    notifyScrollHeight(height: number) {
        this._adapter.updateScrollHeight(height);
    }

    closeCard(e: any, key: string) {
        this._adapter.unregisterClickOutsideHandler();
        this._adapter.notifyClose(e, key);
    }

    _getDate() {
        const { displayValue } = this.getProps();
        return displayValue || getCurrDate();
    }

    showCard(e: any, key: string) {
        this._adapter.unregisterClickOutsideHandler();
        const bodyWidth = document.querySelector('body').clientWidth;
        const popoverWidth = 110;
        const spacing = bodyWidth - e.target.getBoundingClientRect().right - popoverWidth;
        this._adapter.openCard(key, spacing > 0);
        this._adapter.registerClickOutsideHandler(key, () => {
            this.closeCard(null, key);
        });
    }

    formatCbValue(val: [Date, number, number, number] | [Date]) {
        const date = val.shift() as Date;
        const dateArr = [date.getFullYear(), date.getMonth(), date.getDate(), ...val];
        // @ts-ignore skip
        return new Date(...dateArr);
    }

    /**
     *
     * find the location of showCurrTime red line
     */
    getCurrLocation() {
        let startTime: number = null;
        let pos = getPos(getCurrDate());
        this._adapter.updateCurrPos(round(pos));
        const frameFunc = () => {
            const timestamp = Date.now();
            if (!startTime) {
                startTime = timestamp;
            }
            const time = timestamp - startTime;
            if (time > 30000) {
                pos = getPos(getCurrDate());
                this._adapter.updateCurrPos(round(pos));
                startTime = timestamp;
            }
            this.raf = requestAnimationFrame(frameFunc);
        };
        this.raf = requestAnimationFrame(frameFunc);
    }

    getWeeklyData(value: Date, dateFnsLocale: Locale) {
        const data = {} as WeeklyData;
        const { weekStartsOn } = this.getProps();
        data.month = format(value, 'LLL', { locale: dateFnsLocale, weekStartsOn });
        data.week = calcWeekData(value, null, 'week', dateFnsLocale, weekStartsOn);
        this._adapter.setWeeklyData(data);
        return data;
    }

    getRangeData(value: Date, dateFnsLocale: Locale) {
        const data = {} as { month: string; week: Array<DateObj> };
        const { range, weekStartsOn } = this.getProps();
        const len = differenceInCalendarDays(range[1], range[0]);
        data.month = format(value, 'LLL', { locale: dateFnsLocale, weekStartsOn });
        const startDate = startOfDay(range[0]);
        data.week = calcRangeData(value, startDate, len, 'week', dateFnsLocale, weekStartsOn);
        this._adapter.setRangeData(data);
        return data;
    }

    getMonthlyData(value: Date, dateFnsLocale: Locale) {
        const monthStart = startOfMonth(value);
        const data = {} as MonthData;
        const { weekStartsOn } = this.getProps();
        const numberOfWeek = getWeeksInMonth(value, { weekStartsOn });
        [...Array(numberOfWeek).keys()].map(ind => {
            data[ind] = calcWeekData(addDays(monthStart, ind * 7), monthStart, 'month', dateFnsLocale, weekStartsOn);
        });
        this._adapter.setMonthlyData(data);
        return data;
    }

    // ================== Daily Event ==================

    _parseEvents(events: EventObject[]) {
        const parsed: ParsedEventsWithArray = {
            allDay: [],
            day: []
        };
        events.map(event => parseEvent(event)).forEach(item => {
            item.forEach(i => {
                i.allDay ? parsed.allDay.push(i) : parsed.day.push(i);
            });
        });
        return parsed;
    }

    getParseDailyEvents(events: EventObject[], date: Date) {
        if (!date) {
            date = this._getDate();
        }
        const parsed = this._parseEvents(events);
        const { displayValue } = this.getProps();
        const key = startOfDay(date).toString();
        parsed.allDay = convertEventsArrToMap(parsed.allDay, 'date', startOfDay, displayValue).get(key);
        parsed.day = convertEventsArrToMap(parsed.day, 'date', null, displayValue).get(key);
        if (!parsed.allDay) {
            parsed.allDay = [];
        }
        if (!parsed.day) {
            parsed.day = [];
        }

        parsed.day = parsed.day.map(item => renderDailyEvent(item));
        // 将 startPos & endPos 完全相同的事件编为一组
        const sameTimeRangeGroup = parsed.day.reduce((acc, item) => {
            const key = `${item.startPos}-${item.endPos}`;
            if (!acc[key]) {
                acc[key] = [];
            }
            acc[key].push(item);
            return acc;
        }, {});

        // 计算每个 item 的 left 值， 
        const eventCountMap = {};
        parsed.day = parsed.day.map(item => {
            const key = `${item.startPos}-${item.endPos}`;
            let curCount = eventCountMap[key];
            eventCountMap[key] = curCount === undefined ? 0 : ++curCount;
            item.left = curCount !== 0 ? `${(curCount / sameTimeRangeGroup[key].length * 100)}%` : 0;
            return item;
        });
        return parsed;
    }

    parseDailyEvents() {
        const { events, displayValue } = this.getProps();
        const parsed = this.getParseDailyEvents(events, displayValue);
        this._adapter.setParsedEvents(parsed);
        this._adapter.cacheEventKeys((events as EventObject[]).map(i => i.key));
    }

    // ================== Weekly Event ==================

    _parseWeeklyEvents(events: ParsedEvents['allDay'], weekStart: Date) {
        const { weekStartsOn } = this.getProps();
        let parsed = [[]] as ParsedRangeEvent[][];
        const filtered = filterWeeklyEvents(events, weekStart, weekStartsOn);
        [...filtered.keys()].sort((a, b) => sortDate(a, b)).forEach(item => {
            const startDate = new Date(item);
            const curr = filtered.get(item).filter(event => isSameDay(event.date, startDate));
            parsed = parseWeeklyAllDayEvent(curr, startDate, weekStart, parsed, weekStartsOn);
        });
        return parsed;
    }

    _renderWeeklyAllDayEvent(events: ParsedRangeEvent[][]) {
        const res = [] as ParsedRangeEvent[];
        events.forEach(row => {
            const event = row.filter(item => 'leftPos' in item);
            res.push(...event);
        });
        return res;
    }

    // return parsed weekly allday events
    parseWeeklyAllDayEvents(events: ParsedEvents['allDay']) {
        const { week } = this._adapter.getWeeklyData();
        const weekStart = week[0].date;
        const parsed = this._parseWeeklyEvents(events, weekStart);
        const res = this._renderWeeklyAllDayEvent(parsed);
        return res;
    }

    getParsedWeeklyEvents(events: EventObject[]) {
        const parsed = this._parseEvents(events);
        const { displayValue } = this.getProps();
        const result: ParsedEvents = {};
        result.allDay = convertEventsArrToMap(parsed.allDay, 'start', startOfDay, displayValue);
        result.day = convertEventsArrToMap(parsed.day, 'date', null, displayValue);
        return result;
    }

    // return parsed weekly allday events
    parseWeeklyEvents() {
        const { events } = this.getProps();
        const parsed = this.getParsedWeeklyEvents(events);
        this._adapter.setParsedEvents(parsed);
        this._adapter.cacheEventKeys((events as EventObject[]).map(i => i.key));
    }

    // ================== Monthly Event ==================

    pushDayEventIntoWeekMap(item: EventObject, index: number, map: Record<string, EventObject[]>) {
        if (index in map) {
            map[index].push(item);
        } else {
            map[index] = [item];
        }
    }

    convertMapToArray(weekMap: Map<string, EventObject[]>, weekStart: Date) {
        const eventArray = [];
        const map = new Map();
        for (const entry of weekMap.entries()) {
            const [key, value] = entry;
            map.set(key, value);
        }
        const weekEvents = this._parseWeeklyEvents(map, weekStart);
        eventArray.push(...weekEvents);
        return eventArray;
    }

    getParseMonthlyEvents(itemLimit: number) {
        const parsed: any = {};
        const { displayValue, events, weekStartsOn } = this.getProps();
        const currDate = this._getDate();
        const firstDayOfMonth = startOfMonth(displayValue);
        const lastDayOfMonth = endOfMonth(displayValue);
        const res: EventObject[] = [];
        (events as EventObject[]).sort((prev, next) => {
            if (isBefore(prev.start, next.start)) {
                return -1;
            }
            if (isAfter(prev.start, next.start)) {
                return 1;
            }
            return 0;
        }).forEach(event => {
            const parsedEvent = parseAllDayEvent(event, event.allDay, currDate);
            res.push(...parsedEvent);
        });
        res.filter(item => isSameMonth(item.date, displayValue));
        res.forEach(item => {
            // WeekInd calculation error, need to consider the boundary situation at the beginning/end of the month
            // When the date falls within the month
            if (isSameMonth(item.date, displayValue)) {
                const weekInd = getWeekOfMonth(item.date, { weekStartsOn }) - 1;
                this.pushDayEventIntoWeekMap(item, weekInd, parsed);
                return;
            }
            // When the date is within the previous month
            if (isBefore(item.date, firstDayOfMonth)) {
                if (isSameWeek(item.date, firstDayOfMonth, { weekStartsOn })) {
                    this.pushDayEventIntoWeekMap(item, 0, parsed);
                }
                return;
            }
            // When the date is within the next month
            if (isAfter(item.date, lastDayOfMonth)) {
                if (isSameWeek(item.date, lastDayOfMonth, { weekStartsOn })) {
                    const weekInd = getWeekOfMonth(lastDayOfMonth, { weekStartsOn }) - 1;
                    this.pushDayEventIntoWeekMap(item, weekInd, parsed);
                }
                return;
            }
        });
        Object.keys(parsed).forEach(key => {
            const week = parsed[key];
            parsed[key] = {};
            const weekStart = startOfWeek(week[0].date, { weekStartsOn });
            const weekMap = convertEventsArrToMap(week, 'start', startOfDay);
            // When there are multiple events in a week, multiple events should be parsed
            // const oldParsedWeeklyEvent = this._parseWeeklyEvents(weekMap, weekStart);
            const parsedWeeklyEvent = this.convertMapToArray(weekMap, weekStart);
            parsed[key].day = collectDailyEvents(parsedWeeklyEvent);
            parsed[key].display = this._renderDisplayEvents(parsedWeeklyEvent);
        });
        return parsed as MonthlyEvent;
    }

    parseMonthlyEvents(itemLimit: number) {
        const { events } = this.getProps();
        const parsed = this.getParseMonthlyEvents(itemLimit);
        this._adapter.setParsedEvents(parsed);
        this._adapter.setItemLimit(itemLimit);
        this._adapter.cacheEventKeys((events as EventObject[]).map(i => i.key));
    }
    _renderDisplayEvents(events: ParsedRangeEvent[][]) {
        // Limits should not be added when calculating the relative position of each event, because there will be calculations that separate two events in the middle of the week
        let displayEvents: ParsedRangeEvent[] | ParsedRangeEvent[][] = events.slice();
        if (displayEvents.length) {
            displayEvents = this._renderWeeklyAllDayEvent(displayEvents);
        }
        return displayEvents;
    }

    // ================== Range Event ==================


    _parseRangeEvents(events: Map<string, EventObject[]>) {
        let parsed: Array<Array<ParsedRangeEvent>> = [[]];
        const [start, end] = this.getProp('range');
        const filtered = filterEvents(events, start, end);
        [...filtered.keys()].sort((a, b) => sortDate(a, b)).forEach(item => {
            const startDate = new Date(item);
            const curr = filtered.get(item).filter(event => isSameDay(event.date, startDate));
            parsed = parseRangeAllDayEvent(curr, startDate, start, end, parsed);
        });
        return parsed;
    }

    _renderRangeAllDayEvent(events: Array<Array<ParsedRangeEvent>>) {
        let res: Array<ParsedRangeEvent> = [];
        events.forEach(row => {
            const event = row.filter(item => 'leftPos' in item);
            res = [...res, ...event];
        });
        return res;
    }

    // return parsed weekly allday events
    parseRangeAllDayEvents(events: ParsedEvents['allDay']) {
        const parsed = this._parseRangeEvents(events);
        const res = this._renderRangeAllDayEvent(parsed);
        return res;
    }

    getParsedRangeEvents(events: EventObject[]) {
        const parsed = this._parseEvents(events);
        const [start] = this.getProp('range');
        (parsed as unknown as ParsedEvents).allDay = convertEventsArrToMap(parsed.allDay, 'start', startOfDay, start);
        ((parsed as unknown as ParsedEvents)).day = convertEventsArrToMap(parsed.day, 'date', null, start);
        return parsed as unknown as ParsedEvents;
    }

    // return parsed weekly allday events
    parseRangeEvents() {
        const { events } = this.getProps() as { events: EventObject[] };
        const parsed = this.getParsedRangeEvents(events);
        this._adapter.setParsedEvents(parsed);
        this._adapter.cacheEventKeys(events.map(i => i.key));
    }

    checkWeekend(val: Date) {
        return checkWeekend(val);
    }
}
