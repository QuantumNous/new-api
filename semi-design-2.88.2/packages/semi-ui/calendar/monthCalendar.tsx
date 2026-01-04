/* eslint-disable jsx-a11y/no-noninteractive-element-to-interactive-role */
import React, { ReactInstance } from 'react';
import ReactDOM from 'react-dom';
import cls from 'classnames';
import { isEqual } from 'lodash';
import PropTypes from 'prop-types';
import { IconClose } from '@douyinfe/semi-icons';
import CalendarFoundation, { CalendarAdapter, EventObject, MonthData, MonthlyEvent, ParsedEventsType, ParsedEventsWithArray, ParsedRangeEvent } from '@douyinfe/semi-foundation/calendar/foundation';
import { cssClasses } from '@douyinfe/semi-foundation/calendar/constants';
import { DateObj } from '@douyinfe/semi-foundation/calendar/eventUtil';
import LocaleConsumer from '../locale/localeConsumer';
import localeContext from '../locale/context';
import BaseComponent from '../_base/baseComponent';
import Popover from '../popover';
import Button from '../iconButton';
import { Locale } from '../locale/interface';
import { MonthCalendarProps } from './interface';

import '@douyinfe/semi-foundation/calendar/calendar.scss';

const toPercent = (num: number) => {
    const res = num < 1 ? num * 100 : 100;
    return `${res}%`;
};

const prefixCls = `${cssClasses.PREFIX}-month`;
const contentPadding = 60;
const contentHeight = 24;

export interface MonthCalendarState {
    itemLimit: number;
    showCard: Record<string, [boolean] | [boolean, string]>;
    parsedEvents: MonthlyEvent;
    cachedKeys: Array<string>
}

export default class monthCalendar extends BaseComponent<MonthCalendarProps, MonthCalendarState> {
    static propTypes = {
        displayValue: PropTypes.instanceOf(Date),
        header: PropTypes.node,
        events: PropTypes.array,
        mode: PropTypes.string,
        markWeekend: PropTypes.bool,
        width: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
        height: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
        style: PropTypes.object,
        className: PropTypes.string,
        dateGridRender: PropTypes.func,
        onClick: PropTypes.func,
        onClose: PropTypes.func,
    };

    static defaultProps = {
        displayValue: new Date(),
        events: [] as EventObject[],
        mode: 'month',
    };

    static contextType = localeContext;

    cellDom: React.RefObject<HTMLDivElement>;
    foundation: CalendarFoundation;
    cardRef: Map<string, ReactInstance>;
    optionContainerEl: Map<string, HTMLDivElement>;
    contentCellHeight: number;
    monthlyData: MonthData;

    clickOutsideHandler: (e: MouseEvent) => void;

    constructor(props: MonthCalendarProps) {
        super(props);
        this.state = {
            itemLimit: 0,
            showCard: {},
            parsedEvents: {} as MonthlyEvent,
            cachedKeys: []
        };
        this.cellDom = React.createRef();
        this.foundation = new CalendarFoundation(this.adapter);
        this.handleClick = this.handleClick.bind(this);
        this.cardRef = new Map();
        this.optionContainerEl = new Map();
    }

    get adapter(): CalendarAdapter<MonthCalendarProps, MonthCalendarState> {
        return {
            ...super.adapter,
            registerClickOutsideHandler: (key: string, cb: () => void) => {
                const clickOutsideHandler = (e: MouseEvent) => {
                    
                    const cardDom = this.optionContainerEl && this.optionContainerEl.get(key);
                    
                    const target = e.target as Element;
                    const path = e.composedPath && e.composedPath() || [target];
                    if (cardDom && !cardDom.contains(target) && !path.includes(cardDom)) {
                        cb();
                    }
                };
                this.clickOutsideHandler = clickOutsideHandler;
                document.addEventListener('mousedown', clickOutsideHandler, false);
            },
            unregisterClickOutsideHandler: () => {
                document.removeEventListener('mousedown', this.clickOutsideHandler, false);
            },
            setMonthlyData: data => {
                this.monthlyData = data;
            },
            getMonthlyData: () => this.monthlyData,
            notifyClose: (e, key) => {
                const updates = {};
                updates[key] = [false];
                this.setState(prevState => ({
                    showCard: { ...prevState.showCard, ...updates }
                }));
                this.props.onClose && this.props.onClose(e);
            },
            openCard: (key, spacing) => {
                const updates = {};
                const pos = spacing ? 'leftTopOver' : 'rightTopOver';
                updates[key] = [true, pos];
                this.setState(prevState => ({
                    showCard: { ...updates }
                }));
            },
            setParsedEvents: (parsedEvents: ParsedEventsType) => {
                this.setState({ parsedEvents: parsedEvents as MonthlyEvent });
            },
            setItemLimit: itemLimit => {
                this.setState({ itemLimit });
            },
            cacheEventKeys: cachedKeys => {
                this.setState({ cachedKeys });
            }
        };
    }

    calcItemLimit = () => {
        this.contentCellHeight = this.cellDom.current.getBoundingClientRect().height;
        return Math.max(0, Math.ceil((this.contentCellHeight - contentPadding) / contentHeight));
    };

    componentDidMount() {
        this.foundation.init();
        const itemLimit = this.calcItemLimit();
        this.foundation.parseMonthlyEvents(itemLimit);
    }

    componentWillUnmount() {
        this.foundation.destroy();
    }

    componentDidUpdate(prevProps: MonthCalendarProps, prevState: MonthCalendarState) {
        const prevEventKeys = prevState.cachedKeys;
        const nowEventKeys = this.props.events.map(event => event.key);

        let itemLimitUpdate = false;
        let { itemLimit } = this.state;
        if (prevProps.height !== this.props.height) {
            itemLimit = this.calcItemLimit();
            if (prevState.itemLimit !== itemLimit) {
                itemLimitUpdate = true;
            }
        }
        if (!isEqual(prevEventKeys, nowEventKeys) || itemLimitUpdate || !isEqual(prevProps.displayValue, this.props.displayValue)) {
            this.foundation.parseMonthlyEvents(itemLimit);
        }
    }

    handleClick = (e: React.MouseEvent, val: [Date]) => {
        const { onClick } = this.props;
        const value = this.foundation.formatCbValue(val);
        onClick && onClick(e, value);
    };

    closeCard(e: React.MouseEvent, key: string) {
        this.foundation.closeCard(e, key);
    }

    showCard = (e: React.MouseEvent, key: string) => {
        this.foundation.showCard(e, key);
    };

    renderHeader = (dateFnsLocale: Locale['dateFnsLocale']) => {
        const { markWeekend, displayValue } = this.props;
        this.monthlyData = this.foundation.getMonthlyData(displayValue, dateFnsLocale);
        return (
            <div className={`${prefixCls}-header`} role="presentation">
                <div role="presentation" className={`${prefixCls}-grid`}>
                    <ul role="row" className={`${prefixCls}-grid-row`}>
                        {this.monthlyData[0].map(day => {
                            const { weekday } = day;
                            const listCls = cls({
                                [`${cssClasses.PREFIX}-weekend`]: markWeekend && day.isWeekend,
                            });
                            return (
                                <li role="columnheader" aria-label={weekday} key={`${weekday}-monthheader`} className={listCls}>
                                    <span>{weekday}</span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            </div>
        );
    };

    renderEvents = (events: ParsedRangeEvent[]) => {
        const { itemLimit } = this.state;
        if (!events) {
            return undefined;
        }
        const list = events.map((event, ind) => {
            const { leftPos, width, topInd, key, children } = event;
            const style = {
                left: toPercent(leftPos),
                width: toPercent(width),
                top: `${topInd}em`
            };
            if (topInd < itemLimit)
                return (
                    <li
                        className={`${cssClasses.PREFIX}-event-item ${cssClasses.PREFIX}-event-month`}
                        key={key || `${ind}-monthevent`}
                        style={style}
                    >
                        {children}
                    </li>
                );
            return null;
        });
        return list;
    };

    renderCollapsed = (events: MonthlyEvent['day'][number], itemInfo: DateObj, listCls: string, month: string) => {
        const { itemLimit, showCard } = this.state;
        const { weekday, dayString, date } = itemInfo;
        const key = date.toString();
        const remained = events.filter(i => Boolean(i)).length - itemLimit;
        const cardCls = `${prefixCls}-event-card`;
        // const top = contentPadding / 2 + this.state.itemLimit * contentHeight;
        const shouldRenderCard = remained > 0;
        const closer = (
            <Button
                className={`${cardCls}-close`}
                onClick={e => this.closeCard(e, key)}
                type="tertiary"
                icon={<IconClose />}
                theme="borderless"
                size="small"
            />
        );
        const header = (
            <div className={`${cardCls}-header-info`}>
                <div className={`${cardCls}-header-info-weekday`}>{weekday}</div>
                <div className={`${cardCls}-header-info-date`}>{dayString}</div>
            </div>
        );
        const content = (
            <div className={cardCls} ref={ref => this.optionContainerEl.set(key, ref)}>
                <div className={`${cardCls}-content`}>
                    <div className={`${cardCls}-header`}>
                        {header}
                        {closer}
                    </div>
                    <div className={`${cardCls}-body`}>
                        <ul className={`${cardCls}-list`}>
                            {events.map(item => (
                                <li key={item.key || `${item.start.toString()}-event`}>{item.children}</li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        );
        const pos = showCard && showCard[key] ? showCard[key][1] : 'leftTopOver';
        const text = (
            <LocaleConsumer componentName="Calendar">
                {(locale: Locale['Calendar']) => (// eslint-disable-next-line jsx-a11y/no-static-element-interactions
                    <div
                        className={`${cardCls}-wrapper`}
                        style={{ bottom: 0 }}
                        onClick={e => this.showCard(e, key)}
                    >
                        {locale.remaining.replace('${remained}', String(remained))}
                    </div>
                )}
            </LocaleConsumer>
        );
        return (
            <Popover
                key={`${date.valueOf()}`}
                content={content}
                position={pos as any}
                trigger="custom"
                visible={showCard && showCard[key] && showCard[key][0]}
                ref={ref => this.cardRef.set(key, ref)}
            >
                <li key={date as any} className={listCls} onClick={e => this.handleClick(e, [date])}>
                    {this.formatDayString(date, month, dayString)}
                    {shouldRenderCard ? text : null}
                    {this.renderCusDateGrid(date)}
                </li>
            </Popover>
        );
    };

    formatDayString = (dateObj: Date, month: string, date: string) => {
        const { renderDateDisplay } = this.props;
        if (renderDateDisplay) {
            return renderDateDisplay(dateObj);
        }
        if (date === '1') {
            return (
                <LocaleConsumer componentName="Calendar">
                    {(locale: Locale['Calendar'], localeCode: string) => (
                        <span className={`${prefixCls}-date`}>
                            {month}
                            <span className={`${cssClasses.PREFIX}-today-date`}>&nbsp;{date}</span>
                            {locale.datestring}
                        </span>
                    )}
                </LocaleConsumer>
            );
        }
        return (
            <span className={`${prefixCls}-date`}><span className={`${cssClasses.PREFIX}-today-date`}>{date}</span></span>
        );
    };

    renderCusDateGrid = (date: Date) => {
        const { dateGridRender } = this.props;
        if (!dateGridRender) {
            return null;
        }
        return dateGridRender(date.toString(), date);
    };

    renderWeekRow = (index: number | string, weekDay: MonthData[number], events: MonthlyEvent = {} as MonthlyEvent) => {
        const { markWeekend } = this.props;
        const { itemLimit } = this.state;
        const { display, day } = events;
        return (
            <div role="presentation" className={`${prefixCls}-weekrow`} ref={this.cellDom} key={`${index}-weekrow`}>
                <ul role="row" className={`${prefixCls}-skeleton`}>
                    {weekDay.map(each => {
                        const { date, dayString, isToday, isSameMonth, isWeekend, month, ind } = each;
                        const listCls = cls({
                            [`${cssClasses.PREFIX}-today`]: isToday,
                            [`${cssClasses.PREFIX}-weekend`]: markWeekend && isWeekend,
                            [`${prefixCls}-same`]: isSameMonth
                        });
                        const shouldRenderCollapsed = Boolean(day && day[ind] && day[ind].length > itemLimit);
                        const inner = (
                            <li role="gridcell" aria-label={date.toLocaleDateString()} aria-current={isToday ? "date" : false} key={`${date}-weeksk`} className={listCls} onClick={e => this.handleClick(e, [date])}>
                                {this.formatDayString(date, month, dayString)}
                                {this.renderCusDateGrid(date)}
                            </li>
                        );
                        if (!shouldRenderCollapsed) {
                            return inner;
                        }
                        return this.renderCollapsed(day[ind], each, listCls, month);
                    })}
                </ul>
                <ul className={`${cssClasses.PREFIX}-event-items`}>
                    {display ? this.renderEvents(display) : null}
                </ul>
            </div>
        );
    };

    renderMonthGrid = () => {
        const { parsedEvents } = this.state;
        return (
            <div role="presentation" className={`${prefixCls}-week`}>
                <ul role="presentation" className={`${prefixCls}-grid-col`}>
                    {Object.keys(this.monthlyData).map(weekInd =>
                        this.renderWeekRow(weekInd, this.monthlyData[weekInd], parsedEvents[weekInd])
                    )}
                </ul>
            </div>
        );
    };

    render() {
        const { className, height, width, style, header } = this.props;
        const monthCls = cls(prefixCls, className);
        const monthStyle = {
            height,
            width,
            ...style,
        };
        return (
            <LocaleConsumer componentName="Calendar">
                {(locale: Locale['Calendar'], localeCode: string, dateFnsLocale: Locale['dateFnsLocale']) => (
                    <div role="grid" className={monthCls} key={this.state.itemLimit} style={monthStyle} {...this.getDataAttr(this.props)}>
                        <div role="presentation" className={`${prefixCls}-sticky-top`}>
                            {header}
                            {this.renderHeader(dateFnsLocale)}
                        </div>
                        <div role="presentation" className={`${prefixCls}-grid-wrapper`}>
                            {this.renderMonthGrid()}
                        </div>
                    </div>
                )}
            </LocaleConsumer>
        );
    }
}
