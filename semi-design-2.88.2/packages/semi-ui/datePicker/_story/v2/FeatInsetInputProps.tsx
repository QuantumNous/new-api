import React from 'react';
import { DatePicker, Space, Button } from '../../../index';
import { DatePickerProps } from '../../index';

/**
 * Test with Chromatic
 */
export default function App() {
    const spacing = [200, 400];
    const [density, setDensity] = React.useState(false);
    // const defaultValue = '2022-01-15';
    // const defaultRangeValue = ['2022-12-10', '2022-01-15'];

    const props: DatePickerProps = {
        defaultOpen: true,
        motion: false,
        density: density ? 'compact' : 'default',
        defaultPickerValue: '2022-01-15',
        insetInput: {
            placeholder: {
                dateStart: '开始日期',
                dateEnd: '开始日期',
                timeStart: '开始时间',
                timeEnd: '结束时间',
            },
        }
    };

    const handleToggleDensity = () => {
        setDensity(!density);
    };

    return (
        <div style={{ height: '200vh' }}>
            <div style={{ marginBottom: 12 }}>
                <Space>
                    <Button onClick={handleToggleDensity}>
                        {`小尺寸=${density}`}
                    </Button>
                </Space>
            </div>
            <Space wrap spacing={spacing}>
                <DatePicker placeholder='选择单个日期' {...props} />
                <DatePicker placeholder='选择月' {...props} type='month' dropdownClassName="chromatic-ignore" />
                <DatePicker placeholder='选择日期时间' {...props} type='dateTime' />
                <DatePicker placeholder='选择日期范围' {...props} type='dateRange' />
                <DatePicker placeholder='选择日期时间范围' {...props} type='dateTimeRange' />
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
App.storyName = 'insetInputProps';