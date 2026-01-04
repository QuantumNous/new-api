import * as React from 'react';
import Button from '../../button';
import TimePicker from '../TimePicker';
import Locale from '../../locale/source/zh_CN';
import { clear } from 'jest-date-mock';
import * as _ from 'lodash';
import { IconClose } from '@douyinfe/semi-icons';
import { genAfterEach, genBeforeEach, mount, sleep, trigger } from '../../_test_/utils';
import { isTimeFormatLike } from '@douyinfe/semi-foundation/timePicker/utils';
import { BASE_CLASS_PREFIX } from '../../../semi-foundation/base/constants';

describe(`TimePicker`, () => {
    beforeEach(() => {
        clear();
        genBeforeEach()();
    });

    afterEach(genAfterEach());

    it(`test time picker appearance`, async () => {
        const defaultHour = 10;
        const defaultMinute = 24;
        const defaultSeconds = 18;

        const onFocus = sinon.spy();
        const onChange = sinon.spy();

        const elem = mount(
            <TimePicker
                onChange={onChange}
                onFocus={onFocus}
                panelHeader={<strong>Select Time</strong>}
                locale={Locale.TimePicker}
                localeCode={Locale.code}
                defaultOpen={true}
                scrollItemProps={{ mode: 'wheel', cycled: false }}
                format={'HH:mm:ss'}
                defaultValue={`${defaultHour}:${defaultMinute}:${defaultSeconds}`}
                panelFooter={<strong>Select Time</strong>}
            />
        );

        expect(document.querySelectorAll(`.${BASE_CLASS_PREFIX}-scrolllist`).length).toBe(1);
        expect(document.querySelectorAll(`.${BASE_CLASS_PREFIX}-timepicker`).length).toBe(1);
        expect(document.querySelectorAll(`.${BASE_CLASS_PREFIX}-scrolllist-header`).length).toBe(1);
        expect(document.querySelectorAll(`.${BASE_CLASS_PREFIX}-scrolllist-footer`).length).toBe(1);

        // click minute
        const minuteUl = elem.find(`.${BASE_CLASS_PREFIX}-timepicker-panel-list-minute .${BASE_CLASS_PREFIX}-scrolllist-list-outer ul`);
        const minuteLis = minuteUl.find(`li`);

        minuteUl.simulate('click', { target: minuteLis.at(0).getDOMNode(), nativeEvent: null });
        await sleep(200);

        const newMinute = 0;

        let currentDate = elem.state('value')[newMinute];
        expect(currentDate.getHours()).toBe(defaultHour);
        expect(currentDate.getMinutes()).toBe(newMinute);

        // focus
        elem.find(`input`).simulate('focus');
        await sleep(200);
        expect(onFocus.calledOnce).toBeTruthy();

        // input value
        const newInputHour = 10;
        const newInputMinute = 18;
        const newInputSeconds = 18;
        elem.find(`input`).simulate('change', {
            target: { value: `${newInputHour}:${newInputMinute}:${newInputSeconds}` },
        });
        await sleep(200);
        currentDate = elem.state('value')[0];
        expect(currentDate.getMinutes()).toBe(newInputMinute);

        // click inside
        document.querySelector(`.${BASE_CLASS_PREFIX}-scrolllist`).click();
        expect(elem.state('open')).toBe(true);

        // click outside
        // document.body.click();
        trigger(document, 'mousedown');

        await sleep(200);
        expect(elem.state('open')).toBe(false);

        expect(onChange.called).toBeTruthy();
        const args = onChange.getCall(0).args;
        expect(args[0] instanceof Date).toBe(true);
        expect(typeof args[1]).toBe('string');
        elem.unmount();
    });

    it(`test controlled value`, async () => {
        const defaultHour = 10;
        const defaultMinute = 24;
        const defaultSeconds = 18;

        const elem0 = mount(
            <TimePicker
                panelHeader={<strong>Select Time</strong>}
                locale={Locale.TimePicker}
                localeCode={Locale.code}
                defaultOpen={true}
                scrollItemProps={{ cycled: false }}
                format={'HH:mm:ss'}
                value={`${defaultHour}:${defaultMinute}:${defaultSeconds}`}
                panelFooter={<strong>Select Time</strong>}
            />
        );

        const newInputHour = 10;
        const newInputMinute = 18;
        const newInputSeconds = 18;
        elem0.find(`input`).simulate('change', {
            target: { value: `${newInputHour}:${newInputMinute}:${newInputSeconds}` },
        });

        await sleep(200);
        let currentDate0 = elem0.state('value')[0];

        expect(currentDate0.getMinutes()).toBe(defaultMinute);
        elem0.unmount();
    });

    it(`test controlled value with onchange`, async () => {
        const defaultHour = 10;
        const defaultMinute = 24;
        const defaultSeconds = 18;

        const onChange = sinon.spy((date, str) => {
            elem1.setProps({ value: date });
        });

        const elem1 = mount(
            <TimePicker
                onChange={onChange}
                panelHeader={<strong>Select Time</strong>}
                locale={Locale.TimePicker}
                localeCode={Locale.code}
                defaultOpen={true}
                scrollItemProps={{ cycled: false }}
                format={'HH:mm:ss'}
                value={`${defaultHour}:${defaultMinute}:${defaultSeconds}`}
                panelFooter={<strong>Select Time</strong>}
            />
        );

        const newInputHour = 10;
        const newInputMinute = 18;
        const newInputSeconds = 18;

        elem1.find(`input`).simulate('change', {
            target: { value: `${newInputHour}:${newInputMinute}:${newInputSeconds}` },
        });
        await sleep(200);

        let currentDate1 = elem1.state('value')[0];
        expect(currentDate1.getMinutes()).toBe(newInputMinute);
        elem1.unmount();
    });

    it(`test controlled open`, async () => {
        const defaultHour = 10;
        const defaultMinute = 24;
        const defaultSeconds = 18;
        const defaultOpen = true;

        const onChange = sinon.spy((date, str) => {
            elem1.setProps({ value: date });
        });
        const onOpenChange = sinon.spy(open => elem.setProps({ open }));

        const elem = mount(
            <TimePicker
                motion={false}
                onOpenChange={onOpenChange}
                open={defaultOpen}
                onChange={onChange}
                panelHeader={<strong>Select Time</strong>}
                locale={Locale.TimePicker}
                localeCode={Locale.code}
                scrollItemProps={{ cycled: false }}
                format={'HH:mm:ss'}
                value={`${defaultHour}:${defaultMinute}:${defaultSeconds}`}
                panelFooter={<Button icon={<IconClose />} onClick={() => elem.setProps({ open: false })} />}
            />
        );

        expect(elem.state('open')).toBe(true);

        // click close button
        document.querySelector(`.${BASE_CLASS_PREFIX}-scrolllist-footer .${BASE_CLASS_PREFIX}-button`).click();
        elem.setProps({ open: false });
        await sleep(200);
        expect(elem.state('open')).toBe(false);
        expect(onOpenChange.calledOnce).toBeFalsy();

        elem.setProps({ open: true });
        document.body.click();
        await sleep(200);
        expect(elem.state('open')).toBe(true);
    });

    it(`test range picker appearance`, async () => {
        const defaultValue = ['上午 10:12', '上午 11:08'];
        const formatToken = `a hh:mm`;
        const use12Hours = true;

        const elem = mount(
            <TimePicker
                use12Hours={use12Hours}
                focusOnOpen
                format={formatToken}
                type={'timeRange'}
                locale={Locale.TimePicker}
                localeCode={Locale.code}
                defaultValue={defaultValue}
                scrollItemProps={{ cycled: false, mode: 'normal' }}
                defaultOpen
                panelHeader={['start header', 'end header']}
                panelFooter={['start footer', 'end footer']}
            />
        );

        await sleep(200);

        const all = elem.find(`.${BASE_CLASS_PREFIX}-scrolllist`);
        expect(all.length).toBe(2);
        
        // pannel
        const startItem = all.at(0);
        const endItem = all.at(1);
        // start header
        expect(
            startItem
                .find(`.${BASE_CLASS_PREFIX}-scrolllist-header`)
                .getDOMNode()
                .textContent
        ).toEqual('start header');
        // start footer
        expect(
            startItem
                .find(`.${BASE_CLASS_PREFIX}-scrolllist-footer`)
                .getDOMNode()
                .textContent
        ).toEqual('start footer');
        // end header
        expect(
            endItem
                .find(`.${BASE_CLASS_PREFIX}-scrolllist-header`)
                .getDOMNode()
                .textContent
        ).toEqual('end header');
        // end footer
        expect(
            endItem
                .find(`.${BASE_CLASS_PREFIX}-scrolllist-footer`)
                .getDOMNode()
                .textContent
        ).toEqual('end footer');

        // click hour list to change hour to 11
        const newHour = 9;
        const hourUl = all.at(0).find(`.${BASE_CLASS_PREFIX}-timepicker-panel-list-hour ul`);
        const hourLis = hourUl.children(`li`);
        expect(hourLis.length).toBe(use12Hours ? 12 : 24);
        const nextSelectedLi = hourLis.at(newHour);
        expect(nextSelectedLi).not.toBeUndefined();
        nextSelectedLi.simulate('click');
        await sleep(200);
        expect(elem.state('value')[0].getHours()).toBe(newHour);
        elem.unmount();
    });

    it('test isTimeFormatLike function', () => {
        const testCases = [
            ['10:24:00', 'HH:mm:ss', true],
            ['10:24:0', 'HH:mm:ss', false],
            ['10:2:00', 'HH:mm:ss', false],
            ['1:24:00', 'HH:mm:ss', false],
            ['10:24', 'HH:mm', true],
            ['10:2', 'HH:mm', false],
            ['1:24', 'HH:mm', false],
            ['24:30', 'mm:ss', true],
            ['24:3', 'mm:ss', false],
            ['2:30', 'mm:ss', false],
            ['10', 'HH', true],
            ['1', 'HH', false],
            ['10', 'mm', true],
            ['1', 'mm', false],
            ['10', 'ss', true],
            ['1', 'ss', false],
            ['2021 10:24:00', 'yyyy HH:mm:ss', true],
            ['2021 10:24:0', 'yyyy HH:mm:ss', false],
            ['2021 10:2:0', 'yyyy HH:mm:ss', false],
            ['2021 1:24:0', 'yyyy HH:mm:ss', false],
            ['上午 12:00:02', 'a h:mm:ss', true],
            ['上午 12:00:0', 'a h:mm:ss', false],
            ['上午 12:0:00', 'a h:mm:ss', false],
        ];

        testCases.forEach(test => {
            const [time, format, result] = test;
            expect(isTimeFormatLike(time, format)).toBe(result);
        })
    });

    it('click clear', async () => {
        const onChange = sinon.spy();
        let props = {
            defaultValue: "10:23:15",
            showClear: true,
            onChange,
            autofocus: true,
            locale: Locale.TimePicker,
            localeCode: Locale.code
        };
        const elem = mount(<TimePicker {...props} />);
        const clearBtn = elem.find('.semi-input-clearbtn');
        clearBtn.simulate('mouseDown');
        expect(onChange.called).toBeTruthy();
        const args = onChange.getCall(0).args;
        expect(args[0]).toBe(undefined);
        expect(args[1]).toBe('');
        elem.unmount();
    });

    it('test onChangeWithDateFirst=false', async () => {
        const onChange = sinon.spy();
        let props = {
            defaultValue: "10:23:15",
            onChange,
            defaultOpen: true,
            onChangeWithDateFirst: false,
            autofocus: true,
            locale: Locale.TimePicker,
            localeCode: Locale.code,
            scrollItemProps: { mode: 'wheel', cycled: false }
        };
        const elem = mount(<TimePicker {...props} />);
        // click minute
        const minuteUl = elem.find(`.${BASE_CLASS_PREFIX}-timepicker-panel-list-minute .${BASE_CLASS_PREFIX}-scrolllist-list-outer ul`);
        const minuteLis = minuteUl.find(`li`);

        minuteUl.simulate('click', { target: minuteLis.at(0).getDOMNode(), nativeEvent: null });
        await sleep(200);

        expect(onChange.called).toBeTruthy();
        const args = onChange.getCall(0).args;
        expect(typeof args[0]).toBe('string');
        expect(args[1] instanceof Date).toBe(true);
        elem.unmount();
    });
});
