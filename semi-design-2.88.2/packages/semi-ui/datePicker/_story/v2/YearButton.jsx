import React from 'react';
import { DatePicker } from '../../../index';

export default function App() {
    return (
        <div>
            <h4>type=date</h4>
            <DatePicker />
            <h4>type=dateRange</h4>
            <DatePicker type="dateRange" defaultPickerValue="2021-12" />
            <h4>type=dateTimeRange</h4>
            <DatePicker type="dateTimeRange" />
            <h4>type=dateRange + compact</h4>
            <DatePicker type="dateRange" density="compact" />
        </div>
    );
}