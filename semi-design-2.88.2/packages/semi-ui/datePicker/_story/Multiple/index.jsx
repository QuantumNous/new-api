import React from 'react';
import { DatePicker } from '../../../index';

export default function Demo() {
    return (
        <div>
            <span>date 多选</span>
            <DatePicker multiple />
            <br />

            <span>date 多选，max=5</span>
            <DatePicker multiple max={5} />
            <br />

            <span>date defaultValue</span>
            <DatePicker multiple defaultValue={['2019-10-01', '2019-10-03', '2019-10-07']} />
            <br />

            <span>dateTime 多选，max=5</span>
            <DatePicker type={'dateTime'} multiple max={5} />
            <br />
        </div>
    );
}
