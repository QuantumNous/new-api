import React from 'react';
import { DatePicker } from '../../../index';
import { DisabledDateType } from '../../index';
import * as dateFns from 'date-fns';

App.storyName = '根据 focus 状态禁用日期';
/**
 * test with cy
 */
function App() {
    const today = new Date('2021-10-20');
    const disabledDate: DisabledDateType = (date, options) => {
        const { rangeInputFocus } = options;
        const baseDate = dateFns.set(today, { hours: 0, minutes: 0, seconds: 0, milliseconds: 0 });
        if (rangeInputFocus === 'rangeStart') {
            const disabledStart = dateFns.subDays(baseDate, 2);
            const disabledEnd = dateFns.addDays(baseDate, 2);
            return disabledStart <= date && date <= disabledEnd;
        } else if (rangeInputFocus === 'rangeEnd') {
            const disabledStart = dateFns.subDays(baseDate, 3);
            const disabledEnd = dateFns.addDays(baseDate, 3);
            return disabledStart <= date && date <= disabledEnd;
        } else {
            return false;
        }
    };

    return (
        <div>
            <h4>{`开始禁用 ${dateFns.format(today, 'yyyy-MM-dd')} 的前 2 日和后 2 日，结束日期禁用当前日期的前 3 天和后 3 天`}</h4>
            <DatePicker motion={false} type='dateRange' disabledDate={disabledDate} defaultPickerValue={today} />
        </div>
    );
}

export default App;