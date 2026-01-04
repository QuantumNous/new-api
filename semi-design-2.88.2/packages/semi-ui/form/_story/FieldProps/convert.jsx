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

class ConvertDemo extends React.Component {
    constructor(props) {
        super(props);
        this.formApi = null;
    }

    handleChange = val => {
        let finalVal = val;
        let firstClassOption = ['Asia', 'North America'];
        // 在这里去做你的value替换逻辑
        console.log(`originVal:${ val}`);
        if (val.length === 1) {
            // do nothing
        } else {
            if (val.every(item => firstClassOption.includes(item))) {
                finalVal = val[val.length - 1];
            }
        }
        console.log(`finalVal:${ finalVal}`);
        return finalVal;
    };

    render() {
        const treeData = [
            {
                label: '亚洲',
                value: 'Asia',
                key: '0',
                children: [
                    {
                        label: '中国',
                        value: 'China',
                        key: '0-0',
                        children: [
                            {
                                label: '北京',
                                value: 'Beijing',
                                key: '0-0-0',
                            },
                            {
                                label: '上海',
                                value: 'Shanghai',
                                key: '0-0-1',
                            },
                        ],
                    },
                ],
            },
            {
                label: '北美洲',
                value: 'North America',
                key: '1',
            },
        ];
        return (
            <Form getFormApi={this.getFormApi}>
                <Form.TreeSelect
                    field="tree"
                    label="节点（TreeSelect）"
                    placeholder="请选择服务节点"
                    treeData={treeData}
                    convert={this.handleChange}
                    filterTreeNode
                    multiple
                />
            </Form>
        );
    }
}

export { ConvertDemo };