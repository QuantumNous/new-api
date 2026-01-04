import { clear } from 'jest-date-mock';
import { BASE_CLASS_PREFIX } from '../../../semi-foundation/base/constants';

import Popconfirm from '../index';
import { Button } from '../../index';

import { genAfterEach, genBeforeEach, mount, sleep } from '../../_test_/utils';

const wrapCls = `${BASE_CLASS_PREFIX}-popconfirm`;
const wrapSelector = `.${BASE_CLASS_PREFIX}-popover .${wrapCls}`;
const triggerCls = 'trigger';

describe(`Popconfirm`, () => {
    beforeEach(() => {
        clear();
        genBeforeEach()();
    });

    afterEach(genAfterEach());

    it(`test appearance`, async () => {
        const elem = mount(
            <Popconfirm
                position="bottomLeft"
                title="确定是否要保存此修改？"
                content="此修改将不可逆"
                trigger={'click'}
                defaultVisible={false}
            >
                <Button className={triggerCls}>Save</Button>
            </Popconfirm>
        );

        // check if popconfirm hid or not
        expect(document.querySelectorAll(wrapSelector).length === 0).toBeTruthy();

        const triggerElem = document.querySelector(`.${triggerCls}`);
        triggerElem.click();

        // check if popconfirm showed or not
        expect(document.querySelectorAll(wrapSelector).length > 0).toBeTruthy();
    });

    it(`test disabled appearance`, async () => {
        const elem = mount(
            <Popconfirm
                position="bottomLeft"
                title="确定是否要保存此修改？"
                content="此修改将不可逆"
                trigger={'click'}
                defaultVisible={true}
                disabled={true}
            >
                <Button className={triggerCls}>Save</Button>
            </Popconfirm>
        );

        // check if popconfirm hid or not
        expect(document.querySelectorAll(wrapSelector).length === 0).toBeTruthy();
    });

    it(`test controlled appearance`, async () => {
        const props = { visible: true };
        const toggleShow = sinon.spy(() => {
            props.visible = !props.visible;
            elem.setProps(props);
        });

        const elem = mount(
            <Popconfirm
                position="bottomLeft"
                title="确定是否要保存此修改？"
                content="此修改将不可逆"
                {...props}
                trigger={'custom'}
            >
                <Button className={triggerCls} onClick={toggleShow}>
                    Save
                </Button>
            </Popconfirm>
        );

        // check if popconfirm hid or not
        expect(document.querySelectorAll(wrapSelector).length > 0).toBeTruthy();

        // click button and hide popconfirm
        const triggerBtn = document.querySelector(`.${triggerCls}`);
        triggerBtn.click();

        await sleep(200);
        expect(toggleShow.called).toBeTruthy();
        expect(elem.prop('visible')).toBeFalsy();
    });

    it(`test buttons`, async () => {
        const onCancel = sinon.spy();
        const onConfirm = sinon.spy();
        const elem = mount(
            <Popconfirm
                position="bottomLeft"
                title="确定是否要保存此修改？"
                content="此修改将不可逆"
                trigger={'click'}
                onCancel={onCancel}
                onConfirm={onConfirm}
                defaultVisible={true}
            >
                <Button className={triggerCls}>Save</Button>
            </Popconfirm>
        );

        // check if popconfirm showed or not
        expect(document.querySelectorAll(wrapSelector).length > 0).toBeTruthy();

        // click cancel button and check if hid and trigger onCancel
        let buttons = document.querySelectorAll(`.${BASE_CLASS_PREFIX}-popconfirm-footer button`);
        const cancelButton = buttons[0];
        cancelButton.click();

        expect(onCancel.called).toBeTruthy();
        expect(elem.state('visible')).toBeFalsy();
        // must reFind since document has changed
        buttons = document.querySelectorAll(`.${BASE_CLASS_PREFIX}-popconfirm-footer button`);
        const confirmButton = buttons[1];
        expect(confirmButton).toBe(undefined)
    });

    it(`test buttons 2`, async () => {
        const onCancel = sinon.spy();
        const onConfirm = sinon.spy();
        const elem = mount(
            <Popconfirm
                position="bottomLeft"
                title="确定是否要保存此修改？"
                content="此修改将不可逆"
                trigger={'click'}
                onCancel={onCancel}
                onConfirm={onConfirm}
                defaultVisible={true}
            >
                <Button className={triggerCls}>Save</Button>
            </Popconfirm>
        );

        // check if popconfirm showed or not
        expect(document.querySelectorAll(wrapSelector).length > 0).toBeTruthy();

        // click cancel button and check if hid and trigger onCancel
        let buttons = document.querySelectorAll(`.${BASE_CLASS_PREFIX}-popconfirm-footer button`);
        const confirmButton = buttons[1];
        confirmButton.click();

        expect(onConfirm.called).toBeTruthy();
        expect(elem.state('visible')).toBeFalsy();
        // must reFind since document has changed
        buttons = document.querySelectorAll(`.${BASE_CLASS_PREFIX}-popconfirm-footer button`);
        const cancelButton = buttons[0];
        expect(cancelButton).toBe(undefined)
    });
});
