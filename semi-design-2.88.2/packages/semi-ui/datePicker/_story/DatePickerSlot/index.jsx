import React, { useState, useMemo } from 'react';
import { DatePicker, Icon, Typography, Space, Tabs, TabPane } from '../../../index';
import './index.scss';

const { Text } = Typography;

export default function Demo() {
    const [activeTab, setActiveTab] = useState('1');
    const [date, setDate] = useState();
    const uedDisabledDate = currentDate => currentDate && currentDate.getDate() > 10 && currentDate.getDate() < 15;
    const testDisabledDate = currentDate => currentDate && currentDate.getDate() > 15 && currentDate.getDate() < 25;

    const handleTabChange = tab => {
        setActiveTab(tab);
        setDate();
    };

    const handleDateChange = value => {
        setDate(value);
    };

    const disabledDate = useMemo(() => (activeTab === '1' ? uedDisabledDate : testDisabledDate), [activeTab]);

    const TopSlot = function (props) {
        const { style } = props;
        return (
            <Tabs size="small" onChange={handleTabChange} activeKey={activeTab} style={{ padding: '12px 20px 0', ...style }}>
                <TabPane tab="UED 排期" itemKey="1" />
                <TabPane tab="测试排期" itemKey="2" />
            </Tabs>
        );
    };

    const BottomSlot = function (props) {
        const { style } = props;
        return (
            <Space style={{ padding: '12px 20px', ...style }}>
                <Icon type="bulb" style={{ color: 'rgba(var(--amber-5), 1)' }} />
                <Text strong style={{ color: 'var(--color-text-2)' }}>
                    定版前请阅读
                </Text>
                <Text link={{ href: 'https://semi.design/', target: '_blank' }}>发版须知</Text>
            </Space>
        );
    };

    const LeftSlot = function (props) {
        const { style } = props;
        return (
            <div>LeftSlot</div>
        );
    };

    const RightSlot = function (props) {
        const { style } = props;
        return (
            <Space style={{ padding: '12px 20px', ...style }}>
                <div>RightSlot</div>
            </Space>
        );
    };

    const MonthBottomSlot = function (props) {
        const { style } = props;
        return (
            <Space style={{ padding: '12px 20px', ...style }}>
                <Icon type="bulb" style={{ color: 'rgba(var(--amber-5), 1)' }} />
                <Text strong style={{ color: 'var(--color-text-2)' }}>
                    请阅读
                </Text>
                <Text link={{ href: 'https://semi.design/', target: '_blank' }}>须知</Text>
            </Space>
        );
    };

    return (
        <div>
            <span>topSlot</span>
            <DatePicker topSlot={<TopSlot />} leftSlot={<LeftSlot />} rightSlot={<RightSlot/>} disabledDate={disabledDate} value={date} onChange={handleDateChange} />
            <br />
            <br />
            <span>bottomSlot</span>
            <DatePicker bottomSlot={<BottomSlot />} />
            <br />
            <br />
            <span>bottomSlot+dateTimeRange</span>
            <DatePicker type="dateTimeRange" bottomSlot={<BottomSlot />} style={{ width: 300 }} />
            <br />
            <br />
            <span>topSlot+month</span>
            <DatePicker type="month" bottomSlot={<MonthBottomSlot />} />
            <br />
            <br />
            <span>topSlot+bottomSlot+compact</span>
            <DatePicker topSlot={<TopSlot style={{ padding: '8px 12px 0' }} />} bottomSlot={<BottomSlot style={{ padding: '8px 12px' }} />} density="compact" />
        </div>
    );
}
