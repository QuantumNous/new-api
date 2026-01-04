---
localeCode: zh-CN
order: 63
category: 展示类
title: Calendar 日历
icon: doc-calendar
dir: column
brief: 日历组件，允许以日/周/月视图展示对应事件
---

## 代码演示

### 如何引入

```jsx import
import { Calendar } from '@douyinfe/semi-ui';
```

### 日视图

日视图的日历模板，可通过 `showCurrTime` 控制是否显示当前时间的位置红线。

```jsx live=true dir="column"
import React from 'react';
import { Calendar } from '@douyinfe/semi-ui';

() => <Calendar mode="day"></Calendar>;
```

### 周视图

周视图的日历模板，可通过 `showCurrTime` 控制是否显示当前时间的位置红线。

```jsx live=true dir="column"
import React from 'react';
import { Calendar } from '@douyinfe/semi-ui';

() => <Calendar mode="week"></Calendar>;
```

### 月视图

月视图的日历模板。

```jsx live=true dir="column"
import React from 'react';
import { Calendar } from '@douyinfe/semi-ui';

() => <Calendar mode="month"></Calendar>;
```

### 设置周起始日
可以通过 weekStartsOn 设置周几作为每周第一天，0 代表周日，1 代表周一，以此类推。默认为周日。weekStartsOn 自 v2.18 起提供，对月视图、周视图生效。
```jsx live=true dir="column"
import React, { useState } from 'react';
import { RadioGroup, Calendar, Radio } from '@douyinfe/semi-ui';

() => {
    const [v, setV] = useState(0);
    return (
        <div>
            <RadioGroup defaultValue={v} aria-label="周起始日" type="button" name="demo-radio-group-vertical" onChange={e => setV(e.target.value)}>
                <Radio value={0}>周日</Radio>
                <Radio value={1}>周一</Radio>
                <Radio value={2}>周二</Radio>
                <Radio value={3}>周三</Radio>
                <Radio value={4}>周四</Radio>
                <Radio value={5}>周五</Radio>
                <Radio value={6}>周六</Radio>
            </RadioGroup>
            <Calendar
                style={{ marginTop: 20 }}
                mode="month"
                weekStartsOn={v}
            ></Calendar>
        </div>
    );
};
```

### 多日视图

**>=1.5.0**  
多日视图模式。 `range` 必传，左闭右开。

```jsx live=true dir="column"
import React from 'react';
import { Calendar } from '@douyinfe/semi-ui';

() => <Calendar mode="range" range={[new Date(2020, 8, 26), new Date(2020, 8, 31)]} />;
```


### 事件渲染用法

通过 `events` 传入需要渲染的事件，`events` 是一个由 event objects 组成的数组，具体形式请参考 events API。

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
                children: <div style={dailyStyle}>6月25日 14:45 ~ 7月26日 6:18</div>,
            },
            {
                key: '1',
                start: new Date(2019, 6, 18, 10, 0, 0),
                end: new Date(2019, 6, 30, 8, 0, 0),
                children: <div style={allDayStyle}>7月18日 10:00 ~ 7月30日 8:00</div>,
            },
            {
                key: '2',
                start: new Date(2019, 6, 19, 20, 0, 0),
                end: new Date(2019, 6, 23, 14, 0, 0),
                children: <div style={allDayStyle}>7月19日 20:00 ~ 7月23日 14:00</div>,
            },
            {
                key: '3',
                start: new Date(2019, 6, 21, 6, 0, 0),
                end: new Date(2019, 6, 25, 6, 0, 0),
                children: <div style={allDayStyle}>7月21日 6:00 ~ 7月25日 6:00</div>,
            },
            {
                key: '4',
                allDay: true,
                start: new Date(2019, 6, 22, 8, 0, 0),
                children: <div style={allDayStyle}>7月22日 全天</div>,
            },
            {
                key: '5',
                start: new Date(2019, 6, 22, 9, 0, 0),
                end: new Date(2019, 6, 23, 23, 0, 0),
                children: <div style={allDayStyle}>7月22日 9:00 ~ 7月23日 23:00</div>,
            },
            {
                key: '6',
                start: new Date(2019, 6, 23, 8, 32, 0),
                end: new Date(2019, 6, 23, 8, 42, 0),
                children: <div style={dailyStyle}>7月23日 8:32</div>,
            },
            {
                key: '7',
                start: new Date(2019, 6, 23, 14, 30, 0),
                end: new Date(2019, 6, 23, 20, 0, 0),
                children: <div style={dailyStyle}>7月23日 14:30-20:00</div>,
            },
            {
                key: '8',
                start: new Date(2019, 6, 25, 8, 0, 0),
                end: new Date(2019, 6, 27, 6, 0, 0),
                children: <div style={allDayStyle}>7月25日 8:00 ~ 7月27日 6:00</div>,
            },
            {
                key: '9',
                start: new Date(2019, 6, 26, 10, 0, 0),
                end: new Date(2019, 6, 27, 16, 0, 0),
                children: <div style={allDayStyle}>7月26日 10:00 ~ 7月27日 16:00</div>,
            },
        ];
        return (
            <>
                <RadioGroup onChange={e => this.onSelect(e)} value={mode} type="button">
                    <Radio value={'day'}>日视图</Radio>
                    <Radio value={'week'}>周视图</Radio>
                    <Radio value={'month'}>月视图</Radio>
                    <Radio value={'range'}>多日视图</Radio>
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

### 自定义渲染

通过 dateGridRender 可以自定义渲染日期单元格/列。需要使用绝对定位。

#### 自定义渲染事件

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
        overflow: 'hidden',
    };
    const displayValue = new Date(2019, 6, 23, 8, 32, 0);
    const dateRender = dateString => {
        if (dateString === new Date(2019, 6, 23).toString()) {
            return (
                <>
                    <div style={{ ...dailyEventStyle, top: '500px', height: 50 }}>吃饭 🍰</div>
                    <div style={{ ...dailyEventStyle, top: '0', height: 400 }}>睡觉 😪</div>
                    <div style={{ ...dailyEventStyle, top: '700px', height: 100 }}>打豆豆 🎮</div>
                </>
            );
        } else {
            return null;
        }
    };
    return <Calendar height={700} mode="week" displayValue={displayValue} dateGridRender={dateRender} />;
};
```

#### 自定义渲染单元格样式

可以通过 dateGridRender 自定义单元格的背景，月视图的文字 zIndex 默认为 3，如需完全覆盖单元格可以设置更大的 zIndex 来实现。

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
    const importDates = [new Date(2019, 6, 2), new Date(2019, 6, 8), new Date(2019, 6, 19), new Date(2019, 6, 23)];
    const dateRender = dateString => {
        if (importDates.filter(date => date.toString() === dateString).length) {
            return <div style={importantDate} />;
        }
        return null;
    };
    return <Calendar height={700} mode="month" displayValue={displayValue} dateGridRender={dateRender} />;
};
```

#### 自定义日期文案

可以通过 renderDateDisplay 自定义日期文案。


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


## API 参考

### Calendar

| 属性 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| dateGridRender | 自定义单元格/列渲染，需要绝对定位, **v>=1.0.0** | function(dateString: string, date: Date) | - |
| allDayEventsRender | 自定义日/多日/周视图下的顶部事件渲染 | function(events: EventObject[]): ReactNode | - |
| displayValue | 展示日期 | Date | 当前日期 |
| events | 渲染事件，具体格式请参考 event object | EventObject[] | - |
| header | 自定义头部内容 | ReactNode | - |
| height | 日历高度 | string\|number | 600 |
| markWeekend | 区分周末列和工作日，以灰色显示 | boolean | false |
| minEventHeight | 日视图、多日视图以及周视图下事件的最小高度(**>=2.49.0**) | number | Number.MIN_SAFE_INTEGER |
| mode | 初始模式，`day`, `week`, `month`, `range`(**>=1.5.0**) | "day" \| "week" \| "month" \| "range" | `week` |
| onClick | 单击日期格的回调，日视图和周视图以半小时为单位，月视图以日为单位 | function(e: Event, date: Date） | - |
| onClose | 月视图下，展示所有 event 的卡片关闭时的回调 | function(e: Event） | - |
| range | 多日视图模式下展示的日期范围，左闭右开 **v>=1.5.0** | Date[] | - |
| renderTimeDisplay | 自定义日/周视图下的时间文案 | function(time: number): ReactNode | - |
| renderDateDisplay | 自定义日期文案 | function(date: Date): ReactNode | - |
| scrollTop | 日视图和周视图模式下，设置展示内容默认的滚动高度 | number | 400 |
| showCurrTime | 显示当前时间 | boolean | true |
| width | 日历宽度 | string\|number | - |
| weekStartsOn | 以周几作为每周第一天，0 代表周日，1 代表周一，以此类推。v2.18后支持 | number | 0 |

### Event Object

`events` 是一个 event object 组成的数组，event object 约定格式如下：  
当事件为全天事件时，若没有传入起始结束时间，则自动追加到 `displayValue` 的日期中；当事件不是全天事件时，起始结束时间至少传入一个才会被视为有效事件

<Notice type='primary' title='注意'>
  不同 event 的 key 值要求必填且唯一，以此控制事件的更新与重绘。
</Notice>

| 属性     | 说明                              | 类型        | 默认值 |
| -------- | --------------------------------- | ----------- | ------ |
| allDay   | 全天事件                          | boolean     | false  |
| children | 展示日期                          | React.node  | -      |
| end      | 事情结束的时间                    | Date | -      |
| key      | required 且要求唯一, **v>=1.0.0** | string      | -      |
| start    | 事情起始的时间                    | Date | -      |

## 文案规范
- 当需要显示时间时，12 小时制和 24 小时制都是可以使用的
- 如果采用12小时制，需要搭配 AM/PM 一起使用，具体内容可参考 [时间规范](/zh-CN/start/content-guidelines#8.%20%E6%97%A5%E6%9C%9F%E4%B8%8E%E6%97%B6%E9%97%B4)
- 关于月份、星期、时间的缩写使用规则，可参考 [缩写规范](/zh-CN/start/content-guidelines#1.%20%E7%BC%A9%E5%86%99)

## 设计变量

<DesignToken/>
