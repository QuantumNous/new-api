import DatePicker from '../../index';
import React from 'react';
import { set } from 'date-fns';

/**
 * test by cypress, don't modify this story
 */
export default function App() {
    const disabledDate = (date: Date) => {
        const isBefore = date < set(date, { year: 2021, month: 10 });
        const isAfter = date > set(date, { year: 2022, month: 10 });
        return isBefore || isAfter;
    };

    return (
        <DatePicker
            motion={false}
            yearAndMonthOpts={{ motion: false }}
            disabledDate={disabledDate}
            defaultValue={new Date('2022-11')}
            type="month"
            onChange={console.log}
            style={{ width: 140 }}
        />
    );
}