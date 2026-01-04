import React, { useState } from 'react';
import ColumnAlign from '../v2/columnAlign';
import { Space, Button, ConfigProvider } from '../../../';

function App() {
    const [propDirection, setDirection] = React.useState('ltr');
    return (
        <Space vertical align="start">
            <Space>
                <span>table direction = {propDirection}</span>
                <span>ConfigProvider direction = rtl</span>
                <Button onClick={() => setDirection('ltr')}>table prop ltr</Button>
                <Button onClick={() => setDirection('rtl')}>table prop rtl</Button>
                <Button onClick={() => setDirection()}>table prop undefined</Button>
            </Space>
            <div style={{ width: 800 }}>
                <ConfigProvider direction='rtl'>
                    <ColumnAlign direction={propDirection} />
                </ConfigProvider>
            </div>
        </Space>
    );
}

App.storyName = 'table direction rtl';
App.parameters = {
    chromatic: { disableSnapshot: false },
};

export default App;
