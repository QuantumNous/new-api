import { Form } from '../../index';
import { noop } from 'lodash';
import { BASE_CLASS_PREFIX } from '../../../semi-foundation/base/constants';

const Slot = Form.Slot;

function getSlot(slotProps, formProps = {}) {
    return mount(
        <Form {...formProps}>
            <Slot {...slotProps}></Slot>
        </Form>
    );
}

describe('Form-slot', () => {
    it('className & style', () => {
        let props = {
            className: 'slot-test',
            style: {
                color: 'red',
            },
        };
        const slot = getSlot(props).find(`.${BASE_CLASS_PREFIX}-form-slot`);
        expect(slot.exists('.slot-test')).toEqual(true);
        expect(slot.find(`.${BASE_CLASS_PREFIX}-form-slot`)).toHaveStyle('color', 'red');
    });

    it('label - objLabel, stringLabel, numberLabel, reactNodeLabel', () => {
        let objProps = {
            label: {
                required: true,
                text: 'semi',
            },
        };
        const objLabel = getSlot(objProps).find(`.semi-form-field-label-text`).text();
        expect(objLabel).toEqual('semi');

        let stringProps = { label: 'semi' };
        const stringLabel = getSlot(stringProps).find(`.semi-form-field-label-text`).text();
        expect(stringLabel).toEqual('semi');

        let numberProps = { label: 888 };
        const numberLabel = getSlot(numberProps).find(`.semi-form-field-label-text`).text();
        expect(numberLabel).toEqual('888');

        let reactNodeLabel = { label: <div>hahaha</div> };
        const modeLabel = getSlot(reactNodeLabel).find(`.semi-form-field-label-text div`).text();
        expect(modeLabel).toEqual('hahaha');
    });

    it('error - objError, stringError, numberError, reactNodeError', () => {
        let objProps = {
            error: {
                error: 'semi',
            },
        };
        const objError = getSlot(objProps).find(`.semi-form-field-error-message span`).text();
        expect(objError).toEqual('semi');

        let stringProps = { error: 'semi' };
        const stringError = getSlot(stringProps).find(`.semi-form-field-error-message span`).text();
        expect(stringError).toEqual('semi');

        let numerProps = { error: 888 };
        const numerError = getSlot(numerProps).find(`.semi-form-field-error-message`).text();
        expect(numerError).toEqual('');

        let reactNodeLabel = { error: <div>hahaha</div> };
        const modeLabel = getSlot(reactNodeLabel).find(`.semi-form-field-error-message div`).text();
        expect(modeLabel).toEqual('hahaha');
    });

    it('children', () => {
        let children = <div className="slot-child">semi</div>;
        let props = {
            children: children,
        };
        const slot = getSlot(props).find(`.${BASE_CLASS_PREFIX}-form-slot`);
        expect(slot.contains(children)).toEqual(true);
    });

    it('extends Form.labelWidth, Form.labelPosition ', () => {
        let formProps = {
            labelWidth: 200,
            labelPosition: 'left',
        };
        let props = {};
        const form = getSlot(props, formProps);
        expect(form.exists(`.${BASE_CLASS_PREFIX}-form-field-label-left`)).toEqual(true);
        expect(form.find(`.${BASE_CLASS_PREFIX}-form-slot .${BASE_CLASS_PREFIX}-form-field-label`)).toHaveStyle('width', 200);
    });

    // TODO wrapperCol
    // it('extends Form.wrapperCol / Form.labelCol', () => {
    //     let props = {};
    //     let formProps = {
    //         wrapperCol: { span: 20 },
    //         labelCol: { span: 2 },
    //     };
    //     const formContent = (
    //         <Form {...formProps}>
    //             <Slot {...slotProps}></Slot>
    //         </Form>
    //     );
    //     const form = mount(formContent, { attachTo: document.getElementById('container') });
    //     debugger;
    // });
});
