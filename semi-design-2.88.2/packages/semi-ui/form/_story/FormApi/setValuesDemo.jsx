import React, { useState, useLayoutEffect } from 'react';
import { storiesOf } from '@storybook/react';
import { Button, Modal, TreeSelect, Row, Col, Avatar, TextArea, Select as BasicSelect,
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
import { ComponentUsingFormState, CustomStringify } from '../Hook/hookDemo';
const { Input, Select, DatePicker, Switch, Slider, CheckboxGroup, Checkbox, RadioGroup, Radio, TimePicker, InputNumber, InputGroup } = Form;

class SetValuesDemo extends React.Component {
    constructor() {
        super();
        this.formApi = null;
        this.state = {
            flag: false,
        };
        this.getFormApi = this.getFormApi.bind(this);
        this.change = this.change.bind(this);
    }
    change() {
        let a = this.formApi.getFieldExist('ffff');
        let b = this.formApi.getFieldExist('name');
        this.formApi.setValues({ name: 'nike', notExist: '12' }, { isOverride: true });
        this.setState({ flag: true });
    }
    getFormApi(formApi) {
        this.formApi = formApi;
    }
    render() {
        const { flag } = this.state;
        return (
            <Form getFormApi={this.getFormApi} onChange={v => console.log('onChange', v)} onSubmit={v => console.log('onSubmit', v)}>
                {({ formState }) => (
                    <>
                        <Input field="name" initValue=""></Input>
                        <Select field="familyName" multiple style={{ width: 200 }}>
                            <Select.Option value="mike">Mike</Select.Option>
                            <Select.Option value="jane">Jane</Select.Option>
                            <Select.Option value="kate">Kate</Select.Option>
                        </Select>
                        {/* { flag ? <Input field='notExist' /> : null} */}
                        <Checkbox value="false" field="agree" noLabel={true}>
                            我已阅读并清楚相关规定（Checkbox）
                        </Checkbox>
                        <Button onClick={this.change}>change</Button>
                        <Button htmlType="submit">Submit</Button>
                        <code>{CustomStringify(formState)}</code>
                    </>
                )}
            </Form>
        );
    }
}



class SetValuesWithArrayField extends React.Component {
    constructor() {
        super();
        this.formApi = null;
        this.state = {
            flag: false,
        };
        this.getFormApi = this.getFormApi.bind(this);
        this.change = this.change.bind(this);
    }

    change() {
        let length = Math.floor(Math.random() * 100);
        let newEffect = Array.from({ length }, (v, i) => {
            return { name: Math.random(), type: Math.random() };
        });
        this.formApi.setValues({ name: 'nike', notExist: '12', effects: newEffect }, { isOverride: true });
    }

    getFormApi(formApi) {
        this.formApi = formApi;
    }

    render() {
        const { flag } = this.state;
        return (
            <Form
                getFormApi={this.getFormApi}
                onValueChange={(values, changedValue) => console.log('onValueChange', { values, changedValue })}
                onSubmit={v => console.log(v)}
            >
                {({ formState }) => (
                    <>
                        <ArrayField field='effects' initValue={[]}>
                            {({ add, arrayFields }) => (
                                <React.Fragment>
                                    <Button onClick={add}>Add</Button>
                                    {
                                        arrayFields.map(({ field, key, remove }, i) => (
                                            <div key={key} style={{ width: 1000, display: 'flex' }}>
                                                <Form.Input
                                                    field={`${field}[name]`}
                                                    label={`名称：（${field}.name）`}
                                                    style={{ width: 200, marginRight: 16 }}
                                                >
                                                </Form.Input>
                                                <Form.Input
                                                    field={`${field}[type]`}
                                                    label={`类型：（${field}.type）`}
                                                    style={{ width: 90 }}
                                                >
                                                </Form.Input>
                                                <Button type='danger' onClick={remove} style={{ margin: 16 }}>remove</Button>
                                            </div>
                                        ))
                                    }
                                </React.Fragment>
                            )}
                        </ArrayField>
                        <Button onClick={this.change}>change</Button>
                        <Button htmlType="submit">Submit</Button>
                        <TextArea value={CustomStringify(formState)}></TextArea>
                    </>
                )}
            </Form>
        );
    }
}
export { SetValuesDemo, SetValuesWithArrayField };