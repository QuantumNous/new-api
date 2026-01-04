import React from 'react';
import { DatePicker, Space, Button } from '../../../index';

InputFormat.storyName = '输入部分日期，回显在面板上';

/**
 * 优化 input format
 */
export default function InputFormat() {
    const handleChange = (...args) => {
        console.log('change', ...args);
    };

    return (
        <div data-cy="container">
            <Space>
                <div data-cy="date">
                    <DatePicker onChange={handleChange} />
                </div>
                <div data-cy="dateRange">
                    <DatePicker onChange={handleChange} type="dateRange" />
                </div>
                <div data-cy="dateTime">
                    <DatePicker onChange={handleChange} type="dateTime" />
                </div>
            </Space>
        </div>
    );
}