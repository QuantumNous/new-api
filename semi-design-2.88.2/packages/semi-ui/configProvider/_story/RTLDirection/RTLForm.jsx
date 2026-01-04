import React from 'react';
import { Form, Row, Col, Button } from '@douyinfe/semi-ui';
import { IconUpload } from '@douyinfe/semi-icons';

class RTLForm extends React.Component {
    constructor() {
        super();
        this.state = {
            initValues: {
                name: 'semi',
                business: ['hotsoon'],
                role: 'ued',
                switch: true,
                files: [
                    {
                        uid: '1',
                        name: 'vigo.png',
                        status: 'success',
                        size: '130KB',
                        preview: true,
                        url:
                            'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/vigo.png',
                    },
                    {
                        uid: '3',
                        name: 'jiafang.jpeg',
                        status: 'uploading',
                        size: '222KB',
                        percent: 50,
                        preview: true,
                        fileInstance: new File([new ArrayBuffer(2048)], 'jiafang.jpeg', {
                            type: 'image/jpeg',
                        }),
                        url:
                            'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/bag.jpeg',
                    },
                ],
            },
        };
        this.getFormApi = this.getFormApi.bind(this);
    }

    getFormApi(formApi) {
        this.formApi = formApi;
    }

    render() {
        const {
            Section,
            Input,
            InputNumber,
            Select,
            DatePicker,
            TimePicker,
            TextArea,
            CheckboxGroup,
            Checkbox,
            RadioGroup,
            Radio,
            Slider,
            Rating,
            Switch,
        } = Form;
        const { initValues } = this.state;
        const style = {
            width: '90%',
        };
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
            <div
                style={{
                    width: 1200,
                }}
            >
                <Form
                    getFormApi={this.getFormApi}
                    initValues={initValues}
                    style={{
                        padding: 10,
                        width: '100%',
                    }}
                    onValueChange={v => console.log(v)}
                >
                    <Section text={'基本信息'}>
                        <Row>
                            <Col span={12}>
                                <Input
                                    field="name"
                                    label="名称（Input）"
                                    initValue={'mikeya'}
                                    style={style}
                                    trigger="blur"
                                />
                            </Col>
                            <Col span={12}>
                                <DatePicker
                                    field="date"
                                    label="日期（DatePicker）"
                                    style={style}
                                    initValue={new Date()}
                                    placeholder="请选择生效日期"
                                />
                            </Col>
                        </Row>
                        <Row>
                            <Col span={12}>
                                <Select field="role" style={style} label="角色（Select）" placeholder="请选择你的角色">
                                    <Select.Option value="operate">运营</Select.Option>
                                    <Select.Option value="rd">开发</Select.Option>
                                    <Select.Option value="pm">产品</Select.Option>
                                    <Select.Option value="ued">设计</Select.Option>
                                </Select>
                            </Col>
                            <Col span={12}>
                                <Select
                                    field="business"
                                    multiple
                                    style={style}
                                    placeholder="请选择业务线"
                                    label="业务线（多选Select）"
                                    extraText={(
                                        <div
                                            style={{
                                                color: 'rgba(var(--semi-blue-5), 1)',
                                                fontSize: 14,
                                                userSelect: 'none',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            没有找到合适的业务线？
                                        </div>
                                    )}
                                >
                                    <Select.Option value="dy">抖音</Select.Option>
                                    <Select.Option value="hotsoon">火山小视频</Select.Option>
                                    <Select.Option value="toutiao">今日头条</Select.Option>
                                </Select>
                            </Col>
                        </Row>
                        <Row>
                            <Col span={12}>
                                <Form.Cascader
                                    placeholder="请选择所在地区"
                                    treeData={treeData}
                                    field="area"
                                    label="地区（Cascader）"
                                    style={style}
                                />
                            </Col>
                            <Col span={12}>
                                <Form.TreeSelect
                                    field="tree"
                                    style={style}
                                    label="节点（TreeSelect）"
                                    placeholder="请选择服务节点"
                                    treeData={treeData}
                                    filterTreeNode
                                />
                            </Col>
                        </Row>
                        <Row>
                            <Col span={24}>
                                <Form.Upload
                                    field="files"
                                    label="证明文件（Upload）"
                                    action="//semi.design/api/upload"
                                >
                                    <Button icon={<IconUpload />} theme="light">
                                        点击上传
                                    </Button>
                                </Form.Upload>
                            </Col>
                        </Row>
                    </Section>
                    <Section text="资源详情">
                        <Row>
                            <Col span={12}>
                                <TextArea
                                    style={{ ...style, height: 120 }}
                                    field="description"
                                    label="申请理由（TextArea）"
                                    placeholder="请填写申请资源理由"
                                />
                            </Col>
                            <Col span={12}>
                                <CheckboxGroup
                                    field="type"
                                    direction="horizontal"
                                    label="申请类型（CheckboxGroup）"
                                    initValue={['user', 'admin']}
                                    rules={[
                                        {
                                            required: true,
                                        },
                                    ]}
                                >
                                    <Checkbox value="admin">admin</Checkbox>
                                    <Checkbox value="user">user</Checkbox>
                                    <Checkbox value="guest">guest</Checkbox>
                                    <Checkbox value="root">root</Checkbox>
                                </CheckboxGroup>
                                <RadioGroup
                                    field="isMonopolize"
                                    label="是否独占资源（Radio）"
                                    rules={[
                                        {
                                            type: 'boolean',
                                        },
                                        {
                                            required: true,
                                            message: '必须选择是否独占 ',
                                        },
                                    ]}
                                >
                                    <Radio value={true}>是</Radio>
                                    <Radio value={false}>否</Radio>
                                </RadioGroup>
                            </Col>
                        </Row>
                        <Row>
                            <Col span={12}>
                                <TimePicker
                                    field="time"
                                    label="截止时刻（TimePicker）"
                                    style={{
                                        width: '90%',
                                    }}
                                />
                            </Col>
                            <Col span={12}>
                                <InputNumber
                                    field="number"
                                    label="申请数量（InputNumber）"
                                    initValue={20}
                                    style={style}
                                />
                            </Col>
                        </Row>
                        <Row>
                            <Col span={12}>
                                <Slider
                                    field="range"
                                    label="资源使用报警阈值(%)（Slider）"
                                    initValue={10}
                                    style={{
                                        width: '90%',
                                    }}
                                />
                            </Col>
                            <Col span={12}>
                                <Switch field="switch" label="开关(Switch)" />
                            </Col>
                        </Row>
                        <Row>
                            <Col span={12}>
                                <Rating
                                    field="rating"
                                    label="满意度(Rating)"
                                    initValue={2}
                                    style={{
                                        width: '90%',
                                    }}
                                />
                            </Col>
                        </Row>
                    </Section>
                    <Checkbox value="false" field="agree" noLabel={true}>
                        我已阅读并清楚相关规定（Checkbox）
                    </Checkbox>
                    <Button type="primary" htmlType="submit" className="btn-margin-right">
                        提交(submit)
                    </Button>
                    <Button htmlType="reset">重置(reset)</Button>
                </Form>
            </div>
        );
    }
}

export default RTLForm;
