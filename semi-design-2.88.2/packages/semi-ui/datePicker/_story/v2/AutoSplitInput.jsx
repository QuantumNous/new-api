import React from 'react';
import { DatePicker, Space, Input } from '../../../index';

/**
 * 输入开始日期后，自动拆分并选中
 */
export default function AutoSplitInput() {
    const format = 'yyyy-MM-dd HH:mm:ss';
    
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
        <Space data-cy="container" vertical align="start">
            <div>复制文本，粘贴到 DatePicker 内嵌第一个输入框内</div>
            <Space>
                <Input style={{ width: 200 }} defaultValue="2023-09-05 17:41:36" />
                <div data-cy="dateTime">
                    <DatePicker {...props} type="dateTime" />
                </div>
            </Space>
            <Space>
                <Input style={{ width: 400 }} defaultValue="2023-10-09 16:14:31 ~ 2023-10-13 16:14:31" />
                <div data-cy="dateTimeRange">
                    <DatePicker {...props} type="dateTimeRange" />
                </div>
            </Space>
        </Space>
    );
}