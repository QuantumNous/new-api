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


const InputGroupDemo = () => {

    const selectProps = {
        style: { width: '100px' },
        placeholder: '国家',
        field: 'country',
        rules: [
            { required: true }
        ]
    };
    return (
        <>
            <Form onSubmit={(values) => console.log(values)} labelPosition='top' style={{ width: 600 }}>
                <Form.InputGroup label={{ text: 'Movie', required: true }} labelPosition="left" style={{ width: 500 }}>
                    <Form.Select {...selectProps} field='area'>
                        <Form.Select.Option value="crime">+86</Form.Select.Option>
                        <Form.Select.Option value="comedy">+1</Form.Select.Option>
                        <Form.Select.Option value="tragedy">+83</Form.Select.Option>
                    </Form.Select>
                    <Form.Input placeholder="手机号码" style={{ width: 100 }} field="phone" noLabel rules={[{ required: true }]} />
                    <Form.InputNumber placeholder="评分" style={{ width: 140 }} field="MovieScore" noLabel />
                </Form.InputGroup>
                <Form.InputGroup label={{ text: (<span>手机号码</span>), required: true }} labelPosition='top' extraText='i am extraText of Form.InputGroup'>
                    <Form.Select style={{ width: 150 }} field='phonePrefix1' initValue='+86' rules={[{ required: true }]} showClear>
                        <Form.Select.Option value='+1'>美国+1</Form.Select.Option>
                        <Form.Select.Option value='+852'>香港+852</Form.Select.Option>
                        <Form.Select.Option value='+86'>中国+86</Form.Select.Option>
                        <Form.Select.Option value='+81'>日本+81</Form.Select.Option>
                    </Form.Select>
                    <Form.Input initValue='18912345678' style={{ width: 250 }} field='phoneNumber1' trigger={['mount', 'change']} validate={val => 'always errors'} showClear />
                </Form.InputGroup>
            
                <Form.InputGroup
                    label={{ text: (<span>手机号码</span>), required: true }}
                    labelPosition='top' 
                    extraTextPosition='middle'
                    extraText='i am extraText of Form.InputGroup'>
                    <Form.Select style={{ width: 150 }} field='phonePrefix1' initValue='+86' rules={[{ required: true }]} showClear>
                        <Form.Select.Option value='+1'>美国+1</Form.Select.Option>
                        <Form.Select.Option value='+852'>香港+852</Form.Select.Option>
                        <Form.Select.Option value='+86'>中国+86</Form.Select.Option>
                        <Form.Select.Option value='+81'>日本+81</Form.Select.Option>
                    </Form.Select>
                    <Form.Input initValue='18912345678' style={{ width: 250 }} field='phoneNumber1' trigger={['mount', 'change']} validate={val => 'always errors'} showClear />
                </Form.InputGroup>

                <Form.InputGroup label={{ text: (<span>手机号码</span>), required: true }} labelPosition='left' style={{ width: 400 }}>
                    <Form.Select style={{ width: 150 }} field='phonePrefix2' initValue='+86' rules={[{ required: true }]} showClear>
                        <Form.Select.Option value='+1'>美国+1</Form.Select.Option>
                        <Form.Select.Option value='+852'>香港+852</Form.Select.Option>
                        <Form.Select.Option value='+86'>中国+86</Form.Select.Option>
                        <Form.Select.Option value='+81'>日本+81</Form.Select.Option>
                    </Form.Select>
                    <Form.Input initValue='18912345678' style={{ width: 250 }} field='phoneNumber2' showClear />
                </Form.InputGroup>

                <Form.InputGroup
                    label={{ text: (<span>手机号码</span>), required: true }}
                    labelPosition='left'
                    extraTextPosition='bottom'
                    extraText='i am extraText of Form.InputGroup'
                    style={{ width: 400 }}
                >
                    <Form.Select style={{ width: 150 }} field='phonePrefix3' initValue='+86' rules={[{ required: true }]} showClear>
                        <Form.Select.Option value='+1'>美国+1</Form.Select.Option>
                        <Form.Select.Option value='+852'>香港+852</Form.Select.Option>
                        <Form.Select.Option value='+86'>中国+86</Form.Select.Option>
                        <Form.Select.Option value='+81'>日本+81</Form.Select.Option>
                    </Form.Select>
                    <Form.Input style={{ width: 250 }} field='phoneNumber3' trigger={['mount', 'change']} validate={val => 'always errors'} showClear />
                </Form.InputGroup>

                <Form.InputGroup
                    label={{ text: (<span>手机号码</span>), required: true }}
                    labelPosition='left'
                    extraTextPosition='middle'
                    extraText='i am extraText of Form.InputGroup'
                    style={{ width: 400 }}
                >
                    <Form.Select style={{ width: 150 }} field='phonePrefix4' initValue='+86' rules={[{ required: true }]} showClear>
                        <Form.Select.Option value='+1'>美国+1</Form.Select.Option>
                        <Form.Select.Option value='+852'>香港+852</Form.Select.Option>
                        <Form.Select.Option value='+86'>中国+86</Form.Select.Option>
                        <Form.Select.Option value='+81'>日本+81</Form.Select.Option>
                    </Form.Select>
                    <Form.Input style={{ width: 250 }} field='phoneNumber4' trigger={['mount', 'change']} validate={val => 'always errors'} rules={[{ required: true }]} showClear />
                </Form.InputGroup>

                <Button htmlType='submit'>提交</Button>
            </Form>

            <Form 
                labelCol={{ span: 2 }}
                wrapperCol={{ span: 22 }}
            >
                <Form.InputGroup
                    label={{ text: (<span>手机号码</span>), required: true }}
                    labelPosition='left'
                    extraTextPosition='bottom'
                    extraText='i am extraText of Form.InputGroup'
                    style={{ width: 400 }}
                >
                    <Form.Select style={{ width: 150 }} field='phonePrefix3' initValue='+86' rules={[{ required: true }]} showClear>
                        <Form.Select.Option value='+1'>美国+1</Form.Select.Option>
                        <Form.Select.Option value='+852'>香港+852</Form.Select.Option>
                        <Form.Select.Option value='+86'>中国+86</Form.Select.Option>
                        <Form.Select.Option value='+81'>日本+81</Form.Select.Option>
                    </Form.Select>
                    <Form.Input style={{ width: 250 }} field='phoneNumber3' trigger={['mount', 'change']} validate={val => 'always errors'} showClear />
                </Form.InputGroup>

                <Form.InputGroup
                    label={{ text: (<span>手机号码</span>), required: true }}
                    labelPosition='left'
                    extraTextPosition='middle'
                    extraText='i am extraText of Form.InputGroup'
                    style={{ width: 400 }}
                >
                    <Form.Select style={{ width: 150 }} field='phonePrefix4' initValue='+86' rules={[{ required: true }]} showClear>
                        <Form.Select.Option value='+1'>美国+1</Form.Select.Option>
                        <Form.Select.Option value='+852'>香港+852</Form.Select.Option>
                        <Form.Select.Option value='+86'>中国+86</Form.Select.Option>
                        <Form.Select.Option value='+81'>日本+81</Form.Select.Option>
                    </Form.Select>
                    <Form.Input style={{ width: 250 }} field='phoneNumber4' trigger={['mount', 'change']} validate={val => 'always errors'} rules={[{ required: true }]} showClear />
                </Form.InputGroup>
            </Form>

            <Form 
                labelCol={{ span: 4 }}
                wrapperCol={{ span: 20 }}
            >
                <Form.InputGroup
                    label={{ text: (<span>手机号码</span>), required: true }}
                    labelPosition='top'
                    extraTextPosition='bottom'
                    extraText='i am extraText of Form.InputGroup'
                    style={{ width: 400 }}
                >
                    <Form.Select style={{ width: 150 }} field='phonePrefix3' initValue='+86' rules={[{ required: true }]} showClear>
                        <Form.Select.Option value='+1'>美国+1</Form.Select.Option>
                        <Form.Select.Option value='+852'>香港+852</Form.Select.Option>
                        <Form.Select.Option value='+86'>中国+86</Form.Select.Option>
                        <Form.Select.Option value='+81'>日本+81</Form.Select.Option>
                    </Form.Select>
                    <Form.Input style={{ width: 250 }} field='phoneNumber3' trigger={['mount', 'change']} validate={val => 'always errors'} showClear />
                </Form.InputGroup>

                <Form.InputGroup
                    label={{ text: (<span>手机号码</span>), required: true }}
                    labelPosition='top'
                    extraTextPosition='middle'
                    extraText='i am extraText of Form.InputGroup'
                    style={{ width: 400 }}
                >
                    <Form.Select style={{ width: 150 }} field='phonePrefix4' initValue='+86' rules={[{ required: true }]} showClear>
                        <Form.Select.Option value='+1'>美国+1</Form.Select.Option>
                        <Form.Select.Option value='+852'>香港+852</Form.Select.Option>
                        <Form.Select.Option value='+86'>中国+86</Form.Select.Option>
                        <Form.Select.Option value='+81'>日本+81</Form.Select.Option>
                    </Form.Select>
                    <Form.Input style={{ width: 250 }} field='phoneNumber4' trigger={['mount', 'change']} validate={val => 'always errors'} rules={[{ required: true }]} showClear />
                </Form.InputGroup>
            </Form>
            <Form
                disabled={true}
                labelCol={{ span: 2 }}
                wrapperCol={{ span: 22 }}
            >
                <Form.InputGroup
                    label={{ text: (<span>手机号码</span>), required: true }}
                    labelPosition='left'
                    extraTextPosition='middle'
                    extraText='i am extraText of Form.InputGroup'
                    style={{ width: 400 }}
                >
                    <Form.Select style={{ width: 150 }} field='phonePrefix4' initValue='+86' rules={[{ required: true }]} showClear>
                        <Form.Select.Option value='+1'>美国+1</Form.Select.Option>
                        <Form.Select.Option value='+852'>香港+852</Form.Select.Option>
                        <Form.Select.Option value='+86'>中国+86</Form.Select.Option>
                        <Form.Select.Option value='+81'>日本+81</Form.Select.Option>
                    </Form.Select>
                    <Form.Input style={{ width: 250 }} field='phoneNumber4' trigger={['mount', 'change']} validate={val => 'always errors'} rules={[{ required: true }]} showClear />
                </Form.InputGroup>
                <Form.InputGroup
                    label={{ text: (<span>手机号码</span>), required: true }}
                    labelPosition='left'
                    extraTextPosition='middle'
                    extraText='i am extraText of Form.InputGroup'
                    style={{ width: 400 }}
                    disabled={false}
                >
                    <Form.Select style={{ width: 150 }} field='phonePrefix4' initValue='+86' rules={[{ required: true }]} showClear>
                        <Form.Select.Option value='+1'>美国+1</Form.Select.Option>
                        <Form.Select.Option value='+852'>香港+852</Form.Select.Option>
                        <Form.Select.Option value='+86'>中国+86</Form.Select.Option>
                        <Form.Select.Option value='+81'>日本+81</Form.Select.Option>
                    </Form.Select>
                    <Form.Input style={{ width: 250 }} field='phoneNumber4' trigger={['mount', 'change']} validate={val => 'always errors'} rules={[{ required: true }]} showClear />
                </Form.InputGroup>
            </Form>
        </>
    );
};


export { InputGroupDemo };
