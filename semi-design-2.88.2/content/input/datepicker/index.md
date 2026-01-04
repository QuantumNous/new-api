---
localeCode: zh-CN
order: 38
category: 输入类
title: DatePicker 日期选择器
icon: doc-datepicker
brief: 日期选择器用于帮助用户选择一个符合要求的、格式化的日期（时间）或日期（时间）范围
---

## 代码演示

### 如何引入


```jsx import
import { DatePicker } from '@douyinfe/semi-ui';
```

### 基本使用

```jsx live=true
import React from 'react';
import { DatePicker } from '@douyinfe/semi-ui';

() => <DatePicker onChange={(date, dateString) => console.log(dateString)} />;
```

### 小尺寸

使用 density 可以控制日期面板的尺寸，`compact` 为小尺寸，`default` 为默认尺寸。

```jsx live=true
import React from 'react';
import { DatePicker } from '@douyinfe/semi-ui';

function Demo() {
    return (
        <div>
            <DatePicker type="dateTime" density="compact" />
            <br />
            <br />
            <DatePicker type="dateRange" density="compact" style={{ width: 260 }} />
        </div>
    );
}
```

### 多个日期选择

将 `multiple` 设为 `true`，可以多选日期

```jsx live=true
import React from 'react';
import { DatePicker } from '@douyinfe/semi-ui';

() => <DatePicker multiple={true} style={{ width: 240 }} />;
```

### 日期与时间选择

将 `type` 设定为 `dateTime`，可以选择日期时间。  
版本V2.22.0开始，我们将 TimePicker 内的 ScrollItem 的默认模式从 wheel 变更为了 normal, 若想应用回无限滚动的效果，可以通过 timePickerOpts 传入特定配置开启。

```jsx live=true
import React from 'react';
import { DatePicker } from '@douyinfe/semi-ui';

() => (
    <>
        <h4>默认日期与时间选择</h4>
        <DatePicker type="dateTime" />
        <br />
        <br />
        <h4>开启时间列表无限循环</h4>
        <DatePicker
            type="dateTime"
            timePickerOpts={{
                scrollItemProps: { mode: "wheel", cycled: true }
            }}
        />
    </>
);
```

### 日期范围选择

将 `type` 设定为 `dateRange`，可以选择日期范围

```jsx live=true
import React from 'react';
import { DatePicker } from '@douyinfe/semi-ui';

() => <DatePicker type="dateRange" style={{ width: 260 }} onChange={console.log} />;
```

<Notice type="primary" title="注意事项">
    <div>type=dateRange 或 dateTimeRange 时，只有开始日期和结束日期都被选择后才会触发 onChange。</div>
</Notice>

### 日期范围时间选择

将 `type` 设定为 `dateTimeRange`， 可以选择日期时间范围  
当未传入 defaultValue 或 value时，底部面板默认时间为当前时间。如果你有特殊需求（如指定默认时分秒），可以通过 defaultPickerValue 指定

```jsx live=true
import React from 'react';
import { DatePicker } from '@douyinfe/semi-ui';

() => (
    <>
        <DatePicker type="dateTimeRange" style={{ width: 400, marginBottom: 8 }} onChange={console.log} />
        <DatePicker
            type="dateTimeRange"
            style={{ width: 400 }}
            defaultPickerValue={[new Date('2022-08-08 00:00'), new Date('2022-08-09 12:00')]}
            onChange={console.log}
        />
    </>
);
```

### 内嵌输入框

使用 insetInput 可以控制日期面板是否展示内嵌输入框，默认为 false。v2.7.0 后支持。内嵌输入框适用于以下场景：

- 日期时间选择，可以直接通过内嵌输入框单独修改时间，无须通过滚轮选择时间
- 自定义触发器时 + 范围选择，使用内嵌输入框可以单独对开始和结束日期进行修改

insetInput 开启后包括以下功能：

- 点击触发器后，面板默认在原有位置弹出。你可以通过 position 自定义弹出位置
- 点击内嵌日期输入框，面板切换到日期选择；点击内嵌时间输入框，面板切换到时间选择
- 和外部的输入框一致，如果输入了非法日期，面板关闭后日期会回到之前的合法日期

<Notice type="primary" title="注意事项">
    <div>注意，开启后会对组件做一些调整和限制：</div>
    <div>1. 触发器样式：未打开面板时触发器只读，打开时触发器禁用</div>
    <div>2. 面板样式：type 包括 time 时，隐藏底部的切换按钮</div>
    <div>3. 开启 insetInput 后 format 只支持 `dateFormat[ timeFormat]` 格式，使用其他格式会影响内嵌输入框 placeholder 和触发器文本的展示</div>
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
            <DatePicker type="month" placeholder="请选择年月" insetInput style={{ width: 140 }} />
            <br />
            <br />
            <DatePicker type="monthRange" placeholder="请选择年月范围" insetInput style={{ width: 200 }} />
            <br />
            <br />
            <DatePicker type="date" position="bottomLeft" insetInput />
            <br />
            <br />
            <DatePicker type="dateTime" format="yyyy-MM-dd HH:mm" insetInput />
        </div>
    );
}
```

### 同步切换双面板月份

在范围选择的场景中, 开启 `syncSwitchMonth` 则允许双面板同步切换。默认为 false。

> Note：点击年份按钮也会同步切换两个面板，从滚轮里面切换年月不会同步切换面板，这保证了用户选择非固定间隔月份的能力。

```jsx live=true
import React from 'react';
import { DatePicker } from '@douyinfe/semi-ui';

() => (
    <DatePicker
        // 双面板同步切换
        syncSwitchMonth={true}
        type="dateTimeRange"
        style={{ width: 400 }}
    />
);
```

### 切换面板日期的回调

`onPanelChange` 回调函数会在面板的月份或年份切换改变时被调用。

```jsx live=true
import React from 'react';
import { DatePicker } from '@douyinfe/semi-ui';

() => (
    <DatePicker
        syncSwitchMonth={true}
        type="dateTimeRange"
        style={{ width: 400 }}
        onPanelChange={(date, dateString) => console.log(date, dateString)}
    />
);
```

### 周选择

dateRange 搭配 startDateOffset 和 endDateOffset 可以进行单击范围选择，如周选择、双周选择。

```jsx live=true
import React from 'react';
import { DatePicker } from '@douyinfe/semi-ui';

function Demo() {
    const handleChange = date => {
        console.log('date changed', date);
    };

    return (
        <div>
            <h4>选择自然周</h4>
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
            <h4>选择双周</h4>
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
            <h4>选择当前日和后6日</h4>
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

### 年月选择

将 `type` 设定为 `month`，可以进行年月选择。

```jsx live=true
import React from 'react';
import { DatePicker } from '@douyinfe/semi-ui';

() => <DatePicker defaultValue={new Date()} type="month" style={{ width: 140 }} />;
```

### 年月范围选择

**版本：** >= 2.32.0

将 `type` 设定为 `monthRange`，可以进行年月范围选择。暂不支持小尺寸与快捷面板。

```jsx live=true
import React from 'react';
import { DatePicker } from '@douyinfe/semi-ui';

() => <DatePicker type="monthRange" style={{ width: 200 }} />;
```

### 确认日期时间选择

对于“日期时间”（type="dateTime"）或“日期时间范围”（type="dateTimeRange"）的选择，可以进行确认后才将值写入输入框内，你可以通过传递 needConfirm=true 来开启这种行为。

同时支持 “确认”（onConfirm） 和 “取消”（onCancel） 两个按钮的点击回调。

下面这个例子绑定了 onChange、onConfirm、onCancel 三种回调，你可以打开控制台查看打印信息的区别。

> 注意：开启确认选择时，需要点击取消按钮关闭面板，点击空白区域不再关闭面板（v2.2.0）

```jsx live=true
import React from 'react';
import { DatePicker } from '@douyinfe/semi-ui';

() => (
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
```

### 带有快捷方式的日期时间选择

通过 `presets` 设定快捷日期选择

```jsx live=true
import React from 'react';
import { DatePicker } from '@douyinfe/semi-ui';

() => {
    const presets = [
        {
            text: 'Today',
            start: new Date(),
            end: new Date(),
        },
        {
            text: 'Tomorrow',
            start: new Date(new Date().valueOf() + 1000 * 3600 * 24),
            end: new Date(new Date().valueOf() + 1000 * 3600 * 24),
        },
    ];
    return <DatePicker type="dateTime" presets={presets} presetPosition="left"/>;
};
```

### 渲染顶部/底部额外区域

通过 `topSlot` 和 `bottomSlot` 可以自定义渲染顶部和底部额外区域     
通过 `leftSlot` 和 `rightSlot` 可以自定义渲染左侧和右侧额外区域（v2.65.0后支持）

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

    const TopSlot = function(props) {
        const { style } = props;
        return (
            <Tabs
                size="small"
                onChange={handleTabChange}
                activeKey={activeTab}
                style={{ padding: '12px 20px 0', ...style }}
            >
                <TabPane tab="UED 排期" itemKey="1" />
                <TabPane tab="测试排期" itemKey="2" />
            </Tabs>
        );
    };

    const BottomSlot = function(props) {
        const { style } = props;
        return (
            <Space style={{ padding: '12px 20px', ...style }}>
                <IconBulb style={{ color: 'rgba(var(--semi-amber-5), 1)' }} />
                <Text strong style={{ color: 'var(--semi-color-text-2)' }}>
                    定版前请阅读
                </Text>
                <Text link={{ href: 'https://semi.design/', target: '_blank' }}>发版须知</Text>
            </Space>
        );
    };

    const MonthBottomSlot = function(props) {
        const { style } = props;
        return (
            <Space style={{ padding: '12px 20px', ...style }}>
                <IconBulb style={{ color: 'rgba(var(--semi-amber-5), 1)' }} />
                <Text strong style={{ color: 'var(--semi-color-text-2)' }}>
                    请阅读
                </Text>
                <Text link={{ href: 'https://semi.design/', target: '_blank' }}>须知</Text>
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
                placeholder="请选择排期"
            />
            <br />
            <br />
            <DatePicker bottomSlot={<BottomSlot />} placeholder="请选择发版时间" />
            <br />
            <br />
            <DatePicker type="month" bottomSlot={<MonthBottomSlot />} placeholder="请选择年月" />
            <br />
            <br />
            <DatePicker
                topSlot={<TopSlot style={{ padding: '8px 12px 0' }} />}
                bottomSlot={<BottomSlot style={{ padding: '8px 12px' }} />}
                density="compact"
                placeholder="小尺寸"
                dropdownClassName="components-datepicker-demo-slot"
            />
            <br />
            <br />
            <DatePicker type="dateTimeRange" bottomSlot={<BottomSlot />} style={{ width: 400 }} />
            <br />
            <br />
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

### 禁用日期选择

```jsx live=true
import React from 'react';
import { DatePicker } from '@douyinfe/semi-ui';

() => <DatePicker disabled type="dateTime" defaultValue={new Date()} />;
```

### 禁用部分日期或时间

传入 `disabledDate` 可以禁用指定日期，传入 `disabledTime` 可以禁用指定时间，配合 `defaultPickerValue` 可以指定面板打开时所处的年月。

`disabledDate` 和 `disabledTime`，接受的入参都为当前日期，前者返回一个 `boolean` 值，后者返回一个[对象](/zh-CN/input/timepicker#API_参考)，将会透传给 `TimePicker` 组件。

<Notice type="primary" title="注意事项">
    <div>当你使用 timeZone 时，第一个参数为你选择的时区下时间（与onChange的第一个返回值类似）</div>
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
                    <h4>禁用时间：禁用今天下午5-6点</h4>
                    <DatePicker type="dateTime" hideDisabledOptions={false} disabledTime={this.disabledTime} />
                </div>
                <div>
                    <h4>禁用时间：两个面板禁用不同时间</h4>
                    <DatePicker
                        type="dateTimeRange"
                        hideDisabledOptions={false}
                        disabledTime={this.disabledTime2}
                        style={{ width: 400 }}
                    />
                </div>
                <div>
                    <h4>禁用日期：禁用下个月28号之前的所有日期</h4>
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

在 type 包含 range 时，可以根据当前选择动态禁止日期。options 参数 1.9.0 后支持。

```jsx live=true
import React from 'react';
import { DatePicker } from '@douyinfe/semi-ui';
import * as dateFns from 'date-fns';

() => (
    <div>
        <h4>动态禁用日期：禁止选择之前的日期</h4>
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
```

范围选择时，可以根据 focus 状态禁用日期。focus 状态通过 options 中的 rangeInputFocus 参数传递。

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
            <h4>{`开始日期禁用今天前2日和后2日，结束日期禁用今天前3天和后3天`}</h4>
            <DatePicker motion={false} type='dateRange' disabledDate={disabledDate} defaultPickerValue={today} />
        </div>
    );
}
```

### 自定义显示格式

可以通过 `format` 自定义显示格式

```jsx live=true
import React from 'react';
import { DatePicker } from '@douyinfe/semi-ui';

() => <DatePicker format="yyyy年MM月dd日 HH:mm" type="dateTime" defaultValue={new Date()} />;
```

### 自定义触发器

默认情况下我们使用 `Input` 组件作为 `DatePicker` 组件的触发器，通过传递 `triggerRender` 方法你可以自定义这个触发器。

自定义触发器是对触发器的完全自定义，默认的清除按钮将不生效，如果你需要清除功能，请自定义一个清除按钮。

```jsx live=true hideInDSM
import React, { useState, useCallback, useMemo } from 'react';
import * as dateFns from 'date-fns';
import { IconClose, IconChevronDown } from '@douyinfe/semi-icons';
import { DatePicker, Button } from '@douyinfe/semi-ui';

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

<Notice type="primary" title="注意事项">
    <div>范围选择时，面板打开后默认选择的日期为开始日期，选择后会切到结束日期选择。面板关闭后焦点会重置。</div>
    <div>我们建议提供一个清除按钮，当你给 DatePicker 传入空值时，DatePicker 内部也会重置焦点。这样用户可以在清除后重新选择日期范围。（from v2.15）</div>
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
            return '请选择日期时间范围';
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

### 自定义日期显示内容

`renderDate: (dayNumber: number, fullDate: string) => ReactNode`，自定义日期内容。

-   `dayNumber`：当前日。如 `13`。
-   `fullDate`：当前日的完整日期。如 `2020-08-13`。

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
                    <div style={dateStyle}>{dayNumber}</div>
                </Tooltip>
            );
        }
        return dayNumber;
    };
    return <DatePicker renderDate={renderDate} />;
}
```

### 自定义日期格子渲染

`renderFullDate: (dayNumber: number, fullDate: string, dayStatus: object) => ReactNode`， 自定义日期格子的渲染内容。

`dayStatus` 表示当前格子的状态，包括的 `key` 有：

```md
type DayStatusType = {
    isToday?: boolean; // 当前日
    isSelected?: boolean; // 被选中
    isDisabled?: boolean; // 被禁用
    isSelectedStart?: boolean; // 选中开始
    isSelectedEnd?: boolean; // 选中结束
    isInRange?: boolean; // 范围选中日期内
    isHover?: boolean; // 日期在选择项和hover日期之间
    isOffsetRangeStart?: boolean; // 周选择开始
    isOffsetRangeEnd?: boolean; // 周选择结束
    isHoverInOffsetRange?: boolean; // hover在周选择内
};
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
            borderRadius: 'var(--semi-border-radius-circle)',
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

## API 参考

| 属性               | 说明                                                                                                   | 类型      | 默认值  | 版本       |
|--------------------|------------------------------------------------------------------------------------------------------|-----------|---------|------------|
| autoAdjustOverflow | 浮层被遮挡时是否自动调整方向                                                                                       | boolean   | true    | |
| autoFocus          | 自动获取焦点                                                                                               | boolean   | false   |  |
| autoSwitchDate     | 通过面板上方左右按钮、下拉菜单更改年月时，自动切换日期。仅对 date type 生效。                                                         | boolean   | true    |  |
| borderless        | 无边框模式                                                                                    | boolean                         |           | **2.33.0**|
| bottomSlot         | 渲染底部额外区域                                                                                             | ReactNode |         |  |
| className          | 类名                                                                                                   | string    | -       |            |
| clearIcon          | 可用于自定义清除按钮, showClear为true时有效                                                                        | ReactNode |         | **2.25.0** |
| defaultOpen        | 面板默认显示或隐藏                                                                                            | boolean   | false   |            |
| defaultPickerValue | 默认面板日期                                                                                               | ValueType |         |            |
| defaultValue       | 默认值                                                                                                  | ValueType |         |            |
| density            | 面板的尺寸，可选值：`default`, `compact`                                                                       | string    | default |  |
| disabled           | 是否禁用                                                                                                 | boolean   | false   |            |
| disabledDate | 日期禁止判断方法，返回为 true 时禁止该日期，options 参数 1.9.0 后支持，其中 rangeEnd 1.29 后支持，rangeInputFocus 2.22 后支持          | <ApiType detail='(date: Date, options: { rangeStart: string, rangeEnd: string, rangeInputFocus: "rangeStart" \| "rangeEnd" \| false }) => boolean'>(date, options) => boolean</ApiType> | () => false   |
| disabledTime | 时间禁止配置，返回值将会作为参数透传给 [`TimePicker`](/zh-CN/input/timepicker#API_参考)                                   | <ApiType detail='(date: Date \| Date[], panelType?: string) => ({ disabledHours:() => number[], disabledMinutes: (hour: number) => number[], disabledSeconds: (hour: number, minute: number) => number[] })'>(date, panelType) => object</ApiType> | () => false |  |
| disabledTimePicker | 是否禁止时间选择                                                                                             | boolean |  | |
| dropdownClassName | 下拉列表的 CSS 类名                                                                                         | string |  | |
| dropdownStyle | 下拉列表的内联样式                                                                                            | object |  | |
| dropdownMargin | 下拉列表算溢出时的增加的冗余值，详见[issue#549](https://github.com/DouyinFE/semi-design/issues/549)，作用同 Tooltip margin | object\|number  |  | **2.25.0**
| endDateOffset | type 为 dateRange 时，设置单击选择范围的结束日期                                                                     | (selectedDate?: Date) => Date; | - |  |
| format | 在输入框内展现的日期串格式                                                                                        | string | 与 type 对应：详见[日期时间格式](#日期时间格式) |  |
| getPopupContainer | 指定父级 DOM，弹层将会渲染至该 DOM 中，自定义需要设置 `position: relative` 这会改变浮层 DOM 树位置，但不会改变视图渲染位置。                                                 | function():HTMLElement | () => document.body |  |
| hideDisabledOptions | 隐藏禁止选择的时间                                                                                            | boolean | false |  |
| insetInput | 面板中是否嵌入输入框，InsetInputProps 类型 v2.29 支持                                                               | boolean \| <ApiType detail='{ placeholder?: { dateStart?: string; dateEnd?: string; timeStart?: string; timeEnd?: string } }'>InsetInputProps</ApiType>  | false | **2.7.0** |
| inputReadOnly | 文本框是否 readonly                                                                                       | boolean | false |  |
| inputStyle | 输入框样式                                                                                                | object |  |  |
| leftSlot   | 渲染左侧额外区域                                                                                             | ReactNode |         |  **2.65.0** |
| max | multiple 为 true 时，多选的数目,不传或者值为 null\|undefined 的话无限制                                                 | number | - |  |
| motion | 是否开启面板展开的动画                                                                                          | boolean | true |  |
| multiple | 是否可以选择多个，仅支持 type="date"                                                                             | boolean | false |  |
| needConfirm | 是否需要“确认选择”，仅 type="dateTime"\|"dateTimeRange" 时有效                                                    | boolean |  |  |
| open | 面板显示或隐藏的受控属性                                                                                         | boolean |  |  |
| placeholder | 输入框提示文字                                                                                              | string\|string[] | 'Select date' |  |
| position | 浮层位置，可选值同[Popover#API 参考·position 参数](/zh-CN/show/popover#API参考)                                     | string | 'bottomLeft' |  |
| prefix | 前缀内容                                                                                                 | string\|ReactNode |  |  |
| presets | 日期时间快捷方式, start 和 end 在 v2.52 版本支持函数类型                                                                                            |  <ApiType detail='type PresetType = { start?: BaseValueType \| (() => BaseValueType); end?: BaseValueType \| (() => BaseValueType); text?: string }; type PresetsType = Array<PresetType \| (() => PresetType)>;'>Array</ApiType> | [] |  |
| preventScroll | 指示浏览器是否应滚动文档以显示新聚焦的元素，作用于组件内的 focus 方法                                                               | boolean |  |  |
| presetPosition | 日期时间快捷方式面板位置, 可选值'left', 'right', 'top', 'bottom'                                                    | string |  'bottom' | **2.18.0** |
| rangeSeparator | 自定义范围类型输入框的日期分隔符                                                                                     | string | '~' | |
| renderDate | 自定义日期显示内容                                                                                            | (dayNumber, fullDate) => ReactNode | - |  |
| renderFullDate | 自定义显示日期格子内容                                                                                          | (dayNumber, fullDate, dayStatus) => ReactNode | - |  |
| rightSlot         | 渲染右侧额外区域                                                                                             | ReactNode |         | **2.65.0** |
| showClear | 是否显示清除按钮                                                                                             | boolean | true |  |
| size | 尺寸，可选值："small", "default", "large"                                                                   | string | 'default' |  |
| spacing | 浮层与 trigger 的距离                                                                                      | number | 4 |  |
| startDateOffset | type 为 dateRange 时，设置单击选择范围的开始日期                                                                     | <ApiType detail='(selectedDate?: Date) => Date '>(selectedDate) => Date </ApiType>| - |  |
| startYear | 滚轮的开始年                                                                                               | number | 当前年前 100 年 | **2.36.0** |
| endYear | 滚轮的结束年，结束年需要大于开始年                                                                                    | number | 当前年后 100 年 | **2.36.0** |
| stopPropagation | 是否阻止弹出层上的点击事件冒泡                                                                                      | boolean | true |  |
| style | 自定义样式                                                                                                | CSSProperties |  |  |
| syncSwitchMonth | 在范围选择的场景中，支持同步切换双面板的月份                                                                               | boolean | false |  |
| timePickerOpts | 其他可以透传给时间选择器的参数，详见 [TimePicker·API 参考](/zh-CN/input/timepicker#API_参考)                               |  | object | |
| topSlot | 渲染顶部额外区域                                                                                             | ReactNode |  |  |
| triggerRender | 自定义触发器渲染方法，第一个参数是个 Object，详情看下方类型定义                                                                  | (props) => ReactNode| |  |
| type | 类型，可选值："date", "dateRange", "dateTime", "dateTimeRange", "month", "monthRange"                       | string | 'date' |  |
| validateStatus | 校验状态，可选值 default、error、warning，默认 default。仅影响展示样式                                                    | string |  |  |
| value | 受控的值                                                                                                 | ValueType |  |  |
| weekStartsOn | 以周几作为每周第一天，0 代表周日，1 代表周一，以此类推                                                                        | number | 0 |  |
| zIndex | 弹出面板的 zIndex                                                                                         | number | 1030 |  |
| onBlur | 失去焦点时的回调，范围选择时不推荐使用                                                                                  | (e: event) => void | () => {} |  |
| onCancel | 取消选择时的回调，入参为上次确认选择的值，仅 type="dateTime"\|"dateTimeRange" 且 needConfirm=true 时有效。<br/>0.x版本入参顺序与新版有所不同 | <ApiType detail='(date: DateType, dateStr: StringType) => void'>(date, dateString) => void</ApiType> |  | |
| onChange | 值变化时的回调。<br/>0.x版本入参顺序与新版有所不同                                                                        | <ApiType detail='(date: DateType, dateString: StringType) => void'>(date, dateString) => void</ApiType> |  |  |
| onChangeWithDateFirst | 0.x 中 onChange(string, Date), 1.0 后(Date, string)。此开关设为 false 时，入参顺序将与 0.x 版本保持一致                    | boolean | true |  |
| onClear | 点击 clear 按钮时触发                                                                                       | (e: event) => void | () => {} |  |
| onClickOutSide | 当弹出层处于展示状态，点击非弹出层、触发器的回调, event 参数自 2.68.0 支持 | (event: React.mouseEvent) => void | () => {} | **2.31.0** |
| onConfirm | 确认选择时的回调，入参为当前选择的值，仅 type="dateTime"\|"dateTimeRange" 且 needConfirm=true 时有效。<br/>0.x版本入参顺序与新版有所不同   | <ApiType detail='(date: DateType, dateStr: StringType) => void'>(date, dateString) => void</ApiType>|  | |
| onFocus | 获得焦点时的回调，范围选择时不推荐使用                                                                                  | (e: event) => void | () => {} |  |
| onOpenChange | 面板显示或隐藏状态切换的回调                                                                                       | <ApiType detail='(isOpen: boolean) => void'>(isOpen) => void</ApiType> |  |  |
| onPanelChange | 切换面板的年份或者日期时的回调                                                                                      | <ApiType detail='(date: DateType \| DateType[], dateStr: StringType \| StringType[])=>void'>(date, dateStr) => void</ApiType> | function | |
| onPresetClick | 点击快捷选择按钮的回调                                                                                          | <ApiType detail='(item: Object, e: Event) => void'>(item, e) => void</ApiType> | () => {}  | |
| yearAndMonthOpts | 其他可以透传给年月选择器的参数，详见 [ScrollList#API](/zh-CN/show/scrolllist#ScrollItem)                               |  | object | **2.20.0** |

## Methods

| 方法  | 说明                       | 类型                                             | 版本   |
|-------|--------------------------|--------------------------------------------------|--------|
| open  | 调用时可以手动展开下拉列表 | () => void                                       | 2.31.0 |
| close | 调用时可以手动关闭下拉列表 | () => void                                       | 2.31.0 |
| focus | 调用时可以手动聚焦输入框   | (focusType?: 'rangeStart' \| 'rangeEnd') => void | 2.31.0 |
| blur  | 调用时可以手动失焦输入框   | () => void                                       | 2.31.0 |

```jsx live=true
import React, { useRef } from 'react';
import { DatePicker, Space, Button } from '@douyinfe/semi-ui';
import { BaseDatePicker } from '@douyinfe/semi-ui/lib/es/datePicker';

function Demo() {
    const ref = useRef();
    // Typescript 写法
    // const ref = useRef<BaseDatePicker>();
    // 为什么不引用入口导出的 DatePicker？-> 入口组件是个 forwardRef 组件，ref 透传到了这个组件上


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

## 类型定义

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

- 未选中日期时，触发器的 `aria-label` 为 `Choose date`，选中日期时，触发器的 `aria-label` 为 `Change date`
- 日期面板中月的 role 为 `grid`，周的 role 设置为 `row`，日期格子设置为 `gridcell`
- 日期和时间禁用时对应选项的 `aria-disabled` 为 true
- 多选时，月的 `aria-multiselectable` 为 true，选中时日期格子的 `aria-selected` 为 true
- 面板中一些装饰作用的 icon，它们的 `aria-hidden` 为 true




## 文案规范
- 日期选择器建议搭配标签使用
- 使用简洁的标签来表明日期选择所指的内容
- 日期选择器中日期格式请参考[日期与时间](/zh-CN/start/content-guidelines#8.%20%E6%97%A5%E6%9C%9F%E4%B8%8E%E6%97%B6%E9%97%B4)的规范
## 设计变量

<DesignToken/>

## 日期时间格式

semi-ui 组件库中采用 [date-fns(v2.9.0)](https://date-fns.org/v2.9.0/docs/Getting-Started) 作为日期时间引擎，格式化 token 含义如下：

-   `"y"` ：年
-   `"M"` ：月
-   `"d"` ：日
-   `"H"` ：小时
-   `"m"` ：分钟
-   `"s"` ：秒

下面以 `new Date('2023-12-09 08:08:00')` 和 `[new Date('2023-12-09 08:08:00'), new Date('2023-12-10 10:08:00')]` 为例说明不同 `format` 值对展示值的影响：

| 类型 | format | 展示值 |  
| --- | --- |  --- | 
| date | yyyy-MM-dd | 2023-12-09 |
| dateTime | yyyy-MM-dd HH:mm:ss | 2023-12-09 08:08:00 |
| month | yyyy-MM | 2023-12 |
| dateRange | yyyy-MM-dd | 2023-12-09 ～ 2023-12-10 |
| dateTimeRange | yyyy-MM-dd HH:mm:ss | 2023-12-09 08:08 ～ 2023-12-10 10:08 |

多个日期或时间默认使用 `","` （英文逗号）分隔。

> 更多 token 可以查阅 [date-fns 官网](https://date-fns.org/v2.9.0/docs/Unicode-Tokens)


## FAQ

-   **日期时间选择器，时分秒选择时想要无限滚动效果如何实现？**  
    版本V2.22.0开始，我们将 TimePicker 内的 ScrollItem 的默认模式从 wheel 变更为了 normal, 若想应用回无限滚动的效果，可以通过 timePickerOpts 中的特定开关控制该行为，即 timePickerOpts={{ scrollItemProps: { mode: "wheel", cycled: true } }}。

-   **如何设置面板打开时默认显示的时间？**  
     可通过 defaultPickerValue 属性。

- **日期时间选择、范围日期选择，输入部分日期后，面板没有回显日期？**

    输入框需要输入完整后才会回显到面板上。比如，日期时间选择，完整要求日期和时间都已输入。范围日期选择，完整要求开始日期和结束日期都已输入。

- **日期时间选择面板底部的展示的时间是什么？**

    未选择时间时，它为 defaultPickerValue 中时间的值，如果没有设置则是面板打开时的时间。选择时间后，它为已选择的时间。

    由于设计上它有隐含两层含义，可能会导致歧义，建议使用内嵌样式，通过 `insetInput` 打开。使用前推荐阅读相关 <a href="#内嵌输入框">文档</a>。

    <Image src="https://lf6-static.semi.design/obj/semi-tos/images/9c9e8500-bccf-11ed-a8cf-bfecde588f0d.png" width={600} />
