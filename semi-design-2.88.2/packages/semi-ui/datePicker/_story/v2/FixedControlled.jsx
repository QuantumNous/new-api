import React from 'react';
import { DatePicker } from '@douyinfe/semi-ui';

const App = () => (
    <>
        <DatePicker
            type="dateRange"
            defaultPickerValue="2022-08-01"
            value={[new Date('2022-08-08'), new Date('2022-08-09')]}
            style={{ width: 400 }}
        />
    </>
);

export default App;