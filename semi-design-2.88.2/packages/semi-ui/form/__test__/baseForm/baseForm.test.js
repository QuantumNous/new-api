import { Form, Select, Button } from '@douyinfe/semi-ui';
import { noop } from 'lodash';
import { BASE_CLASS_PREFIX } from '../../../../semi-foundation/base/constants';
import { sleep as baseSleep } from '../../../_test_/utils/index';

function getForm(props) {
    return mount(<Form {...props}></Form>, {
        attachTo: document.getElementById('container'),
    });
}

const Option = Select.Option;
const FormSelect = (
    <Form.Select label="business" field="business" style={{ width: 200 }}>
        <Option value="abc">Abc</Option>
        <Option value="hotsoon">Hotsoon</Option>
        <Option value="topbuzz">TopBuzz</Option>
    </Form.Select>
);

const FormInput = <Form.Input field="name" />;

const FieldCls = `.${BASE_CLASS_PREFIX}-form-field`;

const sleep = (ms = 200) => baseSleep(ms);

const fields = (
    <>
        {FormInput}
        {FormSelect}
    </>
);

describe('Form-baseForm', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        // Avoid `attachTo: document.body` Warning
        const div = document.createElement('div');
        div.setAttribute('id', 'container');
        document.body.appendChild(div);
    });

    afterEach(() => {
        const div = document.getElementById('container');
        if (div) {
            document.body.removeChild(div);
        }
    });

    it('className & style', () => {
        const props = {
            className: 'form-test',
            style: {
                color: 'red',
            },
        };
        const form = getForm(props);
        expect(form.exists('form.form-test')).toEqual(true);
        expect(form.find('form.form-test')).toHaveStyle('color', 'red');
    });

    it('layout', () => {
        // layout = 'vertical' (default)
        let props = {};
        const form = getForm(props);
        expect(form.exists(`.${BASE_CLASS_PREFIX}-form-vertical`)).toEqual(true);
        // layout = 'horizontal'
        form.setProps({ layout: 'horizontal' });
        form.update();
        expect(form.exists(`.${BASE_CLASS_PREFIX}-form-horizontal`)).toEqual(true);
        expect(form.exists(`.${BASE_CLASS_PREFIX}-form-vertical`)).toEqual(false);
    });

    it('labelPosition', () => {
        let props = {
            labelPosition: 'left',
            children: FormInput,
        };
        let form = getForm(props);
        const field = form.find(FieldCls);
        expect(field.instance().getAttribute('x-label-pos')).toEqual('left');
    });

    it('labelWidth', () => {
        // number
        let children = (
            <>
                {FormInput}
                {FormSelect}
            </>
        );
        let props = {
            labelWidth: 200,
            children,
        };
        const form = getForm(props);
        const label = form.find(`.${BASE_CLASS_PREFIX}-form-field-label`);
        expect(label.at(0)).toHaveStyle('width', 200);
        expect(label.at(1)).toHaveStyle('width', 200);
        form.unmount();
        // string
        let stringProps = {
            labelWidth: '300px',
            children,
        };
        const form2 = getForm(stringProps);
        const label2 = form2.find(`.${BASE_CLASS_PREFIX}-form-field-label`);
        expect(label2.at(0)).toHaveStyle('width', '300px');
        expect(label2.at(1)).toHaveStyle('width', '300px');
    });

    it('declare fields via component', () => {
        const fields = ({ formState, formApi, values }) => (
            <>
                <Form.Input field="Role" fieldClassName="role" />
                <Form.Input field="UserName" fieldClassName="userName" />
            </>
        );
        let props = {
            component: fields,
        };
        const form = getForm(props);
        expect(form.exists('.role')).toEqual(true);
        expect(form.exists('.userName')).toEqual(true);
        // TODO
        // test whether 'formState', 'formApi', 'values'  work
    });

    it('declare fields via render', () => {
        const render = ({ formState, formApi, values }) => (
            <>
                <Form.Select field="Role" label="角色" style={{ width: 120 }} fieldClassName="role">
                    <Option value="admin">管理员</Option>
                    <Option value="user">普通用户</Option>
                    <Option value="guest">访客</Option>
                </Form.Select>
                <Form.Input field="UserName" label="用户名" fieldClassName="userName" />
                <Form.Input field="Password" label="密码" fieldClassName="password" />
                <code style={{ marginTop: 30 }}>{JSON.stringify(formState)}</code>
            </>
        );
        let props = {
            render,
        };
        const form = getForm(props);
        expect(form.exists('.role')).toEqual(true);
        expect(form.exists('.userName')).toEqual(true);
        expect(form.exists('.password')).toEqual(true);
    });

    it('declare fields via children', () => {
        const children = <Form.Input field="name" fieldClassName="name" />;
        let props = {
            children,
        };
        const form = getForm(props);
        expect(form.exists('.name')).toEqual(true);
    });

    it('test getFormApi callback and params are valid function', () => {
        let api = null;
        let getFormApi = formApi => {
            api = formApi;
        };
        let spyGet = sinon.spy(getFormApi);
        let props = {
            getFormApi: spyGet,
            children: FormInput,
        };
        const form = getForm(props);
        const apiMaps = new Set(Object.keys(api));
        const formApis = [
            'setValue',
            'setValues',
            'setError',
            'setTouched',
            'submitForm',
            'reset',
            'getInitValue',
            'getFieldExist',
            'getFormState',
            'getTouched',
            'getValue',
            'getError',
            'validate',
        ];
        expect(formApis.every(apiName => apiMaps.has(apiName) && typeof api[apiName] === 'function')).toEqual(true);
    });

    it('onSubmit-without validate, trigger by formApi', done => {
        let api = null;
        let onSubmit = values => {};
        let spyOnSubmit = sinon.spy(onSubmit);
        let props = {
            getFormApi: formApi => {
                api = formApi;
            },
            onSubmit: spyOnSubmit,
            children: (
                <>
                    <Form.Input field="input" />
                </>
            ),
        };
        const form = getForm(props);
        api.submitForm();
        // casuse formApi.submitForm is async operation, need to wait
        setTimeout(() => {
            expect(spyOnSubmit.calledOnce).toBe(true);
            expect(spyOnSubmit.calledWithMatch({})).toBe(true);
            done();
        }, 300);
    });

    it('onSubmit-without validate, trigger by form dom event', done => {
        let api = null;
        let onSubmit = values => {};
        let spyOnSubmit = sinon.spy(onSubmit);
        let props = {
            getFormApi: formApi => {
                api = formApi;
            },
            onSubmit: spyOnSubmit,
            children: (
                <>
                    <Form.Input field="input" />
                </>
            ),
        };
        const form = getForm(props);
        let domForm = form.find('form');
        domForm.simulate('submit', { preventDefault: () => {}});
        // casuse formApi.submitForm is async operation, need to wait
        setTimeout(() => {
            expect(spyOnSubmit.calledOnce).toBe(true);
            expect(spyOnSubmit.calledWithMatch({})).toBe(true);
            done();
        }, 300);
    });

    it('onSubmitFail', done => {
        let api = null;
        let spyOnSubmit = sinon.spy(values => {});
        let spyOnSubmitFail = sinon.spy(errors => {});
        let emptyTips = "can't be empty";
        let validateName = val => {
            if (!val) {
                return emptyTips;
            }
            return;
        };
        let props = {
            getFormApi: formApi => {
                api = formApi;
            },
            onSubmit: spyOnSubmit,
            onSubmitFail: spyOnSubmitFail,
            children: (
                <>
                    <Form.Input field="name" validate={validateName} />
                    <Form.Input field="name2" validate={validateName} />
                </>
            ),
        };
        const form = getForm(props);
        api.submitForm();
        // casuse formApi.submitForm is async operation, need to wait
        setTimeout(() => {
            expect(spyOnSubmit.callCount).toEqual(0);
            expect(spyOnSubmitFail.calledOnce).toBe(true);
            expect(
                spyOnSubmitFail.calledWithMatch({
                    name: emptyTips,
                    name2: emptyTips,
                })
            ).toBe(true);
            done();
        }, 200);
    });

    it('onReset', () => {
        let api = null;
        const onReset = () => {};
        const spyOnReset = sinon.spy(onReset);
        const props = {
            onReset: spyOnReset,
            children: FormInput,
            getFormApi: formApi => {
                api = formApi;
            },
            initValues: {
                name: 'a',
            },
        };
        const form = getForm(props);
        let event = { target: { value: 'b' } };
        form.find(`.${BASE_CLASS_PREFIX}-input`).simulate('change', event);
        expect(form.find(`.${BASE_CLASS_PREFIX}-input`).instance().value).toEqual('b');
        api.reset();
        expect(spyOnReset.calledOnce).toEqual(true);
        expect(form.find(`.${BASE_CLASS_PREFIX}-input`).instance().value).toEqual('a');
    });

    it('allowEmpty', done => {
        let api = null;
        let spyOnSubmit = sinon.spy(values => {});

        let props = {
            getFormApi: formApi => {
                api = formApi;
            },
            allowEmpty: true,
            onSubmit: spyOnSubmit,
            children: fields,
        };
        const form = getForm(props);
        api.submitForm();
        setTimeout(() => {
            expect(
                spyOnSubmit.calledWithMatch({
                    name: undefined,
                    business: undefined,
                })
            ).toBe(true);
            done();
        }, 200);
    });

    // TODO onValueChange second arugment
    it('onValueChange', () => {
        let spyOnChange = sinon.spy(values => {});
        let props = {
            onValueChange: spyOnChange,
            children: (
                <>
                    <Form.Input field="name" />
                </>
            ),
        };
        const form = getForm(props);
        let event = { target: { value: 'semi' } };
        form.find(`.${BASE_CLASS_PREFIX}-input`).simulate('change', event);
        expect(spyOnChange.calledOnce).toEqual(true);
        expect(spyOnChange.calledWithMatch({ name: 'semi' })).toEqual(true);
    });

    it('initValues', () => {
        let props = {
            initValues: {
                name: 'semi',
                business: 'abc',
            },
            children: fields,
        };
        const form = getForm(props);
        expect(form.find(`.${BASE_CLASS_PREFIX}-select-selection-text`).text()).toEqual('Abc');
        expect(form.find(`.${BASE_CLASS_PREFIX}-input`).instance().value).toEqual('semi');
    });

    it('labelAlign', () => {
        // labelAlign:left (default)
        let defaultProps = {
            children: fields,
        };
        const defaultForm = getForm(defaultProps);
        expect(defaultForm.find(`.${BASE_CLASS_PREFIX}-form-field-label-right`).length).toEqual(0);
        expect(defaultForm.find(`.${BASE_CLASS_PREFIX}-form-field-label-left`).length).toEqual(2);
        defaultForm.unmount();
        // labelAlign:right
        let rightProps = {
            labelAlign: 'right',
            children: fields,
        };
        const form = getForm(rightProps);
        expect(form.find(`.${BASE_CLASS_PREFIX}-form-field-label-right`).length).toEqual(2);
        expect(form.find(`.${BASE_CLASS_PREFIX}-form-field-label-left`).length).toEqual(0);
    });
    it('labelCol/wrapperCol', () => {
        let props = {
            wrapperCol: { span: 20 },
            labelCol: { span: 2 },
            children: fields,
        };
        const form = getForm(props);
        const fieldsDom = form.find(`.${BASE_CLASS_PREFIX}-form-field`);
        const firstField = fieldsDom.at(0);
        const secondField = fieldsDom.at(1);
        expect(
            firstField
                .children()
                .at(0)
                .find(`.${BASE_CLASS_PREFIX}-col`)
        ).toHaveClassName(`.${BASE_CLASS_PREFIX}-col-2`);
        expect(
            firstField
                .children()
                .at(1)
                .find(`.${BASE_CLASS_PREFIX}-col`)
        ).toHaveClassName(`.${BASE_CLASS_PREFIX}-col-20`);
        expect(
            secondField
                .children()
                .at(0)
                .find(`.${BASE_CLASS_PREFIX}-col`)
        ).toHaveClassName(`.${BASE_CLASS_PREFIX}-col-2`);
        expect(
            secondField
                .children()
                .at(1)
                .find(`.${BASE_CLASS_PREFIX}-col`)
        ).toHaveClassName(`.${BASE_CLASS_PREFIX}-col-20`);
    });

    /**
        () => {
            const { Option } = Form.Select;

            return (
                <Form layout='horizontal'  onValueChange={values=>console.log(values)}>
                    <Form.Input field='a.b' style={{width:80}}/>
                    <Form.Input field='arr[1]' style={{width:80}}/>
                </Form>
            )
        }

        Step1: type 'test' in Form.Input[a.b] , expect log as : { a: { b: 'test' } }
        Step2: delete 'test', expect log as : {},
        Step3: type 'ttt' in  Form.Input[arr[1]], expect log as: { arr: [empty, '2'] }
        Step3: delete 'ttt', expect log as : {},
     */
    it('auto remove empty key', () => {
        let onValueChange = (values) => {
            // debugger
        };
        let spyValueChange = sinon.spy(onValueChange);
        let fields = (
            <>
                <Form.Input field="a.b"  className='ab'/>
                <Form.Input field="arr[1]" className='arr'/>
            </>
        )
        let formProps = { onValueChange: spyValueChange, children: fields };
        let form = getForm(formProps);
        
        let event1 = { target: { value: 'test' } };
        form.find(`.ab .${BASE_CLASS_PREFIX}-input`).simulate('change', event1);
        let firstCall = spyValueChange.firstCall;
        expect(JSON.stringify(firstCall.args[0])).toEqual('{"a":{"b":"test"}}');

        let event2 = { target: { value: '' } };
        form.find(`.ab .${BASE_CLASS_PREFIX}-input`).simulate('change', event2);
        let secondCall = spyValueChange.secondCall;
        expect(JSON.stringify(secondCall.args[0])).toEqual('{}');

        let event3 = { target: { value: 'ttt' } };
        form.find(`.arr .${BASE_CLASS_PREFIX}-input`).simulate('change', event3);
        let thirdCall = spyValueChange.thirdCall;
        expect(JSON.stringify(thirdCall.args[0])).toEqual('{"arr":[null,"ttt"]}');

        let event4 = { target: { value: '' } };
        form.find(`.arr .${BASE_CLASS_PREFIX}-input`).simulate('change', event4);
        let lastCall = spyValueChange.lastCall;
        expect(JSON.stringify(lastCall.args[0])).toEqual('{}');
    });

    it('disabled', ()=>{
        let props = {
            disabled: true,
            children: fields,
        };
        const form = getForm(props);
        expect(form.exists('.semi-select-disabled')).toEqual(true);
        expect(form.exists('.semi-input-disabled')).toEqual(true);
    })

    it('validataFields - sync valdate fail', async() => {
        let fields = (
            <>
                <Form.Input field="a.b"  className='ab'/>
                <Form.Input field="arr[1]" className='arr'/>
            </>
        )
        let err = 'ab not valid'
        let validateFields = (values) => {
            return {
                a: {
                    b: err,
                }
            }
        };
        let promiseCatch = (error) => {};
        let spyPromiseCatch = sinon.spy(promiseCatch);
        let getFormApi = api => {
            formApi = api;
        };
        let formProps = { 
            children: fields,
            validateFields,
            getFormApi,
        };
        let formApi = null;
        let form = getForm(formProps);
        formApi.validate().catch(promiseCatch);
        await sleep(300);
        expect(formApi.getError('a.b')).toEqual(err);
    });

    it('validataFields - sync valdate pass', async() => {
        let fields = (
            <>
                <Form.Input field="a.b"  className='ab'/>
                <Form.Input field="arr[1]" className='arr'/>
            </>
        )
        let validateFields = (values) => {
            return ''
        };
        let getFormApi = api => {
            formApi = api;
        };
        let formProps = { 
            children: fields,
            validateFields,
            getFormApi,
        };
        let formApi = null;
        let form = getForm(formProps);
        formApi.validate();
        await sleep(300);
        expect(formApi.getFormState().errors).toEqual({});
    });

    it('validteFields - async promise return error string, validate fail', async () => {
        let fields = (
            <>
                <Form.Input field="a.b"  className='ab'/>
                <Form.Input field="arr[1]" className='arr'/>
            </>
        )
        let err = 'ab not valid'
        let validateFields = (values) => {
            const sl = ms => new Promise(resolve => setTimeout(resolve, ms));
            return sl(200).then(() => {
                let errors = { a: { b: err }};
                return errors;
            });
        };
        let promiseCatch = (error) => {};
        let spyPromiseCatch = sinon.spy(promiseCatch);
        let getFormApi = api => {
            formApi = api;
        };
        let formProps = { 
            children: fields,
            validateFields,
            getFormApi,
        };
        let formApi = null;
        let form = getForm(formProps);
        formApi.validate().catch(promiseCatch);
        await sleep(300);
        expect(formApi.getError('a.b')).toEqual(err);
    });

    // it('validteFields - async promise reject directly, validate fail', async () => {
    //     let fields = (
    //         <>
    //             <Form.Input field="a.b"  className='ab'/>
    //             <Form.Input field="arr[1]" className='arr'/>
    //         </>
    //     )
    //     let err = 'ab not valid'
    //     let validateFields = (values) => {
    //         const sl = ms => new Promise(resolve => setTimeout(resolve, ms));
    //         return sl(200).then(() => {
    //             throw { a: { b: err }};
    //         });
    //     };
    //     let promiseCatch = (error) => {};
    //     let spyPromiseCatch = sinon.spy(promiseCatch);
    //     let getFormApi = api => {
    //         formApi = api;
    //     };
    //     let formProps = { 
    //         children: fields,
    //         validateFields,
    //         getFormApi,
    //     };
    //     let formApi = null;
    //     let form = getForm(formProps);
    //     formApi.validate().catch(promiseCatch);
    //     await sleep(300);
    //     expect(formApi.getError('a.b')).toEqual(err);
    // });

    it('validteFields - async promise resolve, validate pass', async () => {
        let fields = (
            <>
                <Form.Input field="a.b"  className='ab'/>
                <Form.Input field="arr[1]" className='arr'/>
            </>
        )
        let err = 'ab not valid'
        let validateFields = (values) => {
            const sl = ms => new Promise(resolve => setTimeout(resolve, ms));
            return sl(200).then(() => {
                return '';
            });
        };
        let promiseCatch = (error) => {};
        let spyPromiseCatch = sinon.spy(promiseCatch);
        let getFormApi = api => {
            formApi = api;
        };
        let formProps = { 
            children: fields,
            validateFields,
            getFormApi,
        };
        let formApi = null;
        let form = getForm(formProps);
        formApi.validate().catch(promiseCatch);
        await sleep(300);
        expect(formApi.getFormState().errors).toEqual({});

    });
    // it('showValidateIcon', ()=>{})
});
