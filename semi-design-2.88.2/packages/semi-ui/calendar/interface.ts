import { strings } from '@douyinfe/semi-foundation/calendar/constants';
import type { ArrayElement } from '../_base/base';
import type { BaseProps } from '../_base/baseComponent';
import type { EventObject, weekStartsOnEnum } from '@douyinfe/semi-foundation/calendar/foundation';

export interface CalendarProps extends BaseProps {
    displayValue?: Date;
    range?: Date[];
    header?: React.ReactNode;
    events?: EventObject[];
    mode?: ArrayElement<typeof strings.MODE>;
    showCurrTime?: boolean;
    weekStartsOn?: weekStartsOnEnum;
    scrollTop?: number;
    onClick?: (e: React.MouseEvent, value: Date) => void;
    onClose?: (e: React.MouseEvent) => void;
    renderTimeDisplay?: (time: number) => React.ReactNode;
    markWeekend?: boolean;
    minEventHeight?: number;
    width?: number | string;
    height?: number | string;
    renderDateDisplay?: (date: Date) => React.ReactNode;
    dateGridRender?: (dateString?: string, date?: Date) => React.ReactNode;
    allDayEventsRender?: (events: EventObject[]) => React.ReactNode
}

export type DayCalendarProps = Omit<CalendarProps, 'mode'>;

type DayCalendarPropsKeys = 'events' | 'displayValue' | 'showCurrTime' | 'mode' | 'dateGridRender' | 'minEventHeight';
export interface DayColProps extends Pick<CalendarProps, DayCalendarPropsKeys>, BaseProps {
    scrollHeight: number;
    currPos: number;
    isWeekend: boolean;
    handleClick: (e: React.MouseEvent, val: [Date, number, number, number]) => void
}

export type MonthCalendarProps = Omit<CalendarProps, 'range' | 'showCurrTime' | 'scrollTop' | 'renderTimeDisplay'>;

export type RangeCalendarProps = CalendarProps;

export interface TimeColProps {
    className?: string;
    renderTimeDisplay?: CalendarProps['renderTimeDisplay']
}

export type WeekCalendarProps = CalendarProps;