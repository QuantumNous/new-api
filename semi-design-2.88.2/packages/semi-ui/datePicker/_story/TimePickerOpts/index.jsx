import React from 'react';
import DatePicker from '../../index';

export default function Demo() {
    return (
        <div>
            <div>minuteStep: 15</div>
            <DatePicker
                type="dateTimeRange"
                timePickerOpts={{
                    minuteStep: 15,
                }}
            /><br /><br />
        </div>
    );
}
