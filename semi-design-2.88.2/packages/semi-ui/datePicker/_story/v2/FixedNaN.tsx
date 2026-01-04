import React, { useState } from 'react';
import { Button, DatePicker, Space } from '@douyinfe/semi-ui';

export default function App() {
    const [value, setValue] = useState<Array<Date | typeof NaN>>([NaN, NaN]);

    const handleChange = v => {
        console.log('change', v);
        setValue(v as Date[]);
    };

    return (
        <Space vertical align="start">
            <Space>
                <Button onClick={() => setValue([NaN, NaN])}>set NaN</Button>{' '}
                <h4>current props value: {value.toString()}</h4>
            </Space>
            <DatePicker
                presets={[
                    {
                        text: 'Empty',
                        start: null,
                        end: null,
                    },
                ]}
                type="dateRange"
                value={value}
                onChange={handleChange}
            />
        </Space>
    );
}
