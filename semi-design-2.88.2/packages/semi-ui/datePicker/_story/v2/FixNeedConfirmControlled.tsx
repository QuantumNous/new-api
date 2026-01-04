import React, { useState } from 'react';
import { Button, DatePicker, Space } from '@douyinfe/semi-ui';

/**
 * test with cypress, please modify this story
 * @returns
 */
export default function App() {
    const [value, setValue] = useState([]);
    return (
        <Space>
            <DatePicker
                needConfirm
                defaultPickerValue="2024-02-15"
                value={value}
                type="dateTimeRange"
                onChange={v => setValue(v)}
            />
            <Button>body click</Button>
        </Space>
    );
}
