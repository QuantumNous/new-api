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

const BigNumberFieldDemo = () => (
    <Form
        onSubmit={values => {
            console.log(values);
            Notification.success({ title: 'submit', content: JSON.stringify(values) });
        }}
        onValueChange={v => {
            console.log('change', v);
        }}
        labelPosition="top"
        style={{ width: 400 }}
    >
        <Form.InputGroup label={{ text: <span>手机号码</span>, required: true }} labelPosition="top">
            <Form.Select
                style={{ width: 150 }}
                field="phonePrefix"
                initValue="+86"
                rules={[{ required: true }]}
                showClear
            >
                <Form.Select.Option value="+1">美国+1</Form.Select.Option>
                <Form.Select.Option value="+852">香港+852</Form.Select.Option>
                <Form.Select.Option value="+86">中国+86</Form.Select.Option>
                <Form.Select.Option value="+81">日本+81</Form.Select.Option>
            </Form.Select>
            <Form.Input
                initValue="18912345678"
                style={{ width: 250 }}
                field="phoneNumber"
                rules={[{ required: true }]}
                showClear
            />
        </Form.InputGroup>
        <Form.Input field="姓名" trigger="blur" initValue="Semi" />
        <Form.Input field='test["123"]' trigger="blur" initValue="Semi1" />
        <Form.Input field='test["24"]' trigger="blur" initValue="Semi1" />
        <Form.Input field='test["543"]' trigger="blur" initValue="Semi1" />
        <Form.Input field='extra["202011051537460"]' trigger="blur" initValue="Semi1" />
        <Form.Input field='extra["202011051537461"]' trigger="blur" initValue="Semi2" />
        <Form.Input field='extra["202011051537462"]' trigger="blur" initValue="Semi3" />
        <Button htmlType="submit">提交</Button>
    </Form>
);

export { BigNumberFieldDemo };
