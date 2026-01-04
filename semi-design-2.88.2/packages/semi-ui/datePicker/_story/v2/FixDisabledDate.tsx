import React from 'react';
import { DatePicker } from '@douyinfe/semi-ui';
import * as dateFns from 'date-fns';

App.storyName = 'fix disabled date';
/**
 * test with cypress, please do not modify
 * @returns 
 */
export default function App() {
    const today = new Date('2023-05-06');
    const disabledDate = (date, options) => {
        const { rangeInputFocus } = options;
        const baseDate = dateFns.set(today, { hours: 0, minutes: 0, seconds: 0, milliseconds: 0 });
        if (rangeInputFocus === 'rangeStart') {
            const disabledStart = dateFns.subDays(baseDate, 2);
            const disabledEnd = dateFns.addDays(baseDate, 2);
            return disabledStart <= date && date <= disabledEnd;
        } else if (rangeInputFocus === 'rangeEnd') {
            const disabledStart = dateFns.subDays(baseDate, 3);
            const disabledEnd = dateFns.addDays(baseDate, 3);
            const result = disabledStart <= date && date <= disabledEnd;
            console.log('date', date, options, result);
            return result;
        } else {
            return false;
        }
    };

    return (
        <div>
            <h4>{`开始日期禁用今天前2日和后2日，结束日期禁用今天前3天和后3天`}</h4>
            <DatePicker motion={false} type='dateRange' disabledDate={disabledDate} defaultPickerValue={today} />
        </div>
    );
}
