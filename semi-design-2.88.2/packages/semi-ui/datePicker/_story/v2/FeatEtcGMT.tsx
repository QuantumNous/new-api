import React, { useMemo } from 'react';
import { DatePicker, Space } from '@douyinfe/semi-ui';

App.storyName = 'timeZone Etc/GMT*';

/**
 * test with chromatic
 * @see https://github.com/DouyinFE/semi-design/issues/1585
 */
export default function App(props = {}) {
    const gmtList = useMemo(() => {
        const list = [];
        for (let hourOffset = -11; hourOffset <= 14; hourOffset++) {
            const prefix = hourOffset >= 0 ? '+' : '-';
            const hOffset = Math.abs(parseInt(hourOffset, 10));
            list.push(`GMT${prefix}${String(hOffset).padStart(2, '0')}:00`);
        }
        return list;
    }, []);
    return (
        <Space vertical>
            {gmtList.map(gmt => (
                <DatePicker key={gmt} prefix={gmt} timeZone={gmt} type={'dateTime'} defaultValue={1683084540000} />
            ))}
        </Space>
    );
}
