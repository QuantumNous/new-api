import React, { useState, useLayoutEffect, Component } from 'react';
import { storiesOf } from '@storybook/react';
import { Button, Modal, TreeSelect, Row, Col, Avatar, Select as BasicSelect,
    Form,
    useFormState,
    useFormApi,
    useFieldApi,
    useFieldState,
    withFormState,
    withFormApi,
    withField,
    ArrayField,
    AutoComplete,
    Collapse,
    Icon,
} from '../../../index';
const { Input, Select, DatePicker, Switch, Slider, CheckboxGroup, Checkbox, RadioGroup, Radio, TimePicker, InputNumber, InputGroup } = Form;

const UseFormApiDemo = () => {
    return (
        <Form>
            <Form.Input field="name" initValue="mike"></Form.Input>
            <ArrayField field="arrays" initValue={[]}>
                {({ add, arrayFields }) => (
                    <React.Fragment>
                        <Button onClick={add}>Add</Button>
                        {arrayFields.map(({ field, key, remove }, i) => (
                            <div key={key} style={{ width: 1000, display: 'flex' }}>
                                <Form.Input
                                    field={`${field}[name]`}
                                    label={`name：（${field}.name）`}
                                    style={{ width: 200, marginRight: 16 }}
                                ></Form.Input>
                                <Form.Input
                                    field={`${field}[type]`}
                                    label={`type：（${field}.type`}
                                    style={{ width: 200, marginRight: 16 }}
                                ></Form.Input>
                                {/* <Form.Select
                                            field={`${field}[type]`}
                                            label={`素材类型：（${field}.type）`}
                                            style={{width: 90}}
                                        >
                                            <Form.Select.Option value='2D'>2D</Form.Select.Option>
                                            <Form.Select.Option value='3D'>3D</Form.Select.Option>
                                        </Form.Select> */}
                                <Button type="danger" onClick={remove} style={{ margin: 16 }}>
                                    remove
                                </Button>
                            </div>
                        ))}
                    </React.Fragment>
                )}
            </ArrayField>
            <ComponentUsingFormApi />
            <ComponentUsingFormState />
        </Form>
    );
};

const CustomStringify = values => {
    return JSON.stringify(
        values, 
        (k, v) => (v === undefined ? '__undefined' : v), 
        2
    ).replace(
        '"__undefined"',
        'undefined'
    );
};


const ComponentUsingFormApi = () => {
    const formApi = useFormApi();
    const [count, setCount] = useState(0);
    const change = () => {
        let value0 = {
            name: 'mikeyyaya',
            cc: 'adele',
            arrays: [
                { name: 1, type: '1' },
                { name: 2, type: '2' },
            ],
        };
        formApi.setValues(value0, { isOverride: true });
    };
    const change2 = () => {
        let value2 = {
            // name: '2',
            // cc: 'mike',
            arrays: [],
        };
        formApi.setValues(value2, { isOverride: true });
    };

    return (
        <>
            <Button onClick={change}>ChangeName By【formApi】</Button>
            <Button onClick={change2}>Change 2</Button>
        </>
    );
};

 

// const ComponentUsingFormState = () => {
//     const formState = useFormState();
//     return (
//         <pre>
//             <code style={{ wordBreak: 'break-all', width: 600, whiteSpace: 'normal' }}>{JSON.stringify(formState)}</code>
//             {/* <code style={{wordBreak:'break-all', width: 600, whiteSpace: 'normal'}}>{CustomStringify(formState)}</code> */}
//         </pre>
//     );
// };
/** */
const ComponentUsingFormState = () => {
    const formState = useFormState();
    return (
        <div 
            style={{
                backgroundColor: '#f4f4f4',
                borderRadius: '8px',
                padding: '16px',
                border: '1px solid #e0e0e0',
                margin: '16px 0',
            }}
        >
            <pre>
                <code 
                    style={{ 
                        fontSize: '14px',
                        lineHeight: '1.5',
                        color: '#333',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all'
                    }}
                >
                    {JSON.stringify(formState, null, 2)}
                </code>
            </pre>
        </div>
    );
};

const UseFormStateDemo = () => {
    return (
        <Form>
            <Input field="name" initValue="nike" />
            <h5>FormState read by 【useFormState】：</h5>
            <ComponentUsingFormState />
        </Form>
    );
};

const ComponentUsingFieldApi = () => {
    const nameFieldApi = useFieldApi('name');
    const change = () => {
        nameFieldApi.setValue(Math.random());
    };
    return <Button onClick={change}>changeNameBy【fieldApi】</Button>;
};
const UseFieldApiDemo = () => {
    return (
        <Form>
            <Form.Input field="name"></Form.Input>
            <ComponentUsingFieldApi />
        </Form>
    );
};

const ComponentUsingFieldState = props => {
    const fieldState = useFieldState(props.field);
    return (
        <pre>
            <code>{CustomStringify(fieldState)}</code>
        </pre>
    );
};
const UseFieldStateDemo = () => {
    return (
        <Form>
            <Form.Input field="name" initValue="mike"></Form.Input>
            <h5> 【name】FieldState read by 【useFieldState】：</h5>
            <ComponentUsingFieldState field="name" />
            <Form.Input field="country" initValue="china"></Form.Input>
            <h5> 【country】FieldState read by 【useFieldState】：</h5>
            <ComponentUsingFieldState field="country" />
        </Form>
    );
};


const WithFormStateDemo = () => {
    const SomeComponent = props => <code>{CustomStringify(props.formState)}</code>;
    const ComponentWithFormState = withFormState(SomeComponent);
    return (
        <Form>
            <Form.Input field="name" initValue="steve"></Form.Input>
            <Form.Input field="familyName" initValue="jobs"></Form.Input>
            <Button htmlType="submit">submit</Button>
            <ComponentWithFormState />
        </Form>
    );
};

const WithFormApiDemo = () => {
    const SomeComponet = props => (
        <Button
            onClick={() => {
                props.formApi.setValue('name', Math.random());
            }}
        >
            ChangeName By【formApi】
        </Button>
    );
    const ComponentWithFormApi = withFormApi(SomeComponet);
    return (
        <Form>
            <Input field="name" initValue="mike"></Input>
            <Button htmlType="submit">submit</Button>
            <ComponentWithFormApi />
        </Form>
    );
};

export { UseFormApiDemo, UseFormStateDemo, UseFieldApiDemo, UseFieldStateDemo, WithFormStateDemo, WithFormApiDemo, ComponentUsingFormState, CustomStringify };