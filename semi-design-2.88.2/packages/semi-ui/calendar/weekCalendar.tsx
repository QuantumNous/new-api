import React, { Fragment } from 'react';
import cls from 'classnames';
import PropTypes from 'prop-types';
import CalendarFoundation, { CalendarAdapter, EventObject, ParsedEvents, ParsedEventsType, ParsedRangeEvent, WeeklyData } from '@douyinfe/semi-foundation/calendar/foundation';
import LocaleConsumer from '../locale/localeConsumer';
import localeContext from '../locale/context';
import { cssClasses } from '@douyinfe/semi-foundation/calendar/constants';
import BaseComponent from '../_base/baseComponent';
import DayCol from './dayCol';
import TimeCol from './timeCol';
import { isEqual } from 'lodash';
import { calcRowHeight } from '@douyinfe/semi-foundation/calendar/eventUtil';
import type { WeekCalendarProps } from './interface';

import '@douyinfe/semi-foundation/calendar/calendar.scss';
import { Locale } from '../locale/interface';

const toPercent = (num: number) => {
    const res = num < 1 ? num * 100 : 100;
    return `${res}%`;
};

const prefixCls = `${cssClasses.PREFIX}-week`;
const allDayCls = `${cssClasses.PREFIX}-all-day`;

export interface WeekCalendarState {
    scrollHeight: number;
    parsedEvents: ParsedEvents;
    cachedKeys: Array<string>
}

export default class WeekCalendar extends BaseComponent<WeekCalendarProps, WeekCalendarState> {
    static propTypes = {
        displayValue: PropTypes.instanceOf(Date),
        header: PropTypes.node,
        events: PropTypes.array,
        mode: PropTypes.string,
        showCurrTime: PropTypes.bool,
        markWeekend: PropTypes.bool,
        scrollTop: PropTypes.number,
        renderTimeDisplay: PropTypes.func,
        renderDateDisplay: PropTypes.func,
        dateGridRender: PropTypes.func,
        allDayEventsRender: PropTypes.func,
        width: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
        height: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
        style: PropTypes.object,
        className: PropTypes.string,
    };

    static defaultProps = {
        displayValue: new Date(),
        events: [] as Array<EventObject>,
        mode: 'week',
    };

    static contextType = localeContext;
    dom: React.RefObject<HTMLDivElement>;
    scrollDom: React.RefObject<HTMLDivElement>;
    allDayRowHeight: number;

    weeklyData: WeeklyData;

    foundation: CalendarFoundation;

    constructor(props: WeekCalendarProps) {
        super(props);
        this.state = {
            scrollHeight: 0,
            parsedEvents: {
                day: new Map(),
                allDay: new Map()
            },
            cachedKeys: [],
        };
        this.foundation = new CalendarFoundation(this.adapter);
        this.dom = React.createRef();
        this.scrollDom = React.createRef();
        this.handleClick = this.handleClick.bind(this);
        this.allDayRowHeight = 1;
    }

    get adapter(): CalendarAdapter<WeekCalendarProps, WeekCalendarState> {
        return {
            ...super.adapter,
            setWeeklyData: data => {
                this.weeklyData = data;
            },
            getWeeklyData: () => this.weeklyData,
            updateScrollHeight: scrollHeight => {
                this.setState({ scrollHeight });
            },
            setParsedEvents: (parsedEvents: ParsedEventsType) => {
                this.setState({ parsedEvents: parsedEvents as ParsedEvents });
            },
            cacheEventKeys: cachedKeys => {
                this.setState({ cachedKeys });
            }
        };
    }

    componentDidMount() {
        this.foundation.init();
        const { scrollHeight } = this.scrollDom.current;
        this.dom.current.scrollTop = this.props.scrollTop;
        this.foundation.notifyScrollHeight(scrollHeight);
        this.foundation.parseWeeklyEvents();
    }

    componentDidUpdate(prevProps: WeekCalendarProps, prevState: WeekCalendarState) {
        const prevEventKeys = prevState.cachedKeys;
        const nowEventKeys = this.props.events.map(event => event.key);
        if (!isEqual(prevEventKeys, nowEventKeys) || !isEqual(prevProps.displayValue, this.props.displayValue)) {
            this.foundation.parseWeeklyEvents();
        }
    }

    componentWillUnmount() {
        this.foundation.destroy();
    }


    checkWeekend = (val: Date) => this.foundation.checkWeekend(val);

    handleClick = (e: React.MouseEvent, val: [Date, number, number, number]) => {
        const { onClick } = this.props;
        const value = this.foundation.formatCbValue(val);
        onClick && onClick(e, value);
    };

    renderDayGrid = () => {
        const { parsedEvents } = this.state;
        const events = parsedEvents.day;
        const { week } = this.weeklyData;
        const { markWeekend, dateGridRender, minEventHeight } = this.props;
        const inner = week.map(day => {
            const dateString = day.date.toString();
            const dayEvents = events.has(dateString) ? events.get(dateString) : [];
            const parsed = this.foundation.getParseDailyEvents(dayEvents, day.date);
            return (
                <DayCol
                    key={`${dateString}-weekday`}
                    displayValue={day.date}
                    scrollHeight={this.state.scrollHeight}
                    handleClick={this.handleClick}
                    events={parsed.day}
                    showCurrTime={this.props.showCurrTime}
                    isWeekend={markWeekend && day.isWeekend}
                    dateGridRender={dateGridRender}
                    minEventHeight={minEventHeight}
                />
            );
        });
        return inner;
    };

    renderHeader = (dateFnsLocale: any) => {
        const { markWeekend, displayValue, renderDateDisplay } = this.props;
        const { month, week } = this.foundation.getWeeklyData(displayValue, dateFnsLocale);
        return (
            <div className={`${prefixCls}-header`}>
                <ul className={`${cssClasses.PREFIX}-tag ${prefixCls}-tag ${prefixCls}-sticky-left`}>
                    <span>{month}</span>
                </ul>
                <div role="gridcell" className={`${prefixCls}-grid`}>
                    <ul className={`${prefixCls}-grid-row`}>
                        {week.map(day => {
                            const { date, dayString, weekday, isToday } = day;
                            const listCls = cls({
                                [`${cssClasses.PREFIX}-today`]: isToday,
                                [`${cssClasses.PREFIX}-weekend`]: markWeekend && day.isWeekend,
                            });
                            const dateContent = renderDateDisplay ? (
                                renderDateDisplay(date)
                            ) : (
                                <Fragment>
                                    <span className={`${cssClasses.PREFIX}-today-date`}>{dayString}</span>
                                    <span>{weekday}</span>
                                </Fragment>
                            );
                            return (
                                <li key={`${date.toString()}-weekheader`} className={listCls}>
                                    {dateContent}
                                </li>
                            );
                        })}
                    </ul>
                </div>
            </div>
        );
    };

    renderAllDayEvents = (events: ParsedRangeEvent[]) => {
        if (this.props.allDayEventsRender) {
            return this.props.allDayEventsRender(this.props.events);
        }
        const list = events.map((event, ind) => {
            const { leftPos, width, topInd, children, key } = event;
            const top = `${topInd}em`;
            const style = {
                left: toPercent(leftPos),
                width: toPercent(width),
                top,
            };
            return (
                <li
                    className={`${cssClasses.PREFIX}-event-item ${cssClasses.PREFIX}-event-allday`}
                    key={`allDay-${ind}`}
                    style={style}
                >
                    {children}
                </li>
            );
        });
        return list;
    };

    renderAllDay = (locale: Locale['Calendar']) => {
        const { allDayEventsRender } = this.props;
        const { allDay } = this.state.parsedEvents;
        const parsed = this.foundation.parseWeeklyAllDayEvents(allDay);
        const style = allDayEventsRender ? null : {
            height: `${calcRowHeight(parsed)}em`
        };
        const { markWeekend } = this.props;
        const { week } = this.weeklyData;
        return (

            <div className={`${allDayCls}`} style={style}>
                <ul className={`${cssClasses.PREFIX}-tag ${allDayCls}-tag ${prefixCls}-sticky-left`}>
                    <span>{locale.allDay}</span>
                </ul>
                <div role="gridcell" className={`${cssClasses.PREFIX}-content ${allDayCls}-content`}>
                    <ul className={`${allDayCls}-skeleton`}>
                        {Object.keys(week).map((date, ind) => {
                            const listCls = cls({
                                [`${cssClasses.PREFIX}-weekend`]: markWeekend && week[date].isWeekend,
                            });
                            return (
                                <li key={`${date}-weekgrid`} className={listCls} />
                            );
                        })}
                    </ul>
                    <ul className={`${cssClasses.PREFIX}-event-items`}>
                        {this.renderAllDayEvents(parsed)}
                    </ul>
                </div>
            </div>

        );
    };

    render() {
        const { renderTimeDisplay, className, height, width, style, header } = this.props;
        const weekCls = cls(prefixCls, className);
        const weekStyle = {
            height,
            width,
            ...style,
        };
        return (
            <LocaleConsumer componentName="Calendar">
                {(locale: Locale['Calendar'], localeCode: string, dateFnsLocale: any) => (
                    <div className={weekCls} style={weekStyle} ref={this.dom} {...this.getDataAttr(this.props)}>
                        <div className={`${prefixCls}-sticky-top`}>
                            {header}
                            {this.renderHeader(dateFnsLocale)}
                            {this.renderAllDay(locale)}
                        </div>
                        <div className={`${prefixCls}-scroll-wrapper`}>
                            <div className={`${prefixCls}-scroll`} ref={this.scrollDom}>
                                <TimeCol
                                    className={`${prefixCls}-sticky-left`}
                                    renderTimeDisplay={renderTimeDisplay}
                                />
                                {this.renderDayGrid()}
                            </div>
                        </div>
                    </div>
                )}
            </LocaleConsumer>
        );
    }
}
