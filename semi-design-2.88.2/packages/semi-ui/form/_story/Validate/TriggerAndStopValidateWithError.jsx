import React, { useState, useLayoutEffect, Component } from 'react';
import { storiesOf } from '@storybook/react';
import { Button, Modal, TreeSelect, Row, Col, Avatar, Toast, Select as BasicSelect,
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
    Icon } from '../../../index';

import { ComponentUsingFormState } from '../Hook/hookDemo';
const { Input, Select, DatePicker, Switch, Slider, CheckboxGroup, Checkbox, RadioGroup, Radio, TimePicker, InputNumber, InputGroup } = Form;

const FieldLevelTriggerDemo = () => {
    const initValues = {
        name: 'semi',
        role: 'rd'
    };
    
    const style = { width: '100%' };
    
    const { Select, Input } = Form;

    return (
        <Form initValues={initValues}>
            <Form.Section text='FieldLevelTrigger'>
                <Input
                    field="system"
                    label='trigger=change(default)'
                    style={style}
                    rules={[
                        { required: true, message: 'required error' },
                        { type: 'string', message: 'type error' },
                        { validator: (rule, value) => value === 'semi', message: 'should be semi' }
                    ]}
                />
                <Input
                    field="name"
                    label='trigger=blur'
                    style={style}
                    trigger='blur'
                    rules={[
                        { required: true, message: 'required error' },
                        { type: 'string', message: 'type error' },
                        { validator: (rule, value) => value === 'semi', message: 'should be semi' }
                    ]}
                />
                <Input
                    field="both"
                    label='trigger=blur & change'
                    style={style}
                    trigger={['blur', 'change']}
                    rules={[
                        { required: true, message: 'required error' },
                        { type: 'string', message: 'type error' },
                        { validator: (rule, value) => value === 'semi', message: 'should be semi' }
                    ]}
                />
                <Input
                    field="role"
                    label='trigger=mount'
                    style={style}
                    trigger='mount'
                    rules={[
                        { required: true, message: 'required error' },
                        { type: 'string', message: 'type error' },
                        { validator: (rule, value) => value === 'semi', message: 'should be semi' }
                    ]}
                />
                <Button htmlType='submit'>提交</Button>
                <Button htmlType='reset'>reset</Button>
            </Form.Section>
        </Form>
    );
};

const FormLevelTriggerDemo = () => {
    const initValues = {
        name: 'semi',
        role: 'rd'
    };
    
    const style = { width: '100%' };
    
    const { Select, Input } = Form;

    return (
        <Form initValues={initValues} trigger='blur'>
            <Form.Section text='FormLevelTrigger blur'>
                <Input
                    field="name"
                    style={style}
                    label='fieldTrigger=change'
                    trigger='change'
                    rules={[
                        { required: true, message: 'required error' },
                        { type: 'string', message: 'type error' },
                        { validator: (rule, value) => value === 'semi', message: 'should be semi' }
                    ]}
                />
                <Input
                    field="role"
                    label="fieldTrigger unset (default)"
                    style={style}
                    rules={[
                        { required: true, message: 'required error' },
                        { type: 'string', message: 'type error' },
                        { validator: (rule, value) => value === 'semi', message: 'should be semi' }
                    ]}
                />
                <Input
                    field="custom"
                    label="fieldTrigger=custom"
                    trigger='custom'
                    style={style}
                    rules={[
                        { required: true, message: 'required error' },
                        { type: 'string', message: 'type error' },
                        { validator: (rule, value) => value === 'semi', message: 'should be semi' }
                    ]}
                />
                <Input
                    field="both"
                    label="fieldTrigger=mount & custom"
                    trigger={['custom', 'mount']}
                    style={style}
                    rules={[
                        { required: true, message: 'required error' },
                        { type: 'string', message: 'type error' },
                        { validator: (rule, value) => value === 'semi', message: 'should be semi' }
                    ]}
                />
                <Button htmlType='submit'>提交</Button>
                <Button htmlType='reset'>reset</Button>
            </Form.Section>
        </Form>
    );
};

const FieldStopDemo = () => {
    const initValues = {
        name: 'semi',
        role: 'rd'
    };
    
    const style = { width: '100%' };
    
    const { Select, Input } = Form;

    return (
        <Form initValues={initValues}>
            <Form.Section text='Field Stop=true'>
                <Input
                    field="name"
                    style={style}
                    label='field stop=true'
                    stopValidateWithError
                    rules={[
                        { required: true, message: 'required error' },
                        { validator: (rule, value) => value === 'semi', message: 'should be semi' },
                        { validator: (rule, value) => value.startsWith('s'), message: 'should startwith s' },
                    ]}
                />
                <Input
                    field="role"
                    style={style}
                    label='field stop default (false)'
                    rules={[
                        { required: true, message: 'required error' },
                        { validator: (rule, value) => value === 'semi', message: 'should be semi' },
                        { validator: (rule, value) => value && value.startsWith('s'), message: 'should startwith s' },
                    ]}
                />
                <Button htmlType='submit'>提交</Button>
                <Button htmlType='reset'>reset</Button>
            </Form.Section>
        </Form>
    );
};

const FormStopDemo = () => {

    const style = { width: '100%' };
    
    const { Select, Input } = Form;

    return (
        <Form stopValidateWithError>
            <Form.Section text='Form Stop=true'>
                <Input
                    field="name"
                    style={style}
                    label='field stop default (false)'
                    rules={[
                        { required: true, message: 'required error' },
                        { validator: (rule, value) => value === 'semi', message: 'should be semi' },
                        { validator: (rule, value) => value.startsWith('s'), message: 'should startwith s' },
                    ]}
                />
                <Input
                    field="role"
                    style={style}
                    label='field stop default (false)'
                    rules={[
                        { required: true, message: 'required error' },
                        { validator: (rule, value) => value === 'semi', message: 'should be semi' },
                        { validator: (rule, value) => value && value.startsWith('s'), message: 'should startwith s' },
                    ]}
                />
                <Input
                    field="role"
                    style={style}
                    stopValidateWithError={false}
                    label='field stop false'
                    rules={[
                        { required: true, message: 'required error' },
                        { validator: (rule, value) => value === 'semi', message: 'should be semi' },
                        { validator: (rule, value) => value && value.startsWith('s'), message: 'should startwith s' },
                    ]}
                />
                <Button htmlType='submit'>提交</Button>
                <Button htmlType='reset'>reset</Button>
            </Form.Section>
        </Form>
    );
};

const TriggerDemo = () => {
    return (
        <>
            <FieldLevelTriggerDemo></FieldLevelTriggerDemo>
            <FormLevelTriggerDemo></FormLevelTriggerDemo>
            <FieldStopDemo></FieldStopDemo>
            <FormStopDemo></FormStopDemo>
        </>
    );
};

export { TriggerDemo };