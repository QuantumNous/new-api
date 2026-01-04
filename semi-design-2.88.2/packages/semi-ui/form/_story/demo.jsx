/* eslint-disable */
import React, { Component } from 'react';
import { Button, Row, Col, InputGroup as BasicInputGroup, AutoComplete } from '../../index';
import { Form, useFormState, ArrayField, withField } from '../index';
import BasicSelect from '../../select/index';
import BasicInput from '../../input/index';
import BasicInputNumber from '../../inputNumber/index';
import LocaleProvider from '../../locale/localeProvider';
import zh_CN from '@douyinfe/semi-ui/locale/source/zh_CN';
import en_GB from '@douyinfe/semi-ui/locale/source/en_GB';
import en_US from '@douyinfe/semi-ui/locale/source/en_US';
import ko_KR from '@douyinfe/semi-ui/locale/source/ko_KR';
import ja_JP from '@douyinfe/semi-ui/locale/source/ja_JP';

import {
    UseFormApiDemo,
    UseFormStateDemo,
    UseFieldApiDemo,
    UseFieldStateDemo,
    WithFormStateDemo,
    WithFormApiDemo,
    ComponentUsingFormState,
    CustomStringify,
} from './Hook/hookDemo';

const { Input, Select, DatePicker, Switch, Slider, CheckboxGroup, Checkbox, RadioGroup, Radio, TimePicker, InputNumber, InputGroup } = Form;
const plainOptions = ['Apple', 'Pear', 'Orange'];
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
    }
  ];


const DifferentDeclareUsage = () => (
    <React.Fragment>
        <h2>一般写法</h2>
        <Form layout="horizontal">
            <Input field="name" />
            <Select field="familyName">
                <Option value="mike">Mike</Option>
                <Option value="jane">Jane</Option>
                <Option value="kate">Kate</Option>
            </Select>
        </Form>
        <h2 style={{ marginTop: 20 }}>以下的几种写法可以直接在Form结构内部获取到formState值</h2>
        <h2>通过Render Props</h2>
        <Form
            render={({ formState }) => (
                <>
                    <Input field="name" />
                    <Input field="hello[0]" />
                    <Input field="hello[1]" />
                    <code>{CustomStringify(formState)}</code>
                </>
            )}
            layout="horizontal"
        ></Form>
        <h2 style={{ marginTop: 20 }}>通过child render function</h2>
        <Form layout="horizontal">
            {({ formState }) => (
                <>
                    <Input field="name" />
                    <Input field="hello[0]" />
                    <Input field="hello[1]" />
                    <code>{CustomStringify(formState)}</code>
                </>
            )}
        </Form>
        <h2 style={{ marginTop: 20 }}>通过props.component</h2>
        {/* <Form component={FormContent} layout='horizontal'></Form> */}
        <h2 style={{ marginTop: 20 }}>通过withFormState Hoc（示例见Hoc部分）</h2>
        <h2 style={{ marginTop: 20 }}>通过useFormState Hooks(示例见Hooks部分)</h2>
    </React.Fragment>
)


class BasicDemoWithInit extends Component {
    constructor() {
        super();
        this.state = {
            filed: {},
            layout: 'vertical',
            // layout: 'horizontal',
            labelPosition: 'left',
            // labelPosition: 'top',
            labelAlign: 'left'
            // horizontal
        };
        this.getFormApi = this.getFormApi.bind(this);
        this.changeLayout = this.changeLayout.bind(this);
        this.changeLabelPos = this.changeLabelPos.bind(this);
        this.changeLabelAlign = this.changeLabelAlign.bind(this);
        this.handleReset = this.handleReset.bind(this);
        this.validate = this.validate.bind(this);
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

    changeLabelAlign(labelAlign) {
        this.setState({ labelAlign });
    }

    changeSelect() {
        this.formApi.setValue('select', 'jane');
    }

    getFormApi(formApi) {
        this.formApi = formApi;
    }

    handleReset() {
        console.log('reset')
    }

    validate() {
        this.formApi.validate()
        .then(value => {
            debugger
        })
        .catch(error => {
            debugger
        })
    }

    render() {
        const { layout, labelPosition, labelAlign } = this.state;
        const formInitValue = {
            // name: 'semi',
            business: ['hotsoon'],
            role: 'ued',
            tree: 'Beijing'
        };
        const plainOptions = ['A', 'B', 'C'];
        const style = { width: '90%' };
        return (
            <>
            <div>
                <BasicSelect onChange={this.changeLayout} onChange={this.changeLayout} value={layout}>
                    <BasicSelect.Option value='vertical'>vertical</BasicSelect.Option>
                    <BasicSelect.Option value='horizontal'>horizontal</BasicSelect.Option>
                </BasicSelect>
                <BasicSelect onChange={this.changeLabelPos} value={labelPosition}>
                    <BasicSelect.Option value='top'>top</BasicSelect.Option>
                    <BasicSelect.Option value='left'>left</BasicSelect.Option>
                    <BasicSelect.Option value='inset'>inset</BasicSelect.Option>
                </BasicSelect>
                <BasicSelect onChange={this.changeLabelAlign} value={labelAlign}>
                    <BasicSelect.Option value='left'>left</BasicSelect.Option>
                    <BasicSelect.Option value='right'>right</BasicSelect.Option>
                </BasicSelect>
            </div>

            <Form
                layout={layout}
                labelPosition={labelPosition}
                labelAlign={labelAlign}
                getFormApi={this.getFormApi}
                initValues={formInitValue}
                onReset={this.handleReset}
                onValueChange={(v)=>console.log(v)}
                style={{ padding: '10px', width: 900 }}
                autoScrollToError
                aria-label='Demo Form'
                id='demo-form-id'
                >
                <Form.Section text={'基本信息'}>
                    <Row>
                        <Col span={12}>
                            <Form.Input
                                field='name'
                                label="名称"
                                // initValue={'mikeya'}
                                style={style}
                                trigger='blur'
                                rules={[
                                    { required: true, message: 'required error' },
                                    { type: 'string', message: 'type error' },
                                    { validator: (rule, value) => value === 'muji', message: 'not muji' }
                                ]}
                            />
                        </Col>
                        <Col span={12}>
                            <Form.DatePicker field="date" label='日期' style={style} placeholder='请选择生效日期' />
                        </Col>
                    </Row>
                    <Row>
                        <Col span={12}>
                            <Form.Select field="role" style={style} label='角色' placeholder='请选择你的角色'>
                                <Form.Select.Option value="operate">运营</Form.Select.Option>
                                <Form.Select.Option value="rd">开发</Form.Select.Option>
                                <Form.Select.Option value="pm">产品</Form.Select.Option>
                                <Form.Select.Option value="ued">设计</Form.Select.Option>
                            </Form.Select>
                        </Col>
                        <Col span={12}>
                            <Form.Select
                                field="business"
                                multiple
                                style={style}
                                placeholder='请选择业务线'
                                label="业务线（多选）"
                            >
                                <Form.Select.Option value="dy">抖音</Form.Select.Option>
                                <Form.Select.Option value="hootsoon">火山小视频</Form.Select.Option>
                                <Form.Select.Option value="toutiao">今日头条</Form.Select.Option>
                            </Form.Select>
                        </Col>
                    </Row>
                    <Row>
                        <Col span={12}>
                            <Form.Cascader
                                placeholder="请选择所在地区"
                                treeData={treeData}
                                field='area'
                                label='地区（级联选择）'
                            >
                            </Form.Cascader>    
                        </Col>
                        <Col span={12}>
                            <Form.TreeSelect
                                field="tree"
                                style={style}
                                label='节点（树选择）'
                                placeholder='请选择服务节点'
                                treeData={treeData}
                                filterTreeNode
                            >
                            </Form.TreeSelect>
                        </Col>
                    </Row>
                    <Row>
                        <Col span={12}>
                            <Form.TimePicker
                                field='time'
                                helpText='原则上应当在 9:00 - 18:00 之间'
                                label='时间选择'
                            >
                            </Form.TimePicker>
                        </Col>
                        <Col span={12}>
                            <Form.AutoComplete
                                field='typeData'
                                label='类型选择'
                                data={['1', '2' , '3']}
                            >
                            </Form.AutoComplete>
                        </Col>
                    </Row>
                    <Row>
                        <Col span={12}>
                            <Form.TagInput
                                field='tags'
                                label='tags'
                            />
                        </Col>
                        
                    </Row>
                </Form.Section>
                <Form.Section text='资源详情'>

                <Row>
                    <Col span={12}>
                        <Form.TextArea
                            style={style}
                            field='description'
                            label='申请理由'
                            placeholder='请填写申请资源理由'
                        />
                    </Col>
                    <Col span={12}>
                        <Form.CheckboxGroup
                            field="type"
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
                    </Col>
                </Row>
                <Row>
                    <Col span={12}>
                        <Form.RadioGroup field="isMonopolize" label='是否独占资源' rules={[
                            { type: 'boolean' },
                            { required: true, message: '必须选择是否独占 ' }
                        ]}>
                            <Form.Radio value={true}>是</Form.Radio>
                            <Form.Radio value={false}>否</Form.Radio>
                        </Form.RadioGroup>
                    </Col>
                    <Col span={12}>
                        <Form.InputNumber field='number' label='申请数量' initValue={20} style={style}/>
                    </Col>
                </Row>
                <Row>
                    <Col span={12}>
                      <Form.Slider field="range" label='资源使用报警阈值(%)' initValue={10} style={{ width: '90%' }}/>
                    </Col>
                    <Col span={12}>
                        <Form.CheckboxGroup options={plainOptions} field="checkbox" label='Type' direction='horizontal'/>
                    </Col>
                </Row>
                <Row>
                    <Col span={12}>
                        <Form.Rating field="rating" label='满意度(Rating)' initValue={2} style={{ width: '90%' }}/>
                    </Col>
                    <Col span={12}>
                        <Form.Switch field='switch' label='开关(Switch)'/>
                    </Col>
                </Row>
                <Form.CheckboxGroup field="cardCheckbox" label='卡片选择' style={{ width: '90%' }} type='card' initValue={['1', '3']} direction={'horizontal'} aria-label="CheckboxGroup 示例">
                    <Form.Checkbox value={'1'} disabled extra='Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统' style={{width:280}}>
                        单选框标题
                    </Form.Checkbox>
                    <Form.Checkbox value={'2'} disabled extra='Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统' style={{width:280}}>
                        单选框标题
                    </Form.Checkbox>
                </Form.CheckboxGroup>
                <Row>
                    <Col span={12}>
                        <Form.RadioGroup field='buttonRadio' type='button' buttonSize='middle' defaultValue={1} aria-label="单选组合示例">
                            <Radio value={1}>即时推送</Radio>
                            <Radio value={2}>定时推送</Radio>
                            <Radio value={3}>动态推送</Radio>
                        </Form.RadioGroup>
                    </Col>
                </Row>
                </Form.Section>
                <Form.Checkbox value="false" field="agree" useOutSideGroup={true} noLabel={true}>
                    我已阅读并清楚相关规定
                </Form.Checkbox>
                <div style={{marginTop: 28}}>
                    <Button type="primary" htmlType="submit">提交(submit)</Button>
                    <Button htmlType="reset">重置(reset)</Button>
                    <Button onClick={this.validate}>校验(validate)</Button>
                </div>
            </Form>
            </>
        );
    }
}


class LinkFieldForm extends Component {
    constructor() {
        super();
        this.state = {
            filed: {},
        };
        this.getFormApi = this.getFormApi.bind(this);
        this.handleSelectChange = this.handleSelectChange.bind(this);
    }

    handleSelectChange(value) {
        let text = value === 'male' ? 'Hi male' : 'Hi female!';
        // this.formApi.setValue('Note', text);
    }

    getFormApi(formApi) {
        this.formApi = formApi;
    }

    render() {
        return (
            <Form getFormApi={this.getFormApi}>
                <Row>
                    <Col span={8}>
                        <span>Note will change after Sex select</span>
                        <Input
                            field="Note"
                        />
                        <Select field="Sex" onChange={this.handleSelectChange} style={{width: 500}}>
                            <Option value="female">female</Option>
                            <Option value="male">male</Option>
                        </Select>
                    </Col>
                </Row>
                <Row>
                    <Button type="primary" htmlType="submit">
                        Submit
                    </Button>
                    <Button htmlType="reset">reset</Button>
                </Row>
            </Form>
        );
    }
}


export {  BasicDemoWithInit, LinkFieldForm, DifferentDeclareUsage };

