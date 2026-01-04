import React, { useState, useLayoutEffect, useRef } from 'react';
import { storiesOf } from '@storybook/react';
import {
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
    Button, Modal, TreeSelect, Row, Col, Avatar, Select as BasicSelect
} from '../../../index';
const { Input, Select, DatePicker, Switch, Slider, CheckboxGroup, Checkbox, RadioGroup, Radio, TimePicker, InputNumber, InputGroup } = Form;

import { IconPlusCircle, IconMinusCircle } from '@douyinfe/semi-icons';

const SetValueUsingParentPath = () => {
    const { Option } = Form.Select;
    const formApi = useRef();
    let arr = [
        { name: '脸部贴纸', type: '2D' },
        { name: '前景贴纸', type: '3D' },
    ];
    const setVal = () => {
        console.log(formApi);
        // formApi.current.setValue('a', { b: '123', d: '456' });
        // formApi.current.setValue('peoples', [1, 2]);
        // formApi.current.setError('peoples', ['not valid', 'same']);
        // formApi.current.setValue('effects', arr);
        formApi.current.setError('effects', [
            { type: 'type error', name: 'name error ' },
            { type: 'type error 2', name: 'name error 2' },
        ]);
    };
    const [menu, setMenu] = useState(arr);
    return (
        <Form layout="horizontal" onValueChange={values => console.log(values)} getFormApi={api => formApi.current = api}>
            <Button onClick={setVal}>set</Button>
            {/* <Form.Input field="c" style={{ width: 80 }} /> */}
            {/* <Form.Input field="peoples[0]" style={{ width: 176 }} /> */}
            {/* <Form.Input field="peoples[1]" style={{ width: 176 }} /> */}
            {/* <Form.Input field="a.b" style={{ width: 176 }} /> */}
            {/* <Form.Input field="a.d" style={{ width: 176 }} /> */}
            <ArrayField field="effects" initValue={arr}>
                {/* <ArrayField field="effects" initValue={[]}> */}
                {({ add, arrayFields, addWithInitValue }) => (
                    <React.Fragment>
                        <Button onClick={add} icon="plus_circle" theme="light">新增空白行</Button>
                        <Button
                            icon={<IconPlusCircle></IconPlusCircle>} onClick={() => {
                                addWithInitValue({ name: '自定义贴纸', type: '2D' });
                            }} style={{ marginLeft: 8 }}>新增带有初始值的行
                        </Button>
                        {
                            arrayFields.map(({ field, key, remove }, i) => (
                                <div key={key} style={{ width: 1000, display: 'flex' }}>
                                    <Form.Input
                                        field={`${field}[name]`}
                                        label={`特效类型：（${field}.name）`}
                                        style={{ width: 200, marginRight: 16 }}
                                    />
                                    <Form.Input
                                        field={`${field}[type]`}
                                        label={`素材类型：（${field}.type）`}
                                        style={{ width: 90 }}
                                    />
                                    <Button type="danger" theme="borderless" icon={<IconMinusCircle></IconMinusCircle>} onClick={remove} style={{ margin: 12 }} />
                                </div>
                            ))
                        }
                    </React.Fragment>
                )}
            </ArrayField>
        </Form>
    );
};

export { SetValueUsingParentPath };