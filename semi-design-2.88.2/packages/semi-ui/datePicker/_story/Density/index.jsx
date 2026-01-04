import React, { useState } from 'react';
import { DatePicker, ConfigProvider, ButtonGroup, Button } from '../../../index';
import * as dateFns from 'date-fns';

export default function Demo() {
    const [direction, setDirection] = useState();
    const presets = [
        {
            text: 'Today',
            start: new Date(),
            end: new Date(),
        },
        () => ({
            text: 'Tomorrow',
            start: new Date(new Date().valueOf() + 1000 * 3600 * 24),
            end: new Date(new Date().valueOf() + 1000 * 3600 * 24),
        }),
    ];

    return (
        <div>
            <div style={{ marginBottom: 20 }}>
                <ButtonGroup>
                    <Button onClick={() => setDirection('ltr')}>LTR</Button>
                    <Button onClick={() => setDirection('rtl')}>RTL</Button>
                </ButtonGroup>
            </div>
            <ConfigProvider direction={direction}>
                <span>compact</span>
                <DatePicker density="compact" />
                <br /><br />

                <span>compact+dateRange</span>
                <DatePicker type="dateRange" density="compact" />
                <br /><br />

                <span>compact+dateTime</span>
                <DatePicker type="dateTime" density="compact" defaultOpen />
                <br /><br />

                <span>compact+dateTimeRange</span>
                <DatePicker type="dateTimeRange" density="compact" />
                <br /><br />

                <span>compact+year/month</span>
                <DatePicker type="month" density="compact" />
                <br /><br />

                <span>compact+presets</span>
                <DatePicker type="dateTime" density="compact" presets={presets} />
                <br /><br />

                <span>compact+needConfirm</span>
                <DatePicker type="dateTime" density="compact" needConfirm />
                <br /><br />

                <span>compact+startDateOffset+endDateOffset</span>
                <DatePicker
                    type="dateRange"
                    density="compact"
                    weekStartsOn={1}
                    startDateOffset={date => dateFns.startOfWeek(date, { weekStartsOn: 1 })}
                    endDateOffset={date => dateFns.endOfWeek(date, { weekStartsOn: 1 })}
                />
                <br /><br />
            </ConfigProvider>
        </div>
    );
}
