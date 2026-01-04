import React from 'react';
import { DatePicker } from '@douyinfe/semi-ui';
import * as dateFns from 'date-fns';

/**
 * test with cypress, please do not modify
 */
export default function App() {
    const today = new Date('2023-04-01');
    const disabledDate = (date, options) => {
        const { rangeInputFocus } = options;
        const baseDate = dateFns.set(today, { hours: 0, minutes: 0, seconds: 0, milliseconds: 0 });
        if (rangeInputFocus === 'rangeStart') {
            const endDate = new Date(options.rangeEnd);
            const disabledStart = dateFns.subDays(endDate, 20);
            return date <= disabledStart;
        } else if (rangeInputFocus === 'rangeEnd') {
            const startDate = new Date(options.rangeStart);
            const disabledEnd = dateFns.addDays(startDate, 20);
            return date >= disabledEnd;
        } else {
            return false;
        }
    };
    return (
        <div>
            <DatePicker motion={false} type='dateRange' disabledDate={disabledDate} defaultPickerValue={today} />
        </div>
    );
}

App.storyName = 'fix dynamic disabledDate';