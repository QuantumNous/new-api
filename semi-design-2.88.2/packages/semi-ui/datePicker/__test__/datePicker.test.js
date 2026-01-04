import React from 'react';
import DatePicker from '../index';
import BaseDatePicker from '../datePicker';
import ConfigProvider from '../../configProvider';
import * as _ from 'lodash';
import { clear } from 'jest-date-mock';
import { addDays, startOfWeek, endOfWeek, add, format, addWeeks, set } from 'date-fns';
import { zhCN, enUS } from "date-fns/locale";
import { zonedTimeToUtc } from 'date-fns-tz';
import { strings } from '../../../semi-foundation/datePicker/constants';
import { BASE_CLASS_PREFIX } from '../../../semi-foundation/base/constants';
import en_US from '../../locale/source/en_US';
import LocaleProvider from '../../locale/localeProvider';

import { genBeforeEach, genAfterEach, mount, sleep as baseSleep } from '../../_test_/utils';
import { utcToZonedTime, toIANA } from '../../../semi-foundation/utils/date-fns-extra';

const animationMs = 200;
const baseYear = 2019;
const baseDay = 8;
const baseMon = 8;
const baseDate = new Date(baseYear, baseMon, baseDay, 8, 8, 8, 8);

const popupSelector = `.${BASE_CLASS_PREFIX}-popover .${BASE_CLASS_PREFIX}-datepicker`;

const sleep = (ms = 200) => baseSleep(ms);

const getRandomIANATimeZone = function () {
    const TIME_ZONE = Array.from({ length: 26 }).map((_, index) => index - 11);
    const offset = Math.floor(Math.random() * TIME_ZONE.length);
    const timeZone = toIANA(TIME_ZONE[offset]);
    return [timeZone, offset];
};

describe(`DatePicker`, () => {
    beforeEach(() => {
        clear();
        genBeforeEach()();
    });

    afterEach(genAfterEach());

    it(`test appearance`, () => {
        const defaultValue = new Date();

        /**
         * with default value
         */
        const elem = mount(<DatePicker defaultValue={defaultValue} />);
        expect(elem.find(`.${BASE_CLASS_PREFIX}-datepicker`).length).toBe(1);
        expect(elem.find(`.${BASE_CLASS_PREFIX}-datepicker .${BASE_CLASS_PREFIX}-input-wrapper-clearable`).length).toBe(1);
    });

    it(`test defaultOpen`, async () => {
        const defaultValue = new Date();
        const open = true;
        const motion = false;

        const elem = mount(<DatePicker motion={motion} defaultOpen={open} defaultValue={defaultValue} />);

        await sleep();
        expect(document.querySelectorAll(popupSelector).length).toBe(1);

        // document.body.click();
        document.dispatchEvent(new Event('mousedown', { bubbles: true }));

        await sleep();
        expect(document.querySelectorAll(popupSelector).length).toBe(0);
    });

    it(`test open`, async () => {
        const defaultValue = new Date();
        const open = true;
        const motion = false;

        const elem = mount(<DatePicker motion={motion} open={open} defaultValue={defaultValue} />);

        expect(document.querySelectorAll(popupSelector).length).toBe(1);

        /**
         * click body without reset open
         */
        document.body.click();
        await sleep();
        expect(document.querySelectorAll(popupSelector).length).toBe(1);

        /**
         * click body and set open
         */
        elem.setProps({ open: false });
        document.body.click();

        await sleep();
        expect(document.querySelectorAll(popupSelector).length).toBe(0);
    });

    it(`test presets`, async () => {
        const dayOffset = 1;
        const presets = [
            {
                text: 'Today',
                start: new Date(baseDate),
                end: new Date(baseDate),
            },
            {
                text: 'Next Day',
                start: addDays(new Date(baseDate), dayOffset),
                end: addDays(new Date(baseDate), dayOffset),
            },
        ];
        const defaultValue = new Date(addDays(new Date(baseDate), -dayOffset));
        const open = true;
        const motion = false;

        const demo = mount(<DatePicker presets={presets} motion={motion} open={open} defaultValue={defaultValue} />);
        const elem = demo.find(BaseDatePicker);

        const btns = document.querySelectorAll(`.${BASE_CLASS_PREFIX}-datepicker-quick-control button`);

        /**
         * click next day
         */
        btns[1].click();
        let value = elem.state('value');
        expect(value[0].getDate() - defaultValue.getDate()).toEqual(dayOffset * 2);

        /**
         * click current day
         */
        btns[0].click();
        value = elem.state('value');
        expect(value[0].getDate()).toEqual(defaultValue.getDate() + 1);
    });

    it(`test value`, async () => {
        const currentValue = new Date(baseDate);
        const open = true;
        const motion = false;
        const dayOffset = 3;

        const onChange = sinon.spy(async (date, str) => {
            expect(date.getDate()).toBe(currentValue.getDate() + dayOffset);
            elem.setProps({ value: date });

            await sleep();
            expect(_.first(datePickerElem.state('value')).getDate() - baseDate.getDate()).toBe(dayOffset);
        });

        const elem = mount(<DatePicker motion={motion} open={open} value={currentValue} onChange={onChange} />);
        const datePickerElem = elem.find(BaseDatePicker);
        const popup = document.querySelector(`.${BASE_CLASS_PREFIX}-popover .${BASE_CLASS_PREFIX}-datepicker`);
        const selectedDayElem = popup.querySelector(`.${BASE_CLASS_PREFIX}-datepicker-day-selected`);

        const nextOffsetDayElem = _.times(dayOffset).reduce(node => node.nextElementSibling, selectedDayElem);

        nextOffsetDayElem.click();

        await sleep(animationMs * 3);
        expect(onChange.called).toBeTruthy();
    });

    it(`test needConfirm`, async () => {
        const currentValue = new Date(baseDate);
        const open = true;
        const motion = false;
        const type = 'dateTime';
        const needConfirm = true;
        const dayOffset = 3;

        const demo = mount(
            <DatePicker motion={motion} defaultValue={currentValue} open={open} type={type} needConfirm={needConfirm} />
        );
        const elem = demo.find(BaseDatePicker);

        const btns = document.querySelectorAll(`.${BASE_CLASS_PREFIX}-popover .${BASE_CLASS_PREFIX}-datepicker .${BASE_CLASS_PREFIX}-datepicker-footer .${BASE_CLASS_PREFIX}-button`);

        expect(btns.length).toBe(2);

        const selectedDayElem = document.querySelector(`.${BASE_CLASS_PREFIX}-popover .${BASE_CLASS_PREFIX}-datepicker .${BASE_CLASS_PREFIX}-datepicker-day-selected`);
        const nextOffsetDayElem = _.times(dayOffset).reduce(node => node.nextElementSibling, selectedDayElem);

        /**
         * click next day
         */
        nextOffsetDayElem.click();
        await sleep();
        expect(_.first(elem.state('value')).getDate() === currentValue.getDate()).toBeTruthy();

        /**
         * click cancel button
         */
        btns[0].click();
        await sleep();
        expect(_.first(elem.state('value')).getDate() === currentValue.getDate()).toBeTruthy();
        expect(_.isEqual(elem.state('cachedSelectedValue'), [currentValue])).toBe(true);

        /**
         * click ensure button
         */
        btns[1].click();
        await sleep();
        expect(_.first(elem.state('value')).getDate() === currentValue.getDate()).toBe(true);

        /**
         * re click next day
         */
        nextOffsetDayElem.click();
        await sleep();
        expect(_.first(elem.state('value')).getDate() === currentValue.getDate()).toBeTruthy();

        /**
         * re click ensure button
         */
        btns[1].click();
        await sleep();
        expect(_.first(elem.state('value')).getDate() - currentValue.getDate()).toBe(dayOffset);

        demo.unmount();
    });

    it(`test events`, async () => {
        const currentValue = new Date(baseDate);
        const open = true;
        const motion = false;
        const type = 'dateTime';
        const needConfirm = true;
        const dayOffset = 3;

        const onOpenChange = sinon.spy();
        const onChange = sinon.spy();

        const elem = mount(
            <DatePicker
                onOpenChange={onOpenChange}
                motion={motion}
                defaultValue={currentValue}
                type={type}
                needConfirm={needConfirm}
                onChange={onChange}
            />
        );

        /**
         * click outside
         */
        document.body.click();
        await sleep();
        expect(onOpenChange.called).toBeFalsy();

        /**
         * click datePicker
         */
        const inputWrapper = document.querySelector(`.${BASE_CLASS_PREFIX}-input-wrapper`);
        const dateInputDom = inputWrapper.parentElement;
        dateInputDom.click();
        await sleep();
        expect(onOpenChange.called).toBeTruthy();

        /**
         * input value change
         */
        elem.find(`.${BASE_CLASS_PREFIX}-input-wrapper input`).simulate('change', { target: { value: '2019-10-02 08:30:02' } });
        expect(onChange.called).toBeTruthy();
    });

    it(`test range picker`, async () => {
        const open = true;
        const motion = false;
        const type = 'dateTimeRange';
        const needConfirm = false;
        const dayOffset = 3;
        const leftPrevClickTimes = 3;
        const currentValue = [new Date(baseDate), new Date(baseDate).setDate(baseDay + dayOffset)];

        const demo = mount(
            <DatePicker
                motion={motion}
                defaultOpen={open}
                defaultValue={currentValue}
                type={type}
                needConfirm={needConfirm}
            />
        );
        const elem = demo.find(BaseDatePicker);

        const startDayDom = document.querySelector(`.${BASE_CLASS_PREFIX}-datepicker-day-selected-start`);
        const endDayDom = document.querySelector(`.${BASE_CLASS_PREFIX}-datepicker-day-selected-end`);

        /**
         * check started day and ended day's gap offset
         */
        expect(_.times(dayOffset).reduce(cur => cur.nextElementSibling, startDayDom)).toBe(endDayDom);

        const leftPanel = document.querySelector(`.${BASE_CLASS_PREFIX}-datepicker-month-grid-left`);
        const leftNavBtns = leftPanel.querySelectorAll(`.${BASE_CLASS_PREFIX}-datepicker-navigation .${BASE_CLASS_PREFIX}-button`);
        const rightPanel = document.querySelector(`.${BASE_CLASS_PREFIX}-datepicker-month-grid-right`);
        const rightNavBtns = rightPanel.querySelectorAll(`.${BASE_CLASS_PREFIX}-datepicker-navigation .${BASE_CLASS_PREFIX}-button`);

        // 点击右边面板下一月
        _.get(rightNavBtns, 2).click();
        await sleep();

        // 点击左边面板上一月
        _.times(leftPrevClickTimes).forEach(() => _.get(leftNavBtns, 1).click());

        const leftSecondWeek = leftPanel.querySelectorAll(`.${BASE_CLASS_PREFIX}-datepicker-week`)[1];
        const leftSecondWeekDays = leftSecondWeek.querySelectorAll(`.${BASE_CLASS_PREFIX}-datepicker-day`);
        const startIndex = 0;

        /**
         * select 2019-06-02 ~ 2019-06-05
         */
        demo.find('input').at(0).simulate('focus');
        leftSecondWeekDays[startIndex].click();
        demo.find('input').at(1).simulate('focus');
        leftSecondWeekDays[startIndex + dayOffset].click();

        const value = elem.state('value');
        const startDay = 2;
        expect(value[0].getMonth()).toBe(baseMon - leftPrevClickTimes);
        expect(value[0].getDate()).toBe(startDay);
        expect(value[1].getMonth()).toBe(baseMon - leftPrevClickTimes);
        expect(value[1].getDate()).toBe(startDay + dayOffset);
    });

    it(`test change panel in range picker`, async () => {
        const motion = false;
        const type = 'dateRange';
        const needConfirm = false;
        const dayOffset = 3;
        const currentValue = [new Date(baseDate), new Date(baseDate).setDate(baseDay + dayOffset)];

        const demo = mount(
            <DatePicker
                motion={motion}
                defaultOpen={open}
                defaultValue={currentValue}
                type={type}
                needConfirm={needConfirm}
            />
        );
        const elem = demo.find(BaseDatePicker);
        
        const leftPanel = document.querySelector(`.${BASE_CLASS_PREFIX}-datepicker-month-grid-left`);
        const leftSecondWeek = leftPanel.querySelectorAll(`.${BASE_CLASS_PREFIX}-datepicker-week`)[1];
        const leftSecondWeekDays = leftSecondWeek.querySelectorAll(`.${BASE_CLASS_PREFIX}-datepicker-day`);
        const startIndex = 0;
        
        demo.find('input').at(0).simulate('focus');
        leftSecondWeekDays[startIndex].click();
        await sleep();
        expect(elem.state('rangeInputFocus')).toBe('rangeEnd');
        expect(elem.instance().focusRecordsRef.current.rangeStart).toBe(true);
        leftSecondWeekDays[startIndex + dayOffset].click();
        await sleep();
        expect(elem.instance().focusRecordsRef.current.rangeStart).toBe(false);
        expect(elem.instance().focusRecordsRef.current.rangeEnd).toBe(false);
        expect(elem.state('rangeInputFocus')).toBe(false);
    });

    // github workflow 过不了，本地可以，先跳过
    it.skip(`test change panel in range picker with start greater than endTime`, async () => {
        const motion = false;
        const type = 'dateRange';
        const needConfirm = false;
        const dayOffset = 3;
        const currentValue = [new Date(baseDate), new Date(baseDate).setDate(baseDay + dayOffset)];

        const demo = mount(
            <DatePicker
                motion={motion}
                defaultOpen={open}
                defaultValue={currentValue}
                type={type}
                needConfirm={needConfirm}
            />
        );
        const elem = demo.find(BaseDatePicker);
        
        const leftPanel = document.querySelector(`.${BASE_CLASS_PREFIX}-datepicker-month-grid-left`);
        const leftThirdWeek = leftPanel.querySelectorAll(`.${BASE_CLASS_PREFIX}-datepicker-week`)[2];
        const leftThirdWeekDays = leftThirdWeek.querySelectorAll(`.${BASE_CLASS_PREFIX}-datepicker-day`);
        const startIndex = 0;
        
        demo.find('input').at(0).simulate('focus');
        leftThirdWeekDays[startIndex].click();
        await sleep(600);
        expect(elem.state('rangeInputFocus')).toBe('rangeEnd');
        const inputValue = elem.state('inputValue');
        expect(inputValue.split('~')[1].trim()).toBe('');
    });

    /**
     * this test suite won't end up with result
     */
    it.skip(`test year or month picker`, async () => {
        const open = true;
        const motion = false;
        const type = 'month';
        const monOffset = 2;
        const yearOffset = 3;
        const currentValue = new Date(baseDate);

        const elem = mount(<DatePicker motion={motion} defaultOpen={open} defaultValue={currentValue} type={type} />);

        await sleep();

        const lists = document.querySelectorAll(`.${BASE_CLASS_PREFIX}-scrolllist-item-wheel`);
        /**
         * select year
         */
        const currentSelectedYear = lists[0].querySelector(`ul .${BASE_CLASS_PREFIX}-scrolllist-item-selected`);
        _.times(yearOffset)
            .reduce(cur => cur.nextElementSibling, currentSelectedYear)
            .click();

        /**
         * select month
         */
        const currentSelectedMon = lists[1].querySelector(`ul .${BASE_CLASS_PREFIX}-scrolllist-item-selected`);
        _.times(monOffset)
            .reduce(cur => cur.nextElementSibling, currentSelectedMon)
            .click();

        await sleep();
        const value = elem.state('value');
        expect(value[0].getYear()).toBe(baseYear + yearOffset);
        expect(value[0].getMonth()).toBe(baseMon + monOffset);
    });

    it('test week select', async () => {
        const demo = mount(
            <DatePicker
                type="dateRange"
                defaultOpen={open}
                weekStartsOn={1}
                startDateOffset={date => startOfWeek(date, { weekStartsOn: 1 })}
                endDateOffset={date => endOfWeek(date, { weekStartsOn: 1 })}
            />
        );
        const elem = demo.find(BaseDatePicker);

        const leftPanel = document.querySelector(`.${BASE_CLASS_PREFIX}-datepicker-month-grid-left`);
        const leftSecondWeek = leftPanel.querySelectorAll(`.${BASE_CLASS_PREFIX}-datepicker-week`)[1];
        const leftSecondWeekDays = leftSecondWeek.querySelectorAll(`.${BASE_CLASS_PREFIX}-datepicker-day`);
        const startIndex = 3;

        /**
         * 点击当前月第二个星期的第四天
         */
        leftSecondWeekDays[startIndex].click();

        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const monthFirstDay = add(new Date(year, 0, 1, 0, 0, 0), { months: month });
        const clickDay = addDays(startOfWeek(addWeeks(monthFirstDay, 1), { weekStartsOn: 1 }), 3);
        const value = elem.state('value');
        const dateFormat = 'yyyy-MM-dd';

        expect(format(value[0], dateFormat)).toBe(format(startOfWeek(clickDay, { weekStartsOn: 1 }), dateFormat));
        expect(format(value[1], dateFormat)).toBe(format(endOfWeek(clickDay, { weekStartsOn: 1 }), dateFormat));
    });
    
    it('test autoFocus', async () => {
        const motion = false;
        const elem = mount(<DatePicker motion={motion} autoFocus={true} />);
        const elem2 = mount(<DatePicker motion={motion} autoFocus={false} />);

        expect(elem.find(`.${BASE_CLASS_PREFIX}-datepicker .${BASE_CLASS_PREFIX}-input-wrapper-focus`).length).toBe(1);
        expect(elem2.find(`.${BASE_CLASS_PREFIX}-datepicker .${BASE_CLASS_PREFIX}-input-wrapper-focus`).length).toBe(0);
    });

    it('custom dropdownClassName & dropdownStyle', async () => {
        let props = {
            dropdownClassName: 'my-datePicker',
            dropdownStyle: {
                color: 'red',
            },
            defaultOpen: true,
            motion: false,
        };
        const elem = mount(<DatePicker {...props} />);
        expect(elem.exists('.my-datePicker')).toEqual(true);
        expect(elem.find('.my-datePicker')).toHaveStyle('color', 'red');
    });

    it('onClear', async () => {
        const onClear = sinon.spy();
        let props = {
            defaultOpen: true,
            motion: false,
            autoFocus: true,
            defaultValue: baseDate,
            showClear: true,
            onClear: onClear,
        };
        const elem = mount(<DatePicker {...props} />);
        const clearBtn = elem.find('.semi-input-clearbtn');
        clearBtn.simulate('mouseDown', { target: { value: 'test' } });
        expect(onClear.called).toBeTruthy();
    });

    it('input disabled date should not trigger onChange', async () => {
        const onChange = sinon.spy();
        const defaultValue = '2021-04-12';
        const disabeldDate = '2021-04-15';
        const notDisabledDate = '2021-04-13';
        let props = {
            defaultOpen: true,
            motion: false,
            value: defaultValue,
            onChange,
            disabledDate: dateStr => {
                const date = new Date(dateStr);
                const day = date.getDate();
                if (day === 15) {
                    return true;
                }
                return false;
            }
        };
        const elem = mount(<DatePicker {...props} />);
        elem.find(`.${BASE_CLASS_PREFIX}-input-wrapper input`).simulate('change', { target: { value: disabeldDate } });
        await sleep();
        expect(onChange.called).toBeFalsy();
        elem.find(`.${BASE_CLASS_PREFIX}-input-wrapper input`).simulate('change', { target: { value: notDisabledDate } });
        await sleep();
        expect(onChange.called).toBeTruthy();
    });

    it('click presets disabled date should not trigger onChange', async () => {
        const onChange = sinon.spy();
        const defaultValue = '2021-04-12';
        const disabledValue = '2021-04-15';
        const notDisabledValue = '2021-04-30';
        const defaultDate = new Date(`${defaultValue} 00:00:00`);
        const disableDate = new Date(`${disabledValue} 00:00:00`);
        const notDisabledDate = new Date(`${notDisabledValue} 00:00:00`);
        let props = {
            open: true,
            motion: false,
            defaultValue,
            onChange,
            disabledDate: date => {
                const day = date.getDate();
                if (day === 15) {
                    return true;
                }
                return false;
            },
            presets: [
                {
                    text: 'disabled date',
                    start: disableDate,
                },
                {
                    text: 'valid date',
                    start: notDisabledValue,
                },
            ],
        };
        const demo = mount(<DatePicker {...props} />);
        const elem = demo.find(BaseDatePicker);
        const btns = document.querySelectorAll(`.${BASE_CLASS_PREFIX}-datepicker-quick-control button`);

        // click disabled date
        btns[0].click();
        let value = elem.state('value');
        expect(value[0].getDate()).toEqual(defaultDate.getDate());
        expect(onChange.called).toBeFalsy();

        // click valid date
        btns[1].click();
        await sleep();
        value = elem.state('value');
        expect(value[0].getDate()).toEqual(notDisabledDate.getDate());
        expect(onChange.called).toBeTruthy();
    });

    it('check inputValue is correct when change timeZone', async () => {
        const today = set(new Date(), { hours: 22, minutes: 0, seconds: 0 });
        const [originZone, originOffset] = getRandomIANATimeZone();
        const [newZone, newOffset] = getRandomIANATimeZone();

        const elem = mount(
            <ConfigProvider timeZone={originZone}>
                <DatePicker type="dateTime" defaultOpen={true} motion={false} defaultPickerValue={today} />
            </ConfigProvider>
        );

        const demo = elem.find(BaseDatePicker);

        // 选中一个日期
        const days = document.querySelectorAll('.semi-datepicker-day');
        // 6 无实际意义，第一行的第7个肯定是有效日期，如第一行最后一天是月首
        days[6].click();
        await sleep();
        // 查看value值
        expect(elem.find('.semi-datepicker-day-selected')).toBeTruthy();
        const selectedDay = demo.state('value')[0];
        const input = document.querySelector('.semi-input');
        expect(input.value).toEqual(format(selectedDay, strings.FORMAT_DATE_TIME));
        // 切换时区
        elem.setProps({ timeZone: newZone });
        const newZoneDate = add(selectedDay, { hours: newOffset - originOffset })
        const formatNewZoneDate = format(newZoneDate, strings.FORMAT_DATE_TIME);
        expect(input.value).toEqual(formatNewZoneDate);
    });

    it('check inputValue in controlled mode when change timeZone', async () => {
        const now = new Date();
        const [originZone, originOffset] = getRandomIANATimeZone();
        const [newZone, newOffset] = getRandomIANATimeZone();
        
        // 给定一个时区下的date value
        const originZoneDate = zonedTimeToUtc(now, originZone);
        const elem = mount(
            <ConfigProvider timeZone={originZone}>
                <DatePicker type="dateTime" defaultOpen={true} motion={false} value={originZoneDate} />
            </ConfigProvider>
        );

        const input = document.querySelector('.semi-input');
        const originFormatDate = format(now, strings.FORMAT_DATE_TIME);
        expect(input.value).toEqual(originFormatDate);
        // 切换时区
        elem.setProps({ timeZone: newZone });
        const newZoneDate = add(now, { hours: newOffset - originOffset })
        const formatNewZoneDate = format(newZoneDate, strings.FORMAT_DATE_TIME);
        expect(input.value).toEqual(formatNewZoneDate);
    });

    it(`test locale format default`, () => {
        const localeFormatten = 'yyyy-MM-dd EEEE';
        const defaultValue = new Date('2021-04-30');
        const localeValue = format(defaultValue, localeFormatten, { locale: zhCN })

        // 默认为中文
        const elem = mount(<DatePicker format={localeFormatten} defaultValue={defaultValue} />);
        expect(elem.find(`.${BASE_CLASS_PREFIX}-datepicker .${BASE_CLASS_PREFIX}-input`).instance().value).toBe(localeValue);
    });

    it(`test locale format enUS`, () => {
        const localeFormatten = 'yyyy-MM-dd EEEE';
        const defaultValue = new Date('2021-04-30');
        const localeValue = format(defaultValue, localeFormatten, { locale: enUS })

        // 英文
        const elem = mount(
            <LocaleProvider locale={en_US}>
                <DatePicker format={localeFormatten} defaultValue={defaultValue} />
            </LocaleProvider>
        );
        expect(elem.find(`.${BASE_CLASS_PREFIX}-datepicker .${BASE_CLASS_PREFIX}-input`).instance().value).toBe(localeValue);
    });

    it(`test onPresetClick`, async () => {
        const dayOffset = 1;
        const presets = [
            {
                text: 'Today',
                start: new Date(baseDate),
                end: new Date(baseDate),
            },
            {
                text: 'Next Day',
                start: addDays(new Date(baseDate), dayOffset),
                end: addDays(new Date(baseDate), dayOffset),
            },
        ];
        const defaultValue = new Date(addDays(new Date(baseDate), -dayOffset));
        const open = true;
        const motion = false;
        const handlePresetClick = sinon.spy();

        const demo = mount(<DatePicker onPresetClick={handlePresetClick} presets={presets} motion={motion} open={open} defaultValue={defaultValue} />);
        const elem = demo.find(BaseDatePicker);

        const btns = document.querySelectorAll(`.${BASE_CLASS_PREFIX}-datepicker-quick-control button`);

        btns[0].click();
        btns[1].click();
        expect(handlePresetClick.calledTwice).toBeTruthy();
        const args0 = handlePresetClick.getCall(0).args;
        const args1 = handlePresetClick.getCall(1).args;
        expect(args0[0]).toEqual(presets[0]);
        expect(args0[1] instanceof Event).toBeTruthy;
        expect(args1[0]).toEqual(presets[1]);
        expect(args1[1] instanceof Event).toBeTruthy;
    });

    it(`test range type click one not trigger notifyChange`, async () => {
        const onChange = sinon.spy(async (date, str) => {
            elem.setProps({ value: date });
        });
        let props = {
            defaultOpen: true,
            motion: false,
            value: undefined,
            onChange,
            defaultPickerValue: '2021-08-13',
            type: 'dateRange'
        };
        const elem = mount(<DatePicker {...props} />);
        const leftPanel = document.querySelector(`.${BASE_CLASS_PREFIX}-datepicker-month-grid-left`);
        const leftSecondWeek = leftPanel.querySelectorAll(`.${BASE_CLASS_PREFIX}-datepicker-week`)[1];
        const leftSecondWeekDays = leftSecondWeek.querySelectorAll(`.${BASE_CLASS_PREFIX}-datepicker-day`);
        const startIndex = 0;
        const endIndex = 2;
        
        elem.find('input').at(0).simulate('focus');
        leftSecondWeekDays[startIndex].click();
        expect(onChange.calledOnce).toBe(false);
        elem.find('input').at(1).simulate('focus');
        leftSecondWeekDays[endIndex].click();
        expect(onChange.calledOnce).toBe(true);
        const [rangeStart, rangeEnd] = onChange.getCall(0).args[0];
        const dateFormat = 'yyyy-MM-dd';
        expect(format(rangeStart, dateFormat)).toBe('2021-08-08');
        expect(format(rangeEnd, dateFormat)).toBe('2021-08-10');
        const inputs = elem.find(`.${BASE_CLASS_PREFIX}-datepicker .${BASE_CLASS_PREFIX}-input`);
        expect(inputs.at(0).instance().value).toBe('2021-08-08');
        expect(inputs.at(1).instance().value).toBe('2021-08-10');
    });

    /**
     * test disabled rangeStart and select a not disabled range end
     * e.g. 
     *  You can select a no disabled date(like one day of september) when defaultValue=['2021-08-06', '2021-08-15'] and disabled august.
     */
    it('test rangeStart disabled and select rangeEnd', async () => {
        const onChange = sinon.spy();
        const defaultValue = ['2021-08-06', '2021-08-15'];
        let props = {
          type: 'dateRange',
          defaultOpen: true,
          motion: false,
          defaultValue,
          onChange,
          // disabled august
          disabledDate: dateStr => {
              const date = new Date(dateStr);
              const month = date.getMonth();
              if (month === 7) {
                  return true;
              }
              return false;
          },
          style: { width: 300 }
        };
        const elem = mount(<DatePicker {...props} />);
        const baseElem = elem.find(BaseDatePicker);
        const rightPanel = document.querySelector(`.${BASE_CLASS_PREFIX}-datepicker-month-grid-right`);
        const rightSecondWeek = rightPanel.querySelectorAll(`.${BASE_CLASS_PREFIX}-datepicker-week`)[1];
        const rightSecondWeekDays = rightSecondWeek.querySelectorAll(`.${BASE_CLASS_PREFIX}-datepicker-day`);

        /**
         * select 2021-09-10 as rangeEnd
         */
        elem.find('input').at(1).simulate('focus');
        const endIndex = 5; // 2021-09-10
        rightSecondWeekDays[endIndex].click();
        const value = baseElem.state('value');

        // test rangeEnd is selected
        expect(value[0].getMonth()).toBe(7);
        expect(value[0].getDate()).toBe(6);
        expect(value[1].getMonth()).toBe(8);
        expect(value[1].getDate()).toBe(10);
        // test input value is same with state value
        expect(elem.find('input').at(0).instance().value).toBe(defaultValue[0]);
        expect(elem.find('input').at(1).instance().value).toBe('2021-09-10');
        // test event is called
        expect(onChange.calledOnce).toBe(true);
    });

    /**
     * test disabled some day and select a no disabled day in multiple mode
     */
    it('test disabled multiple select', async () => {
        const onChange = sinon.spy();
        const defaultValue = ['2021-08-06', '2021-08-15'];
        let props = {
            type: 'date',
            multiple: true,
            defaultOpen: true,
            motion: false,
            defaultValue,
            onChange,
            // disabled august
            disabledDate: dateStr => {
                const date = new Date(dateStr);
                const day = date.getDate();
                if (day > 20 && day < 25) {
                    return true;
                }
                return false;
            },
            style: { width: 300 }
        };
        const elem = mount(<DatePicker {...props} />);
        const baseElem = elem.find(BaseDatePicker);
        const leftPanel = document.querySelector(`.${BASE_CLASS_PREFIX}-datepicker-month-grid-left`);
        const leftSecondWeek = leftPanel.querySelectorAll(`.${BASE_CLASS_PREFIX}-datepicker-week`)[1];
        const leftSecondWeekDays = leftSecondWeek.querySelectorAll(`.${BASE_CLASS_PREFIX}-datepicker-day`);

        /**
         * select 2021-08-10(not disabled)
         */
        leftSecondWeekDays[2].click();
        let value = baseElem.state('value');

        // test 2021-08-10 is selected
        expect(value.length).toBe(3);
        expect(value[2].getMonth()).toBe(7);
        expect(value[2].getDate()).toBe(10);
        // test input value is same with state value
        expect(elem.find('input').at(0).instance().value).toBe('2021-08-06,2021-08-15,2021-08-10');
        // test event is called
        expect(onChange.calledOnce).toBe(true);

        /**
         * select 2021-08-21(disabled)
         */
        const leftThirdWeek = leftPanel.querySelectorAll(`.${BASE_CLASS_PREFIX}-datepicker-week`)[2];
        const leftThirdWeekDays = leftThirdWeek.querySelectorAll(`.${BASE_CLASS_PREFIX}-datepicker-day`);
        leftThirdWeekDays[6].click();
        await sleep();
        value = baseElem.state('value');

        // test 2021-08-21 is not selected
        expect(value.length).toBe(3);
        expect(elem.find('input').at(0).instance().value).toBe('2021-08-06,2021-08-15,2021-08-10');
        expect(onChange.calledOnce).toBe(true); // still calledOnce
    });

    
    it('test disabled time callback', async () => {
        const disabledTime = sinon.spy((date, panelType) => {
            if (panelType === 'left') {
                return { disabledHours: () => [17, 18] };
            } else {
                return { disabledHours: () => [12, 13, 14, 15, 16, 17, 18] };
            }
        });
        let props = {
            type: 'dateTimeRange',
            defaultValue: ['2021-09-08', '2021-10-03'],
            defaultOpen: true,
            motion: false,
            disabledTime,
            style: { width: 400 },
            timePickerOpts: {
                scrollItemProps: { cycled: false }
            }
        };
        const elem = mount(<DatePicker {...props} />);
        elem.find('.semi-datepicker-month-grid-left .semi-datepicker-switch-time').simulate('click');
        const args = disabledTime.lastCall.args;
        expect(args[0].length).toBe(2);
        expect(args[1]).toBe('left');

        elem.setProps({ type: 'dateTime' });
        elem.update();
        elem.find('.semi-datepicker-month-grid-left .semi-datepicker-switch-time').simulate('click');
        const args2 = disabledTime.lastCall.args;
        expect(Array.isArray(args2[0])).toBe(false);
        expect(args2[1]).toBe('left');
    });

    it('test rangeSeparator', async () => {
        const rangeSeparator = '-'
        const defaultValue = ['2021-08-06', '2021-08-15'];
        let props = {
          type: 'dateRange',
          motion: false,
          defaultValue,
          style: { width: 300 },
          rangeSeparator,
        };
        const elem = mount(
            <div>
                <DatePicker {...props} />
                <DatePicker {...props} type="dateTimeRange" />
            </div>
        );
        const allSeparators = document.querySelectorAll('.semi-datepicker-range-input-separator');
        expect(allSeparators[0].textContent.trim()).toBe(rangeSeparator);
        expect(allSeparators[1].textContent.trim()).toBe(rangeSeparator);
    });

    /**
     * fix https://github.com/DouyinFE/semi-design/issues/422
     */
    it('test input year length larger than 4', async () => {
        const props = {
            motion: false,
            defaultOpen: true,
            defaultValue: '2021-12-21',
        };
        const handleChange = sinon.spy();
        const elem = mount(
            <DatePicker {...props} onChange={handleChange} />
        );

        elem.find('input').simulate('change', { target: { value: '20221-12-21' }});
        expect(handleChange.called).toBeFalsy();
    });

    it('test click next/prev year buttons', () => {
        let props = {
          type: 'dateRange',
          motion: false,
          style: { width: 300 },
          defaultPickerValue: new Date('2021-12-01'),
          defaultOpen: true,
        };
        const elem = mount(<DatePicker {...props} />);

        const leftPanel = document.querySelector(`.semi-datepicker-month-grid-left`);
        const leftNavBtns = leftPanel.querySelector(`.semi-datepicker-navigation`).children;
        const rightPanel = document.querySelector(`.semi-datepicker-month-grid-right`);
        const rightNavBtns = rightPanel.querySelector(`.semi-datepicker-navigation`).children;

        // 点击左边面板上一年
        _.get(leftNavBtns, 0).click();
        expect(document.querySelector(`.semi-datepicker-month-grid-left .semi-datepicker-navigation-month`).textContent).toBe('2020年 12月');
        // 点击左边面板下一年
        _.get(leftNavBtns, 4).click();
        expect(document.querySelector(`.semi-datepicker-month-grid-left .semi-datepicker-navigation-month`).textContent).toBe('2021年 12月');

        // 点击右边面板下一年
        _.get(rightNavBtns, 4).click();
        expect(document.querySelector(`.semi-datepicker-month-grid-right .semi-datepicker-navigation-month`).textContent).toBe('2023年 1月');
        // 点击右边面板上一年
        _.get(rightNavBtns, 0).click();
        expect(document.querySelector(`.semi-datepicker-month-grid-right .semi-datepicker-navigation-month`).textContent).toBe('2022年 1月');
    });

    const testMonthSyncChange = type => {
        let props = {
            type,
            motion: false,
            style: { width: 300 },
            defaultPickerValue: new Date('2021-12-01'),
            defaultOpen: true,
          };
          const elem = mount(<DatePicker {...props} />);
  
          const leftPanel = document.querySelector(`.semi-datepicker-month-grid-left`);
          const leftNavBtns = leftPanel.querySelector(`.semi-datepicker-navigation`).children;
          const rightPanel = document.querySelector(`.semi-datepicker-month-grid-right`);
          const rightNavBtns = rightPanel.querySelector(`.semi-datepicker-navigation`).children;
  
          // 点击左边面板下一月，自动切换右面板
          _.get(leftNavBtns, 3).click();
          expect(document.querySelector(`.semi-datepicker-month-grid-left .semi-datepicker-navigation-month`).textContent).toBe('2022年 1月');
          expect(document.querySelector(`.semi-datepicker-month-grid-right .semi-datepicker-navigation-month`).textContent).toBe('2022年 2月');
          // 点击右边面板上一月，自动切换左面板
          _.get(rightNavBtns, 1).click();
          expect(document.querySelector(`.semi-datepicker-month-grid-left .semi-datepicker-navigation-month`).textContent).toBe('2021年 12月');
          expect(document.querySelector(`.semi-datepicker-month-grid-right .semi-datepicker-navigation-month`).textContent).toBe('2022年 1月');
  
          // 点击左边面板上一月，不需要自动切换右面板
          _.get(leftNavBtns, 1).click();
          expect(document.querySelector(`.semi-datepicker-month-grid-left .semi-datepicker-navigation-month`).textContent).toBe('2021年 11月');
          elem.unmount();
    }

    it('test month sync change dateRange type', () => { testMonthSyncChange('dateRange') });
    it('test month sync change dateTimeRange type', () => { testMonthSyncChange('dateTimeRange')});

    it(`test preset given null`, async () => {
        const props = {
            presets: [
                {
                    text: 'Today',
                    start: null,
                    end: null,
                }
            ],
            defaultValue: baseDate,
            defaultOpen: true,
            motion: false,
            type: 'dateRange'
        }
        const handleChange = sinon.spy();
        const demo = mount(<DatePicker {...props} onChange={handleChange} />);
        const elem = demo.find(BaseDatePicker);

        const btns = document.querySelectorAll('.semi-datepicker-quick-control button');

        btns[0].click();
        expect(handleChange.called).toBeTruthy();
        const args = handleChange.getCall(0).args;
        expect(args[0].length).toEqual(0);
        expect(elem.state('panelShow')).toBeFalsy();
    });

    it(`test preset given null + needConfirm`, async () => {
        const props = {
            presets: [
                {
                    text: 'Today',
                    start: null,
                    end: null,
                }
            ],
            defaultValue: baseDate,
            defaultOpen: true,
            motion: false,
            type: 'dateTimeRange',
            needConfirm: true,
        }
        const handleChange = sinon.spy();
        const handleConfirm = sinon.spy();
        const demo = mount(<DatePicker {...props} onChange={handleChange} onConfirm={handleConfirm} />);
        const elem = demo.find(BaseDatePicker);

        const btns = document.querySelectorAll('.semi-datepicker-quick-control button');

        // 点击 preset
        btns[0].click();
        expect(handleChange.called).toBe(true);
        const argsChange = handleChange.getCall(0).args;
        expect(argsChange[0].length).toBe(0);
        expect(elem.state('panelShow')).toBe(true);
        // 点击确定
        const footerBtns = document.querySelectorAll('.semi-datepicker-footer .semi-button');
        footerBtns[1].click();
        expect(handleConfirm.called).toBe(true);
        const argsConfirm = handleConfirm.getCall(0).args;
        expect(argsConfirm[0].length).toBe(0);
        expect(elem.state('panelShow')).toBe(false);
    });
    
    it('test dateRange triggerRender', async () => {
        const elem = mount(
            <DatePicker
                motion={false}
                // defaultOpen
                type="dateRange"
                triggerRender={({ placeholder }) => (
                    <button>
                        {placeholder}
                    </button>
                )}
            />
        );
        const trigger = document.querySelector('button');
        trigger.click();
        await sleep();
        const leftPanel = document.querySelector(`.${BASE_CLASS_PREFIX}-datepicker-month-grid-left`);
        const leftSecondWeek = leftPanel.querySelectorAll(`.${BASE_CLASS_PREFIX}-datepicker-week`)[1];
        const leftSecondWeekDays = leftSecondWeek.querySelectorAll(`.${BASE_CLASS_PREFIX}-datepicker-day`);
        const rightPanel = document.querySelector(`.${BASE_CLASS_PREFIX}-datepicker-month-grid-right`);
        const rightSecondWeek = rightPanel.querySelectorAll(`.${BASE_CLASS_PREFIX}-datepicker-week`)[1];
        const rightSecondWeekDays = rightSecondWeek.querySelectorAll(`.${BASE_CLASS_PREFIX}-datepicker-day`);
        leftSecondWeekDays[0].click();
        await sleep();
        rightSecondWeekDays[0].click();

        const baseElem = elem.find(BaseDatePicker);
        expect(baseElem.state('panelShow')).toBeFalsy();
    });
});
