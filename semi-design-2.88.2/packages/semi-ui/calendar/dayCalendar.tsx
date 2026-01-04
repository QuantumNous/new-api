import React from 'react';
import { isEqual } from 'lodash';
import cls from 'classnames';
import PropTypes from 'prop-types';
import CalendarFoundation, { CalendarAdapter, ParsedEventsType, ParsedEventsWithArray } from '@douyinfe/semi-foundation/calendar/foundation';
import { cssClasses } from '@douyinfe/semi-foundation/calendar/constants';
import DayCol from './dayCol';
import TimeCol from './timeCol';
import BaseComponent from '../_base/baseComponent';
import LocaleConsumer from '../locale/localeConsumer';
import localeContext from '../locale/context';
import { Locale } from '../locale/interface';
import { DayCalendarProps } from './interface';
import '@douyinfe/semi-foundation/calendar/calendar.scss';

const prefixCls = `${cssClasses.PREFIX}-day`;

export interface DayCalendarState {
    scrollHeight: number;
    parsedEvents: ParsedEventsWithArray;
    cachedKeys: Array<string>
}

export default class DayCalendar extends BaseComponent<DayCalendarProps, DayCalendarState> {
    static propTypes = {
        displayValue: PropTypes.instanceOf(Date),
        events: PropTypes.array,
        header: PropTypes.node,
        showCurrTime: PropTypes.bool,
        onClick: PropTypes.func,
        mode: PropTypes.string,
        renderTimeDisplay: PropTypes.func,
        markWeekend: PropTypes.bool,
        minEventHeight: PropTypes.number,
        scrollTop: PropTypes.number,
        width: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
        height: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
        style: PropTypes.object,
        className: PropTypes.string,
        dateGridRender: PropTypes.func,
        allDayEventsRender: PropTypes.func,
    };

    static defaultProps = {
        events: [] as DayCalendarProps['events'],
        displayValue: new Date(),
        mode: 'day',
    };

    static contextType = localeContext;
    dom: React.RefObject<HTMLDivElement>;
    scrollDom: React.RefObject<HTMLDivElement>;
    isWeekend: boolean;

    foundation: CalendarFoundation;


    constructor(props: DayCalendarProps) {
        super(props);
        this.foundation = new CalendarFoundation(this.adapter);

        this.state = {
            scrollHeight: 0,
            parsedEvents: {
                day: [],
                allDay: []
            },
            cachedKeys: [],
        };

        this.dom = React.createRef();
        this.scrollDom = React.createRef();
        this.isWeekend = false;
    }

    get adapter(): CalendarAdapter<DayCalendarProps, DayCalendarState> {
        return {
            ...super.adapter,
            updateScrollHeight: scrollHeight => {
                this.setState({ scrollHeight });
            },
            setParsedEvents: (parsedEvents: ParsedEventsType) => {
                this.setState({ parsedEvents: parsedEvents as ParsedEventsWithArray });
            },
            cacheEventKeys: cachedKeys => {
                this.setState({ cachedKeys });
            },
        };
    }

    componentDidMount() {
        this.foundation.init();
        const { scrollHeight } = this.scrollDom.current;
        this.dom.current.scrollTop = this.props.scrollTop;
        this.foundation.notifyScrollHeight(scrollHeight);
        this.foundation.parseDailyEvents();
    }

    componentDidUpdate(prevProps: DayCalendarProps, prevState: DayCalendarState) {
        const prevEventKeys = prevState.cachedKeys;
        const nowEventKeys = this.props.events.map(event => event.key);
        if (!isEqual(prevEventKeys, nowEventKeys) || !isEqual(prevProps.displayValue, this.props.displayValue)) {
            this.foundation.parseDailyEvents();
        }
    }

    componentWillUnmount() {
        this.foundation.destroy();
    }

    checkWeekend = (val: Date) => this.foundation.checkWeekend(val);

    renderAllDayEvents = (events: ParsedEventsWithArray['allDay']) => {
        if (this.props.allDayEventsRender) {
            return this.props.allDayEventsRender(this.props.events);
        }
        const list = events.map((event, ind) => {
            const { children, key } = event;
            return (
                <li className={`${cssClasses.PREFIX}-event-item ${cssClasses.PREFIX}-event-allday`} key={key || `allDay-${ind}`}>
                    {children}
                </li>
            );
        });
        return list;
    };

    handleClick = (e: React.MouseEvent, val: [Date, number, number, number]) => {
        const { onClick } = this.props;
        const value = this.foundation.formatCbValue(val);
        onClick && onClick(e, value);
    };

    renderAllDay = (events: ParsedEventsWithArray['allDay']) => {
        const allDayCls = `${cssClasses.PREFIX}-all-day`;
        const contentCls = cls(`${allDayCls}-content`, {
            [`${cssClasses.PREFIX}-weekend`]: this.isWeekend,
        });
        return (
            <LocaleConsumer componentName="Calendar">
                {(locale: Locale['Calendar']) => (
                    <div className={`${allDayCls}`}>
                        <ul className={`${cssClasses.PREFIX}-tag ${allDayCls}-tag ${prefixCls}-sticky-left`}>
                            <span>{locale.allDay}</span>
                        </ul>
                        <div role="gridcell" className={contentCls}>
                            <ul className={`${cssClasses.PREFIX}-event-items`}>
                                {this.renderAllDayEvents(events)}
                            </ul>
                        </div>
                    </div>
                )}
            </LocaleConsumer>
        );
    };

    render() {
        const { dateGridRender, displayValue, showCurrTime, renderTimeDisplay, markWeekend, className, height, width, style, header, minEventHeight } = this.props;
        const dayCls = cls(prefixCls, className);
        const dayStyle = {
            height,
            width,
            ...style,
        };
        const { parsedEvents, scrollHeight } = this.state;
        this.isWeekend = markWeekend && this.checkWeekend(displayValue);
        return (
            <div className={dayCls} style={dayStyle} ref={this.dom} {...this.getDataAttr(this.props)}>
                <div className={`${prefixCls}-sticky-top`}>
                    {header}
                    {this.renderAllDay(parsedEvents.allDay)}
                </div>
                <div className={`${prefixCls}-scroll-wrapper`}>
                    <div className={`${prefixCls}-scroll`} ref={this.scrollDom}>
                        <TimeCol
                            className={`${prefixCls}-sticky-left`}
                            renderTimeDisplay={renderTimeDisplay}
                        />
                        <DayCol
                            events={parsedEvents.day}
                            displayValue={displayValue}
                            scrollHeight={scrollHeight}
                            handleClick={this.handleClick}
                            showCurrTime={showCurrTime}
                            isWeekend={this.isWeekend}
                            minEventHeight={minEventHeight}
                            dateGridRender={dateGridRender}
                        />
                    </div>
                </div>
            </div>
        );
    }

}
