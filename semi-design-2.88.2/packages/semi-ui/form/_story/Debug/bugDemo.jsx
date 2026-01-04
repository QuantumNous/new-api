/* eslint-disable */
import React, { useState, useLayoutEffect, Component, useEffect } from 'react';
import { storiesOf } from '@storybook/react';
import { Button, Modal, TreeSelect, Row, Col, Avatar, TextArea, Input as BasicInput, Select as BasicSelect,
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

class Test extends React.Component {
    constructor() {
        super();
        console.log(this.props);
        debugger;
    }
    componentWillReceiveProps(prevProps) {
        console.log(this.props);
        debugger;
    }
    componentDidMount() {
        console.log(this.props);
        debugger;
    }
    componentWillUnmount() {
        console.log(this.props);
        debugger;
    }
    render() {
        return this.props.value;
    }
}

const FCC = (() => () => {
    useEffect(() => {
        // effect
        debugger;
        return () => {
            debugger;
        };
    }, []);
    return <div>t</div>;
})();

class SetValuesArray extends React.Component {
    constructor() {
        super();
        this.state = {
            initValues: {
                effects: [
                    { name: 'A', key: '12312' },
                    { name: 'B', key: '234234' },
                    { name: 'C', key: '345435' },
                ]
            }
        };
        this.id = 3;
        this.getFormApi = this.getFormApi.bind(this);
        this.add = this.add.bind(this);
        this.remove = this.remove.bind(this);
        this.renderItems = this.renderItems.bind(this);
        const iii = Form.Input;
    }
    getFormApi(formApi) {
        this.formApi = formApi;
    }
    add(obj) {
        let effects = this.formApi.getValue('effects');
        if (!effects) {
            effects = [];
        }
        effects.push({ name: '', type: '', key: Math.random() });
        // effects.push({ name: '', type: '', key: this.id++  });
        //    this.formApi.setValue('effects', effects);
        this.formApi.setValues({
            ...this.formApi.getValue(),
            effects
        }, { isOverride: true });
    }
    remove(key) {
        let effects = this.formApi.getValue('effects');
        effects = effects.filter((effect, index) => key !== effect.key);
        if (!effects.length) {
            effects = undefined;
        }
        //    this.formApi.setValue('effects', effects);
        this.formApi.setValues({
            ...this.formApi.getValue(),
            effects
        }, { isOverride: true });
    }

    renderItems(formState, values) {
        console.log(values);
        return values.effects && values.effects.map((effect, i) => (
            // <div style={{ width: 1000, display: 'flex' }}>
            <div style={{ width: 1000, display: 'flex' }} key={effect.key}>
                {/* <Test value={`effects[${i}].name`} /> */}
                {/* <FCC value={`effects[${i}].name`} /> */}
                {/* <BasicInput props={`effects[${i}].name`} /> */}
                {/* <Button type='danger' onClick={() => this.remove(effect.key)} style={{ margin: 12 }}>Remove</Button> */}
                <Form.Input field={`effects[${i}].name`} style={{ width: 200, marginRight: 12 }} key={`effects[${i}].name`} />
                {/* <Form.Input field={`effects[${i}].name`} style={{width: 200, marginRight: 12}} key={effect.key}></Form.Input> */}
                <Button type="danger" onClick={() => this.remove(effect.key)} style={{ margin: 12 }}>Remove</Button>
                <span>{effect.key}</span>
            </div>
        ));
    }

    render() {
        let { initValues } = this.state;
        return (
            <>
                <dd />
                <Form
                    getFormApi={this.getFormApi}
                    initValues={initValues}
                    style={{ width: 500 }}
                    labelPosition="left"
                    labelWidth="180px"
                >
                    {({ formState, values }) => (
                        <>
                            <Button onClick={this.add}>add</Button>
                            {this.renderItems(formState, values)}
                            <TextArea style={{ marginTop: 10 }} value={JSON.stringify(formState.values)} />
                        </>
                    )}
                </Form>
                <div className="test">will be render by react</div>
            </>
        );
    }
}

class FieldPathWithArrayDemo extends React.Component {
    constructor(props) {
        super();
        this.state = {
            data: {
                value: [
                    { name: 'kkk' },
                    { name: 'ccc' },
                    { name: 'ddd' },
                ]
            },
            regionLoad: 0
        };
        this.change = this.change.bind(this);
    }

    change() {
        let { regionLoad } = this.state;
        if (regionLoad !== 0) {
            this.setState({ regionLoad: 0 });
        } else {
            this.setState({ regionLoad: 1 });
        }
    }

    render() {
        const { data, regionLoad } = this.state;

        return (
            <Form
                initValues={data}
                onChange={formState => console.log(formState)}
                onValueChange={formState => console.log(formState)}
                style={{ padding: '10px', width: 600 }}>
                {
                    regionLoad === 0 ? (
                        <Form.Input
                            field="value[0].name"
                        />
                    ) : null
                }
                <Button onClick={this.change}>change</Button>
            </Form>
        );
    }
}



const Twice = () => {
    // 或者把useFormState去掉
    // const { values } = useFormState();
    console.log('render');
    return (
        <Form.Input
            field="test"
            // 把rules去掉就不会render两次
            rules={[{ required: true, message: '版本号不能为空' }]}
        />
    );
};
class DoubleRerender extends React.Component {
    render() {
        return (
            <Form>
                <Twice />
            </Form>
        );
    }
}


export { SetValuesArray, FieldPathWithArrayDemo, DoubleRerender };