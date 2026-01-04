---
localeCode: en-US
order: 63
category: Show
title:  Calendar
subTitle: Calendar
icon: doc-calendar
dir: column
brief: Calendar component that allows to display corresponding events in day/week/month view
---

## Demos

### How to import

```jsx import
import { Calendar } from '@douyinfe/semi-ui';
```
### Day Mode

Day mode. You could toggle the red line of current time using `showCurrTime`.

```jsx live=true dir="column"
import React from 'react';
import { Calendar } from '@douyinfe/semi-ui';

() => (
    <Calendar mode="day"></Calendar>
);
```

### Week Mode

Week mode. You could toggle the red line of current time using `showCurrTime`.

```jsx live=true dir="column"
import React from 'react';
import { Calendar } from '@douyinfe/semi-ui';

() => (
    <Calendar mode="week"></Calendar>
);
```

### Month Mode

Month Mode.

```jsx live=true dir="column"
import React from 'react';
import { Calendar } from '@douyinfe/semi-ui';

() => (
    <Calendar mode="month"></Calendar>
);
```

### Set week start day
The day of the week can be set as the first day of the week through weekStartsOn, 0 for Sunday, 1 for Monday, and so on. Default is Sunday.  
`weekStartsOn` is available since v2.18, and takes effect for month view and week view.

```jsx live=true dir="column"
import React, { useState } from 'react';
import { RadioGroup, Calendar, Radio } from '@douyinfe/semi-ui';

() => {
    const [v, setV] = useState(0);
    return (
        <div>
            <RadioGroup type="button" defaultValue={v} aria-label="StartOfWeek" name="demo-radio-group-vertical" onChange={e => setV(e.target.value)}>
                <Radio value={0}>Sunday</Radio>
                <Radio value={1}>Mon</Radio>
                <Radio value={2}>Tue</Radio>
                <Radio value={3}>Wed</Radio>
                <Radio value={4}>Thu</Radio>
                <Radio value={5}>Fri</Radio>
                <Radio value={6}>Sat</Radio>
            </RadioGroup>
            <Calendar
                mode="month"
                weekStartsOn={v}
            ></Calendar>
        </div>
    );
};
```


### Range Mode
**>=1.5.0**  
Range Mode. `range` is required which is a left-closed and right-open interval. 

```jsx live=true dir="column"
import React from 'react';
import { Calendar } from '@douyinfe/semi-ui';

() => (
    <Calendar mode="range" range={[new Date(2020, 8, 26), new Date(2020, 8, 31)]} />
);
```

### Render Events

You could pass in an array of event objects to `events` to render items. For detailed format, refer to API below.

```jsx live=true dir="column"
import React from 'react';
import { Calendar, DatePicker, RadioGroup, Radio } from '@douyinfe/semi-ui';

class Demo extends React.Component {
    constructor() {
        super();
        this.state = {
            mode: 'week',
            displayValue: new Date(2019, 6, 23, 8, 32, 0),
        };
    }

    onSelect(e) {
        this.setState({
            mode: e.target.value,
        });
    }

    onChangeDate(e) {
        this.setState({
            displayValue: e,
        });
    }

    render() {
        const { mode, displayValue } = this.state;
        const isMonthView = mode === 'month';
        const dailyEventStyle = {
            borderRadius: '3px',
            boxSizing: 'border-box',
            border: 'var(--semi-color-primary) 1px solid',
            padding: '10px',
            backgroundColor: 'var(--semi-color-primary-light-default)',
            height: '100%',
            overflow: 'hidden',
        };
        const allDayStyle = {
            borderRadius: '3px',
            boxSizing: 'border-box',
            border: 'var(--semi-color-bg-1) 1px solid',
            padding: '2px 4px',
            backgroundColor: 'var(--semi-color-primary-light-active)',
            height: '100%',
            overflow: 'hidden',
        };
        const dailyStyle = isMonthView ? allDayStyle : dailyEventStyle;
        const events = [
            {
                key: '0',
                start: new Date(2019, 5, 25, 14, 45, 0),
                end: new Date(2019, 6, 26, 6, 18, 0),
                children: <div style={dailyStyle}>June 25th 14:45 ~ July 26th 6:18</div>,
            },
            {
                key: '1',
                start: new Date(2019, 6, 18, 10, 0, 0),
                end: new Date(2019, 6, 30, 8, 0, 0),
                children: <div style={allDayStyle}>July 18th 10:00 ~ July 30th 8:00</div>,
            },
            {
                key: '2',
                start: new Date(2019, 6, 19, 20, 0, 0),
                end: new Date(2019, 6, 23, 14, 0, 0),
                children: <div style={allDayStyle}>July 19th 20:00 ~ July 23rd 14:00</div>,
            },
            {
                key: '3',
                start: new Date(2019, 6, 21, 6, 0, 0),
                end: new Date(2019, 6, 25, 6, 0, 0),
                children: <div style={allDayStyle}>July 21st 6:00 ~ July 25th 6:00</div>,
            },
            {
                key: '4',
                allDay: true,
                start: new Date(2019, 6, 22, 8, 0, 0),
                children: <div style={allDayStyle}>July 22 full day</div>,
            },
            {
                key: '5',
                start: new Date(2019, 6, 22, 9, 0, 0),
                end: new Date(2019, 6, 23, 23, 0, 0),
                children: <div style={allDayStyle}>July 22nd 9:00 ~ July 23rd 23:00</div>,
            },
            {
                key: '6',
                start: new Date(2019, 6, 23, 8, 32, 0),
                end: new Date(2019, 6, 23, 8,42, 0),
                children: <div style={dailyStyle}>July 23 8:32</div>,
            },
            {
                key: '7',
                start: new Date(2019, 6, 23, 14, 30, 0),
                end: new Date(2019, 6, 23, 20, 0, 0),
                children: <div style={dailyStyle}>July 23 14:30-20:00</div>,
            },
            {
                key: '8',
                start: new Date(2019, 6, 25, 8, 0, 0),
                end: new Date(2019, 6, 27, 6, 0, 0),
                children: <div style={allDayStyle}>July 25th 8:00 ~ July 27th 6:00</div>,
            },
            {
                key: '9',
                start: new Date(2019, 6, 26, 10, 0, 0),
                end: new Date(2019, 6, 27, 16, 0, 0),
                children: <div style={allDayStyle}>July 26th 10:00 ~ July 27th 16:00</div>,
            },
        ];
        return (
            <>
                <RadioGroup onChange={e => this.onSelect(e)} value={mode} type="button">
                    <Radio value={'day'}>Day view</Radio>
                    <Radio value={'week'}>Week view</Radio>
                    <Radio value={'month'}>Month view</Radio>
                    <Radio value={'range'}>Multi-day view</Radio>
                </RadioGroup>
                <br />
                <br />
                <DatePicker value={displayValue} onChange={e => this.onChangeDate(e)} />
                <br />
                <br />
                <Calendar
                    height={400}
                    mode={mode}
                    displayValue={displayValue}
                    events={events}
                    minEventHeight={40}
                    range={mode === 'range' ? [new Date(2019, 6, 23), new Date(2019, 6, 26)] : []}
                ></Calendar>
            </>
        );
    }
}
```

### Custom Render
You could use `dateGridRender` to render customized date cell or column. Use absolute positioning for elements.

#### Custom Render Events
```jsx live=true dir="column"
import React from 'react';
import { Calendar } from '@douyinfe/semi-ui';

() => {
    const dailyEventStyle = {
        position: 'absolute',
        left: '0',
        right: '0',
        borderRadius: '3px',
        boxSizing: 'border-box',
        border: 'var(--semi-color-primary) 1px solid',
        padding: '10px',
        backgroundColor: 'var(--semi-color-primary-light-default)',
        overflow: 'hidden'
    };
    const displayValue = new Date(2019, 6, 23, 8, 32, 0);
    const dateRender = (dateString) => {
        if (dateString === new Date(2019, 6, 23).toString()) {
            return (
                <>
                    <div style={{ ...dailyEventStyle, top: '500px', height: 50 }}>Eating 🍰</div>
                    <div style={{ ...dailyEventStyle, top: '0', height: 400 }}>Sleeping 😪</div>
                    <div style={{ ...dailyEventStyle, top: '700px', height: 100 }}>Playstation 🎮</div>
                </>
            );
        } else {
            return null;
        }
    };
    return (
        <Calendar 
            height={700}
            mode='week'
            displayValue={displayValue} 
            dateGridRender={dateRender}
        />
    );
};
```

#### Customized Date Cell Style
You could also use `dateGridRender` to customize date cell style, e.g. backgroundColor. Please notice that in Month View, the date text on the right corner has a z-index of 3. Use a larger z-index if you would like to cover the text as well.
```jsx live=true dir="column"
import React from 'react';
import { Calendar } from '@douyinfe/semi-ui';

() => {
    const importantDate = {
        position: 'absolute',
        left: '0',
        right: '0',
        top: '0',
        bottom: '0',
        backgroundColor: 'var(--semi-color-danger-light-default)',
    };
    const displayValue = new Date(2019, 6, 23, 8, 32, 0);
    const importDates = [
        new Date(2019, 6, 2),
        new Date(2019, 6, 8),
        new Date(2019, 6, 19),
        new Date(2019, 6, 23)
    ];
    const dateRender = (dateString) => {
        if (importDates.filter(date => date.toString() === dateString).length) {
            return (
                <div style={importantDate} />
            );
        } 
        return null;
    };
    return (
        <Calendar 
            height={700}
            mode='month'
            displayValue={displayValue} 
            dateGridRender={dateRender}
        />
    );
};
```

#### Customized Date Render
You could use `renderDateDisplay` to customize the display of date


```jsx live=true dir="column"
import React from 'react';
import { Avatar, Calendar } from '@douyinfe/semi-ui';

() => {
    const displayValue = new Date(2023, 4, 14);

    const renderDateDisplay = date => {
        const colors = ["amber", "blue", "cyan", "green", "grey", "indigo", "lime"];
        return <div><Avatar color={colors[date.getDay()]} size="small">{date.getDate()}</Avatar></div>;
    };

    return <Calendar height={400} mode="week" displayValue={displayValue} renderDateDisplay={renderDateDisplay} />;
};
```

## API Reference

### Calendar

| Properties   | Instructions                                                                                           | type                  | Default      |
| ------------ | ------------------------------------------------------------------------------------------------------ | --------------------- | ------------ |
| dateGridRender | Custom render for date cell or column. Use absolute positioning for elements. **v>=1.0.0** | function(dateString: string, date: Date) | - | 
| allDayEventsRender | Custom render for events area at the top of calendar in day/range/week mode. | function(events: EventObject[]): ReactNode | - | 
| displayValue | Display date                                                                                           | Date           | current date |
| events       | Events for rendering, refer to event object                                                            | EventObject[]                 | -            |
| header       | Header                                                                                                 | React.Node            | -            |
| height       | Height                                                                                                 | string\|number        | 600          |
| markWeekend  | Toggle whether to distinguish weekend column with grey background from weekdays                        | boolean               | false        |
| minEventHeight | The minimum height of events in daily view, multi-day view and weekly view(**>=2.49.0**) | number | Number.MIN_SAFE_INTEGER |
| mode         | Mode, one of `day`, `week`, `month`, `range`(**>=1.5.0**)                                         | "day" \| "week" \| "month" \| "range" | `week` |
| onClick      | Callback invoked when clicking on date, basic unit for day and week mode is 0.5h, for month mode is 1d | function(e: Event, date: Date） | -            |
| onClose | Callback invoked when event display card close in the month mode | function(e: Event） | - |
| renderTimeDisplay | Customize the display of time in day/week mode | function(time: number): ReactNode | - |
| renderDateDisplay | Customize the display of date | function(date: Date): ReactNode | - |
| range | Date range to display in range mode, left-closed and right-open **v>=1.5.0** | Date[] | - |
| scrollTop    | Scroll height for displayed content in day and week mode                                               | number                | 400          |
| showCurrTime | Toggle whether to show red line of current time                                                        | boolean               | true         |
| width        | Width                                                                                                  | string\|number        | -            |
| weekStartsOn | Take the day of the week as the first day of the week, 0 for Sunday, 1 for Monday, and so on. Support after v2.18 | number | 0 |


### Event Object

`events` is an array of event objects.   
By default, when the event is an all day event without start or end time, it will be put into `displayValue`. If an event is not an all-day event, it must has at least start or end time as a valid input.

<Notice type='primary' title='Attention'>
  Key property is required and must be unique. It is used for events update and re-render.
</Notice>

| Properties | Instructions                   | type        | Default |
| ---------- | ------------------------------ | ----------- | ------- |
| allDay     | Whether it is an all-day event | boolean     | false   |
| children   | Displayed content              | React.node  | -       |
| end        | End time of the event          | Date | -       |
| key | Required and must be unique. **v>=1.0.0** | string | - |
| start      | Start time of the event        | Date | -       |

## Content Guidelines

- Both 12-hour and 24-hour clocks can be used when the time needs to be displayed
- If the 12-hour clock is used, it needs to be used together with AM/PM. For details, please refer to [Time Specification](/en-US/start/content-guidelines#8.%20%E6%97%A5%E6%9C%9F%E4%B8%8E%E6%97%B6%E9%97%B4)
- For the abbreviation rules for month, week and time, please refer to [Abbreviation Specification](/en-US/start/content-guidelines#1.%20%E7%BC%A9%E5%86%99)

## Design Tokens
<DesignToken/>