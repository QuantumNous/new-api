import React from 'react';
import { DatePicker, Space, Input, Button, Select } from '@douyinfe/semi-ui';
import { Position } from '@douyinfe/semi-foundation/tooltip/foundation';
import { strings } from '@douyinfe/semi-foundation/tooltip/constants';
import * as dateFns from 'date-fns';

/**
 * Test with Chromatic
 */
export default function App() {
    const spacing = [200, 400];
    const [date, setDate] = React.useState();
    const [insetInput, setInsetInput] = React.useState(true);
    const [position, setPosition] = React.useState('leftTopOver');
    const [needConfirm, setNeedConfirm] = React.useState(false);
    const [density, setDensity] = React.useState(true);

    const props = {
        defaultOpen: true,
        motion: false,
        insetInput,
        defaultPickerValue: '2021-12-01',
        position,
        density: density ? 'compact' : 'default',
        autoAdjustOverflow: false,
    };

    const positionOptionList = strings.POSITION_SET.map((position) => ({
        value: position,
        label: position,
        key: position,
    }));

    const triggerRender = ({ placeholder }) => {
        const format = 'Pp';
        const value = (date && dateFns.format(date, format)) || placeholder;
        return <Input value={value} readOnly />;
    };

    const handleDateChange = (date) => {
        setDate(date);
    };

    const handleBtnClick = () => {
        setInsetInput(!insetInput);
    };

    const handleReset = () => {
        setInsetInput(true);
        setPosition('leftTopOver');
    };

    const handleToggleNeedConfirm = () => {
        setNeedConfirm(!needConfirm);
    };

    const handleToggleDensity = () => {
        setDensity(!density);
    };

    return (
        <div style={{ height: '200vh' }}>
            <div style={{ marginBottom: 12 }}>
                <Space>
                    <Button onClick={handleBtnClick}>
                        {`insetInput=${insetInput}`}
                    </Button>
                    <Button onClick={handleToggleNeedConfirm}>
                        {`needConfirm=${needConfirm}`}
                    </Button>
                    <Button onClick={handleToggleDensity}>
                        {`小尺寸=${density}`}
                    </Button>
                    <Select
                        style={{ width: 200 }}
                        optionList={positionOptionList} 
                        placeholder='选择position'
                        value={position}
                        onChange={setPosition}
                        showClear
                    />
                    <Button onClick={handleReset} theme="solid">reset</Button>
                </Space>
            </div>
            <Space wrap spacing={spacing}>
                <DatePicker placeholder='选择单个日期' {...props} />
                <DatePicker placeholder='选择月' {...props} type='month' defaultOpen={false} />
                <DatePicker placeholder='选择日期时间' {...props} type='dateTime' needConfirm={needConfirm} />
                <DatePicker placeholder='选择日期范围' {...props} type='dateRange' />
                <DatePicker placeholder='选择日期时间范围' {...props} type='dateTimeRange' needConfirm={needConfirm} />
                <DatePicker placeholder='format=Pp' {...props} format='yyyy-MM-dd  HH:mm:ss' type='dateTimeRange' />
            </Space>
        </div>
    );
}

App.parameters = {
    chromatic: {
        disableSnapshot: false,
        delay: 3000,
        viewports: [1800]
    },
};
App.storyName = 'inset input';