import React, { useState, useLayoutEffect, useEffect, useRef } from 'react';
import { storiesOf } from '@storybook/react';
import { Button, Modal, TreeSelect, Row, Col, Avatar, Tabs, TabPane, Badge } from '@douyinfe/semi-ui';
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
} from '../../index';

import {
    UseFormApiDemo,
    UseFormStateDemo,
    UseFieldApiDemo,
    UseFieldStateDemo,
    WithFormStateDemo,
    WithFormApiDemo,
    ComponentUsingFormState,
    CustomStringify
} from '../Hook/hookDemo';
const { Input, Select, DatePicker, Switch, Slider, CheckboxGroup, Checkbox, RadioGroup, Radio, TimePicker } = Form;

const FieldRefDemo = () => {
    const fieldRef = useRef(null);
    const inputRef = useRef(null);
    const [open, setOpen] = useState(false);

    const onChange = () => {
        console.log(fieldRef);
        if (open) {
            fieldRef.current && fieldRef.current.close();
            setOpen(false);
        } else {
            fieldRef.current && fieldRef.current.open();
            setOpen(true);
        }
    };

    const focus = () => {
        inputRef.current && inputRef.current.focus();
    };

    return (
        <Form>
            <Form.Input
                field="name"
                label="名称"
                ref={inputRef}
                rules={[
                    { required: true, message: 'required error' },
                    { type: 'string', message: 'type error' },
                    { validator: (rule, value) => value === 'muji', message: 'not muji' }
                ]}
            />
            <Button onClick={onChange}>toggleOpen</Button>
            <Button onClick={focus}>focus Input</Button>
            <Form.Select field="role" label="角色" placeholder="请选择你的角色" ref={fieldRef}>
                <Form.Select.Option value="operate">运营</Form.Select.Option>
                <Form.Select.Option value="rd">开发</Form.Select.Option>
                <Form.Select.Option value="pm">产品</Form.Select.Option>
                <Form.Select.Option value="ued">设计</Form.Select.Option>
            </Form.Select>
        </Form>
    );
};

export { FieldRefDemo };