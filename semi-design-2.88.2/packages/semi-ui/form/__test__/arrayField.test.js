import { Form, ArrayField, Button } from '../../index';
import { IconPlusCircle } from '@douyinfe/semi-icons';

const data = [
    {
        name: 'hzj',
        type: 'rd',
    }, // line 1
    {
        name: 'dc',
        type: 'ued',
    }, // line 2
];
const newLine = {
    name: 'yx',
    type: 'rd',
}; // line 3

function getForm(props) {
    let { formProps = {}, arrayFieldProps = {}, fieldProps = {} } = props;
    const component = (
        <Form
            style={{
                width: 500,
            }}
            {...formProps}
        >
            <ArrayField field="data" {...arrayFieldProps}>
                {({ add, arrayFields, addWithInitValue }) => (
                    <React.Fragment>
                        <Button className="addEmptyLine" onClick={add} icon={<IconPlusCircle />} theme="light">
                            Add Empty Line
                        </Button>
                        <Button
                            className="addLine"
                            onClick={() => {
                                addWithInitValue(newLine);
                            }}
                        >
                            Add line with setting value
                        </Button>
                        {arrayFields.map(({ field, key, remove }, i) => (
                            <div key={key}>
                                <Form.Input field={`${field}[name]`} {...fieldProps} />
                                <Form.Input field={`${field}[type]`} {...fieldProps} />
                                <Button type="danger" onClick={remove} />
                            </div>
                        ))}
                    </React.Fragment>
                )}
            </ArrayField>
        </Form>
    );
    return mount(component);
}

function getNestedArrayFieldDemo() {}

function getFormState(form) {
    return form.instance().formApi.getFormState();
}

function getFieldDom(form, fieldPath) {
    let dom = form.find(`.semi-form-field[x-field-id="${fieldPath}"]`);

    try {
        dom = dom.find('.semi-input');
        return dom.instance().value;
    } catch (error) {
        console.log(error);
    }
}

describe('Form.ArrayField', () => {
    it('declare initValue via ArrayField props', () => {
        let props = {
            formProps: {},
            arrayFieldProps: {
                initValue: data,
            },
            fieldProps: {},
        };
        let form = getForm(props); // check line 1

        let line1Name = getFieldDom(form, 'data[0][name]');
        let line1Type = getFieldDom(form, 'data[0][type]');
        expect(line1Name).toEqual(data[0].name);
        expect(line1Type).toEqual(data[0].type); // check line 2

        let line2Name = getFieldDom(form, 'data[1][name]');
        let line2Type = getFieldDom(form, 'data[1][type]');
        expect(line2Name).toEqual(data[1].name);
        expect(line2Type).toEqual(data[1].type);
        form.unmount();
    });
    it('declare initValue via Form initValues', () => {
        let props = {
            formProps: {
                initValues: {
                    data: data,
                },
            },
            arrayFieldProps: {},
            fieldProps: {},
        };
        let form = getForm(props); // check line 1

        let line1Name = getFieldDom(form, 'data[0][name]');
        let line1Type = getFieldDom(form, 'data[0][type]');
        expect(line1Name).toEqual(data[0].name);
        expect(line1Type).toEqual(data[0].type); // check line 2

        let line2Name = getFieldDom(form, 'data[1][name]');
        let line2Type = getFieldDom(form, 'data[1][type]');
        expect(line2Name).toEqual(data[1].name);
        expect(line2Type).toEqual(data[1].type);
    });
    it('declare initValue via Field props / add line when field props set initValue', () => {
        let props = {
            formProps: {
                initValues: {
                    data: [{}],
                },
            },
            fieldProps: {
                initValue: 'semi',
            },
        };
        let form = getForm(props); // check line 1

        let line1Name = getFieldDom(form, 'data[0][name]');
        let line1Type = getFieldDom(form, 'data[0][type]');
        expect(line1Name).toEqual('semi');
        expect(line1Type).toEqual('semi'); // check line 2 which add by click add button

        let addButton = form.find('.semi-button.addEmptyLine');
        addButton.simulate('click', {});
        let line2Name = getFieldDom(form, 'data[1][name]');
        let line2Type = getFieldDom(form, 'data[1][type]');
        expect(line1Name).toEqual('semi');
        expect(line1Type).toEqual('semi');
    });
    it('ArrayField-basic usage', () => {
        let props = {
            formProps: {
                initValues: {
                    data,
                },
            },
        };
        let form = getForm(props); // Add line 3

        let addButton = form.find('.semi-button.addEmptyLine');
        addButton.simulate('click', {}); // check line 3

        let line3Name = getFieldDom(form, 'data[2][name]');
        let line3Type = getFieldDom(form, 'data[2][type]');
        expect(line3Name).toEqual('');
        expect(line3Type).toEqual(''); // Add line 4

        addButton.simulate('click', {}); // check line 4

        let line4Name = getFieldDom(form, 'data[3][name]');
        let line4Type = getFieldDom(form, 'data[3][type]');
        expect(line4Name).toEqual('');
        expect(line4Name).toEqual(''); // change line 2
        // test current state
        // Remove line 3
        // test current state
        // remove line 1
    });

    // it('formApi-reset, when include ArrayField', () => {
    // });
    it('addWithInitValue', () => {
        // let props = {
        //     formProps: {
        //         initValues: {
        //             data,
        //         },
        //     }
        // };
        // let form = getForm(props);
        // // Add line 3
        // let addButton = form.find('.semi-button.addLine');
        // addButton.simulate('click', {});
        // // check line 3
        // form.update();
        // setTimeout(() => {
        //     let line3Name = getFieldDom(form, 'data[2][name]');
        //     let line3Type = getFieldDom(form, 'data[2][type]');
        //     debugger
        //     expect(line3Name).toEqual(newLine.name);
        //     expect(line3Type).toEqual(newLine.type);
        //     done();
        // }, 1000);
    }); // it('ArrayField-form allowEmpty', () => {
    // });
    // it('formApi setValues rewrite ArrayField', () => {
    // });
    // it('Nested ArrayField', () => {
    // });

});
