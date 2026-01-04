---
localeCode: zh-CN
order: 49
category: 输入类
title: TimePicker 时间选择器
icon: doc-timepicker
brief: 用户使用时间选择器可以方便地选择某一符合要求的、格式化的时间点
---


## 代码演示

### 如何引入

```jsx import
import { TimePicker } from '@douyinfe/semi-ui';
```
### 基础使用

点击 TimePicker，然后可以在浮层中选择或者输入某一时间。

```jsx live=true
import React from 'react';
import { TimePicker } from '@douyinfe/semi-ui';

function Demo() {
    return <TimePicker />;
}
```

### 无限滚动

版本V2.22.0开始，我们将 TimePicker 内的 ScrollItem 的默认模式从 `wheel` 变更为了 `normal`, 若想应用回无限滚动的效果，可参考以下示例。

```jsx live=true
import React from 'react';
import { TimePicker } from '@douyinfe/semi-ui';

function Demo() {
    return <TimePicker scrollItemProps={{ mode: "wheel", cycled: true }}/>;
}
```

### 受控组件

当使用 `value` 而不是 `defaultValue` 时，作为受控组件使用。`value` 和 `onChange` 需要配合使用。

```jsx live=true hideInDSM
import React from 'react';
import { TimePicker } from '@douyinfe/semi-ui';

class Demo extends React.Component {
    constructor() {
        super();
        this.state = {
            value: null,
        };
        this.onChange = this.onChange.bind(this);
    }

    onChange(time) {
        console.log(time);
        this.setState({ value: time });
    };

    render() {
        return <TimePicker value={this.state.value} onChange={this.onChange} />;
    }
}
```

### 不同的 Format 格式

TimePicker 浮层中的列会随着 `format` 变化，当略去 `format` 中的某部分时，浮层中对应的列也会消失。

NOTE: `format` 遵循 date-fns 的 `format` 格式。 https://date-fns.org/v2.0.0/docs/format

```jsx live=true
import React from 'react';
import { TimePicker } from '@douyinfe/semi-ui';

function Demo() {
    return <TimePicker format={'HH:mm'} defaultValue={'10:24'}/>;
}
```

### 设置面板头部，底部

```jsx live=true
import React, { useState } from 'react';
import { TimePicker, Button } from '@douyinfe/semi-ui';

function Demo() {
    const [open, setOpen] = useState(false);
    const closePanel = () => setOpen(false);
    const onOpenChange = (open) => {
        setOpen(open);
        console.log(open);
    };

    return (
        <div>
            <TimePicker
                open={open}
                onOpenChange={onOpenChange}
                panelHeader={'Time Select'}
                panelFooter={<Button onClick={closePanel}>close</Button>}
            />
            <br/><br/>
            <TimePicker
                type='timeRange'
                panelHeader={['start header', 'end header']}
                panelFooter={[
                    <Button key="1" onClick={() => {console.log('start footer');}}>start footer</Button>, 
                    <Button key="2" onClick={() => {console.log('end footer');}}>end footer</Button>
                ]}
            />
        </div>
    );
}
```

### 禁用时间选择

```jsx live=true
import React from 'react';
import { TimePicker } from '@douyinfe/semi-ui';

function Demo() {
    return <TimePicker defaultValue={'12:08:23'} disabled />;
}
```

### 设置步长

可以使用 `hourStep`, `minuteStep`, `secondStep` 按步长展示可选的时分秒。

```jsx live=true
import React from 'react';
import { TimePicker } from '@douyinfe/semi-ui';

function Demo() {
    return <TimePicker minuteStep={15} secondStep={10} />;
}
```

### 12 小时制

12 小时制的时间选择器，默认的 `format` 为 `h:mm:ss a`，传入的 `format` 格式必须在 [dateFns 日期格式](https://date-fns.org/v2.0.0/docs/format)范围之内。

> 例如默认的 12 小时制格式串为：`a h:mm:ss`，如果传入 `A h:mm:ss` 则会导致无法正确格式化。

```jsx live=true
import React from 'react';
import { TimePicker } from '@douyinfe/semi-ui';

function Demo() {
    return (
        <div>
            <TimePicker use12Hours /><br/><br/>
            <TimePicker use12Hours format="a h:mm" />
        </div>
    );
}
```

### 时间范围

**版本：** >=0.23.0

传入 type="timeRange" 开启时间范围选择。

```jsx live=true
import React from 'react';
import { TimePicker } from '@douyinfe/semi-ui';

function Demo() {
    return (
        <div>
            <TimePicker type="timeRange" defaultValue={["10:23:15", "12:38:32"]} /><br/><br/>
            <TimePicker type="timeRange" use12Hours format="a h:mm" defaultValue={["上午 08:11", "下午 11:21"]} />
        </div>
    );
}
```

### 自定义触发器

默认情况下我们使用 `Input` 组件作为 `TimePicker` 组件的触发器，通过传递 `triggerRender` 方法你可以自定义这个触发器。

```jsx live=true hideInDSM
import React, { useState, useMemo } from 'react';
import * as dateFns from 'date-fns';
import { TimePicker, Button } from '@douyinfe/semi-ui';
import { IconChevronDown, IconClose } from '@douyinfe/semi-icons';

function Demo() {
    const formatToken = 'HH:mm:ss';
    const [time, setTime] = useState(new Date());

    return (
        <TimePicker
            value={time}
            format={formatToken}
            onChange={time => setTime(time)}
            triggerRender={({ placeholder }) => (
                <Tag
                    color='cyan'
                    size='large'
                    shape='circle'
                    style={{ padding: 12, paddingRight: 16, fontSize: 14 }}
                    theme={'light'}
                    prefixIcon={<IconTimePicker />}
                >
                    {time ? dateFns.format(time, formatToken) : placeholder}
                </Tag>
            )}
        />
    );
}
```

## 时区设置

Semi 所有关于时区的配置都收敛在 ConfigProvider 中，详细使用可以参考 [ConfigProvider](/zh-CN/other/configprovider)

```jsx live=true hideInDSM
import React, { useMemo, useState } from 'react';
import { ConfigProvider, Select, TimePicker } from '@douyinfe/semi-ui';

function Demo(props = {}) {
    const [timeZone, setTimeZone] = useState('GMT+08:00');
    const defaultTimestamp = 1581599305265;
    const gmtList = useMemo(() => {
        const list = [];
        for (let hourOffset = -11; hourOffset <= 14 ; hourOffset++) {
            const prefix = hourOffset >= 0 ? '+' : '-';
            const hOffset = Math.abs(parseInt(hourOffset, 10));
            list.push(`GMT${prefix}${String(hOffset).padStart(2, '0')}:00`);
        }
        return list;
    }, []);

    return (
        <ConfigProvider timeZone={timeZone}>
            <div style={{ width: 300 }}>
                <h5 style={{ margin: 10 }}>Select Time Zone:</h5>
                <Select
                    placeholder={'请选择时区'}
                    style={{ width: 300 }}
                    value={timeZone}
                    showClear={true}
                    onSelect={value => setTimeZone(value)}
                >
                    {gmtList.map(gmt => (
                        <Select.Option key={gmt} value={gmt}>
                            {gmt}
                        </Select.Option>
                    ))}
                </Select>
                <br/> 
                <br/> 
                <h5 style={{ margin: 10 }}>TimePicker:</h5>
                <TimePicker defaultValue={defaultTimestamp} onChange={(date, dateString) => console.log('DatePicker changed: ', date, dateString)} />
            </div>
        </ConfigProvider>
    );
}
```

## API 参考

| 参数                  | 说明                                                                                                                     | 类型                                                                              | 默认值                                                            | 版本       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ---------- |
| autoAdjustOverflow    | 浮层被遮挡时是否自动调整方向                                                                                             | boolean                                                                           | true                                                              |            |
| autoFocus             | 自动获取焦点                                                                                                             | boolean                                                                           | false                                                             |            |
| borderless            | 无边框模式  >=2.33.0                                                                                                     | boolean                                                                           |                                                                   |
| className             | 外层样式名                                                                                                               | string                                                                            |                                                                   |            |
| clearIcon             | 可用于自定义清除按钮, showClear为true时有效                                                                              | ReactNode                                                                         |                                                                   | **2.25.0** |
| defaultOpen           | 面板是否默认打开                                                                                                         | boolean                                                                           |                                                                   |            |
| defaultValue          | 默认时间                                                                                                                 | Date\|timeStamp\|String（type="timeRange"时为数组）                               |                                                                   |            |
| disabled              | 禁用全部操作                                                                                                             | boolean                                                                           | false                                                             |            |
| disabledHours         | 禁止选择部分小时选项                                                                                                     | Function(): number[]                                                              |                                                                   |            |
| disabledMinutes       | 禁止选择部分分钟选项                                                                                                     | Function(selectedHour: number): number[]                                          |                                                                   |            |
| disabledSeconds       | 禁止选择部分秒选项                                                                                                       | Function(selectedHour: number, selectedMinute: number): number[]                  |                                                                   |            |
| dropdownMargin        | 浮层算溢出时的增加的冗余值，详见[issue#549](https://github.com/DouyinFE/semi-design/issues/549)，作用同 Tooltip margin   | object\|number                                                                    |                                                                   | **2.25.0** |
| focusOnOpen           | 挂载时是否打开面板并focus输入框                                                                                          | boolean                                                                           | false                                                             |            |
| format                | 展示的时间格式                                                                                                           | string                                                                            | "HH:mm:ss"                                                        |            |
| getPopupContainer     | 指定容器，浮层将会渲染至该元素内，自定义需要设置 `position: relative`  这会改变浮层 DOM 树位置，但不会改变视图渲染位置。 | Function(): HTMLElement                                                           | () => document.body                                               |            |
| hideDisabledOptions   | 隐藏禁止选择的选项                                                                                                       | boolean                                                                           | false                                                             |            |
| hourStep              | 小时选项间隔                                                                                                             | number                                                                            | 1                                                                 |            |
| inputReadOnly         | 设置输入框为只读（避免在移动设备上打开虚拟键盘）                                                                         | boolean                                                                           | false                                                             |            |
| minuteStep            | 分钟选项间隔                                                                                                             | number                                                                            | 1                                                                 |            |
| motion                | 是否展示弹出层动画                                                                                                       | boolean                                                                           | true                                                              |            |
| open                  | 面板是否打开的受控属性                                                                                                   | boolean                                                                           |                                                                   |            |
| panelFooter           | 面板底部 addon                                                                                                           | ReactNode\|ReactNode[]\|string                                                    | 无                                                                |            |
| panelHeader           | 面板头部 addon                                                                                                           | ReactNode\|ReactNode[]\|string                                                    | 无                                                                |            |
| placeholder           | 没有值的时候显示的内容                                                                                                   | string                                                                            | "请选择时间"                                                      |            |
| popupClassName        | 弹出层类名                                                                                                               | string                                                                            | ''                                                                |            |
| popupStyle            | 弹出层样式对象                                                                                                           | object                                                                            | -                                                                 |            |
| position              | 浮层位置                                                                                                                 | string                                                                            | type="timeRange"时默认为"bottom"，type="time"时默认为"bottomLeft" |            |
| prefix                | 前缀内容                                                                                                                 | string\|ReactNode                                                                 |                                                                   |            |
| preventScroll         | 指示浏览器是否应滚动文档以显示新聚焦的元素，作用于组件内的 focus 方法                                                    | boolean                                                                           |                                                                   |            |
| rangeSeparator        | 时间范围分隔符                                                                                                           | string                                                                            | " ~ "                                                             |            |
| scrollItemProps       | 透传给 scrollItem 的属性，可选值同[ScrollList#API](/zh-CN/show/scrolllist#ScrollItem)                                    | object                                                                            |                                                                   |            |
| secondStep            | 秒选项间隔                                                                                                               | number                                                                            | 1                                                                 |            |
| showClear             | 是否展示清除按钮                                                                                                         | boolean                                                                           | true                                                              |            |
| stopPropagation       | 是否阻止弹出层上的点击事件冒泡                                                                                           | boolean                                                                           | true                                                              | **2.49.0** |
| size                  | 输入框的大小，可选 'default'，'small'，'large'                                                                           | string                                                                            | 'default'                                                         |            |
| triggerRender         | 自定义触发器渲染方法                                                                                                     | ({ placeholder: string }) => ReactNode                                            | -                                                                 |            |
| type                  | 类型                                                                                                                     | "time"\|"timeRange"                                                               | "time"                                                            |            |
| use12Hours            | 使用 12 小时制，为 true 时 `format` 默认为 `h:mm:ss a`                                                                   | boolean                                                                           | false                                                             |            |
| value                 | 当前时间                                                                                                                 | Date\|timeStamp\|String（type="timeRange"时为数组）                               |                                                                   |            |
| onBlur                | 失去焦点时的回调                                                                                                         | (e: domEvent) => void                                                             | () => {}                                                          |            |
| onChange              | 时间发生变化的回调                                                                                                       | Function(time: Date, timeString: string): void （type="timeRange"时入参皆为数组） | 无                                                                |            |
| onChangeWithDateFirst | 设置为 `true` 时 onChange 的入参顺序为 (Date, string), `false` 时为 (string, Date)                                       | boolean                                                                           | true                                                              | **2.4.0**  |
| onFocus               | 获得焦点时的回调                                                                                                         | (e: domEvent) => void                                                             | () => {}                                                          |            |
| onOpenChange          | 面板打开/关闭时的回调                                                                                                    | Function(isOpen: boolean): void                                                   | 无                                                                |            |

## Methods

绑定在组件实例上的方法，可以通过 ref 调用实现某些特殊交互

| 名称    | 描述     |
| ------- | -------- |
| blur()  | 移除焦点 |
| focus() | 获取焦点 |

## 文案规范
- 时间选择器至少包括时和分，如：11:30，它在本地化过程中，可以适应为12小时制或者24小时制
- 当选择12小时制，需要和AM/PM一起搭配使用
## 设计变量
<DesignToken/>
