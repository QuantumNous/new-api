import React from 'react';
import { DatePicker, Space, Button } from '../../../index';

InputFormatDisabled.storyName = '输入禁用日期，不回显在面板上';

/**
 * 优化 input format
 */
export default function InputFormatDisabled() {
    const handleChange = (...args) => {
        console.log('change', ...args);
    };

    const disabledDate = (date) => {
        return date.getDate() === 15;
    };

    return (
        <div data-cy="container">
            <Space>
                <div data-cy="date">
                    <DatePicker disabledDate={disabledDate} onChange={handleChange} />
                </div>
            </Space>
        </div>
    );
}