import React, { useState } from 'react';
import DatePicker from '../../index';

export default function Demo() {
    const [timestamp, setTimestamp] = useState(0);
    const [timestamps, setTimestamps] = useState([0, 0]);
    const log = (...args) => console.log(...args);

    return (
        <div>
            <DatePicker value={timestamp} onChange={(str, date) => setTimestamp(date && date.valueOf())} />
            <DatePicker
                type={'dateTimeRange'}
                value={timestamps}
                onChange={(strs, dates) => setTimestamps(dates.map(d => d && d.valueOf()))}
            />
            <DatePicker defaultValue={[0, 0]} disabled />
        </div>
    );
}
