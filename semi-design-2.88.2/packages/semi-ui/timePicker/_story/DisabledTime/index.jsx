import React from 'react';
import { range } from 'lodash';
import { TimePicker } from '../../../index';

export default function Demo() {
    return (
        <div>
            <TimePicker
                panelHeader={'Time Select'}
                onChange={val => console.log(val)}
                disabledHours={() => [1, 2]}
                disabledMinutes={hour => (hour == 3 ? range(0, 10, 1) : [])}
                disabledSeconds={(hour, minute) => (hour === 4 && minute === 15 ? range(0, 10, 1) : [])}
            />
        </div>
    );
}
