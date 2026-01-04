import Calendar from '../index'
import { mount, shallow } from 'enzyme';
import WeekCalendar from '../weekCalendar'
import DayCalendar from '../dayCalendar';
import MonthCalendar from '../monthCalendar';
import RangeCalendar from '../rangeCalendar';
import { BASE_CLASS_PREFIX } from '../../../semi-foundation/base/constants';


describe('Calendar', () => {
    it('prop mode', () => {
        let calendar = mount(<Calendar></Calendar>)
        expect(calendar.find(WeekCalendar)).toHaveLength(1)


        calendar = mount(<Calendar mode='day'></Calendar>)
        expect(calendar.find(DayCalendar)).toHaveLength(1)

        calendar = mount(<Calendar mode='month'></Calendar>)
        expect(calendar.find(MonthCalendar)).toHaveLength(1)

        calendar = mount(<Calendar mode='range' range={[new Date(2020, 8, 26), new Date(2020, 8, 31)]}></Calendar>)
        expect(calendar.find(RangeCalendar)).toHaveLength(1)
    })

    it('prop showCurrTime', () => {
        let wrapper = mount(<Calendar showCurrTime={false} mode='week' />)
        expect(wrapper.find('.semi-calendar-grid-curr-line')).toHaveLength(0)

        wrapper = mount(<Calendar showCurrTime={false} mode='day' />)
        expect(wrapper.find('.semi-calendar-grid-curr-line')).toHaveLength(0)

        wrapper = mount(<Calendar showCurrTime mode='week' />)
        expect(wrapper.find('.semi-calendar-grid-curr-line')).toHaveLength(1)


        wrapper = mount(<Calendar showCurrTime mode='day' />)
        expect(wrapper.find('.semi-calendar-grid-curr-line')).toHaveLength(1)
    })

    it('prop onClick', () => {
        const clickHandler = jest.fn();
        let weekWrapper = mount(<Calendar onClick={clickHandler} mode='week'  />)
        expect(clickHandler).toHaveBeenCalledTimes(0)
        weekWrapper.find('.semi-calendar-grid-skeleton-row-line').at(0).simulate('click')
        expect(clickHandler).toHaveBeenCalledTimes(1)

        const clickHandler2 = jest.fn();
        let monthWrapper = mount(<Calendar onClick={clickHandler2} mode='month'  />)
        expect(clickHandler2).toHaveBeenCalledTimes(0)
        monthWrapper.find('.semi-calendar-month-skeleton li').at(0).simulate('click')
        expect(clickHandler2).toHaveBeenCalledTimes(1)
    })
    
    it('test dateGridRender', ()=>{
        const importantDateStyle = {
            position: 'absolute',
            left: '0',
            right: '0',
            top: '0',
            bottom: '0',
            backgroundColor: 'red',
        };
        const displayValue = new Date(2019, 6, 23, 8, 32, 0);
        const importDates = [new Date(2019, 6, 2)];
        const dateRender = dateString => {
            if (importDates.filter(date => date.toString() === dateString).length) {
                return <div style={importantDateStyle}>hello</div>;
            }
            return null;
        };
        let calendar = mount(<Calendar displayValue={displayValue} dateGridRender={dateRender} mode='month'></Calendar>)
        // test the date 2019, 7, 2 whether renders an extra div
        expect(calendar.find(`.${BASE_CLASS_PREFIX}-calendar-month-same`).at(1).find('div').text()).toBe('hello')
    })

    it('test event render',()=>{
        const allDayStyle = {
            borderRadius: '3px',
            boxSizing: 'border-box',
            border: 'var(--color-bg-1) 1px solid',
            padding: '2px 4px',
            backgroundColor: 'var(--color-primary-light-active)',
            height: '100%',
            overflow: 'hidden',
        };
        const events = [
            {
                key: '0',
                start: new Date(2019, 5, 25, 14, 45, 0),
                children: <div className="eventDay" style={allDayStyle}>6月25日 14:45</div>,
            },
            {
                key: '1',
                start: new Date(2019, 6, 18, 10, 0, 0),
                children: <div className="eventDay" style={allDayStyle}>7月18日 10:00</div>,
            },
            {
                key: '2',
                start: new Date(2019, 6, 19, 20, 0, 0),
                children: <div className="eventDay" style={allDayStyle}>7月19日 20:00</div>,
            },
            {
                key: '3',
                start: new Date(2019, 6, 21, 6, 0, 0),
                children: <div className="eventDay" style={allDayStyle}>7月21日 6:00</div>,
            },
            {
                key: '4',
                allDay: true,
                start: new Date(2019, 6, 22, 8, 0, 0),
                children: <div className="eventDay" style={allDayStyle}>7月22日 全天</div>,
            },
            {
                key: '5',
                start: new Date(2019, 6, 23, 9, 0, 0),
                allDay: true,
                children: <div className="eventDay" >7月23日 全天</div>,
            },
            {
                key: '6',
                start: new Date(2019, 6, 24, 8, 32, 0),
                children: <div className="eventDay" style={allDayStyle}>7月24日 8:32</div>,
            },
            {
                key: '7',
                start: new Date(2019, 6, 25, 8, 32, 0),
                end: new Date(2019, 6, 26, 8, 32, 0),
                children: <div className="eventDay" style={allDayStyle}>7月25日 8:32 - 7月26日 8:32</div>,
            }

        ];
        
        let dailyCalendar = mount(<Calendar
            height={400}
            mode={'day'}
            displayValue={new Date(2019, 6, 23)}
            events={events}
        ></Calendar>)

        const eventOnJuly23 = events.filter(event=>{
            return event.start.getMonth() === 6 && event.start.getDate() === 23
        })
        // test whether 07/23's event rendered
        expect(dailyCalendar.find(`.eventDay`).length).toBe(eventOnJuly23.length)

    })

    it('test weekStartsOn', () => {
        const displayValue = new Date(2022, 7, 1, 8, 32, 0);

        let calendar = mount(<Calendar
                    height={400}
                    mode={'month'}
                    weekStartsOn={3}
                    displayValue={displayValue}
                ></Calendar>);
        let firstHead = calendar.find('.semi-calendar-month-header li').at(0).text();
        expect(firstHead).toEqual('周三');

        let defaultCalendar = mount(<Calendar
                    height={400}
                    mode={'month'}
                    displayValue={displayValue}
                ></Calendar>);
        let defaultFirstHead = defaultCalendar.find('.semi-calendar-month-header li').at(0).text();
        expect(defaultFirstHead).toEqual('周日');
    });

    it('test getMonthlyData same month fixture', () => {
        const displayValue = new Date(2023, 3, 10, 8, 32, 0);

        let calendar = mount(<Calendar
            mode={'month'}
            displayValue={displayValue}
        ></Calendar>);

        let firstRow = calendar.find('.semi-calendar-month-weekrow').at(0);
        let lastRow = calendar.find('.semi-calendar-month-weekrow').last();
        let sameMonthClass = `${BASE_CLASS_PREFIX}-calendar-month-same`;
        // 2023-03-26
        expect(firstRow.find('li').at(0).hasClass(sameMonthClass)).toEqual(false);
        // 2023-04-01
        expect(firstRow.find('li').last().hasClass(sameMonthClass)).toEqual(true);
        // 2023-04-30
        expect(lastRow.find('li').at(0).hasClass(sameMonthClass)).toEqual(true);
        // 2023-05-06
        expect(lastRow.find('li').last().hasClass(sameMonthClass)).toEqual(false);
    });

    it('Custom renderDateDisplay', () => {
        const displayValue = new Date(2023, 3, 1, 8, 32, 0);
        const customPrefix = 'my-custom-render-';

        let monthCalendar = mount(<Calendar
            mode={'month'}
            displayValue={displayValue}
            renderDateDisplay={d => <span className={`${customPrefix}${d.getMonth()}-${d.getDate()}`} />}
        ></Calendar>);

        // 2023-04-01
        expect(monthCalendar.find(`.${customPrefix}3-1`).length).toEqual(1);

        let weekCalendar = mount(<Calendar
            mode={'week'}
            displayValue={displayValue}
            renderDateDisplay={d => <span className={`${customPrefix}${d.getMonth()}-${d.getDate()}`} />}
        ></Calendar>);

        // 2023-04-01
        expect(weekCalendar.find(`.${customPrefix}3-1`).length).toEqual(1);
    });

    it('Custom allDayEventsRender', () => {
        const displayValue = new Date(2023, 3, 1, 8, 32, 0);
        const customClassName = 'my-custom-render';
        const defaultElementSelector = '.semi-calendar-event-allday';

        let calendar = mount(<Calendar
            mode={'week'}
            displayValue={displayValue}
            allDayEventsRender={events => <div className={customClassName} />}
        ></Calendar>);

        expect(calendar.find(`.${customClassName}`).length).toEqual(1);
        expect(calendar.find(defaultElementSelector).length).toEqual(0);
    });

    it('test range mode RangeData fixture', () => {
        const displayValue = new Date(2023, 3, 1, 8, 32, 0);
        const events = [
            {
                key: '0',
                allDay: false,
                start: new Date(2023, 3, 1, 8, 32, 0),
                end: new Date(2023, 3, 1, 9, 32, 0),
                children: <div className="eventDay">eventDay</div>,
            },
        ];
        const range = [
            new Date(2023, 3, 1, 8, 32, 0),
            new Date(2023, 3, 5, 8, 32, 0),
        ];

        let calendar = mount(<Calendar
            mode="range"
            height={400}
            displayValue={displayValue}
            range={range}
            events={events}
        ></Calendar>);
        // force set scrollHeight to avoid skipped events render
        calendar.childAt(0).setState({ scrollHeight: 400 });

        expect(calendar.find(".eventDay").length).toBe(1);
    });
})