import React, { useState } from 'react';
import { DatePicker, Space } from "../../../index";

/**
 * fix https://github.com/DouyinFE/semi-design/issues/1413
 */
export default function App() {
    const [date, setDate] = useState();
    const defaultPickerValue = ['2022-02-07', '2023-02-07'];
    const handleDateChange = value => {
        setDate(value);
    };
    return (
        <Space>
            <DatePicker defaultPickerValue={defaultPickerValue} type="dateTimeRange" value={date} onChange={handleDateChange} insetInput />
            <DatePicker defaultPickerValue={defaultPickerValue} type="dateTimeRange" insetInput placeholder={"非受控"} />
        </Space>
    );
}

App.storyName = '修复受控内嵌输入框类型';