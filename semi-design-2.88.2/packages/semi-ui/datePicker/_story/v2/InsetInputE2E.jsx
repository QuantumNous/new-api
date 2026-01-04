import React from 'react';
import { DatePicker, Space, Button } from '@douyinfe/semi-ui';

/**
 * Test with Cypress
 * Don't modify DOM structure
 */
export default function App() {
    const [needConfirm, setNeedConfirm] = React.useState(false);

    const spacing = [200, 400];
    const props = {
        insetInput: true,
        defaultPickerValue: '2021-12-01',
        motion: false,
    };

    const handleToggleNeedConfirm = () => {
        setNeedConfirm(!needConfirm);
    };

    return (
        <div style={{ height: '300vh' }}>
            <div style={{ marginBottom: 12 }}>
                <Space>
                    <Button onClick={handleToggleNeedConfirm} data-cy="btn">
                        {`needConfirm=${needConfirm}`}
                    </Button>
                </Space>
            </div>
            <Space wrap spacing={spacing}>
                <div data-cy="date">
                    <DatePicker placeholder="选择单个日期" {...props} />
                </div>
                <div data-cy="month">
                    <DatePicker
                        {...props}
                        placeholder="选择月"
                        type="month"
                        defaultValue="2021-12"
                        timePickerOpts={{
                            scrollItemProps: { motion: false },
                        }}
                    />
                </div>
                <div data-cy="dateTime">
                    <DatePicker placeholder="选择日期时间" {...props} type="dateTime" needConfirm={needConfirm} />
                </div>
                <div data-cy="dateRange">
                    <DatePicker placeholder="选择日期范围" {...props} type="dateRange" />
                </div>
                <div data-cy="dateTimeRange">
                    <DatePicker
                        placeholder="选择日期时间范围"
                        {...props}
                        type="dateTimeRange"
                        needConfirm={needConfirm}
                    />
                </div>
                <div data-cy="customFormat">
                    <DatePicker placeholder="选择日期范围" {...props} type="dateRange" format="Pp" />
                </div>
            </Space>
        </div>
    );
}

App.parameters = { chromatic: { disableSnapshot: true } };
App.storyName = 'inset input e2e test';
