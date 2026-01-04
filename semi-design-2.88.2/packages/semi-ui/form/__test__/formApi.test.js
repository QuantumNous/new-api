// formApi test
import { Form, Select, Button } from '../../index';
import { noop } from 'lodash';
import { sleep as baseSleep } from '../../_test_/utils/index';
const sleep = (ms = 200) => baseSleep(ms);

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

const FieldCls = `.semi-form-field`;

const fields = (
    <>
        {FormInput}
        {FormSelect}
    </>
);

const getDomValue = (field, form) => {
    let inputDOM = form.find(`[x-field-id="${field}"] input`).getDOMNode();
    return inputDOM.getAttribute("value");
};

describe('Form-formApi', () => {
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
    it('formApi-getFieldExist', () => {
        let formApi = null;
        let getFormApi = api => {
            formApi = api;
        };
        let spyGet = sinon.spy(getFormApi);
        let props = {
            getFormApi: spyGet,
            children: FormInput,
        };
        const form = getForm(props);
        expect(formApi.getFieldExist('name')).toEqual(true);
        expect(formApi.getFieldExist('business')).toEqual(false);
    });

    it('formApi-getInitValue / getInitValues', () => {
        let formApi = null;
        let getFormApi = api => {
            formApi = api;
        };
        let initValues = {
            name: 'semi',
            business: 'abc',
        };
        let props = {
            initValues,
            getFormApi,
            children: fields,
        };
        const form = getForm(props);
        expect(formApi.getInitValue('name')).toEqual('semi');
        expect(formApi.getInitValue('business')).toEqual('abc');
        expect(formApi.getInitValue('notExistField')).toEqual(undefined);
        expect(formApi.getInitValue()).toEqual(initValues);
        expect(formApi.getInitValues()).toEqual(initValues);
    });

    it('formApi-getTouched', () => {
        let formApi = null;
        let getFormApi = api => {
            formApi = api;
        };
        let props = {
            getFormApi,
            children: fields,
        };
        const form = getForm(props);
        let event = {};
        form.find(`.semi-input`).simulate('blur', event);
        expect(formApi.getTouched('name')).toEqual(true);
        expect(!formApi.getTouched('business')).toEqual(true);
    });

    it('formApi-getValue', () => {
        let formApi = null;
        let getFormApi = api => {
            formApi = api;
        };
        let props = {
            getFormApi,
            children: fields,
        };
        const form = getForm(props);
        // get specific field value
        expect(formApi.getValue('name')).toEqual(undefined);
        let event = { target: { value: 'semi' } };
        form.find(`.semi-input`).simulate('change', event);
        expect(formApi.getValue('name')).toEqual('semi');
        // get all field's value
        expect(formApi.getValue()).toEqual({ name: 'semi' });
        expect(formApi.getValues()).toEqual({ name: 'semi' });
    });


    it('formApi-getError', done => {
        let formApi = null;
        let getFormApi = api => {
            formApi = api;
        };
        let errorMessage = 'not muji';
        const props = {
            getFormApi,
            children: (
                <Form.Input
                    trigger="change"
                    field="name"
                    rules={[{ validator: (rule, value) => value === 'muji', message: errorMessage }]}
                />
            ),
        };
        const form = getForm(props);
        let event = { target: { value: 'semi' } };
        form.find(`.semi-input`).simulate('change', event);
        setTimeout(() => {
            expect(formApi.getError('name')).toEqual(errorMessage);
            done();
        }, 300);
    });

    it('formApi-getFormState', done => {
        let formApi = null;
        let getFormApi = api => {
            formApi = api;
        };
        const props = {
            getFormApi,
            children: (
                <Form.Input
                    trigger="change"
                    field="name"
                    rules={[{ validator: (rule, value) => value === 'muji', message: 'not muji' }]}
                />
            ),
        };
        const form = getForm(props);
        let event = { target: { value: 'semi' } };
        form.find(`.semi-input`).simulate('change', event);
        let expectFormState = {
            values: { name: 'semi' },
            errors: { name: 'not muji' },
            touched: { name: true },
        };
        setTimeout(() => {
            expect(formApi.getFormState()).toEqual(expectFormState);
            done();
        }, 300);
    });

    it('formApi-setError', () => {
        let formApi = null;
        let getFormApi = api => {
            formApi = api;
        };
        const props = {
            getFormApi,
            children: <Form.Input trigger="change" field="name" fieldClassName="test" />,
        };
        const form = getForm(props);
        let errorMessage = 'not muji';
        formApi.setError('name', errorMessage);
        let expectFormState = {
            values: {},
            errors: { name: errorMessage },
            touched: {},
        };
        expect(formApi.getFormState()).toEqual(expectFormState);
        form.update();
        expect(form.find(`.test .semi-form-field-error-message`).text()).toEqual(errorMessage);
    });

    it('formApi-setTouched', () => {
        let formApi = null;
        let getFormApi = api => {
            formApi = api;
        };
        let props = {
            getFormApi,
            children: fields,
        };
        const form = getForm(props);
        let event = {};
        form.find(`.semi-input`).simulate('blur', event);
        expect(formApi.getTouched('name')).toEqual(true);
        expect(!formApi.getTouched('business')).toEqual(true);
    });

    it('formApi-setValue', () => {
        let formApi = null;
        let getFormApi = api => {
            formApi = api;
        };
        let props = {
            getFormApi,
            children: fields,
        };
        let expectVal = 'semi';
        const form = getForm(props);
        formApi.setValue('name', expectVal);

        expect(formApi.getValue('name')).toEqual(expectVal);
        expect(form.find(`.semi-input`).instance().value).toEqual(expectVal);
    });

    it('formApi-reset', () => {
        let formApi = null;
        const props = {
            children: fields,
            getFormApi: api => {
                formApi = api;
            },
            initValues: {
                name: 'a',
            },
        };
        const form = getForm(props);
        let event = { target: { value: 'b' } };
        form.find(`.semi-input`).simulate('change', event);
        formApi.reset();
        expect(form.find(`.semi-input`).instance().value).toEqual('a');
        expect(formApi.getFormState()).toEqual({
            values: { name: 'a' },
            errors: {},
            touched: {},
        });
    });

    it('formApi-setValues-override', () => {
        let formApi = null;
        const props = {
            children: fields,
            getFormApi: api => {
                formApi = api;
            },
            initValues: {
                name: 'a',
                extraKeyA: 'uno',
            },
        };
        const form = getForm(props);
        let expectVal = {
            name: 'semi',
            business: 'abc',
            extraKeyB: 'Kay tse',
        };
        formApi.setValues(expectVal, { isOverride: true });
        expect(formApi.getValue()).toEqual(expectVal);
    });

    it('formApi-setValues-merge', () => {
        let formApi = null;
        let initValues = {
            name: 'a',
            extraKeyA: 'uno',
        };
        const props = {
            children: fields,
            getFormApi: api => {
                formApi = api;
            },
            initValues,
        };
        const form = getForm(props);
        let expectVal = {
            name: 'semi',
            business: 'abc',
            extraKeyB: 'not exist',
        };
        let mergeVal = { name: 'semi', business: 'abc', extraKeyA: 'uno' };
        formApi.setValues(expectVal);
        expect(formApi.getValue()).toEqual(mergeVal);
    });

    it('formApi-validate, validate all field, specail field', async () => {
        let fields = (
            <>
                <Form.Input field="a.b"  className='ab' validate={(val) => val ? '' : 'ab-err'} />
                <Form.Input field="a.c"  className='ac' validate={(val) => val ? '' : 'ac-err'} />
            </>
        )
        let formApi = null;
        let getFormApi = api => {
            formApi = api;
        };
        let formProps = { 
            children: fields,
            getFormApi,
        };
        let form = getForm(formProps);
        formApi.validate().then(values=>{}).catch(error=> {});
        await sleep(400);
        expect(formApi.getFormState().errors).toEqual({ a: { b: 'ab-err', c: 'ac-err'}});
        formApi.reset();
        formApi.validate(['a.c']).then(values=>{}).catch(error=> {});
        await sleep(300);
        expect(formApi.getFormState().errors).toEqual({ a: { c: 'ac-err'}});
    });

    it('formApi-validate, nested field', async () => {
        let fields = (
            <>
                <Form.Input field="a.b"  className='ab' validate={(val) => val ? '' : 'ab-err'} />
                <Form.Input field="a.c"  className='ac' validate={(val) => val ? '' : 'ac-err'} />
                <Form.Input field="e"  className='e' validate={(val) => val ? '' : 'e-err'} />
            </>
        )
        let formApi = null;
        let getFormApi = api => {
            formApi = api;
        };
        let formProps = { 
            children: fields,
            getFormApi,
        };
        let form = getForm(formProps);
        formApi.validate(['a']).then(values=>{}).catch(error=> {});
        await sleep(300);
        expect(formApi.getFormState().errors).toEqual({ a: { b: 'ab-err', c: 'ac-err' }});
    })

    it('formApi-setValue, when include nested field', async () => {
        let fields = (
            <>
                <Form.Input field="a.b"  className='ab' validate={(val) => val ? '' : 'ab-err'} />
                <Form.Input field="a.c"  className='ac' validate={(val) => val ? '' : 'ac-err'} />
                <Form.Input field="e"  className='e' validate={(val) => val ? '' : 'e-err'} />
            </>
        )
        let formApi = null;
        let getFormApi = api => {
            formApi = api;
        };
        let formProps = { 
            children: fields,
            getFormApi,
        };
        let form = getForm(formProps);
        formApi.setValue('a', { b: 'semi-b', c: 'semi-c'})
        await sleep(300);
        expect(formApi.getFormState().values).toEqual({ a: { b: 'semi-b', c: 'semi-c' }});
        expect(form.find('.ab .semi-input').instance().value).toEqual('semi-b');
        expect(form.find('.ac .semi-input').instance().value).toEqual('semi-c');
        expect(form.find('.e .semi-input').instance().value).toEqual('');
    });

    it('formApi-setEror, when include nested field', async () => {
        let fields = (
            <>
                <Form.Input field="a.b"  className='ab' validate={(val) => val ? '' : 'ab-err'} />
                <Form.Input field="a.c"  className='ac' validate={(val) => val ? '' : 'ac-err'} />
                <Form.Input field="e"  className='e' validate={(val) => val ? '' : 'e-err'} />
            </>
        )
        let formApi = null;
        let getFormApi = api => {
            formApi = api;
        };
        let formProps = { 
            children: fields,
            getFormApi,
        };
        let form = getForm(formProps);
        formApi.setError('a', { b: 'ab-err', c: 'ac-err'});
        form.update();
        await sleep(500);
        expect(formApi.getFormState().errors).toEqual({ a: { b: 'ab-err', c: 'ac-err' }});
        expect(form.find('.ab .semi-form-field-error-message span').at(1).text()).toEqual('ab-err');
        expect(form.find('.ac .semi-form-field-error-message span').at(1).text()).toEqual('ac-err');
    });

    it('formApi-setTouched, when include nested field', async () => {
        let fields = (
            <>
                <Form.Input field="a.b"  className='ab' validate={(val) => val ? '' : 'ab-err'} />
                <Form.Input field="a.c"  className='ac' validate={(val) => val ? '' : 'ac-err'} />
                <Form.Input field="e"  className='e' validate={(val) => val ? '' : 'e-err'} />
            </>
        )
        let formApi = null;
        let getFormApi = api => {
            formApi = api;
        };
        let formProps = { 
            children: fields,
            getFormApi,
        };
        let form = getForm(formProps);
        formApi.setTouched('a', { b: true, c: true })
        await sleep(300);
        expect(formApi.getFormState().touched).toEqual({ a: { b: true, c: true }});
    })

        it('formApi-setValue, field path precise', () => {
        // case like:
        // Exist 3 Field: a.b、a.c、a.d
        // formApi.setValue('a.b', '123');
        let formApi = null;
        const fields = (
            <>
                <Form.Input field='a.b' />
                <Form.Input field='a.c' />
                <Form.Input field='a.d' />
            </>
        );
        const props = {
            children: fields,
            getFormApi: api => {
                formApi = api;
            },
        };
        const form = getForm(props);
        formApi.setValue('a.c', 'semi');
        // check formState.values
        let val = formApi.getValue('a.c');
        expect(val).toEqual('semi');
        form.update();
        // check dom render
        expect(getDomValue('a.c', form)).toEqual('semi');
    });

    it('formApi-setValue, field path belongs to parent aggregate', () => {
        // case like:
        // Exist 3 Field: a.b、a.c、a.d
        // formApi.setValue('a', { b: 'semi', c: 'design' });
        let formApi = null;
        const fields = (
            <>
                <Form.Input field='a.b' />
                <Form.Input field='a.c' />
                <Form.Input field='a.d' />
            </>
        );
        const props = {
            children: fields,
            getFormApi: api => {
                formApi = api;
            },
        };
        const form = getForm(props);
        formApi.setValue('a', { b: 'semi', c: 'design' });
        let acVal = formApi.getValue('a.c');
        let abVal = formApi.getValue('a.b');
        expect(abVal).toEqual('semi');
        expect(acVal).toEqual('design');
        form.update();

        // check dom render
        expect(getDomValue('a.b', form)).toEqual('semi');
        expect(getDomValue('a.c', form)).toEqual('design');
    });

    it('formApi-setValue with array field path, 0 -> 3', () => {

        const fields = ({ formState, values }) => {

            return values.a && values.a.map((effect, i) => (
                <div key={effect.key}>
                    <Form.Input field={`a[${i}].name`} />
                    <Form.Input field={`a[${i}].type`}  />
                </div>
            ));
        };
        let formApi = null;
        const props = {
            children: fields,
            getFormApi: api => {
                formApi = api;
            },
        };
        const form = getForm(props);
        let targetValue = [
            { name: '0-name', type: '0-type' },
            { name: '1-name', type: '1-type' },
            { name: '2-name', type: '2-type' },
        ];
        formApi.setValue('a', targetValue);
        let formStateValues = formApi.getValue();
        form.update();
        // check dom render
        expect(getDomValue('a[0].name', form)).toEqual('0-name');
        expect(getDomValue('a[0].type', form)).toEqual('0-type');
        expect(getDomValue('a[1].name', form)).toEqual('1-name');
        expect(getDomValue('a[1].type', form)).toEqual('1-type');
        expect(getDomValue('a[2].name', form)).toEqual('2-name');
        expect(getDomValue('a[2].type', form)).toEqual('2-type');
    });

    // // this case result was different in cypress / jest, jest result is wrong
    // it('formApi-setValue with array field path, 3 -> 2, delete some field', done => {
    //     const fields = ({ formState, values }) => {
    //         return values.a && values.a.map((item, i) => (
    //             <div key={item.key} style={{ width: 300 }}>
    //                 <Form.Input field={`a[${i}].name`} />
    //                 <Form.Input field={`a[${i}].type`} />
    //             </div>
    //         ));
    //     };
    //     let formApi = null;
    //     const props = {
    //         children: fields,
    //         initValues: {
    //             a: [
    //                 { name: '0-name', type: '0-type', key: 0 },
    //                 { name: '1-name', type: '1-type', key: 1 },
    //                 { name: '2-name', type: '2-type', key: 2 },
    //             ]
    //         },
    //         getFormApi: api => {
    //             formApi = api;
    //         },
    //     };
    //     let form = getForm(props);
    //     // remove middle one
    //     formApi.setValue('a', [
    //         { name: '0-name', type: '0-type', key: 0 },
    //         { name: '2-name', type: '2-type', key: 2 },
    //     ]);
    //     let formStateValues = formApi.getValue();
    //     form.update();

    //     setTimeout(() => {
    //         // check dom render
    //         expect(getDomValue('a[0].name', form)).toEqual('0-name');
    //         expect(getDomValue('a[0].type', form)).toEqual('0-type');
    //         expect(getDomValue('a[1].name', form)).toEqual('2-name');
    //         expect(getDomValue('a[1].type', form)).toEqual('2-type');

    //         expect(form.exists(`[x-field-id="a[2].name"] input`)).toEqual(false);
    //         expect(form.exists(`[x-field-id="a[2].type"] input`)).toEqual(false);
    //         done();
    //     }, 5000);
    // });

    it('formApi-setValue with array field path, 1 -> 3, add some field', () => {
        const fields = ({ formState, values }) => {
            return values.a && values.a.map((effect, i) => (
                <div key={effect.key}>
                    <Form.Input field={`a[${i}].name`} />
                    <Form.Input field={`a[${i}].type`} />
                </div>
            ));
        };
        let formApi = null;
        const props = {
            children: fields,
            initValues: {
                a: [{ name: 'semi', type: 'design' }]
            },
            getFormApi: api => {
                formApi = api;
            },
        };
        let form = getForm(props);
        formApi.setValue('a', [
            { name: '0-name', type: '0-type' },
            { name: '1-name', type: '1-type' },
            { name: '2-name', type: '2-type' },
        ]);
        let formStateValues = formApi.getValue();
        form.update();
        // check dom render
        expect(getDomValue('a[0].name', form)).toEqual('0-name');
        expect(getDomValue('a[0].type', form)).toEqual('0-type');
        expect(getDomValue('a[1].name', form)).toEqual('1-name');
        expect(getDomValue('a[1].type', form)).toEqual('1-type');
        expect(getDomValue('a[2].name', form)).toEqual('2-name');
        expect(getDomValue('a[2].type', form)).toEqual('2-type');
    });

    // it('formApi-submitForm', () => {
    //     // submit should call validate first
    // });
});
