import React from 'react';

import { DatePicker } from '../../../index';

export default function Demo() {
    const createLog = (event, cb) => {
        return function log(...args) {
            console.log(`${event}: `, ...args);

            if (typeof cb === 'function') {
                cb(...args);
            }
        };
    };

    return (
        <DatePicker
            defaultValue={new Date()}
            onBlur={createLog('onBlur')}
            onFocus={createLog('onFocus')}
            onChange={createLog('onChange')}
        />
    );
}
