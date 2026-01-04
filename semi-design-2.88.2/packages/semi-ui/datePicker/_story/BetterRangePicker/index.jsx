import React from 'react';
import { addDays } from 'date-fns';

import { DatePicker, Typography, Space, InputGroup, Input, InputNumber, Row } from '../../../index';
import RTLWrapper from '../../../configProvider/_story/RTLDirection/RTLWrapper';

const { Title, Text } = Typography;
const dayOffset = 1;
const baseYear = 2019;
const baseDay = 8;
const baseMon = 8;
const presets = [
    {
        text: 'Today',
        start: new Date(),
        end: new Date(),
    },
    {
        text: 'Next Day',
        start: addDays(new Date(), dayOffset),
        end: addDays(new Date(), dayOffset),
    },
];
const baseDate = new Date(baseYear, baseMon, baseDay, 8, 8, 8, 8);
const currentValue = [new Date(baseDate), new Date(baseDate).setDate(baseDay + dayOffset)];

Demo.parameters = {
    chromatic: { disableSnapshot: false },
};

export default function Demo(props = {}) {
    const style = { width: 240 };
    return (
        <RTLWrapper>
            <Row style={{ marginBottom: 20 }}>
                <Title heading={3}>不同尺寸</Title>
                <div style={{ marginBottom: 4 }}>
                    <Space>
                        <Text>default size</Text>
                        <DatePicker
                            onFocus={console.log}
                            onClear={e => {
                                console.log('clear', e);
                            }}
                            type="dateRange"
                            style={style}
                            onChange={console.log}
                        />
                        <DatePicker />
                    </Space>
                </div>
                <div style={{ marginBottom: 4 }}>
                    <Space>
                        <Text>small size</Text>
                        <DatePicker type="dateRange" size="small" style={style} />
                        <DatePicker size="small" />
                    </Space>
                </div>
                <div style={{ marginBottom: 4 }}>
                    <Space>
                        <Text>large size</Text>
                        <DatePicker type="dateRange" size="large" style={{ width: 280 }} />
                        <DatePicker size="large" />
                    </Space>
                </div>
            </Row>
            <Row style={{ marginBottom: 20 }}>
                <Title heading={3}>prefix、insetLabel</Title>
                <div style={{ marginBottom: 4 }}>
                    <Space>
                        <Text>prefix</Text>
                        <DatePicker prefix="Semi Design" type="dateRange" style={{ width: 340 }} />
                    </Space>
                </div>
                <div style={{ marginBottom: 4 }}>
                    <Space>
                        <Text>insetLabel</Text>
                        <DatePicker
                            insetLabel="放假时间"
                            type="dateRange"
                            defaultValue={['2021-06-10', '2021-06-17']}
                            showClear
                            style={{ width: 340 }}
                        />
                    </Space>
                </div>
            </Row>
            <Row style={{ marginBottom: 20 }}>
                <Title heading={3}>dateTimeRange</Title>
                <Space>
                    <DatePicker type="dateTimeRange" showClear needConfirm style={{ width: 360 }} />
                    <DatePicker
                        type="dateTimeRange"
                        defaultValue={currentValue}
                        placeholder="请选择日期"
                        style={{ width: 400 }}
                    />
                    <DatePicker
                        type="dateTimeRange"
                        placeholder={['请选择开始日期', '请选择结束日期']}
                        style={{ width: 360 }}
                    />
                </Space>
            </Row>
            <Row style={{ marginBottom: 20 }}>
                <Title heading={3}>对比不同校验状态</Title>
                <div style={{ marginBottom: 4 }}>
                    <Space>
                        <Text>default status</Text>
                        <DatePicker />
                        <DatePicker type="dateRange" style={style} />
                    </Space>
                </div>
                <div style={{ marginBottom: 4 }}>
                    <Space>
                        <Text>warning status</Text>
                        <DatePicker validateStatus="warning" />
                        <DatePicker type="dateRange" validateStatus="warning" style={style} />
                    </Space>
                </div>
                <div style={{ marginBottom: 4 }}>
                    <Space>
                        <Text>error status</Text>
                        <DatePicker validateStatus="error" />
                        <DatePicker type="dateRange" validateStatus="error" style={style} />
                    </Space>
                </div>
                <div style={{ marginBottom: 4 }}>
                    <Space>
                        <Text>disabled status</Text>
                        <DatePicker disabled />
                        <DatePicker type="dateRange" disabled style={style} />
                    </Space>
                </div>
            </Row>
            <Row style={{ marginBottom: 20 }}>
                <Title heading={3}>输入框组合</Title>
                <div style={{ marginBottom: 4 }}>
                    <InputGroup>
                        <Input placeholder="Name" style={{ width: 100 }} />
                        <DatePicker type="dateRange" placeholder={['入学时间', '离校时间']} style={style} />
                        <InputNumber placeholder="Score" style={{ width: 140 }} />
                    </InputGroup>
                </div>
                <div style={{ marginBottom: 4 }}>
                    <InputGroup>
                        <Input placeholder="Name" style={{ width: 100 }} />
                        <DatePicker type="dateRange" placeholder={['入学时间', '离校时间']} style={style} />
                    </InputGroup>
                </div>
                <div style={{ marginBottom: 4 }}>
                    <InputGroup>
                        <DatePicker type="dateRange" placeholder={['入学时间', '离校时间']} style={style} />
                        <Input placeholder="Name" style={{ width: 100 }} />
                        <InputNumber placeholder="Score" style={{ width: 140 }} />
                    </InputGroup>
                </div>
            </Row>
            <Row style={{ marginBottom: 20 }}>
                <Title heading={3}>带presets</Title>
                <div style={{ marginBottom: 4 }}>
                    <Space>
                        <DatePicker presets={presets} />
                        <DatePicker type="dateRange" presets={presets} style={style} />
                        <DatePicker type="dateTimeRange" presets={presets} style={{ width: 360 }} />
                    </Space>
                </div>
            </Row>
        </RTLWrapper>
    );
}
