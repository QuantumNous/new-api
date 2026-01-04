import React, { useRef } from 'react';
import type { BaseDatePicker } from '../../index';
import { DatePicker, Space, Button } from '../../../index';

/**
 * test in cypress
 */
export default function Demo() {
    const ref = useRef<BaseDatePicker>();

    const handleClickOutside = () => {
        console.log('click outside');
    };

    return (
        <Space vertical align={'start'}>
            <Space>
                <Button onClick={() => ref.current.open()}>open</Button>
                <Button onClick={() => ref.current.close()}>close</Button>
            </Space>
            <div>
                <DatePicker motion={false} type="dateTime" needConfirm ref={ref} onClickOutSide={handleClickOutside} />
            </div>
        </Space>
    );
}

Demo.storyName = 'ref open & close';
Demo.parameters = {
    chromatic: { disableSnapshot: false },
};
