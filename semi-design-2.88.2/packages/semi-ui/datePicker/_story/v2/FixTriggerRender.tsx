import React, { useState, useCallback, useMemo } from 'react';
import { DatePicker, Button, Icon, Space } from '../../../index';

export default function Demo() {
    const [date, setDate] = useState([]);
    const onChange = useCallback(date => {
        setDate(date);
        console.log(date);
    }, []);
    const onClear = useCallback(e => {
        e && e.stopPropagation();
        setDate(null);
    }, []);

    const closeIcon = useMemo(() => (date ? <Icon type="close" onClick={onClear} /> : <Icon type="chevron_down" />), [date]);

    return (
        <Space>
            <DatePicker
                type="dateTimeRange"
                onChange={onChange}
                value={date}
                triggerRender={({ placeholder }) => (
                    <Button theme={'light'} icon={closeIcon} iconPosition={'right'}>
                        {(date && String(date)) || placeholder}
                    </Button>
                )}
            />
            <DatePicker
                type="dateRange"
                motion={false}
                triggerRender={({ placeholder }) => <Button theme={'light'}>{placeholder}</Button>}
            />
        </Space>
    );
}
