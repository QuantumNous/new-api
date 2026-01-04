import React, { useState } from 'react';
import { ButtonGroup, Button, ConfigProvider } from '@douyinfe/semi-ui';

export default function RTLWrapper({ children, onDirectionChange }: { children: React.ReactNode; onDirectionChange?: (direction: 'ltr' | 'rtl') => void }) {
    const [direction, setDirection] = useState();
    const handleDirectionChange = dir => {
        setDirection(dir);
        
        if (typeof onDirectionChange === 'function') {
            onDirectionChange(dir);
        }
    };

    return (
        <>
            <div style={{ marginBottom: 20 }}>
                <ButtonGroup>
                    <Button onClick={() => handleDirectionChange('ltr')}>LTR</Button>
                    <Button onClick={() => handleDirectionChange('rtl')}>RTL</Button>
                </ButtonGroup>
            </div>
            <ConfigProvider direction={direction}>
                {children}
            </ConfigProvider>
        </>
    );
}