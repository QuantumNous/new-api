import React, { useState } from 'react';
import { ButtonGroup, Button, ConfigProvider } from '../../../index';

export default function RTLWrapper({ children, onDirectionChange, defaultDirection = 'ltr' }: { defaultDirection?: 'ltr' | 'rtl'; children: React.ReactNode; onDirectionChange?: (direction: 'ltr' | 'rtl') => void }) {
    const [direction, setDirection] = useState(defaultDirection);
    const handleDirectionChange = dir => {
        setDirection(dir);

        if (typeof onDirectionChange === 'function') {
            onDirectionChange(dir);
        }
    };

    return (
        <div style={{ width: '100%' }}>
            <div style={{ marginBottom: 20 }}>
                <ButtonGroup>
                    <Button onClick={() => handleDirectionChange('ltr')}>LTR</Button>
                    <Button onClick={() => handleDirectionChange('rtl')}>RTL</Button>
                </ButtonGroup>
                {`direction=${direction}`}
            </div>
            <ConfigProvider direction={direction}>
                {children}
            </ConfigProvider>
        </div>
    );
}