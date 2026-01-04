import React from 'react';
import { DatePicker, Space, Button } from '../../../index';

InputFormatConfirm.storyName = '输入时间 + needConfirm';

export default function InputFormatConfirm() {
    const [insetInput, setInputInput] = React.useState(false);
    const format = 'yyyy-MM-dd HH:mm';
    const defaultPickerValue = '2021-03-15 14:00';
    const defaultPickerValue2 = ['2021-01-10 00:01', '2021-03-15 23:59'];
    
    const handleChange = (...args) => {
        console.log('change', ...args);
    };
        
    const handleConfirm = (...args) => {
        console.log('confirm', ...args);
    };

    const props = {
        format,
        onChange: handleChange,
        onConfirm: handleConfirm,
        motion: false,
        needConfirm: true,
        insetInput
    };

    return (
        <div data-cy="container">
            <Space>
                <Button data-cy="inset-switch" onClick={() => setInputInput(!insetInput)}>{`insetInput=${insetInput}`}</Button>
                <Space>
                    <div data-cy="dateTime">
                        <DatePicker {...props} type="dateTime" defaultPickerValue={defaultPickerValue} />
                    </div>
                    <div data-cy="dateTimeRange">
                        <DatePicker {...props} type="dateTimeRange" defaultPickerValue={defaultPickerValue2} />
                    </div>
                </Space>
            </Space>
        </div>
    );
}