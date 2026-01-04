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
} from '../../../index';
import { format } from 'date-fns';
import { ComponentUsingFormState } from '../Hook/hookDemo';
const { Input, Select, DatePicker, Switch, Slider, CheckboxGroup, Checkbox, RadioGroup, Radio, TimePicker, InputNumber, InputGroup } = Form;

class NestArrayField extends React.Component {
    constructor() {
        super();
        this.state = {
            data: {
                group: [
                    {
                        name: '0',
                        // name: '0', items: [ { itemName: 'form', type: '0-1' } ],
                    },
                    // {
                    //     name: '1', items: [ { itemName: 'form', type: '1-1' } ],
                    // }
                ],
            },
            flag: true
        };
        this.getFormApi = this.getFormApi.bind(this);
        this.change = this.change.bind(this);
    }

    change = () => {
        let number = this.formApi.getValue('number');
        let newData = {
            group: [
                { name: Math.random().toString().slice(0, 3), items: [ { itemName: Math.random(), type: '0-1' } ] },
                // { name: Math.random(), items: [ { itemName: Math.random(), type: '0-1' } ] },
            ]
        };
        this.formApi.setValues(newData, { isOverride: true });
    }

    getFormApi(formApi) {
        this.formApi = formApi;
    }

    render() {
        return (
            <Form
                onValueChange={(values)=>console.log(values)}
                getFormApi={this.getFormApi}
                initValues={this.state.data}
            >
                <Row>
                    <Col span={12}>
                        <ArrayField field='group'>
                            {({ add, arrayFields, addWithInitValue }) => (
                                <React.Fragment>
                                    <Button onClick={() => addWithInitValue({ name: 1 })} type='primary'>Add level-1</Button>
                                    <Button onClick={this.change}>改变</Button>
                                    {
                                        arrayFields.map(({ field, key, remove }, i) => (
                                            <div key={key} style={{ width: 1000 }}>
                                                <Input
                                                    field={`${field}[name]`}
                                                    label={`${field}.name`}
                                                    style={{ width: 200 }}
                                                >
                                                </Input>
                                                <ArrayField field={`${field}.items`}>
                                                    {({ add, arrayFields, addWithInitValue }) => (
                                                        <div style={{ marginLeft: 50 }}>
                                                            <Button onClick={() => addWithInitValue({ itemName: '2-1' })} type='primary'>add via api</Button>
                                                            <Button onClick={add} type='primary'>add via props.initvalues</Button>
                                                            {
                                                                arrayFields.map(({ field, key, remove }, i) => (
                                                                    <div key={key}>
                                                                        <Input
                                                                            style={{ width: 150 }}
                                                                            field={`${field}.itemName`}
                                                                            label={`${field}.itemName`}
                                                                            initValue='2d'
                                                                        >
                                                                        </Input>
                                                                        <Button type='danger' onClick={remove}>remove level-2</Button>
                                                                    </div>
                                                                ))
                                                            }
                                                        </div>
                                                    )}
                                                </ArrayField>
                                                <Button type='danger' onClick={remove}>remove level-1</Button>
                                            </div>
                                        ))
                                    }
                                </React.Fragment>
                            )}
                        </ArrayField>
                    </Col>
                    <Col span={12}>
                        <ComponentUsingFormState/>
                    </Col>
                </Row>
            </Form>
        );
    }
}




class Child extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            ts: format(new Date(), 'yyyy-MM-dd HH:mm:ss')
        };
    }
    render() {
        return <div>
            {this.state.ts}
        </div>;
    }
}

class Parent extends React.Component {
    constructor(props) {
        super(props);
        this.click = this.click.bind(this);
    }

    click() {
        this.forceUpdate();
    }
    render() {
        return <div>
            {[1, 2, 3].map(i => (
                <div key={i}>
                    <Child></Child>
                </div>
            ))}
            <Button onClick={this.click}>change</Button>
        </div>;
    }
}

export { NestArrayField, Parent };