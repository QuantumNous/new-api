import { Form, Select, Button } from '../../../index';
import { noop } from 'lodash';
import { BASE_CLASS_PREFIX } from '../../../../semi-foundation/base/constants';

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

const fields = (
    <>
        {FormInput}
        {FormSelect}
    </>
);

describe('Form-onChange', () => {
    // beforeEach(() => {
    //     document.body.innerHTML = '';
    //     // Avoid `attachTo: document.body` Warning
    //     const div = document.createElement('div');
    //     div.setAttribute('id', 'container');
    //     document.body.appendChild(div);
    // });

    // afterEach(() => {
    //     const div = document.getElementById('container');
    //     if (div) {
    //         document.body.removeChild(div);
    //     }
    // });

    // TODO
    // 1、field mounted
    // it('onChange - trigger by field mounted', () => {
    //     const spyOnChange = sinon.spy(() => {});
    //     const props = {
    //         onChange: spyOnChange,
    //     };
    //     const form = getForm(props);
    //     form.setProps({ children: fields });
    // TODO mounted目前不触发form上面的onChange
    //     expect(spyOnChange.called).toEqual(true);
    // });

    // 2、field umounted
    it('onChange - trigger by field unmounted', () => {
        const spyOnChange = sinon.spy(() => {});
        const props = {
            onChange: spyOnChange,
            children: fields,
        };
        const form = getForm(props);
        // unmount 2 field component
        form.setProps({ children: undefined });
        expect(spyOnChange.callCount).toEqual(2);
    });

    // 3、field value changed
    it('onChange - trigger by field value updated internal', () => {
        const spyOnChange = sinon.spy(formState => {});

        const props = {
            onChange: spyOnChange,
            children: <Form.Input field="name" />,
        };
        const form = getForm(props);
        let event = { target: { value: 'semi' } };
        form.find(`.${BASE_CLASS_PREFIX}-input`).simulate('change', event);
        let expectFormState = {
            values: { name: 'semi' },
            errors: {},
            touched: { name: true },
        };
        expect(spyOnChange.callCount).toEqual(1);
        expect(spyOnChange.calledWithMatch(expectFormState)).toBe(true);
    });

    // 4、field error status changed
    it('onChange - trigger by field error status updated internal', done => {
        const spyOnChange = sinon.spy(formState => {});

        const props = {
            onChange: spyOnChange,
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
        form.find(`.${BASE_CLASS_PREFIX}-input`).simulate('change', event);
        let expectFormState = {
            values: { name: 'semi' },
            errors: { name: 'not muji' },
            touched: { name: true },
        };

        // casuse validate is async operation, need to wait
        setTimeout(() => {
            // first called by value change
            expect(spyOnChange.callCount).toEqual(2);
            expect(spyOnChange.lastCall.calledWithMatch(expectFormState)).toEqual(true);
            done();
        }, 300);
    });

    // 5、field touched status changed
    it('onChange - trigger by touched status updated, internal', () => {
        const spyOnChange = sinon.spy(formState => {});

        const props = {
            onChange: spyOnChange,
            children: <Form.Input field="name" />,
        };
        const form = getForm(props);
        let event = {};
        form.find(`.${BASE_CLASS_PREFIX}-input`).simulate('blur', event);
        let expectFormState = {
            values: {},
            errors: {},
            touched: { name: true },
        };
        expect(spyOnChange.calledOnce).toBe(true);
        expect(spyOnChange.calledWithMatch(expectFormState)).toEqual(true);
    });
});
