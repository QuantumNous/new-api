---
localeCode: en-US
order: 38
category: Input
title: DatePicker
subTitle: Date Selector
icon: doc-datepicker
brief: The date selector is used to help the user select a compliant, formatted date (time) or date (time) range.
---

## Demos

### How to import

```jsx import 
import { DatePicker } from '@douyinfe/semi-ui';
```


### Basic Use

```jsx live=true
import React from 'react';
import { DatePicker } from '@douyinfe/semi-ui';

class App extends React.Component {
    render() {
        return <DatePicker onChange={(date, dateString) => console.log(dateString)} style={{ width: 240 }} />;
    }
}
```

### Picker Density

The density can be used to control the size of the picker panel. The `compact` is the small size and the `default` is the default size. Support after v1.17.0.

```jsx live=true
import React from 'react';
import { DatePicker } from '@douyinfe/semi-ui';

function Demo() {
    return (
        <div>
            <DatePicker type="dateTime" density='compact' /><br /><br />
            <DatePicker type="dateRange" density='compact' style={{ width: 260 }} />
        </div>
    );
}
```



### Multiple Date Selection

Set `Multiple` to `true`, can choose multiple dates.

```jsx live=true
import React from 'react';
import { DatePicker } from '@douyinfe/semi-ui';

class App extends React.Component {
    render() {
        return <DatePicker multiple={true} style={{ width: 240 }} />;
    }
}
```

### Date and Time Selection

Set `type` to `dateTime`, can choose date and time.  
Starting from version V2.22.0, we changed the default mode of ScrollItem in TimePicker from wheel to normal. If you want to apply the infinite scrolling effect again, you can enable it by passing in a specific configuration through timePickerOpts.

```jsx live=true
import React from 'react';
import { DatePicker } from '@douyinfe/semi-ui';

class App extends React.Component {
    render() {
        return (
            <>
                <h4>Default date and time selection</h4>
                <DatePicker type="dateTime" />
                <br />
                <br />
                <h4>Turn on cycled mode</h4>
                <DatePicker type="dateTime" timePickerOpts={{ scrollItemProps: { mode: "wheel", cycled: true } }} />
            </>
        );
    }
}
```

### Date Range Selection

Set `type` to `dateRange`, can choose the date range.

```jsx live=true
import React from 'react';
import { DatePicker } from '@douyinfe/semi-ui';

class App extends React.Component {
    render() {
        return <DatePicker type="dateRange" style={{ width: 260 }} onChange={console.log} />;
    }
}
```

<Notice type="primary" title="Note">
    <div>When you use range selection, if only one date is selected, onChange will not be triggered at this time. Only when both the start date and the end date are selected will onChange be triggered.</div>
</Notice>

### Date Time Range Selection

Set `type` to `dateTimeRange`, can choose the date range and choose time;

```jsx live=true
import React from 'react';
import { DatePicker } from '@douyinfe/semi-ui';

class App extends React.Component {
    render() {
        return <DatePicker type="dateTimeRange" style={{ width: 400 }} onChange={console.log} />;
    }
}
```

### Input in Panel

Use `insetInput` to control whether the date panel is inset with the input box, the default is `false`. Supported since `v2.7.0`. Inset input boxes are suitable for the following scenarios:

- Date and time selection, you can directly input the time through the embedded input box, no need to select the time through the scroll wheel
- When `triggerRender`+ range selection, use the inset input box to modify the start and end dates independently

After `insetInput` is turned on, it includes the following functions:

- After clicking the trigger, the panel will pop up in the original position by default. You can customize the popup position by `position`
- Click the embedded date input box, the panel switches to date selection; click the embedded time input box, the panel switches to time selection
- Consistent with the external input box, if an illegal date is entered, the date will return to the previous legal date after the panel is closed

<Notice type="primary" title="Notes">
     <div>Note that some adjustments and restrictions will be made to the components after opening insetInput:</div>
     <div>1. Trigger style: the trigger is read-only when the panel is not open, and the trigger is disabled when it is open</div>
     <div>2. Panel style: when type includes time, hide the toggle button at the bottom</div>
     <div>3. After insetInput is enabled, the `format` API only supports the `dateFormat[ timeFormat]` format. Using other formats will affect the display of the inset input box placeholder and trigger text</div>
</Notice>

```jsx live=true
import React from 'react';
import { DatePicker } from '@douyinfe/semi-ui';

function Demo() {
    return (
        <div>
            <DatePicker type="date" insetInput />
            <br />
            <br />
            <DatePicker type="dateTime" insetInput />
            <br />
            <br />
            <DatePicker type="dateRange" insetInput style={{ width: 260 }} />
            <br />
            <br />
            <DatePicker type="dateTimeRange" insetInput style={{ width: 400 }} />
            <br />
            <br />
            <DatePicker type="month" placeholder="please input month" insetInput style={{ width: 140 }} />
            <br />
            <br />
            <DatePicker type="monthRange" placeholder="please input month Range" insetInput style={{ width: 200 }} />
            <br />
            <br />
            <DatePicker type="dateTime" format="yyyy-MM-dd HH:mm" insetInput />
        </div>
    );
}
```

### Synchronously switch months

version：>= 1.28.0

In the scenario of range selection, turning on `syncSwitchMonth` means to switch the two panels simultaneously. The default is false.

> Note: Clicking the year button will also switch the two panels synchronously. Switching the year and month from the scroll wheel will not switch the panels synchronously. This ensures the user's ability to select months at non-fixed intervals.

```jsx live=true
import React from 'react';
import { DatePicker } from '@douyinfe/semi-ui';

class App extends React.Component {
    render() {
        return (
            <DatePicker
                syncSwitchMonth={true}
                type="dateTimeRange"
                style={{ width: 400 }}
            />
        );
    }
}
```

### Panel Change Callback

version：>=1.28.0

`onPanelChange` will be called when the month or year of the panel is changed.

```jsx live=true
import React from 'react';
import { DatePicker } from '@douyinfe/semi-ui';

class App extends React.Component {
    render() {
        return (
            <DatePicker
                syncSwitchMonth={true}
                type="dateTimeRange"
                style={{ width: 400 }}
                onPanelChange={(date, dateString) => console.log(date, dateString)}
            />
        );
    }
}
```

### Select Week

`daterange` is used with `startDateOffset` and `endDateOffset` to select range with single click, such as weekly selection and biweekly selection. Support after v1.10.0.

```jsx live=true
import React from 'react';
import { DatePicker } from '@douyinfe/semi-ui';

function Demo() {
    const handleChange = date => {
        console.log('date changed', date);
    };

    return (
        <div>
            <h4>Choose a week</h4>
            <DatePicker
                style={{ width: 260 }}
                type="dateRange"
                weekStartsOn={1}
                startDateOffset={date => dateFns.startOfWeek(date, { weekStartsOn: 1 })}
                endDateOffset={date => dateFns.endOfWeek(date, { weekStartsOn: 1 })}
                onChange={handleChange}
            />
            <br />
            <br />
            <h4>Choose two weeks</h4>
            <DatePicker
                style={{ width: 260 }}
                type="dateRange"
                weekStartsOn={1}
                startDateOffset={date => dateFns.startOfWeek(date, { weekStartsOn: 1 })}
                endDateOffset={date => dateFns.add(dateFns.endOfWeek(date, { weekStartsOn: 1 }), { days: 7 })}
                onChange={handleChange}
            />
            <br />
            <br />
            <h4>Select the current day and the next 6 days</h4>
            <DatePicker
                style={{ width: 260 }}
                type="dateRange"
                weekStartsOn={1}
                endDateOffset={date => dateFns.add(date, { days: 6 })}
                onChange={handleChange}
            />
            <br />
            <br />
        </div>
    );
}
```

### Selection

**Version:** > = 0.21.0

Set `type` to `month`, can make year-to-month selection.

```jsx live=true
import React from 'react';
import { DatePicker } from '@douyinfe/semi-ui';

class App extends React.Component {
    render() {
        return <DatePicker defaultValue={new Date()} type="month" style={{ width: 140 }} />;
    }
}
```

### Year and Month Range Selection

**version：** >= 2.32.0

Set `type` to `monthRange` to select the year and month range, small size and quick panel are not supported yet.

```jsx live=true
import React from 'react';
import { DatePicker } from '@douyinfe/semi-ui';

() => <DatePicker type="monthRange" style={{ width: 200 }} />;
```

### Confirm Date and Time Selection

**Version: > = 0.18.0**

For the selection of "datetime" (type = "dateTime") or "datetime range" (type = "dateTimeRange"), you can confirm it before writing the value into the input box. You can pass `NeedConfirm` = true to enable this behavior.

At the same time, the click callbacks of the "onConfirm" and "onCancel" buttons are supported.

The following example binds three callbacks: `onChange`, `onConfirm` and `onCancel`, and you can open the console to see the difference in print information.

> Note: When opening `needConfirm`, you need to click the cancel button to close the panel, and clicking the blank area will no longer close the panel (v2.2.0)

```jsx live=true
import React from 'react';
import { DatePicker } from '@douyinfe/semi-ui';

class App extends React.Component {
    render() {
        return (
            <DatePicker
                type="dateTime"
                needConfirm={true}
                onConfirm={(...args) => {
                    console.log('Confirmed: ', ...args);
                }}
                onCancel={(...args) => {
                    console.log('Canceled: ', ...args);
                }}
                onChange={(...args) => {
                    console.log('Changed: ', ...args);
                }}
            />
        );
    }
}
```

### Date and Time Selection with Shortcuts

Pass parameter `Presets` to set shortcuts for date selection.

```jsx live=true
import React from 'react';
import { DatePicker } from '@douyinfe/semi-ui';

class App extends React.Component {
    constructor() {
        this.presets = [
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
    }

    render() {
        return <DatePicker type="dateTime" presets={this.presets} presetPosition="left"/>;
    }
}
```

### Render TopSlot/BottomSlot

With `topSlot` and `bottomSlot`, you can customize the rendering of the top and bottom extra areas.

```jsx live=true
import React, { useState, useMemo } from 'react';
import { DatePicker, Typography, Tabs, TabPane, Space } from '@douyinfe/semi-ui';
import { IconBulb } from '@douyinfe/semi-icons';

function Demo() {
    const { Text } = Typography;

    const [activeTab, setActiveTab] = useState('1');
    const [date, setDate] = useState();
    const uedDisabledDate = currentDate => currentDate && currentDate.getDate() > 10 && currentDate.getDate() < 15;
    const testDisabledDate = currentDate => currentDate && currentDate.getDate() > 15 && currentDate.getDate() < 25;

    const handleTabChange = tab => {
        setActiveTab(tab);
        setDate();
    };

    const handleDateChange = value => {
        setDate(value);
    };

    const disabledDate = useMemo(() => (activeTab === '1' ? uedDisabledDate : testDisabledDate), [activeTab]);

    const TopSlot = function (props) {
        const { style } = props;
        return (
            <Tabs size="small" onChange={handleTabChange} activeKey={activeTab} style={{ padding: '12px 20px 0', ...style }}>
                <TabPane tab="UED Schedule" itemKey="1" />
                <TabPane tab="Test schedule" itemKey="2" />
            </Tabs>
        );
    };

    const BottomSlot = function (props) {
        const { style } = props;
        return (
            <Space style={{ padding: '12px 20px', ...style }}>
                <IconBulb style={{ color: 'rgba(var(--semi-amber-5), 1)' }} />
                <Text strong style={{ color: 'var(--semi-color-text-2)' }}>
                    Please read before finalizing
                </Text>
                <Text link={{ href: 'https://semi.design/', target: '_blank' }}>Release notice</Text>
            </Space>
        );
    };

    const MonthBottomSlot = function (props) {
        const { style } = props;
        return (
            <Space style={{ padding: '12px 20px', ...style }}>
                <IconBulb style={{ color: 'rgba(var(--semi-amber-5), 1)' }} />
                <Text strong style={{ color: 'var(--semi-color-text-2)' }}>
                    please read
                </Text>
                <Text link={{ href: 'https://semi.design/', target: '_blank' }}>Notice</Text>
            </Space>
        );
    };

    return (
        <div>
            <DatePicker 
                topSlot={<TopSlot />}
                disabledDate={disabledDate}
                value={date}
                onChange={handleDateChange}
                dropdownClassName="components-datepicker-demo-slot"
                placeholder="Please select a schedule"
            />
            <br /><br />
            <DatePicker
                bottomSlot={<BottomSlot />}
                placeholder="Please select release time"
            />
            <br /><br />
            <DatePicker
                type="month"
                bottomSlot={<MonthBottomSlot />}
                placeholder="Please select month"
            />
            <br /><br />
            <DatePicker 
                topSlot={<TopSlot style={{ padding: '8px 12px 0' }} />} 
                bottomSlot={<BottomSlot style={{ padding: '8px 12px' }} />} 
                density="compact"
                dropdownClassName="components-datepicker-demo-slot"
            />
            <br /><br />
            <DatePicker 
                type="dateTimeRange"
                bottomSlot={<BottomSlot />}
                style={{ width: 400 }}
                placeholder="Please select a time range"
            />
        </div>
    );
}
```

```css
.components-datepicker-demo-slot {
    
    .semi-tabs-content {
        padding: 0;
    }
    
    .semi-tabs-bar-line.semi-tabs-bar-top {
        border-bottom: none;
    }
}
```

### Disable Date Selection

```jsx live=true
import React from 'react';
import { DatePicker } from '@douyinfe/semi-ui';

class App extends React.Component {
    render() {
        return <DatePicker disabled type="dateTime" defaultValue={new Date()} />;
    }
}
```

### Disable Partial Date or Time

Pass in `disabledDate` to disable the specified date, pass in `disabledTime` to disable the specified time, and with `defaultPickerValue` you can specify the year and month when the panel is opened.

`disabledDate` and`disabledTime`, the accepted input parameters are the current date, the former returns a `boolean` value, the latter returns an [object](/en-US/input/timepicker#API_Reference) It will be directly passed to the `TimePicker` component.

<Notice type="primary" title="Note">
    <div>When you use timeZone, the Date of the first parameter is the time under the time zone you choose (similar to the first return value of onChange)</div>
</Notice>

```jsx live=true
import React from 'react';
import { DatePicker } from '@douyinfe/semi-ui';
import * as dateFns from 'date-fns';
import { range } from 'lodash-es';

class App extends React.Component {
    constructor(props = {}) {
        super(props);

        this.today = () => new Date();

        this.nextValidMonth = () => {
            const nextValidDate = this.today();
            nextValidDate.setMonth((nextValidDate.getMonth() + 1) % 12);
            return nextValidDate;
        };

        this.disabledTime = date =>
            dateFns.isToday(date)
                ? {
                    disabledHours: () => [17, 18],
                    disabledMinutes: hour => (19 === hour ? range(0, 10, 1) : []),
                    disabledSeconds: (hour, minute) => (hour === 20 && minute === 20 ? range(0, 20, 1) : []),
                }
                : null;

        this.disabledTime2 = (date, panelType) => {
            if (panelType === 'left') {
                return { disabledHours: () => [17, 18] };
            } else {
                return { disabledHours: () => [12, 13, 14, 15, 16, 17, 18] };
            }
        };

        this.disabledDate = date => {
            const deadDate = this.today();
            const month = deadDate.getMonth();
            deadDate.setDate(28);
            deadDate.setMonth((month + 1) % 12);
            return date.getTime() < deadDate.getTime();
        };
    }

    render() {
        return (
            <div>
                <div>
                    <h4>Disabled 17:00:00-18:00:00 today</h4>
                    <DatePicker type="dateTime" hideDisabledOptions={false} disabledTime={this.disabledTime} />
                </div>
                <div>
                    <h4>Two panels disable different times</h4>
                    <DatePicker
                        type="dateTimeRange"
                        hideDisabledOptions={false}
                        disabledTime={this.disabledTime2}
                        style={{ width: 400 }}
                    />
                </div>
                <div>
                    <h4>Disable time before the 28th of next month</h4>
                    <DatePicker
                        type="dateTimeRange"
                        disabledDate={this.disabledDate}
                        defaultPickerValue={this.nextValidMonth()}
                        style={{ width: 400 }}
                    />
                </div>
            </div>
        );
    }
}
```

When `type` contains `range`, the date can be disabled dynamically according to the rangeStart. The `options` parameter is supported after 1.9.0

```jsx live=true
import React from 'react';
import { DatePicker } from '@douyinfe/semi-ui';
import * as dateFns from 'date-fns';

class App extends React.Component {
    render() {
        return (
            <div>
                <h4>Prohibit selection of previous dates</h4>
                <DatePicker
                    type={'dateRange'}
                    disabledDate={(date, options) => {
                        const { rangeStart } = options;
                        const startDate = dateFns.parseISO(rangeStart);
                        return dateFns.isBefore(date, startDate);
                    }}
                    style={{ width: 260 }}
                />
            </div>
        );
    }
}
```

When `type` contains `range`, dates can be disabled based on the focus state. The focus state is passed through the `rangeInputFocus` parameter in `options`.

```jsx live=true
import React from 'react';
import { DatePicker } from '@douyinfe/semi-ui';
import * as dateFns from 'date-fns';

function App() {
    const today = new Date();
    const disabledDate = (date, options) => {
        const { rangeInputFocus } = options;
        const baseDate = dateFns.set(today, { hours: 0, minutes: 0, seconds: 0, milliseconds: 0 });
        if (rangeInputFocus === 'rangeStart') {
            const disabledStart = dateFns.subDays(baseDate, 2);
            const disabledEnd = dateFns.addDays(baseDate, 2);
            return disabledStart <= date && date <= disabledEnd;
        } else if (rangeInputFocus === 'rangeEnd') {
            const disabledStart = dateFns.subDays(baseDate, 3);
            const disabledEnd = dateFns.addDays(baseDate, 3);
            return disabledStart <= date && date <= disabledEnd;
        } else {
            return false;
        }
    };

    return (
        <div>
            <h4>{`Start date disables 2 days before and 2 days after today, end date disables 3 days before and 3 days after today`}</h4>
            <DatePicker motion={false} type='dateRange' disabledDate={disabledDate} defaultPickerValue={today} />
        </div>
    );
}
```

### Custom Display Format

Pass parameter `format` to custom display format.

```jsx live=true
import React from 'react';
import { DatePicker } from '@douyinfe/semi-ui';

class App extends React.Component {
    render() {
        return <DatePicker format="yyyy-MM-dd HH:mm" type="dateTime" defaultValue={new Date()} />;
    }
}
```

### Custom Trigger

**Version:** >=0.34.0

By default we use the `Input` component as the trigger for the `DatePicker` component. You can customize this trigger by passing the `triggerRender` method.

The custom trigger is a complete customization of the trigger, the default clear button will not take effect, if you need clear function, please customize a clear button.

```jsx live=true
import React, { useState, useCallback, useMemo } from 'react';
import * as dateFns from 'date-fns';
import { DatePicker, Button } from '@douyinfe/semi-ui';
import { IconClose, IconChevronDown } from '@douyinfe/semi-icons';

function Demo() {
    const [date, setDate] = useState(new Date());
    const formatToken = 'yyyy-MM-dd';
    const onChange = useCallback(date => {
        setDate(date);
    }, []);
    const onClear = useCallback(e => {
        e && e.stopPropagation();
        setDate(null);
    }, []);

    const closeIcon = useMemo(() => {
        return date ? <IconClose onClick={onClear} /> : <IconChevronDown />;
    }, [date]);

    return (
        <DatePicker
            onChange={onChange}
            value={date}
            format={formatToken}
            triggerRender={({ placeholder }) => (
                <Button theme={'light'} icon={closeIcon} iconPosition={'right'}>
                    {(date && dateFns.format(date, formatToken)) || placeholder}
                </Button>
            )}
        />
    );
}
```

<Notice type="primary" title="Note">
    <div>When DatePicker is range type, the default date selected after the panel is opened is the start date, and it will switch to the end date selection after selection. The focus is reset when the panel is closed.</div>
    <div>We recommend providing a clear button, when you pass null value to DatePicker, DatePicker will also reset focus internally. This allows the user to reselect the date range after clearing. (from v2.15)</div>
</Notice>

```jsx live=true hideInDSM
import React, { useState, useCallback, useMemo } from 'react';
import { DatePicker, Button, Icon } from '@douyinfe/semi-ui';
import { IconClose, IconChevronDown } from '@douyinfe/semi-icons';

function Demo() {
    const [date, setDate] = useState();
    const formatToken = 'yyyy-MM-dd HH:mm:ss';
    const onChange = useCallback(date => {
        setDate(date);
        console.log(date);
    }, []);
    const onClear = useCallback(e => {
        e && e.stopPropagation();
        setDate();
    }, []);

    const closeIcon = useMemo(() => {
        return date ? <IconClose onClick={onClear} /> : <IconChevronDown />;
    }, [date]);

    const triggerContent = (placeholder) => {
        if (Array.isArray(date) && date.length) {
            return `${dateFns.format(date[0], formatToken)} ~ ${dateFns.format(date[1], formatToken)}`;
        } else {
            return 'Please select a date range';
        }
    };

    return (
        <DatePicker
            type='dateTimeRange'
            onChange={onChange}
            value={date}
            triggerRender={({ placeholder }) => (
                <Button theme={'light'} icon={closeIcon} iconPosition={'right'}>
                    {triggerContent(placeholder)}
                </Button>
            )}
        />
    );
}
```

### Custom Render Date Content

**Version：**>=1.4.0

`renderDate: (dayNumber: number, fullDate: string) => ReactNode`

-   `dayNumber`: such as `13`.
-   `fullDate`: such as `2020-08-13`.

```jsx live=true
import React from 'react';
import { DatePicker, Tooltip } from '@douyinfe/semi-ui';

function Demo() {
    const dateStyle = {
        width: '100%',
        height: '100%',
        border: '1px solid var(--semi-color-primary)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
    };
    const renderDate = (dayNumber, fullDate) => {
        if (dayNumber === 1) {
            return (
                <Tooltip content={'Always Day 1'}>
                    <div style={dateStyle}>
                        {dayNumber}
                    </div>
                </Tooltip>
            );
        }
        return dayNumber;
    };
    return <DatePicker renderDate={renderDate} />;
}
```

### Custom Render Date Box

**Version：**>=1.4.0

`renderFullDate: (dayNumber: number, fullDate: string, dayStatus: object) => ReactNode`

`dayStatus` is this status of current date box. The included keys are as follows.

```md
type DayStatusType = {
    isToday?: boolean,
    isSelected?: boolean,
    isDisabled?: boolean,
    isSelectedStart?: boolean,
    isSelectedEnd?: boolean,
    isInRange?: boolean,
    isHover?: boolean,
    isOffsetRangeStart?: boolean,
    isOffsetRangeEnd?: boolean,
    isHoverInOffsetRange?: boolean,
}
```

```jsx live=true
import React from 'react';
import { DatePicker } from '@douyinfe/semi-ui';
import classNames from 'classnames';

function Demo() {
    const renderFullDate = (dayNumber, fullDate, dayStatus) => {
        const { isInRange, isHover, isSelected, isSelectedStart, isSelectedEnd } = dayStatus;
        const prefix = 'components-datepicker-demo';

        const dateCls = classNames({
            [`${prefix}-day-inrange`]: isInRange,
            [`${prefix}-day-hover`]: isHover,
            [`${prefix}-day-selected`]: isSelected,
            [`${prefix}-day-selected-start`]: isSelectedStart,
            [`${prefix}-day-selected-end`]: isSelectedEnd,
        });

        const dayStyle = {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '80%',
            height: '80%',
            borderRadius: '50%',
        };

        return (
            <div style={dayStyle} className={dateCls}>
                {dayNumber}
            </div>
        );
    };

    return <DatePicker style={{ width: 260 }} type={'dateRange'} renderFullDate={renderFullDate} />;
}
```

```css
.components-datepicker-demo-day-inrange,
.components-datepicker-demo-day-hover {
    background: var(--semi-color-primary-light-hover);
}

.components-datepicker-demo-day-selected,
.components-datepicker-demo-day-selected-start,
.components-datepicker-demo-day-selected-end {
    color: var(--semi-color-bg-2);
    background: var(--semi-color-primary);
}
```

## API Reference

| Properties         | Instructions                                                                                                                                                                                                                                  | Type      | Default | Version    |
|--------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------|---------|------------|
| autoAdjustOverflow | Whether the floating layer automatically adjusts its direction when it is blocked                                                                                                                                                             | boolean   | true    | **0.34.0** |
| autoFocus          | Automatic access to focus                                                                                                                                                                                                                     | boolean   | false   | **1.10.0** |
| autoSwitchDate     | When the year and month are changed through the left and right buttons and the drop-down menu at the top of the panel, the date is automatically switched. Only valid for `date` type.                                                        | boolean   | true    | **1.13.0** |
| bottomSlot         | Render the bottom extra area                                                                                                                                                                                                                  | ReactNode |         | **1.22.0** |
| borderless        | borderless mode  >=2.33.0                                                                                                                                                                                                                     | boolean                         |           |
| className          | Class name                                                                                                                                                                                                                                    | string    | -       |            |
| clearIcon          | Can be used to customize the clear button, valid when showClear is true                                                                                                                                                                       | ReactNode |         | **2.25.0** |
| defaultOpen        | Panel displays or hides by default                                                                                                                                                                                                            | boolean   | false   |            |
| defaultPickerValue | Default panel date                                                                                                                                                                                                                            | ValueType |         |            |
| defaultValue       | Default value                                                                                                                                                                                                                                 | ValueType                                                                                                                                                                                                    |                                             |                           |  |
| density            | Density of picker panel, one of `default`, `compact`                                                                                                                                                                                          | string                                                                                                                                                                                                    | default                                        | **1.17.0**              |
| disabled           | Is it disabled?                                                                                                                                                                                                                               | boolean                                                                                                                                                                                                   | false                                                                                 |                           |
| disabledDate       | The date is prohibited from the judgment method, and the date is prohibited when returned to true. Options parameter supported after 1.9.0, rangeEnd supported after 1.29 and rangeInputFocus is supported since 2.22                         | <ApiType detail='(date: Date, options: { rangeStart: string, rangeEnd: string, rangeInputFocus: "rangeStart" \| "rangeEnd" \| false }) => boolean'>(date, options) => boolean</ApiType>     | () = > false                                                                          |                           |
| disabledTime       | Time prohibition configuration, the return value will be transparently passed to [`TimePicker`](/en-US/input/timepicker#API_Reference) as a parameter                                                                                         | <ApiType detail='(date: Date \| Date[], panelType?: string) => ({ disabledHours:() => number[], disabledMinutes: (hour: number) => number[], disabledSeconds: (hour: number, minute: number) => number[] })'>(date, panelType) => object</ApiType> | () => false        | **0.36.0**                |
| disabledTimePicker | Disable time selection or not.                                                                                                                                                                                                                | boolean           | **0.32.0**                |
| dropdownClassName  | CSS classname for drop-down menu                                                                                                                                                                                                              | string                                                               |                                 | **1.13.0** |
| dropdownMargin | Popup layer calculates the size of the safe area when the current direction overflows, used in scenes covered by fixed elements, more detail refer to [issue#549](https://github.com/DouyinFE/semi-design/issues/549), same as Tooltip margin | object\|number |  | **2.25.0** |
| dropdownStyle      | Inline style of drop-down menu                                                                                                                                                                                                                | object                                                               |                                  | **1.13.0** |
| endDateOffset      | When type is dateRange, set the end date of the selected range                                                                                                                                                                                | (selectedDate?: Date) => Date;                                                                                                                                                                            | -                                                                                     | **1.10.0**                |
| format             | Date string format displayed in the input box                                                                                                                                                                                                 | string                                                                                                                                                                                                    | Corresponding to type: For details, see [Date and Time Format](#Date%20and%20Time%20Format) |                           |
| getPopupContainer | Specifies the parent DOM, and the bullet layer will be rendered to the DOM, you need to set 'position: relative`  This will change the DOM tree position, but not the view's rendering position.                                                                                                                              | function():HTMLElement | () = > document.body |
| inputReadOnly      | Is the text box readonly                                                                                                                                                                                                                      | boolean                                                                                                                                                                                                   | false                                                                                 |                           |
| insetInput        | Whether the input box is embedded in the panel. InsetInputProps type supported after v2.29                                                                                                                                                    | boolean  \| <ApiType detail='{ placeholder?: { dateStart?: string; dateEnd?: string; timeStart?: string; timeEnd?: string } }'>InsetInputProps</ApiType>                                                                                                                                                                                                | false                                                                                 | **2.7.0**                          |
| inputStyle         | Input box style                                                                                                                                                                                                                               | object                                                                                                                                                                                                    |                                                                                       |                           |
| max                | When multiple is set to true, the number of selected, non-pass or value is null\|undefined, unlimited.                                                                                                                                        | number                                                                                                                                                                                                    | -                                                                                     |                           |
| multiple           | Whether you can choose multiple, only type = "date" is supported                                                                                                                                                                              | boolean                                                                                                                                                                                                   | false                                                                                 |                           |
| needConfirm        | Do you need to "confirm selection", only `type= "dateTime"\| "dateTimeRange"` works.                                                                                                                                                          | boolean                                                                                                                                                                                                   |                                                                                       | **0.18.0**                |
| open               | Controlled properties displayed or hidden by panels                                                                                                                                                                                           | boolean                                                                                                                                                                                                   |                                                                                       |                           |
| placeholder        | Input box prompts text                                                                                                                                                                                                                        | string\|string[]                                                                                                                                                                                                    | 'Select date'                                                                         |                           |
| position           | Floating layer position, optional value with [Popover #API Reference · position](/en-US/show/popover#API%20Reference)                                                                                                                         | string                                                                                                                                                                                                    | 'bottomLeft'                                                                          |                           |
| prefix             | Prefix content                                                                                                                                                                                                                                | string\|ReactNode                                                                                                                                                                                         |                                                                                       |                           |
| presets            | Date Time Shortcut, start and end support function type after v2.52                                                                                                                                                                                                                            |  <ApiType detail='type PresetType = { start?: BaseValueType \| (() => BaseValueType); end?: BaseValueType \| (() => BaseValueType); text?: string }; type PresetsType = Array<PresetType \| (() => PresetType)>;'>Array</ApiType>                                  | []                                                                                    |                           |
| preventScroll | Indicates whether the browser should scroll the document to display the newly focused element, acting on the focus method inside the component, excluding the component passed in by the user                                                 | boolean |  |  |
| presetPosition     | Date time shortcut panel position, optional 'left', 'right', 'top', 'bottom'                                                                                                                                                                  | 'bottom' | **2.18.0** |
| rangeSeparator     | Custom range type picker separator of input trigger                                                                                                                                                                                           | string | '~' | **1.31.0** 
| renderDate         | Custom date display content                                                                                                                                                                                                                   | (dayNumber, fullDate) => ReactNode                                                                                                                                                                        | -                                                                                     | **1.4.0**            |
| renderFullDate     | Custom display date box                                                                                                                                                                                                                       | (dayNumber, fullDate, dayStatus) => ReactNode                                                                                                                                                             | -                                                                                     | **1.4.0**            |
| showClear          | Do you show the clear button?                                                                                                                                                                                                                 | boolean                                                                                                                                                                                                   | true                                                                                  |        **0.35.0**                           |
| size               | Size, optional: "small," "default," "large"                                                                                                                                                                                                   | string                                                                                                                                                                                                    | 'default'                                                                             |                           |
| spacing            | The distance between the pop-up layer and the children element                                                                                                                                                                                | number                                                                                                                                                                                                    | 4                                                                                     | **1.9.0**                 |
| startDateOffset    | When type is dateRange, set the start date of the selected range                                                                                                                                                                              | (selectedDate?: Date) => Date;                                                                                                                                                                            | -                                                                                     | **1.10.0**                |
| startYear | start year of the year scroll panel                                                                                                                                                                                                           | number | 100 years before current year | **2.36.0** |
| endYear | end year of the year scroll panel                                                                                                                                                                                                             | number | 100 years after current year | **2.36.0** |
| stopPropagation | Whether to prevent click events on the popup layer from bubbling | boolean | true | |
| syncSwitchMonth    | In the scene of range, it supports synchronous switching of the month of the dual panel                                                                                                                                                       |boolean|false|**1.28.0**|
| timePickerOpts     | For other parameters that can be transparently passed to the time selector, see [TimePicker·API Reference](/en-US/input/timepicker#API%20Reference)                                                                                           |                                                                                                                                                                                                           | object                                                                                | **1.1.0**                 |
| topSlot            | Render the top extra area                                                                                                                                                                                                                     | ReactNode                                                                                                                                                                                                 |                                                | **1.22.0**                   |
| triggerRender      | Custom trigger rendering method                                                                                                                                                                                                               | (TriggerRenderProps) => ReactNode                                                                                                                                                                    |                                                                                       | **0.34.0**                |
| type               | Type, optional value: "date", "dateRange", "dateTime", "dateTimeRange", "month", "monthRange"                                                                                                                                                 | string                                                                                                                                                                                                    | 'date'                                                                                |  |
| value              | Controlled value                                                                                                                                                                                                                              | ValueType                                                                                                                                                     |                                                                                       |                           |
| weekStartsOn       | Take the day of the week as the first day of the week, 0 for Sunday, 1 for Monday, and so on.                                                                                                                                                 | number                                                                                                                                                                                                    | 0                                                                                     |                           |
| onBlur | Callback when focus is lost. It is not recommended to use this API in range selection                                                                                                                                                         | (event) => void | () => {} | **1.0.0** |
| onCancel           | Cancel the callback when selected, enter the reference as the value of the last confirmed selection, only `type` equals "dateTime"or "dateTimeRange" and `needConfirm` equals true                                                            | <ApiType detail='(date: DateType, dateStr: StringType) => void'>(date, dateString) => void</ApiType>                                                              |                                                                                       | **0.18.0**                |
| onChange           | A callback when the value changes                                                                                                                                                                                                             |   <ApiType detail='(date: DateType, dateString: StringType) => void'>(date, dateString) => void</ApiType>       |                                                                                       |                           |
| onClear            | A callback when click the clear button                                                                                                                                                                                                        | (event) => void                                                                                                                                                                                     | () => {}                                                                              | **1.16.0**           |
| onClickOutSide    | When the pop-up layer is in a display state, click the non-popup layer and trigger callback, event parameter is supported since 2.68.0 | (event: React.mouseEvent) => void | () => {} | **2.31.0** |
| onConfirm          | Confirm the callback at the time of selection, enter the reference as the value of the current selection, only `type` equals "dateTime" or "dateTimeRange" and `needConfirm` equals true                                                      |  <ApiType detail='(date: DateType, dateStr: StringType) => void'>(date, dateString) => void</ApiType>|                                                                                       | **0.18.0**                |
| onFocus | Callback when focus is obtained. It is not recommended to use this API in range selection                                                                                                                                                     | (event) => void | () => {} | **1.0.0** |
| onOpenChange       | Callback when popup open or close                                                                                                                                                                                                             | (isOpen) => void                                                                                                                                                                                 |                                                                                       |                           |
| onPanelChange      | Callback when the year or date of the panel is switched                                                                                                                                                                                       |  <ApiType detail='(date: DateType \| DateType[], dateStr: StringType \| StringType[])=>void'>(date, dateStr) => void</ApiType>  |  |**1.28.0**|
| onPresetClick      | Callback when click preset button                                                                                                                                                                                                             | <ApiType detail='(item: Object, e: Event) => void'>(item, e) => void</ApiType>       |   **1.24.0**                           |
| yearAndMonthOpts | Other parameters that can be transparently passed to the year-month selector, see details in [ScrollList#API](/zh-CN/show/scrolllist#ScrollItem)                                                                                              |  | object | **2.22.0** |

## Methods

| Methods | Description                                       | Version |
|---------|---------------------------------------------------|---------|
| open    | The dropdown can be manually opened when calling  | 2.31.0  |
| close   | The dropdown can be manually closed when calling  | 2.31.0  |
| focus   | The input box can be manually focused when called | 2.31.0  |
| blur    | The input box can be manually blurred when called | 2.31.0  |

```jsx live=true
import React, { useRef } from 'react';
import { DatePicker, Space, Button } from '@douyinfe/semi-ui';
import { BaseDatePicker } from '@douyinfe/semi-ui/lib/es/datePicker';

function Demo() {
    const ref = useRef();
    // Typescript
    // const ref = useRef<BaseDatePicker>();
    // Why not import the DatePicker exported by the entry? 
    // The entry component is a forwardRef component, and the ref is transparently passed to this component

    const handleClickOutside = () => {
        console.log('click outside');
    };

    return (
        <Space vertical align={'start'}>
            <Space>
                <Button onClick={() => ref.current.open()}>open</Button>
                <Button onClick={() => ref.current.close()}>close</Button>
                <Button onClick={() => ref.current.focus()}>focus</Button>
                <Button onClick={() => ref.current.blur()}>blur</Button>
            </Space>
            <div>
                <DatePicker type="dateTime" ref={ref} onClickOutSide={handleClickOutside} />
            </div>
        </Space>
    );
}
```


## Interface Define

```typescript
type BaseValueType = string | number | Date;
type ValueType = BaseValueType | BaseValueType[];
type DateType = Date | Date[];
type StringType = string | string[];
type TriggerRenderProps = {
    value?: ValueType;
    inputValue?: string;
    placeholder?: string | string[];
    autoFocus?: boolean;
    size?: InputSize;
    disabled?: boolean;
    inputReadOnly?: boolean;
    componentProps?: DatePickerProps;
    [x: string]: any;
};
```

## Accessibility

### ARIA

- When a date is not selected, the `aria-label` of the trigger is `Choose date`, and when a date is selected, the `aria-label` of the trigger is `Change date`
- The role of the month in the date panel is `grid`, the role of the week is set to `row`, and the date cell is set to `gridcell`
- `aria-disabled` is true for the corresponding option when date and time are disabled
- When multi-selected, `aria-multiselectable` of month is true, and `aria-selected` of date grid is true when selected
- Some decorative icons in the panel, their `aria-hidden` is true

## Date and Time Format

Adopted in the semi-ui component library [date-fns(v2.9.0)](https://date-fns.org/v2.9.0/docs/Getting-Started) As a date and time engine, formatting token means the following:

-   `"y"`: Year
-   `"M"`: month
-   `"d"`: day
-   `"H"`: hours
-   `"h"`: hours (12h)
-   `"m"`: minutes
-   `"s"`: seconds

The following uses `new Date('2023-12-09 08:08:00')` or `[new Date('2023-12-09 08:08:00'), new Date('2023-12-10 10 :08:00')]` as `value` to explain the impact of different types and different `format` values on the displayed value:

| type | format | display value |
| --- | --- | --- |
| date | yyyy-MM-dd | 2023-12-09 |
| dateTime | yyyy-MM-dd HH:mm:ss | 2023-12-09 08:08:00 |
| month | yyyy-MM | 2023-12 |
| dateRange | yyyy-MM-dd | 2023-12-09 ~ 2023-12-10 |
| dateTimeRange | yyyy-MM-dd HH:mm:ss | 2023-12-09 08:08 ~ 2023-12-10 10:08 |


Multiple dates or times are used by default `","` (English comma) separated.

> More token available [Date-fns official website](https://date-fns.org/v2.9.0/docs/Unicode-Tokens)

## Content Guidelines

- Date picker is recommended to be used with tags
- Use concise labels to indicate what the date selection refers to
- Please refer to [Date and Time](/en-US/start/content-guidelines#8.%20%E6%97%A5%E6%9C%9F%E4%B8%8E%E6%97%B6%E9%97%B4)

## Design Tokens
<DesignToken/>

## FAQ

-   **Date time picker, when you choose time, minute and second, you don't want to scroll infinitely. How to achieve the effect?**  
    Starting from version V2.22.0, we changed the default mode of ScrollItem in TimePicker from wheel to normal. If you want to apply the infinite scrolling effect again, you can control this behavior through a specific switch in timePickerOpts, that is, timePickerOpts={{ scrollItemProps: { mode: "wheel", cycled: true } }}.

-   **How to set the default display time when the panel is opened?**  
    You can use the defaultPickerValue property.

- **Date time selection, range date selection, after inputting some dates, the panel does not echo the date?**

     The input box needs to be entered completely before it is showed to the panel. For example, for `dateTime` type, the full requested date and time have been entered. For `dateRange` type, full requires start and end dates to be entered.

- **What is the displayed time at the bottom of the date time selection panel?**

    When no time is selected, it is the value of the time in `defaultPickerValue`, if not set it is the time when the panel was opened. After selecting a time, it is the selected time.

    Since it has two hidden meanings in design, which may lead to ambiguity, it is recommended to use inline styles and open them through `insetInput`. It is recommended to read the relevant <a href="#input-in-panel">Documentation</a> before use.
    
    <Image src="https://lf9-static.semi.design/obj/semi-tos/images/a0d68960-bccf-11ed-84ab-fbdf4dc2eb57.png" width={600} />
