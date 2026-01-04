import React from 'react';
import DatePicker from '../../index';

/**
 * test with cypress
 * 
 * fix issue 1221
 * @see https://github.com/DouyinFE/semi-design/issues/1221
 */
export default function App() {
    return (
        <div>
            <DatePicker type="dateRange" defaultPickerValue={'2019-07-01'} style={{ width: 260 }} onChange={console.log} />
            <br /><br />
            <DatePicker type="dateTimeRange" defaultPickerValue={'2019-07-01'} style={{ width: 260 }} onChange={console.log} />
            <br /><br />
            <DatePicker type="dateRange" defaultValue={['2019-07-01', '2019-08-02']} style={{ width: 260 }} onChange={console.log} />
            <br /><br />
            <DatePicker type="dateTimeRange" defaultValue={['2019-07-01', '2019-08-02']} style={{ width: 260 }} onChange={console.log} />
        </div>
    );
}

App.storyName = '修复范围面板漂移问题';