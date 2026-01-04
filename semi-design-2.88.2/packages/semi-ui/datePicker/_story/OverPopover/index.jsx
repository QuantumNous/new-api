import React from 'react';
import { format } from 'date-fns';

import { DatePicker, Button, Popover } from '../../../index';

export default function Demo() {
    return (
        <Popover
            content={
                <DatePicker
                    defaultValue={'2020-03-15 08:09:11'}
                    triggerRender={({ value, inputValue, placeholder }) => (
                        <Button>{(value && value[0] && format(value[0], 'yyyy-MM-dd')) || placeholder}</Button>
                    )}
                />
            }
            trigger={'click'}
        >
            <Button>Click Me</Button>
        </Popover>
    );
}
