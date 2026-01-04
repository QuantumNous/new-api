import React, { useState, useMemo } from 'react';
import * as dateFns from 'date-fns';

import { TimePicker, Button, Icon } from '../../../index';

export default function Demo() {
    const formatToken = 'HH:mm:ss';
    const [time, setTime] = useState(new Date());
    const triggerIcon = useMemo(() => {
        return time ? (
            <Icon
                type={'close'}
                onClick={e => {
                    e && e.stopPropagation();
                    setTime();
                }}
            />
        ) : (
            <Icon type={'chevron_down'} />
        );
    }, [time]);

    return (
        <TimePicker
            value={time}
            format={formatToken}
            onChange={time => setTime(time)}
            triggerRender={({ placeholder }) => (
                <Button theme={'light'} icon={triggerIcon} iconPosition={'right'}>
                    {time ? dateFns.format(time, formatToken) : placeholder}
                </Button>
            )}
        />
    );
}
