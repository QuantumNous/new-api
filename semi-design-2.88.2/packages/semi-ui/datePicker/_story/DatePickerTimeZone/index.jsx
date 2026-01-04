import React, { useState, useMemo } from 'react';
import { Select, DatePicker, ConfigProvider } from '../../../index';
// import './index.scss';

export default function Demo(props = {}) {
    const selectList = ['-10:00', '-09:00', '-08:00', '-07:00', '-06:00'];
    const defaultTimeZone = selectList[1];
    const [tz, setTZ] = useState(defaultTimeZone);
    const optionList = useMemo(() => selectList.map(e => ({ label: e, value: e })), []);
    // console.log(tz.valueOf());
    return (
        <ConfigProvider timeZone={tz}>
            <Select
                optionList={optionList}
                onChange={setTZ}
                defaultValue={defaultTimeZone}
                prefix={'时区'}
            />
            <DatePicker
                style={{ width: '350px' }}
                type="dateTime"
                onChange={console.log}
            />
        </ConfigProvider>
    );
}
