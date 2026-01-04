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


import { cloneDeepWith, cloneDeep } from 'lodash';

import { ComponentUsingFormState } from '../Hook/hookDemo';
const { Input, Select, DatePicker, Switch, Slider, CheckboxGroup, Checkbox, RadioGroup, Radio, TimePicker, InputNumber, InputGroup } = Form;

const Option = Select.Option;

class ManyFieldDemo extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            fields: Array.from({ length: 100 }, (v, i) => i + 1),
        };
        this.formApi = null;
        this.getFormApi = this.getFormApi.bind(this);
        this.validate = this.validate.bind(this);
        this.scroll = this.scroll.bind(this);
    }

    getFormApi(formApi) {
        this.formApi = formApi;
    }

    validate() {
        let begin = new Date().valueOf();
        let end, time;
        this.formApi
            .validate()
            .then(values => {
                end = new Date().valueOf();
                time = (end - begin) / 1000;
                console.log(`validate用时:${ time }s`);
                // debugger
            })
            .catch(err => {
                end = new Date().valueOf();
                time = (end - begin) / 1000;
                console.log(`validate用时:${ time }s`);
                // debugger
            });
    }

    scroll() {
        let targetIndex = Math.floor(Math.random() * 100);
        Toast.info(`${targetIndex }`);
        this.formApi.scrollToField(`No${targetIndex}`);
    }

    renderFields() {
        const { fields } = this.state;

        return fields.map(item => (
            <Form.Input
                key={`No${item}`}
                field={`No${item}`}
                rules={[
                    { required: true, message: 'required error' },
                    {
                        pattern: /^[a-zA-Z0-9_]+$/,
                        message: '限制输入字符为：a-z, A-Z, 0-9, _',
                    },
                ]}
            />
        ));
    }
    render() {
        let fields = this.renderFields();
        return (
            <Form getFormApi={this.getFormApi}>
                <ComponentUsingFormState />
                <div style={{ height: 500, overflow: 'scroll' }}>{fields}</div>
                <Button onClick={this.validate}>validate</Button>
                <Button onClick={this.scroll}>scroll</Button>
                <Button htmlType="reset">reset</Button>
                <Button htmlType="submit">submit</Button>
            </Form>
        );
    }
}

let initEmploy = [
    {
        id: 2229,
        name: '马一',
        username: 'mayi',
        departmentId: '2879712',
        departmentName: 'Data云',
        employeeNumber: 18396181,
    },
    {
        id: 280,
        name: '马会',
        username: 'mahu',
        departmentId: '64976063',
        departmentName: '公司架',
        employeeNumber: 712323,
    },
    {
        id: 324,
        name: '马3克',
        username: 'ma2ke',
        departmentId: '288980096081',
        departmentName: '头条-量',
        employeeNumber: 5735271,
    },
    {
        id: 3632,
        name: '海波',
        username: 'menibo',
        departmentId: '2889875',
        departmentName: '会作组',
        employeeNumber: 37380,
    },
    {
        id: 4905,
        name: '马列',
        username: 'memin',
        departmentId: '2889801404',
        departmentName: '头学习',
        employeeNumber: 6079433,
    },
    {
        id: 7353,
        name: '马3立',
        username: 'ma3nli',
        departmentId: '2881335',
        departmentName: 'Data研发',
        employeeNumber: 103343,
    },
    {
        id: 467,
        name: '孟',
        username: 'myu',
        departmentId: '28837',
        departmentName: '垂直',
        employeeNumber: 13,
    },
    {
        id: 2129,
        name: '马一3',
        username: 'myi',
        departmentId: '28712',
        departmentName: 'Data云',
        employeeNumber: 196181,
    },
    {
        id: 2830,
        name: '马会4',
        username: 'mahu',
        departmentId: '649476063',
        departmentName: '公司架',
        employeeNumber: 7132323,
    },
    {
        id: 3244,
        name: '马32克',
        username: 'ma24ke',
        departmentId: '2889820096081',
        departmentName: '头条-量',
        employeeNumber: 57345271,
    },
    {
        id: 36372,
        name: '海波',
        username: 'men9ibo',
        departmentId: '28689875',
        departmentName: '会作组',
        employeeNumber: 377380,
    },
    {
        id: 49405,
        name: '马列',
        username: 'memin',
        departmentId: '28896801404',
        departmentName: '头学习',
        employeeNumber: 60679433,
    },
    {
        id: 73553,
        name: '马3立',
        username: 'ma3nli',
        departmentId: '28816335',
        departmentName: 'Data研发',
        employeeNumber: 1073343,
    },
    {
        id: 4657,
        name: '孟',
        username: 'myu',
        departmentId: '288437',
        departmentName: '垂直',
        employeeNumber: 134,
    },
];
class EffectDemo extends React.Component {
    constructor() {
        super();
        this.state = {
            employees: [],
        };
    }

    onSearchEmployee = () => {
        this.setState({ employees: initEmploy });
    };

    renderMultipleSelectedItem = optionNode => {
        let content = <div>{optionNode.name}</div>;
        return {
            isRenderInTag: true,
            content,
        };
    };

    renderEmployeeOption = item => {
        const optionStyle = {
            display: 'flex',
            width: 334,
        };
        return (
            <Option key={item.id} value={item.id} style={optionStyle} showTick={false} {...item}>
                <Avatar src={item.avatarUrl} color={item.color} size="small">
                    {item.abbr}
                </Avatar>
                <p className="option-employee-name">{item.name}</p>
                <p className="option-department-name">{item.departmentName}</p>
            </Option>
        );
    };

    render() {
        const { employees } = this.state;
        return (
            <Form>
                <Select
                    field="owner"
                    filter
                    remote
                    onSearch={this.onSearchEmployee}
                    label="项目负责人"
                    placeholder="请搜索并选择项目负责人"
                    onChangeWithObject={true}
                    style={{ width: 340 }}
                    rules={[{ required: true, message: '字段不能为空' }]}
                    renderSelectedItem={optionNode => (
                        <>
                            <span className="option-employee-name">{optionNode.name}</span>
                            <span className="option-department-name">{optionNode.departmentName}</span>
                        </>
                    )}
                >
                    {employees.map(item => this.renderEmployeeOption(item))}
                </Select>

                <Select
                    field="informedOwner"
                    filter
                    multiple
                    remote
                    max={5}
                    style={{ width: 340 }}
                    onSearch={this.onSearchEmployee}
                    label={(
                        <span>
                            项目知会人<span className="optional-label">(选填)</span>
                        </span>
                    )}
                    placeholder="知会人可了解项目信息和进度 (最多五人)"
                    // onChangeWithObject={true}
                    renderSelectedItem={this.renderMultipleSelectedItem}
                >
                    {employees.map(item => this.renderEmployeeOption(item))}
                </Select>
                <Select
                    field="relatedOwner"
                    filter
                    remote
                    multiple
                    max={3}
                    style={{ width: 340 }}
                    onSearch={this.onSearchEmployee}
                    // onChangeWithObject={true}
                    label={(
                        <span>
                            相关负责人<span className="optional-label">(选填)</span>
                        </span>
                    )}
                    placeholder="相关负责人与负责人拥有同等权限 (最多三人)"
                    renderSelectedItem={this.renderMultipleSelectedItem}
                >
                    {employees.map(item => this.renderEmployeeOption(item))}
                </Select>
            </Form>
        );
    }
}




// Form.Select 开启onChangeWithObject时，外部在modal打开关闭时调用formApi.setValues

class ModalFormSelectWithObject extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            visible: false,
        };
        this.showDialog = this.showDialog.bind(this);
        this.handleOk = this.handleOk.bind(this);
        this.handleCancel = this.handleCancel.bind(this);
        this.getFormApi = this.getFormApi.bind(this);
    }

    showDialog() {
        // let values = this.formApi.getValues();
        this.formApi && this.formApi.getValues();
        this.setState({ visible: true });
    }

    handleOk() {
        // this.formApi.validate()
        //     .then((values) => {
        //         console.log(values)
        //     })
        //     .catch((errors) => {
        //         console.log(errors)
        //     });
    }

    handleCancel() {
        let start = new Date().valueOf();
        let values = this.formApi.getValues();
        let end = new Date().valueOf();
        console.log(values);
        values.region = '123';
        let newvalues = this.formApi.getValues();
        console.log(newvalues);
        console.log(end - start);
        this.setState({ visible: false });
    }

    getFormApi(formApi) {
        this.formApi = formApi;
    }

    renderOption() {
        const list = [
            { value: 'semi', label: 'Semi', c: { arr: [2] } },
            { value: 'hotsoon', label: '火山小视频', c: { arr: [3] } },
            { value: 'pipixia', label: '皮皮虾', c: { arr: [4] } },
            { value: 'toutiao', label: '今日头条', c: { arr: [5] } },
        ];
        return list.map(item => (
            <Select.Option value={item.value} key={item.label} c={item.c}>
                <div>
                    {item.label}
                    <div>random string</div>
                    <div>{Math.random()}</div>
                </div>
            </Select.Option>
        ));
    }

    render() {
        const { visible } = this.state;
        let message = '该项为必填项';
        return (
            <>
                <Button onClick={this.showDialog}>打开弹窗</Button>
                <Modal
                    title="新建"
                    visible={visible}
                    onOk={this.handleOk}
                    onCancel={this.handleCancel}
                >
                    <Form
                        getFormApi={this.getFormApi}
                    >
                        <Row>
                            <Col span={6}>
                                <Form.Select
                                    field="region"
                                    onChange={object => this.change(object)}
                                    label="国家/地区"
                                    placeholder="请选择"
                                    onChangeWithObject
                                    style={{ width: 100 }}
                                    rules={[
                                        { required: true, message },
                                    ]}
                                >
                                    {this.renderOption()}
                                </Form.Select>
                            </Col>
                            <Col span={6}>
                                <Form.Select
                                    field="area"
                                    label="投放区域"
                                    placeholder="请选择"
                                    onChangeWithObject
                                    style={{ width: 100 }}
                                    rules={[
                                        { required: true, message },
                                    ]}
                                >
                                    <Select.Option value="China">中国</Select.Option>
                                    <Select.Option value="US">美国</Select.Option>
                                    <Select.Option value="Europe">欧洲</Select.Option>
                                    <Select.Option value="Japan">日本</Select.Option>
                                </Form.Select>
                            </Col>

                        </Row>
                    </Form>
                </Modal>
            </>
        );
    }
}

export { ManyFieldDemo, EffectDemo, ModalFormSelectWithObject };