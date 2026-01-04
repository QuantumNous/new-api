import React from 'react';
import { DatePicker, Space } from '@douyinfe/semi-ui';

/**
 * Test with Chromatic
 */
export default function App() {
    // 使用过去的时间，避免当前日变动引入 UI 测试失败
    const defaultValue = new Date('2021-01-01 00:00:00');
    const props = {
        defaultOpen: true,
        position: 'bottomLeft',
        autoAdjustOverflow: false,
        defaultPickerValue: defaultValue,
        needConfirm: true,
        motion: false,
    };
    const spacing = [48, 400];
    // 使用过去的时间，避免当前日变动引入 UI 测试失败
    const defaultRangeValue = [defaultValue, new Date('2021-03-31 00:00:00')];
    return (
        <div style={{ height: '100vh' }}>
            <Space wrap spacing={spacing}>
                <DatePicker {...props} type="month" defaultValue={defaultValue} />
                <DatePicker {...props} type="dateTimeRange" defaultValue={defaultRangeValue} density="compact" />
                <DatePicker {...props} type="dateTimeRange" defaultValue={defaultRangeValue} />
            </Space>
        </div>
    );
}

App.parameters = {
    chromatic: {
        disableSnapshot: false,
        delay: 3000,
        viewports: [1800]
    },
};
App.storyName = 'defaultOpen';