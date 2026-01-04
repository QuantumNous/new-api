import React from 'react';
import { DatePicker, Space, Button } from '../../../index';

AutoFillTime.storyName = '自动填充时间';

/**
 * 输入开始日期后，自动填充一个时间
 */
export default function AutoFillTime() {
    const format = 'yyyy-MM-dd HH:mm';
    const defaultPickerValue = '2021-03-15 14:00';
    const defaultPickerValue2 = ['2021-01-10 00:01', '2021-03-15 23:59'];
    
    const handleChange = (...args) => {
        console.log('change', ...args);
    };

    const props = {
        format,
        insetInput: true,
        onChange: handleChange,
        motion: false,
    };

    return (
        <div data-cy="container">
            <Space>
                <div data-cy="dateTime">
                    <DatePicker {...props} type="dateTime" defaultPickerValue={defaultPickerValue} />
                </div>
                <div data-cy="dateTimeRange">
                    <DatePicker {...props} type="dateTimeRange" defaultPickerValue={defaultPickerValue2} />
                </div>
            </Space>
        </div>
    );
}