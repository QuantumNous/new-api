import React, { useState } from 'react';
import DatePicker from '../../index';

/**
 * test with cypress
 *
 * fix issue 1422
 * @see https://github.com/DouyinFE/semi-design/issues/1422
 */
export default function App() {
    const [date, setDate] = useState();
    const handleChange = newDate => {
        setDate(newDate);
    };
    return (
        <div>
            <DatePicker
                type="date"
                multiple
                defaultPickerValue={'2019-07-01'}
                style={{ width: 260 }}
                onChange={console.log}
            />
            <DatePicker
                type="date"
                multiple
                defaultPickerValue={'2019-07-01'}
                placeholder="受控"
                style={{ width: 260 }}
                value={date}
                onChange={handleChange}
            />
        </div>
    );
}

App.storyName = '修复多选面板漂移问题';
