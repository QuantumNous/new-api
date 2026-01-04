import React from 'react';
import PropTypes from 'prop-types';
import { EventObject } from '@douyinfe/semi-foundation/calendar/foundation';
import BaseComponent from '../_base/baseComponent';
import DayCalendar from './dayCalendar';
import WeekCalendar from './weekCalendar';
import MonthCalendar from './monthCalendar';
import RangeCalendar from './rangeCalendar';
import { CalendarProps } from './interface';
import '@douyinfe/semi-foundation/calendar/calendar.scss';

export * from './interface';

// eslint-disable-next-line @typescript-eslint/ban-types
class Calendar extends BaseComponent<CalendarProps, {}> {
    static propTypes = {
        displayValue: PropTypes.instanceOf(Date),
        header: PropTypes.node,
        events: PropTypes.arrayOf(PropTypes.shape({
            allDay: PropTypes.bool,
            start: PropTypes.instanceOf(Date),
            end: PropTypes.instanceOf(Date),
            key: PropTypes.string.isRequired,
            children: PropTypes.node,
        })),
        mode: PropTypes.string,
        showCurrTime: PropTypes.bool,
        weekStartsOn: PropTypes.number,
        scrollTop: PropTypes.number,
        onClick: PropTypes.func,
        renderTimeDisplay: PropTypes.func,
        renderDateDisplay: PropTypes.func,
        markWeekend: PropTypes.bool,
        minEventHeight: PropTypes.number,
        width: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
        height: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
        style: PropTypes.object,
        className: PropTypes.string,
    };

    static defaultProps = {
        events: [] as EventObject[],
        displayValue: new Date(),
        showCurrTime: true,
        mode: 'week',
        markWeekend: false,
        height: 600,
        scrollTop: 400,
        weekStartsOn: 0,
    };

    render() {
        const { mode, ...rest } = this.props;
        const component = {
            month: (<MonthCalendar />),
            week: (<WeekCalendar />),
            day: (<DayCalendar />),
            range: (<RangeCalendar />)
        };
        return React.cloneElement(component[mode], { ...rest });
    }
}

export type { EventObject };
export default Calendar;
