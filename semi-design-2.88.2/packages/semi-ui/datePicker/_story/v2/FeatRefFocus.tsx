import React, { useRef } from 'react';
import type { BaseDatePicker } from '../../index';
import { DatePicker, Space, Button } from '../../../index';

/**
 * test in cypress
 */
export default function Demo() {
    const ref = useRef<BaseDatePicker>();
    const rangeRef = useRef<BaseDatePicker>();
    const insetRef = useRef<BaseDatePicker>();

    const handleFocusInset = (focusType) => {
        insetRef.current.focus(focusType);
        insetRef.current.open();
    };

    const handleBlurInset = () => {
        insetRef.current.blur();
        insetRef.current.close();
    };

    return (
        <Space vertical align={'start'}>
            <Space vertical align={'start'} data-cy="single">
                <h4>单个输入框</h4>
                <Space>
                    <Button onClick={() => ref.current.focus()}>focus</Button>
                    <Button onClick={() => ref.current.blur()}>blur</Button>
                </Space>
                <div>
                    <DatePicker motion={false} type="dateTime" ref={ref} />
                </div>
            </Space>
            <Space vertical align={'start'} data-cy="range">
                <h4>两个输入框</h4>
                <Space>
                    <Button onClick={() => rangeRef.current.focus()}>focus default</Button>
                    <Button onClick={() => rangeRef.current.focus('rangeEnd')}>focus end</Button>
                    <Button onClick={() => rangeRef.current.blur()}>blur</Button>
                </Space>
                <div>
                    <DatePicker motion={false} type="dateRange" ref={rangeRef} />
                </div>
            </Space>
            <Space vertical align={'start'} data-cy="inset">
                <h4>内嵌输入框</h4>
                <Space>
                    <Button onClick={handleFocusInset}>focus start + open</Button>
                    <Button onClick={() => handleFocusInset('rangeEnd')}>focus end + open</Button>
                    <Button onClick={handleBlurInset}>blur + close</Button>
                </Space>
                <div>
                    <DatePicker motion={false} insetInput type="dateRange" ref={insetRef} />
                </div>
            </Space>
        </Space>
    );
}

Demo.storyName = 'ref focus & blur';
Demo.parameters = {
    chromatic: { disableSnapshot: false },
};
