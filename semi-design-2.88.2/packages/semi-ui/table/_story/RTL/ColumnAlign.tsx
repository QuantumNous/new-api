import React from 'react';
import { Space } from '../../../index';
import ColumnAlign from '../v2/columnAlign';
import RTLWrapper from '../../../configProvider/_story/RTLDirection/RTLWrapper';

function App() {
    return (
        <Space vertical align='start' style={{ width: 800 }}>
            <RTLWrapper defaultDirection='rtl'>
                <ColumnAlign />
            </RTLWrapper>
            <RTLWrapper defaultDirection='ltr'>
                <ColumnAlign />
            </RTLWrapper>
        </Space>
    );
}

App.storyName = 'column align';
App.parameters = {
    chromatic: { disableSnapshot: false },
};

export default App;
