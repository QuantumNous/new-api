import React from 'react';
import { DatePicker, Space } from '../../../index';

App.storyName = "fix defaultPickerValue number bug";
export default function App() {
    const defaultPickerValue = new Date('2021-03-15 00:00:00').valueOf();
    const defaultPickerValueArray = [new Date('2021-03-15 00:00:00').valueOf(), new Date('2021-05-15 23:59:59').valueOf()];
    return (            
        <Space>
            <div data-cy="dateTime">
                <DatePicker
                    type="dateTime"
                    defaultPickerValue={defaultPickerValue}
                />
            </div>
            <div data-cy="dateTimeRange">
                <DatePicker
                    type="dateTimeRange"
                    defaultPickerValue={defaultPickerValueArray}
                />
            </div>
            <div data-cy="before-1970">
                <DatePicker
                    type="dateTime"
                    defaultPickerValue={new Date('1910-01-01 13:00:00')}
                />
            </div>
        </Space>

    );
}