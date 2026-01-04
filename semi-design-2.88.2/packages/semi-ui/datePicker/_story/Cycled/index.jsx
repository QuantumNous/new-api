import React from 'react';
import DatePicker from '../../index';

export default function Demo() {
    return (
        <div>
            <div>时分秒选择不无限滚动</div>
            <DatePicker type="dateTime" timePickerOpts={{ scrollItemProps: { cycled: false } }} />
        </div>
    );
}
