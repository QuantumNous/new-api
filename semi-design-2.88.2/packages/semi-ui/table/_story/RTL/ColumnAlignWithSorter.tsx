import React from 'react';
import { Space } from '../../../index';
import ColumnAlignWithSorter from '../v2/columnAlignWithSorter';
import RTLWrapper from '../../../configProvider/_story/RTLDirection/RTLWrapper';

function App() {
    return (
        <Space vertical align='start' style={{ width: 1200 }}>
            <RTLWrapper defaultDirection='rtl'>
                <ColumnAlignWithSorter />
            </RTLWrapper>
            <RTLWrapper defaultDirection='ltr'>
                <ColumnAlignWithSorter />
            </RTLWrapper>
        </Space>
    );
}

App.parameters = {
    chromatic: {
        delay: 3000,
    },
};

export default App;
