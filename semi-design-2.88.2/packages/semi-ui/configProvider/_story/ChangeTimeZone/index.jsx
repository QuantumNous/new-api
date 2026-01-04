import React, { useMemo, useState } from 'react';
import { ConfigProvider, Select, DatePicker, TimePicker } from '@douyinfe/semi-ui';
import { IANAOffsetMap, zonedTimeToUtc, utcToZonedTime, format as tzFormat } from '@douyinfe/semi-foundation/utils/date-fns-extra';
import { parse, format, addDays, addWeeks, startOfMonth, endOfMonth, addMonths } from 'date-fns';

import zh_CN from '@douyinfe/semi-ui/locale/source/zh_CN';
import en_GB from '@douyinfe/semi-ui/locale/source/en_GB';
import ko_KR from '@douyinfe/semi-ui/locale/source/ko_KR';
import ja_JP from '@douyinfe/semi-ui/locale/source/ja_JP';

const { Option } = Select;

const presets = [
    {
        text: 'Today',
        start: new Date(),
        end: new Date(),
    },
    {
        text: 'Tomorrow',
        start: addDays(new Date(), 1),
        end: addDays(new Date(), 1),
    },
    {
        text: 'Next Week',
        start: addWeeks(new Date(), 1),
        end: addWeeks(new Date(), 2),
    },
    {
        text: 'Next Month',
        start: startOfMonth(addMonths(new Date(), 1)),
        end: endOfMonth(addMonths(new Date(), 1)),
    },
    {
        text: 'Today',
        start: new Date(),
        end: new Date(),
    },
    {
        text: 'Tomorrow',
        start: addDays(new Date(), 1),
        end: addDays(new Date(), 1),
    },
    {
        text: 'Next Week',
        start: addWeeks(new Date(), 1),
        end: addWeeks(new Date(), 2),
    },
    {
        text: 'Next Month',
        start: startOfMonth(addMonths(new Date(), 1)),
        end: endOfMonth(addMonths(new Date(), 1)),
    },
];

const Demo = () => {
    const [timeZone, setTimeZone] = useState('GMT-08:00');
    const [localeCode, setLocaleCode] = useState(zh_CN.code);
    const defaultTimestamp = 1581599305265;
    const defaultTimestampEnd = defaultTimestamp + 3600 * 24 * 2 + 1600 * 2;
    const formatToken = 'yyyy-MM-dd HH:mm:ss';
    const defaultDate = parse(`2020-02-13 21:08:25`, formatToken, Date.now());
    const gmtList = useMemo(
        () =>
            IANAOffsetMap.map(([hourOffset, [iana]]) => {
                const hOffset = Math.abs(parseInt(hourOffset, 10));
                const mOffset = Math.abs(Math.abs(hourOffset) - hOffset);
                const prefix = hourOffset >= 0 ? '+' : '-';
                return `GMT${prefix}${String(hOffset).padStart(2, '0')}:${String(mOffset * 60).padStart(2, '0')}`;
            }),
        []
    );
    const localeList = useMemo(() => [zh_CN, en_GB, ko_KR, ja_JP], []);

    const [timeDate, setTimeDate] = useState(new Date(defaultTimestamp));
    const [date, setDate] = useState(new Date(defaultTimestamp));

    const Item = useMemo(() => (props = {}) => <div {...props} style={{ marginBottom: 20, ...props.style }} />, []);

    return (
        <ConfigProvider timeZone={timeZone} locale={localeList.find(locale => locale.code === localeCode)}>
            <div style={{ width: 300 }}>
                <Item>
                    <Select
                        placeholder={'Select time zone'}
                        style={{ width: 300 }}
                        value={timeZone}
                        onSelect={value => setTimeZone(value)}
                    >
                        {gmtList.map(gmt => (
                            <Option key={gmt} value={gmt}>
                                {gmt}
                            </Option>
                        ))}
                    </Select>
                    <Select placeholder={'Select locale'} value={localeCode} onSelect={value => setLocaleCode(value)}>
                        {localeList.map(locale => (
                            <Option key={locale.code} value={locale.code}>
                                {locale.code}
                            </Option>
                        ))}
                    </Select>
                </Item>
                <Item>
                    <strong>Same UTC Time</strong>
                    <ul>
                        {gmtList.map(gmt => (
                            <li key={gmt}>
                                <strong style={{ marginRight: 5 }}>{gmt}</strong>
                                <span>{tzFormat(defaultTimestamp, formatToken, { timeZone: gmt })}</span>
                            </li>
                        ))}
                    </ul>
                    <strong>Same Time String</strong>
                    <ul>
                        {gmtList.map(gmt => (
                            <li key={gmt}>
                                <strong style={{ marginRight: 5 }}>{gmt}</strong>
                                <span>
                                    {tzFormat(zonedTimeToUtc(format(defaultTimestamp, formatToken), gmt), formatToken)}
                                </span>
                            </li>
                        ))}
                    </ul>
                </Item>
                <Item>
                    <h2>Uncontrolled DatePicker</h2>
                    <DatePicker
                        type={'dateTime'}
                        defaultValue={new Date(defaultTimestamp)}
                        format={formatToken}
                        onChange={(date, dateString) => console.log('DatePicker changed: ', date, dateString)}
                    />
                </Item>
                <Item>
                    <h2>Controlled DatePicker</h2>
                    <DatePicker
                        type={'dateTime'}
                        value={date}
                        format={formatToken}
                        onChange={(date, dateString) => {
                            console.log('DatePicker changed: ', date, dateString);
                            setDate(date);
                        }}
                    />
                </Item>
                <Item>
                    <h2>With Confirm and Persets</h2>
                    <DatePicker
                        type="dateTime"
                        needConfirm
                        presets={presets.map(preset => ({
                            text: preset.text,
                            start: preset.start,
                        }))}
                        onChange={(...args) => console.log(...args)}
                    />
                </Item>
                <Item>
                    <h2>Uncontrolled TimePicker</h2>
                    <TimePicker
                        defaultValue={new Date(defaultTimestamp)}
                        onChange={(time, timeString) => console.log('TimePicker changed: ', time, timeString)}
                    />
                </Item>

                <Item>
                    <h2>Controlled TimePicker</h2>
                    <TimePicker
                        value={timeDate}
                        onChange={(time, timeString) => {
                            console.log('TimePicker changed: ', time, timeString);
                            // setTimeDate(time);
                            setTimeDate(timeString);
                        }}
                    />
                </Item>
            </div>
        </ConfigProvider>
    );
};

export default Demo;
