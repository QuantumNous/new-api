/* eslint-disable jsx-a11y/no-noninteractive-element-to-interactive-role */
import React from 'react';
import cls from 'classnames';
import PropTypes from 'prop-types';
import CalendarFoundation, { CalendarAdapter } from '@douyinfe/semi-foundation/calendar/foundation';
import { cssClasses } from '@douyinfe/semi-foundation/calendar/constants';
import BaseComponent from '../_base/baseComponent';
import localeContext from '../locale/context';
import { DayColProps } from './interface';
import '@douyinfe/semi-foundation/calendar/calendar.scss';


const prefixCls = `${cssClasses.PREFIX}-grid`;

function pad(d: number) {
    return (d < 10) ? `0${d.toString()}` : d.toString();
}

export interface DayColState {
    currPos: number;
    showCurrTime: boolean
}

export default class DayCol extends BaseComponent<DayColProps, DayColState> {
    static propTypes = {
        events: PropTypes.array,
        displayValue: PropTypes.instanceOf(Date),
        showCurrTime: PropTypes.bool,
        scrollHeight: PropTypes.number,
        currPos: PropTypes.number,
        handleClick: PropTypes.func,
        mode: PropTypes.string,
        minEventHeight: PropTypes.number,
        isWeekend: PropTypes.bool,
        dateGridRender: PropTypes.func,
    };

    static defaultProps = {
        events: [] as DayColProps['events'],
        showCurrTime: true,
        scrollHeight: 0,
        currPos: 0,
        mode: 'dayCol',
        minEventHeight: Number.MIN_SAFE_INTEGER
    };

    static contextType = localeContext;
    foundation: CalendarFoundation;

    constructor(props: DayColProps) {
        super(props);
        this.state = {
            currPos: 0,
            showCurrTime: false,
        };
        this.foundation = new CalendarFoundation(this.adapter);
    }

    componentDidMount() {
        this.foundation.init();
        this.foundation.initCurrTime();
    }

    componentWillUnmount() {
        this.foundation.destroy();
    }

    get adapter(): CalendarAdapter<DayColProps, DayColState> {
        return {
            ...super.adapter,
            updateCurrPos: currPos => {
                this.setState({ currPos });
            },
            updateShowCurrTime: () => {
                this.setState({ showCurrTime: true });
            },
        };
    }

    renderEvents = () => {
        const { events, scrollHeight, minEventHeight } = this.props;
        const list = events.map((event, ind) => {
            const { startPos, endPos, children, key, left = 0 } = event;
            const top = startPos * scrollHeight;
            const height = (endPos - startPos) * scrollHeight;
            const style = {
                top: `${top}px`,
                height: `${Math.max(minEventHeight, height)}px`,
                left: left
            };
            return (
                <li className={`${cssClasses.PREFIX}-event-item ${cssClasses.PREFIX}-event-day`} style={style} key={key || `${top}-${ind}`}>
                    {children}
                </li>
            );
        });
        return list;
    };

    renderCurrTime = () => {
        const { currPos } = this.state;
        const { scrollHeight } = this.props;
        const key = currPos;
        const top = currPos * scrollHeight;
        const style = { top };
        const circle = (<div className={`${prefixCls}-curr-circle`} style={style} />);
        const line = (<div className={`${prefixCls}-curr-line`} style={style} />);
        return (
            <React.Fragment key={key}>
                {circle}
                {line}
            </React.Fragment>
        );
    };

    handleClick: DayColProps['handleClick'] = (e, val) => {
        this.props.handleClick(e, val);
    };

    renderGrid = () => {
        const showCurrTime = this.props.showCurrTime ? this.state.showCurrTime : false;
        const { displayValue, isWeekend, dateGridRender } = this.props;
        const skCls = cls(`${prefixCls}-skeleton`, {
            [`${cssClasses.PREFIX}-weekend`]: isWeekend,
        });
        return (
            <div className={`${prefixCls}`} role="presentation">
                <div role="gridcell" className={`${prefixCls}-content`}>
                    {showCurrTime ? this.renderCurrTime() : null}
                    <ul role="row" className={skCls}>
                        {[...Array(25).keys()].map(item => {
                            const line = cls({
                                [`${prefixCls}-skeleton-row-line`]: true,
                            });
                            return (
                                <React.Fragment key={`${item}-daycol`}>
                                    <li data-time={`${pad(item)}:00:00`} className={line} onClick={e => this.handleClick(e, [displayValue, item, 0, 0])} />
                                    <li data-time={`${pad(item)}:30:00`} onClick={e => this.handleClick(e, [displayValue, item, 30, 0])} />
                                </React.Fragment>
                            );
                        })}
                    </ul>
                    {dateGridRender && dateGridRender(displayValue.toString(), displayValue)}
                    <ul className={`${cssClasses.PREFIX}-event-items`}>
                        {this.renderEvents()}
                    </ul>
                </div>
            </div>
        );
    };

    render() {
        const grid = this.renderGrid();
        return grid;
    }
}
