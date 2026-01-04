import React, { useState, useMemo } from 'react';
import { DatePicker, ConfigProvider, Select } from '@douyinfe/semi-ui';
import * as _ from 'lodash';
import * as dateFns from 'date-fns';
import { utcToZonedTime } from 'date-fns-tz';

const { Option } = Select;

function Demo() {
    const now = new Date();
    const startDate = dateFns.addMinutes(dateFns.subDays(now, 1), 5);
    const [timeZone, setTimeZone] = useState('GMT+09:00');
    const gmtList = useMemo(() => {
        const list = [];
        for (let hourOffset = -11; hourOffset <= 14; hourOffset++) {
            const prefix = hourOffset >= 0 ? '+' : '-';
            const hOffset = Math.abs(parseInt(hourOffset, 10));
            list.push(`GMT${prefix}${String(hOffset).padStart(2, '0')}:00`);
        }
        return list;
    }, []);

    return (
        <div style={{ width: 300 }}>
            <DatePicker
                type="dateTime"
                disabledTimePicker={true}
                disabledDate={str => {
                    const date = new Date(str);

                    if (str.length <= 4) {
                        return date.getFullYear() < 2015;
                    }

                    return date.getMonth() + 1 < 10;
                }}
                onChange={date => console.log('date changed', date)}
            />
            <DatePicker
                type="dateTimeRange"
                defaultValue={['2020-02-01 11:22:33', '2020-02-22 12:32:38']}
                disabledTimePicker={true}
                disabledDate={str => {
                    const date = new Date(str);

                    if (str.length <= 4) {
                        return date.getFullYear() < 2015;
                    }

                    return date.getMonth() + 1 < 10;
                }}
            />
            <br />
            <strong>Disabled 17:00:00-18:00:00 today</strong>
            <DatePicker
                type="dateTime"
                hideDisabledOptions={false}
                disabledTime={date =>
                    (dateFns.isToday(date)
                        ? {
                            disabledHours: () => [17, 18],
                            disabledMinutes: hour => (19 === hour ? _.range(0, 10, 1) : []),
                            disabledSeconds: (hour, minute) =>
                                (hour === 20 && minute === 20 ? _.range(0, 20, 1) : []),
                        }
                        : null)
                }
            />
            <div>
                <h5>Month Picker</h5>
                <DatePicker
                    type="month"
                    disabledDate={date =>
                        // [2019, 2018].includes(dateFns.getYear(date)) ||
                        2020 === dateFns.getYear(date) && [1, 2, 3].includes(dateFns.getMonth(date))
                    }
                />
            </div>
            {/* 开始时间不能早于当下时间+5min，结束时间要在7天内 */}
            <DatePicker
                type={'dateTimeRange'}
                disabledDate={cur => {
                    const deadDate = dateFns.addDays(now, 7);
                    return dateFns.isAfter(cur, deadDate) || dateFns.isBefore(cur, startDate);
                }}
                disabledTime={(dates, panelType) => {
                    if (dateFns.isToday(dates[0]) && panelType === 'left') {
                        return {
                            disabledHours: () => _.range(0, now.getHours(), 1),
                            disabledMinutes: hour =>
                                (now.getHours() === hour ? _.range(0, now.getMinutes() + 5, 1) : []),
                        };
                    }
                }}
                onChange={(...args) => console.log(...args)}
            />
            <br />
            {/* 动态禁止时间，禁止选中之前的Date */}
            <strong>Disabled date before rangeStart</strong>
            <DatePicker
                type={'dateRange'}
                disabledDate={(cur, options) => {
                    const { rangeStart } = options;
                    const startDate = dateFns.parseISO(rangeStart);
                    return dateFns.isBefore(cur, startDate);
                }}
                style={{ width: 240 }}
            />
            <br /><br />
            <strong>type=month时禁止2020年且11月之前的日期 v1.10.0</strong>
            <DatePicker
                type={'month'}
                disabledDate={cur => {
                    if (cur.getFullYear() === 2020 && cur.getMonth() < 10) {
                        return true;
                    }
                    return false;
                }}
                style={{ width: 240 }}
            />
            <br /><br />
            <strong>type=month时禁止2008年-2020年 v1.10.0</strong>
            <DatePicker
                type={'month'}
                style={{ width: 240 }}
                disabledDate={cur => {
                    const currentYear = cur.getFullYear();
                    if (2008 <= currentYear && currentYear <= 2020) {
                        return true;
                    }
                    return false;
                }}
            />
            <br /><br />
            <strong>fix disabledDate callback timeZone bug</strong>
            <ConfigProvider timeZone={timeZone}>
                <div style={{ width: 300 }}>
                    <h5 style={{ margin: 10 }}>Select Time Zone:</h5>
                    <Select
                        placeholder={'请选择时区'}
                        style={{ width: 300 }}
                        value={timeZone}
                        showClear={true}
                        onSelect={value => setTimeZone(value)}
                    >
                        {gmtList.map(gmt => (
                            <Option key={gmt} value={gmt}>
                                {gmt}
                            </Option>
                        ))}
                    </Select>
                    <br />
                    <br />
                    <DatePicker
                        disabledDate={str => {
                            const date = new Date(str);
                            const isDisabled = date.valueOf() === 1626274800000;
                            if (isDisabled) {
                                console.log(str);
                            }
                            return isDisabled;
                        }}
                        placeholder="禁用每月10号"
                        onChange={date => {
                            console.log('selected', date);
                        }}
                    />
                    <DatePicker
                        type="dateTime"
                        disabledTime={str => {
                            const date = new Date(str);
                            const localDate = utcToZonedTime(date, timeZone);
                            const isDisabled = localDate.getDate() === 15;
                            return isDisabled ? ({ disabledHours: () => [18] }) : null;
                        }}
                        defaultPickerValue={new Date('2021-07-15 17:00:00')}
                        placeholder="禁用7月15号下午6点"
                        onChange={date => {
                            console.log('selected', date);
                        }}
                    />
                </div>
            </ConfigProvider>
        </div>
    );
}

export default Demo;
