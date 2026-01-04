import React, { useState, useLayoutEffect, Component } from 'react';
import { storiesOf } from '@storybook/react';
import { Button, Modal, TreeSelect, Row, Col, Avatar, Icon, Select as BasicSelect,
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
    Collapse } from '../../../index';
import { ComponentUsingFormState } from '../Hook/hookDemo';
const { Input, Select, DatePicker, Switch, Slider, CheckboxGroup, Checkbox, RadioGroup, Radio, TimePicker, InputNumber, InputGroup } = Form;
const plainOptions = ['Apple', 'Pear', 'Orange'];


const { Option } = Select;
const { Label } = Form;
const { Section } = Form;

// wrapperCol, labelCol
class LayoutDemo extends React.Component {
    constructor() {
        super();
        this.state = {
            labelPosition: 'left',
            labelAlign: 'left',
            // labelWidth: '180px'
        };
        this.changeLabelPos = this.changeLabelPos.bind(this);
        this.changeLabelAlign = this.changeLabelAlign.bind(this);
    }

    changeLabelPos(labelPosition) {
        let labelWidth;
        // labelPosition === 'left' ? labelWidth = '180px' : labelWidth = 'auto';
        this.setState({ labelPosition, labelWidth });
    }

    changeLabelAlign(labelAlign) {
        this.setState({ labelAlign });
    }

    setValues() {
        this.formApi.setValues({

        });
    }

    render() {
        const { labelPosition, labelAlign, labelWidth } = this.state;
        return (
            <>
                <div>
                    <Label style={{ marginLeft: 10 }}>lablPosition:</Label>
                    <BasicSelect onChange={this.changeLabelPos} value={labelPosition}>
                        <Select.Option value="top">top</Select.Option>
                        <Select.Option value="left">left</Select.Option>
                    </BasicSelect>
                    <Label style={{ marginLeft: 10 }}>lablAlign:</Label>
                    <BasicSelect onChange={this.changeLabelAlign} value={labelAlign}>
                        <Select.Option value="left">left</Select.Option>
                        <Select.Option value="right">right</Select.Option>
                    </BasicSelect>
                </div>
                <hr />
                <Form
                    labelPosition={labelPosition}
                    labelWidth={labelWidth}
                    labelAlign={labelAlign}
                    labelCol={{ span: 6 }}
                    wrapperCol={{ span: 18 }}
                    onChange={formState => console.log(formState)}
                    onValueChange={formState => console.log(formState)}
                    style={{ padding: '10px', width: 600 }}>
                    <Form.Input
                        field="input"
                        label="我是label阿"
                        trigger="blur"
                        rules={[
                            { required: true, message: 'required error' },
                            { type: 'string', message: 'type error' },
                            { validator: (rule, value) => value === 'muji', message: 'not muji' }
                        ]}
                    />
                    <Form.Switch field="agree" />
                    <Form.InputNumber field="price" />
                    <Form.Select field="name" style={{ width: 300 }}>
                        <Option value="mike">mike</Option>
                        <Option value="jane">jane</Option>
                        <Option value="kate">kate</Option>
                    </Form.Select>
                    <Form.CheckboxGroup field="role">
                        <Form.Checkbox value="admin">管理员admin</Form.Checkbox>
                        <Form.Checkbox value="user">用户user</Form.Checkbox>
                        <Form.Checkbox value="guest">访客guest</Form.Checkbox>
                        <Form.Checkbox value="root">根用户root</Form.Checkbox>
                    </Form.CheckboxGroup>
                    <Form.Checkbox useOutSideGroup field="root">root</Form.Checkbox>
                    <Form.RadioGroup field="sex" name="apple">
                        <Form.Radio value="1">man</Form.Radio>
                        <Form.Radio value="2">woman</Form.Radio>
                    </Form.RadioGroup>
                    <Form.Slot label={{ text: 'texxt', required: true }}>
                        <div>slot</div>
                    </Form.Slot>
                    <Form.InputGroup label='group text' style={{ width: 600 }}>
                        <Form.Input field='inGroupName' style={{ width: 200 }}></Form.Input>
                        <Form.Input field='inGroupType' style={{ width: 390 }}></Form.Input>
                    </Form.InputGroup>
                </Form>
            </>
        );
    }
}

class InsetLabelDemo extends React.Component {
    constructor(props) {
        super();
        this.state = {
            labelPosition: 'left',
            labelAlign: 'left',
            // labelWidth: '180px'
        };
        this.changeLabelPos = this.changeLabelPos.bind(this);
        this.changeLabelAlign = this.changeLabelAlign.bind(this);
    }


    changeLabelPos(labelPosition) {
        let labelWidth;
        // labelPosition === 'left' ? labelWidth = '180px' : labelWidth = 'auto';
        this.setState({ labelPosition, labelWidth });
    }

    changeLabelAlign(labelAlign) {
        this.setState({ labelAlign });
    }

    render() {
        const { labelPosition, labelAlign } = this.state;

        return (
            <Form
                labelPosition={'inset'}
                labelCol={{ span: 6 }}
                wrapperCol={{ span: 18 }}
                onChange={formState => console.log(formState)}
                onValueChange={formState => console.log(formState)}
                style={{ padding: '10px', width: 600 }}>
                <Form.Input
                    field="input"
                />
                <Form.InputNumber field="price" />
                <Form.DatePicker field="date" placeholder="请选择日期时间范围" />
                <Form.TimePicker field="time" />
                <Form.Slot label={{ text: 'texxt', required: true }}>
                    <div>slot</div>
                </Form.Slot>
            </Form>
        );
    }
}

class LayoutForm extends React.Component {
    constructor() {
        super();
        this.state = {
            filed: {},
            layout: 'vertical',
            labelPosition: 'top',
            // horizontal
        };
        this.getFormApi = this.getFormApi.bind(this);
        this.changeLayout = this.changeLayout.bind(this);
        this.changeLabelPos = this.changeLabelPos.bind(this);
    }

    changeLayout(layout) {
        this.setState({ layout });
    }

    changeLabelPos(labelPosition) {
        this.setState({ labelPosition });
    }

    changeInput() {
        this.formApi.setValue('input', Math.random());
    }

    getFormApi(formApi) {
        this.formApi = formApi;
    }

    render() {
        const { field } = this.state;
        const { layout, labelPosition } = this.state;
        return (
            <>
                <div>
                    <BasicSelect onChange={this.changeLayout} value={layout}>
                        <BasicSelect.Option value="vertical">vertical</BasicSelect.Option>
                        <BasicSelect.Option value="horizontal">horizontal</BasicSelect.Option>
                    </BasicSelect>
                    <BasicSelect onChange={this.changeLabelPos} value={labelPosition}>
                        <BasicSelect.Option value="top">top</BasicSelect.Option>
                        <BasicSelect.Option value="left">left</BasicSelect.Option>
                    </BasicSelect>
                </div>
                <Form
                    layout={layout}
                    labelPosition={labelPosition}
                    labelWidth={'auto'}
                    getFormApi={this.getFormApi}
                    style={{ padding: '10px' }}>
                    <Row>
                        <Col span={6}>
                            <Input
                                field="input"
                                label="我是label阿"
                                style={{ width: '250px' }}
                                trigger="blur"
                                rules={[
                                    { required: true, message: 'required error' },
                                    { type: 'string', message: 'type error' },
                                    { validator: (rule, value) => value === 'muji', message: 'not muji' }
                                ]}
                            />
                        </Col>
                        <Col span={6}>
                            <Switch field="switch" />
                        </Col>
                        <Col span={6}>
                            <InputNumber field="number" />
                        </Col>
                        <Col span={6}>
                            <Select field="select">
                                <Option value="mike">mike</Option>
                                <Option value="jane">jane</Option>
                                <Option value="kate">kate</Option>
                            </Select>
                        </Col>
                    </Row>
                    <Row>
                        <Col span={6}>
                            <Select
                                field="peoples"
                                multiple
                                label="Select [multiple]"
                                rules={[
                                    { type: 'array', min: 1, max: 3, messag: 'peoples errors' }
                                ]}
                            >
                                <Option value="a">a</Option>
                                <Option value="b">b</Option>
                                <Option value="c">c</Option>
                                <Option value="d">d</Option>
                                <Option value="e">e</Option>
                            </Select>
                        </Col>
                        <Col span={6}>
                            <CheckboxGroup options={plainOptions} field="checkbox" />
                        </Col>
                        <Col span={6}>
                            <CheckboxGroup
                                field="role"
                                rules={[
                                    { required: true }
                                ]}
                            >
                                <Checkbox value="admin">admin</Checkbox>
                                <Checkbox value="user">user</Checkbox>
                                <Checkbox value="guest">guest</Checkbox>
                                <Checkbox value="root">root</Checkbox>
                            </CheckboxGroup>
                        </Col>
                    </Row>
                    <Row>
                        <Col span={12}>
                            <Button type="primary" htmlType="submit">
                                Submit
                            </Button>
                            <Button htmlType="reset">reset</Button>
                            <Button onClick={this.changeInput.bind(this)}>change Input</Button>
                            <ComponentUsingFormState />
                        </Col>
                    </Row>
                </Form>
            </>
        );
    }
}

export { LayoutDemo, InsetLabelDemo };
