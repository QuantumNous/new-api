import React from 'react';
import { DatePicker, Space } from '../../../index';

App.storyName = 'year scroll range';

/**
 * @see https://github.com/DouyinFE/semi-design/issues/1620
 */
export default function App() {
    return (
        <div data-cy="container">
            <Space vertical align="start">
                <DatePicker type="dateTime" startYear={2000} endYear={2300} />
                <DatePicker type="month" startYear={2000} endYear={2300} />
            </Space>
        </div>
    );
}