import React, { useState, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import { IconClose, IconChevronDown } from '@douyinfe/semi-icons';

import { DatePicker, Button } from '../../../index';

Demo.parameters = {
    chromatic: { disableSnapshot: true },
};

export default function Demo() {
    const [date, setDate] = useState(new Date());
    const formatToken = 'yyyy-MM-dd';
    const onChange = useCallback((dateStr, date) => {
        setDate(date);
    }, []);
    const onClear = useCallback(e => {
        e && e.stopPropagation();
        setDate(null);
    }, []);

    const closeIcon = useMemo(() => (date ? <IconClose onClick={onClear} /> : <IconChevronDown />), [date]);

    return (
        <DatePicker
            onChange={onChange}
            value={date}
            format={formatToken}
            triggerRender={({ value, placeholder }) => (
                <Button theme={'light'} icon={closeIcon} iconPosition={'right'}>
                    {(date && format(date, formatToken)) || placeholder}
                </Button>
            )}
        />
    );
}
