import React, { useState } from 'react';
import { DatePicker } from '@douyinfe/semi-ui';

/**
 * @see https://github.com/DouyinFE/semi-design/issues/2521
 * 
 * related to issue #2388
 * @see https://github.com/DouyinFE/semi-design/pull/2388
 */
const App = () => {
    const [v, setV] = useState([]);
    const handleChange = (value) => {
        setV(value);
    };
    
    return (
        <DatePicker value={v} type="dateRange" defaultPickerValue={['2023-10-01']} style={{ width: 260 }} onChange={handleChange} />
    );
};

export default App;