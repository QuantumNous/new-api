import React, { useRef } from 'react';
import type { BaseDatePicker } from '../../index';
import { DatePicker, Tabs, Space, Button } from '../../../index';

/**
 * test in cypress
 */
export default function Demo() {
    const ref = useRef<BaseDatePicker>();
    const ref2 = useRef<BaseDatePicker>();
    const TabPane = Tabs.TabPane;

    const handleClickOutside = () => {
        console.log('click outside');
    };

    const handleTabChange = (activeKey: string) => {
        if (activeKey === '1') {
            ref2.current?.close();
        }
        if (activeKey === '2') {
            ref.current?.close();
        }
    };

    return (
        <Space vertical align="start">
            <Space>
                <Button onClick={() => ref.current.close()}>close</Button>
            </Space>
            <Tabs type="line" onChange={handleTabChange}>
                <TabPane tab="文档" itemKey="1">
                    <DatePicker motion={false} type="dateTime" needConfirm ref={ref} onClickOutSide={handleClickOutside} />
                </TabPane>
                <TabPane tab="快速起步" itemKey="2">
                    <DatePicker motion={false} type="dateTimeRange" needConfirm ref={ref2} onClickOutSide={handleClickOutside} />
                </TabPane>
            </Tabs>
        </Space>
    );
}

Demo.storyName = 'fix needConfirm in Tabs';
Demo.parameters = {
    chromatic: { disableSnapshot: false },
};