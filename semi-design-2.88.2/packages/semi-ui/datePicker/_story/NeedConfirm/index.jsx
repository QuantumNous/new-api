import React, { useState } from 'react';
import { parse } from 'date-fns';
import { DatePicker } from '@douyinfe/semi-ui/';

export default function Demo(props = {}) {
    const [value, setValue] = useState('2019-10-01');
    const dateTimeToken = 'yyyy-MM-dd HH:mm:ss';
    const log = (...args) => console.log(...args);
    const onChange = v => {
        console.log(v);
        setValue(v);
    };
    const printArgs = (...args) => {
        console.log('printArgs: ', ...args);
    };
    const [open, setOpen] = useState(true);
    const [value2, setValue2] = useState(parse('2019-10-02 8:30:02', dateTimeToken, new Date()));
    const [value3] = useState(['2019-10-01', '20191002']);
    const [value4, setValue4] = useState(['2019-10-01', '2019-10-09']);
    const [value5] = useState(['2019-10-01', '2019-11-09']);
    const [value6, setValue6] = useState(['2019-10-01', '20191109']);
    return (
        <>
            <span>dateTime: defaultValue + onConfirm + needConfirm</span>
            <DatePicker type="dateTime" defaultValue={new Date()} onChange={log} needConfirm />
            <br />

            <span>dateTimeRange: defaultValue + onConfirm + needConfirm</span>
            <DatePicker type="dateTimeRange" defaultValue={value6} onChange={log} needConfirm />
            <br />

            <span>dateTime: value + onConfirm + needConfirm</span>
            <DatePicker type="dateTime" value={value2} onConfirm={setValue2} needConfirm />
            <br />

            <span>dateTimeRange: value + onConfirm + needConfirm</span>
            <DatePicker type="dateTimeRange" value={value4} onConfirm={setValue4} onChange={log} needConfirm />
            <br />

            <span>dateTimeRange: value + needConfirm</span>
            <DatePicker type="dateTimeRange" value={value5} onChange={log} needConfirm />
            <br />

            <span>dateTimeRange: value</span>
            <DatePicker
                type="dateTimeRange"
                value={[new Date(), new Date().valueOf() + 3610 * 1000 * 24 * 2]}
                onChange={log}
            />
            <br /><br />

            <div>v1.15 手动输入改变选中，blur 输入框恢复原来的值</div>
            <DatePicker
                type="dateTime"
                needConfirm
                defaultValue={new Date()}
                onConfirm={
                    (...args) => {
                        console.log('Confirmed: ', ...args);
                    }}
                onCancel={
                    (...args) => {
                        console.log('Canceled: ', ...args);
                    }}
                onChange={
                    (...args) => {
                        console.log('Changed: ', ...args);
                    }
                }
            />
            <br />
            <DatePicker
                type="dateTimeRange"
                needConfirm
                style={{ width: 400 }}
                defaultValue={[new Date(), new Date().valueOf() + 3610 * 1000 * 24 * 2]}
                onConfirm={
                    (...args) => {
                        console.log('Confirmed: ', ...args);
                    }}
                onCancel={
                    (...args) => {
                        console.log('Canceled: ', ...args);
                    }}
                onChange={
                    (...args) => {
                        console.log('Changed: ', ...args);
                    }
                }
            />
            <br />
        </>
    );
}
