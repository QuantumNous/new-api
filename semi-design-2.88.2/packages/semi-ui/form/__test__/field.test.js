import { Form, Select } from '../../index';
import { noop } from 'lodash';
import { func } from 'prop-types';
import { BASE_CLASS_PREFIX } from '../../../semi-foundation/base/constants';
import { sleep as baseSleep } from '../../_test_/utils/index';

const sleep = (ms = 200) => baseSleep(ms);

function getForm(props) {
    return mount(<Form {...props}></Form>);
}

function getInput(props) {
    return <Form.Input {...props} />;
}

const Option = Select.Option;
const FormSelect = (
    <Form.Select label="business" field="business" style={{ width: 200 }}>
        <Option value="dy">Douyin</Option>
        <Option value="hotsoon">Hotsoon</Option>
        <Option value="topbuzz">TopBuzz</Option>
    </Form.Select>
);

const FormInput = <Form.Input field="name" />;

const FieldCls = `.${BASE_CLASS_PREFIX}-form-field`;

const fields = (
    <>
        {FormInput}
        {FormSelect}
    </>
);

describe('Form-field', () => {
    it('className & style & fieldClassName', () => {
        const fieldProps = {
            className: 'test-a',
            style: {
                color: 'red',
            },
            fieldClassName: 'field-test-b',
        };
        const props = {
            children: getInput(fieldProps),
        };
        const form = getForm(props);
        expect(form.exists(`.${BASE_CLASS_PREFIX}-input-wrapper.test-a`)).toEqual(true);
        expect(form.find(`.${BASE_CLASS_PREFIX}-input-wrapper.test-a`)).toHaveStyle('color', 'red');
        expect(form.find(`.${BASE_CLASS_PREFIX}-form-field.field-test-b`).length).toEqual(1);
    });
    it('label', () => {
        const props = {
            children: getInput({
                label: 'Company',
                field: 'name',
            }),
        };
        const form = getForm(props);
        expect(form.find(`.${BASE_CLASS_PREFIX}-form-field-label`).text()).toEqual('Company');
    });
    it('labelPosition', () => {
        // field's labelPosition has a higher weight than form
        const props = {
            labelPosition: 'top',
            children: (
                <>
                    {getInput({ labelPosition: 'left', fieldClassName: 'left-input' })}
                    {getInput({ fieldClassName: 'top-input' })}
                </>
            ),
        };
        const form = getForm(props);
        expect(
            form
                .find('.left-input')
                .instance()
                .getAttribute('x-label-pos')
        ).toEqual('left');
        expect(
            form
                .find('.top-input')
                .instance()
                .getAttribute('x-label-pos')
        ).toEqual('top');
    });
    it('labelAlign', () => {
        // field's labelAlign has a higher weight than form
        const props = {
            labelAlign: 'right',
            children: (
                <>
                    {getInput({ labelAlign: 'left', fieldClassName: 'left-input' })}
                    {getInput({ fieldClassName: 'right-input' })}
                </>
            ),
        };
        const form = getForm(props);
        expect(form.exists(`.left-input .${BASE_CLASS_PREFIX}-form-field-label-left`)).toEqual(true);
        expect(form.exists(`.right-input .${BASE_CLASS_PREFIX}-form-field-label-right`)).toEqual(true);
    });
    it('noLabel', () => {
        const fieldProps = {
            noLabel: true,
            field: 'name',
        };
        const props = {
            children: getInput(fieldProps),
        };
        const form = getForm(props);
        expect(form.exists(`.${BASE_CLASS_PREFIX}-form-field-label`)).toEqual(false);
    });
    it('name', () => {
        const props = {
            children: getInput({ field: 'name', name: 'company' }),
        };
        const form = getForm(props);
        expect(form.exists(`.${BASE_CLASS_PREFIX}-form-field.${BASE_CLASS_PREFIX}-form-field-company`)).toEqual(true);
    });
    it('initValue', () => {
        // field's initValue has a higher weight than form initValues
        const props = {
            children: getInput({ initValue: 'b', field: 'name' }),
            initValues: {
                name: 'a',
            },
        };
        const form = getForm(props);
        expect(form.find(`.${BASE_CLASS_PREFIX}-input`).instance().value).toEqual('b');
    });
    it('onChange', () => {
        const onChange = () => {};
        const spyOnChange = sinon.spy(onChange);
        const fieldProps = {
            onChange: spyOnChange,
            field: 'name',
        };
        const props = {
            children: getInput(fieldProps),
        };
        const form = getForm(props);
        const event = { target: { value: 'semi' } };
        form.find(`.${BASE_CLASS_PREFIX}-input`).simulate('change', event);
        expect(spyOnChange.calledOnce).toEqual(true);
        expect(spyOnChange.calledWithMatch('semi')).toEqual(true);
    });
    it('validate-sync', () => {
        const validate = value => {
            return value !== 'semi' ? 'invalid' : '';
        };
        const spyValidate = sinon.spy(validate);
        const fieldProps = {
            field: 'name',
            trigger: 'change',
            validate: spyValidate,
            // rules are invalidated when validate is also declared
            rules: [
                { type: 'string', message: 'rules error1' },
                { validator: (rule, value) => value === 'muji', message: 'rules error2' },
            ],
        };
        const props = {
            children: getInput(fieldProps),
        };
        const form = getForm(props);
        // fail
        const failedEvent = { target: { value: 'milk' } };
        form.find(`.${BASE_CLASS_PREFIX}-input`).simulate('change', failedEvent);
        expect(spyValidate.calledWithMatch('milk')).toEqual(true);
        expect(form.find(`.${BASE_CLASS_PREFIX}-form-field-error-message`).text()).toEqual('invalid');
        // success
        const successEvent = { target: { value: 'semi' } };
        form.find(`.${BASE_CLASS_PREFIX}-input`).simulate('change', successEvent);
        expect(form.exists(`.${BASE_CLASS_PREFIX}-form-field-error-message`)).toEqual(false);
    });
    it('validate-async', done => {
        const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
        const validate = val => {
            return sleep(50).then(() => {
                if (val !== 'semi') {
                    return 'invalid';
                }
                return '';
            });
        };
        const spyValidate = sinon.spy(validate);
        const fieldProps = {
            trigger: 'change',
            validate: spyValidate,
            field: 'name',
        };
        let formApi = null;
        const getFormApi = api => {
            formApi = api;
        };
        const props = {
            getFormApi,
            children: getInput(fieldProps),
        };
        const form = getForm(props);
        // fail
        const failedEvent = { target: { value: 'milk' } };
        form.find(`.${BASE_CLASS_PREFIX}-input`).simulate('change', failedEvent);
        setTimeout(() => {
            form.update();
            expect(spyValidate.firstCall.calledWithMatch('milk')).toEqual(true);
            expect(formApi.getError('name')).toEqual('invalid');
            expect(form.find(`.${BASE_CLASS_PREFIX}-form-field-error-message`).text()).toEqual('invalid');
            const successEvent = { target: { value: 'semi' } };
            form.find(`.${BASE_CLASS_PREFIX}-input`).simulate('change', successEvent);
        }, 200);
        setTimeout(() => {
            form.update();
            // success
            expect(spyValidate.secondCall.calledWithMatch('semi')).toEqual(true);
            expect(formApi.getError('name')).toEqual(undefined);
            expect(form.exists(`.${BASE_CLASS_PREFIX}-form-field-error-message`)).toEqual(false);
            done();
        }, 800);
    });
    it('rules', done => {
        // rules work
        let fieldProps = {
            field: 'name',
            trigger: 'change',
            rules: [
                { type: 'string', message: 'type error' },
                { validator: (rule, value) => value === 'muji', message: 'not muji' },
            ],
        };
        let formApi = null;
        const getFormApi = api => {
            formApi = api;
        };
        const props = {
            getFormApi,
            children: getInput(fieldProps),
        };
        const form = getForm(props);
        const event2 = { target: { value: 2 } };
        form.find(`.${BASE_CLASS_PREFIX}-input`).simulate('change', event2);
        setTimeout(() => {
            form.update();
            expect(form.find(`.${BASE_CLASS_PREFIX}-form-field-error-message`).text()).toEqual('type error, not muji');
        }, 50);
        setTimeout(() => {
            const event3 = { target: { value: 'semi' } };
            form.find(`.${BASE_CLASS_PREFIX}-input`).simulate('change', event3);
            form.update();
        }, 100);
        setTimeout(() => {
            // console.log(formApi);
            expect(form.find(`.${BASE_CLASS_PREFIX}-form-field-error-message`).text()).toEqual('not muji');
            done();
        }, 200);
    });
    it('transform', () => {
        const transform = stringVal => {
            return Number(stringVal);
        };
        const validate = value => {
            return value !== 5 ? 'invalid' : '';
        };
        const spyValidate = sinon.spy(validate);
        const fieldProps = {
            transform,
            validate: spyValidate,
            field: 'count',
        };
        let formApi = null;
        const getFormApi = api => {
            formApi = api;
        };
        const props = {
            getFormApi,
            children: getInput(fieldProps),
        };
        const form = getForm(props);
        const event = { target: { value: '5' } };
        form.find(`.${BASE_CLASS_PREFIX}-input`).simulate('change', event);
        expect(spyValidate.calledWithMatch(5)).toEqual(true);
        // only transform value before validate, can't change value in formState
        expect(formApi.getValue('count')).toEqual('5');
    });
    it('convert', () => {
        const convert = stringVal => {
            return Number(stringVal);
        };
        const spyConvert = sinon.spy(convert);
        const fieldProps = {
            convert: spyConvert,
            field: 'count',
        };
        let formApi = null;
        const getFormApi = api => {
            formApi = api;
        };
        const props = {
            getFormApi,
            children: getInput(fieldProps),
        };
        const form = getForm(props);
        const event = { target: { value: '5' } };
        form.find(`.${BASE_CLASS_PREFIX}-input`).simulate('change', event);
        expect(spyConvert.calledWithMatch('5')).toEqual(true);
        expect(formApi.getValue('count')).toEqual(5);
    });

    it('trigger - mounted / change / blur ', done => {
        const validate = val => (val !== 'semi' ? 'invalid' : '');
        const propsChange = {
            trigger: 'change',
            field: 'a',
            fieldClassName: 'a',
            validate,
        };
        const propsBlur = {
            trigger: 'blur',
            field: 'b',
            fieldClassName: 'b',
            initValue: 'milk',
            validate,
        };
        //TODO mounted
        const propsMounted = {
            trigger: 'mounted',
            field: 'c',
            fieldClassName: 'c',
            validate,
        };
        const props = {
            children: (
                <>
                    {getInput(propsChange)}
                    {getInput(propsBlur)}
                </>
            ),
        };
        const form = getForm(props);
        const event = { target: { value: 'trigger' } };
        form.find(`.a .${BASE_CLASS_PREFIX}-input`).simulate('change', event);
        form.find(`.b .${BASE_CLASS_PREFIX}-input`).simulate('blur', event);
        setTimeout(() => {
            form.update();
            expect(form.find(`.a .${BASE_CLASS_PREFIX}-form-field-error-message`).text()).toEqual('invalid');
            expect(form.find(`.b .${BASE_CLASS_PREFIX}-form-field-error-message`).text()).toEqual('invalid');
            done();
        }, 100);
    });

    it('trigger - change & blur', done => {
        const validate = val => {
            if (val === 'changeVal') {
                return 'changeError';
            } else if (val === 'blurVal') {
                return 'blurError';
            } else {
                return '';
            }
        };
        const fieldProps = {
            trigger: ['change', 'blur'],
            field: 'a',
            fieldClassName: 'a',
            validate,
        };
        const props = {
            children: <>{getInput(fieldProps)}</>,
        };
        const form = getForm(props);
        let event = { target: { value: 'changeVal' } };
        form.find(`.a .${BASE_CLASS_PREFIX}-input`).simulate('change', event);
        setTimeout(() => {
            form.update();
            expect(form.find(`.a .${BASE_CLASS_PREFIX}-form-field-error-message`).text()).toEqual('changeError');
        }, 50);
        setTimeout(() => {
            event = { target: { value: 'blurVal' } };
            form.find(`.a .${BASE_CLASS_PREFIX}-input`).simulate('change', event);
            form.find(`.a .${BASE_CLASS_PREFIX}-input`).simulate('blur', {});
        }, 80);
        setTimeout(() => {
            form.update();
            expect(form.find(`.a .${BASE_CLASS_PREFIX}-form-field-error-message`).text()).toEqual('blurError');
            done();
        }, 100);
    });

    it('field', () => {
        // 1、username
        // 2、user[0]
        // 3、siblings.1
        // 4、siblings['2']
        // 5、parents[0].name
        // 6、parents[1]['name']
        const fields = ['username', 'user[0]', 'siblings.1', 'siblings[2]', 'parents[0].name', "parents[1]['name']"];

        const props = {
            children: <>{fields.map((field, index) => getInput({ field: field, fieldClassName: `field-${index}` }))}</>,
            initValues: {
                username: 'a',
                user: ['b'],
                siblings: [0, 'c', 'd'],
                parents: [{ name: 'e' }, { name: 'f' }],
            },
        };
        const form = getForm(props);
        // If you do not pass a specific label prop, the label content is consistent with the field
        const fieldsDOM = form.find(`.${BASE_CLASS_PREFIX}-form-field .${BASE_CLASS_PREFIX}-input`);
        expect(fieldsDOM.at(0).instance().value).toEqual('a');
        expect(fieldsDOM.at(1).instance().value).toEqual('b');
        expect(fieldsDOM.at(2).instance().value).toEqual('c');
        expect(fieldsDOM.at(3).instance().value).toEqual('d');
        expect(fieldsDOM.at(4).instance().value).toEqual('e');
        expect(fieldsDOM.at(5).instance().value).toEqual('f');
    });

    it('validate race condition', async () => {
        let formApi = null;
        let asyncValidatorCallback = null;

        const fieldProps = {
            field: 'text',
            rules: [
                { type: 'string', max: 10 },
                {
                    asyncValidator(rule, value, callback) {
                        if (!asyncValidatorCallback) {
                            asyncValidatorCallback = callback;
                        } else {
                            callback();
                        }
                    }
                }
            ]
        }
        const props = {
            getFormApi(api) {
                formApi = api;
            },
            children: getInput(fieldProps),
        };
        const form = getForm(props);

        const event1 = { target: { value: 'semi' } };
        form.find(`.${BASE_CLASS_PREFIX}-input`).simulate('change', event1);
        await sleep(200);
        form.update();
        expect(formApi.getError('text')).toBeUndefined();

        const event2 = { target: { value: 'Prefer knowledge to wealth, for the one is transitory, the other perpetual.' } };
        form.find(`.${BASE_CLASS_PREFIX}-input`).simulate('change', event2);
        await sleep(200);
        asyncValidatorCallback();
        await sleep(200);
        form.update();
        expect(formApi.getError('text')).not.toBeUndefined();
    });

    // TODO
    // it('allowEmptyString', () => {});
    // it('extraText')
    // it('extraTextPosition')
    // it('helpText')
    // it('stopValidateWithError')
    // it('noErrorMessage)
    // it('pure')
    // it('fieldStyle')
});
