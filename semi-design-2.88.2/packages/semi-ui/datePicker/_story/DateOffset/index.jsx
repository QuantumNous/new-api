import React from 'react';
import DatePicker from '../../index';
import * as dateFns from 'date-fns';

export default function Demo() {
    const handleChange = date => {
        console.log('date changed', date);
    };

    return (
        <div>
            <strong>设置 startDateOffset 和 endDateOffset 可以单击选择日期范围</strong>
            <br />
            <br />
            <div>选择前三天和后三天</div>
            <DatePicker
                style={{ width: 240 }}
                type="dateRange"
                startDateOffset={date => dateFns.sub(date, { days: 3 })}
                endDateOffset={date => dateFns.add(date, { days: 3 })}
                onChange={handleChange}
            />
            <br />
            <br />
            <div>选择自然周</div>
            <DatePicker
                style={{ width: 240 }}
                type="dateRange"
                weekStartsOn={1}
                startDateOffset={date => dateFns.startOfWeek(date, { weekStartsOn: 1 })}
                endDateOffset={date => dateFns.endOfWeek(date, { weekStartsOn: 1 })}
                onChange={handleChange}
            />
            <br />
            <br />
            <div>选择后6天</div>
            <DatePicker
                style={{ width: 240 }}
                type="dateRange"
                weekStartsOn={1}
                endDateOffset={date => dateFns.add(date, { days: 6 })}
                onChange={handleChange}
            />
            <br />
            <br />
            <div>选择前6天</div>
            <DatePicker
                style={{ width: 240 }}
                type="dateRange"
                weekStartsOn={1}
                startDateOffset={date => dateFns.sub(date, { days: 6 })}
                onChange={handleChange}
            />
            <br />
            <br />
            <div>选择1天</div>
            <DatePicker
                style={{ width: 240 }}
                type="dateRange"
                startDateOffset={date => date}
                endDateOffset={date => date}
                onChange={handleChange}
            />
            <br />
            <br />
            <div>禁止每个月的5号（仅查看样式，功能上不禁止）</div>
            <DatePicker
                style={{ width: 240 }}
                type="dateRange"
                disabledDate={date => {
                    if (date.getDate() === 5) {
                        return true;
                    }
                    return false;
                }}
                weekStartsOn={1}
                startDateOffset={date => dateFns.startOfWeek(date, { weekStartsOn: 1 })}
                endDateOffset={date => dateFns.endOfWeek(date, { weekStartsOn: 1 })}
                onChange={handleChange}
            />
        </div>
    );
}
