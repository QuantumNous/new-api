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
    ArrayField
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

const NameDemo = () => {
    const style = { width: '90%' };
    const helpText = <span style={{ color: 'var(--semi-color-warning)' }}>密码强度：弱</span>;
    return (
        <Form extraTextPosition="middle">
            <Form.Input
                field="b"
                name='test'
            />
            <Form.Input
                field='name'
                label="名称"
                name='name'
                // initValue={'mikeya'}
                style={style}
                trigger='blur'
                rules={[
                    { required: true, message: 'required error' },
                    { type: 'string', message: 'type error' },
                    { validator: (rule, value) => value === 'muji', message: 'not muji' }
                ]}
            />
            <Form.DatePicker field="date" name='date' label='日期' style={style} placeholder='请选择生效日期' />
            <Form.Select field="role" name='role' style={style} label='角色' placeholder='请选择你的角色'>
                <Form.Select.Option value="operate">运营</Form.Select.Option>
                <Form.Select.Option value="rd">开发</Form.Select.Option>
                <Form.Select.Option value="pm">产品</Form.Select.Option>
                <Form.Select.Option value="ued">设计</Form.Select.Option>
            </Form.Select>
            <Form.Select
                field="business"
                name='business'
                multiple
                style={style}
                placeholder='请选择业务线'
                label="业务线（多选）"
            >
                <Form.Select.Option value="dy">抖音</Form.Select.Option>
                <Form.Select.Option value="hootsoon">火山小视频</Form.Select.Option>
                <Form.Select.Option value="toutiao">今日头条</Form.Select.Option>
            </Form.Select>
            <Form.Cascader
                placeholder="请选择所在地区"
                field='area'
                name='area'
                label='地区（级联选择）'
            >
            </Form.Cascader>    
            <Form.TreeSelect
                field="tree"
                name='tree'
                style={style}
                label='节点（树选择）'
                placeholder='请选择服务节点'
                filterTreeNode
            >
            </Form.TreeSelect>
            <Form.TimePicker
                field='time'
                name='time'
                helpText='原则上应当在 9:00 - 18:00 之间'
                label='时间选择'
            >
            </Form.TimePicker>
            <Form.AutoComplete
                field='typeData'
                label='类型选择'
                name='typeData'
                data={['1', '2', '3']}
            >
            </Form.AutoComplete>
            <Form.TagInput
                field='tags'
                label='tags'
                name='tags'
            />
            <Form.TextArea
                style={style}
                field='description'
                name='description'
                label='申请理由'
                placeholder='请填写申请资源理由'
            />
            <Form.CheckboxGroup
                field="type"
                name='anotherType'
                label='申请类型'
                initValue={['user', 'admin']}
                rules={[
                    { required: true }
                ]}
            >
                <Form.Checkbox value="admin">管理员admin</Form.Checkbox>
                <Form.Checkbox value="user">用户user</Form.Checkbox>
                <Form.Checkbox value="guest">访客guest</Form.Checkbox>
                <Form.Checkbox value="root">根用户root</Form.Checkbox>
            </Form.CheckboxGroup>
            <Form.RadioGroup
                name='anotherSource'
                field="isMonopolize" label='是否独占资源' rules={[
                    { type: 'boolean' },
                    { required: true, message: '必须选择是否独占 ' }
                ]}>
                <Form.Radio value={true}>是</Form.Radio>
                <Form.Radio value={false}>否</Form.Radio>
            </Form.RadioGroup>
            <Form.InputNumber field='number' name='number' label='申请数量' initValue={20} style={style}/>
            <Form.Slider field="range" name='range' label='资源使用报警阈值(%)' initValue={10} style={{ width: '90%' }}/>
            <Form.Rating field="rating" name='rating' label='满意度(Rating)' initValue={2} style={{ width: '90%' }}/>
            <Form.Switch field='switch' name='switch' label='开关(Switch)'/>
            <Form.CheckboxGroup field="cardCheckbox" label='卡片选择' style={{ width: '90%' }} type='card' initValue={['1', '3']} direction={'horizontal'} aria-label="CheckboxGroup 示例">
                <Form.Checkbox value={'1'} disabled extra='Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统' style={{ width: 280 }}>
                    单选框标题
                </Form.Checkbox>
                <Form.Checkbox value={'2'} disabled extra='Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统' style={{ width: 280 }}>
                    单选框标题
                </Form.Checkbox>
            </Form.CheckboxGroup>
            <Form.RadioGroup field='buttonRadio' type='button' buttonSize='middle' defaultValue={1} aria-label="单选组合示例">
                <Radio value={1}>即时推送</Radio>
                <Radio value={2}>定时推送</Radio>
                <Radio value={3}>动态推送</Radio>
            </Form.RadioGroup>
            <Form.Checkbox value="false" field="agree" name='agree' useOutSideGroup={true} noLabel={true}>
                我已阅读并清楚相关规定
            </Form.Checkbox>
        </Form>
    );
};

export { NameDemo };