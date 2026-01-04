---
localeCode: zh-CN
order: 82
category: 展示类
title: Timeline 时间轴
icon: doc-timeline
brief: 时间轴是用于对一系列信息进行时间排序时，垂直展示的组件。
---

## 代码演示

### 如何引入

```jsx import
import { Timeline } from '@douyinfe/semi-ui';
```

### 基本用法

```jsx live=true
import React from 'react';
import { Timeline } from '@douyinfe/semi-ui';

() => (
    <Timeline>
        <Timeline.Item time="2019-07-14 10:35">第一个节点内容</Timeline.Item>
        <Timeline.Item time="2019-06-13 16:17">第二个节点内容</Timeline.Item>
        <Timeline.Item time="2019-05-14 18:34">第三个节点内容</Timeline.Item>
    </Timeline>
);
```

### 节点类型

通过 type 可以设置节点类型，对应原点会变成相应的颜色，可选：`default`，`ongoing`， `success`， `warning`， `error`。

```jsx live=true
import React from 'react';
import { Timeline } from '@douyinfe/semi-ui';

() => (
    <Timeline>
        <Timeline.Item time="2019-07-14 10:35" type="ongoing">
            审核中
        </Timeline.Item>
        <Timeline.Item time="2019-06-13 16:17" type="success">
            发布成功
        </Timeline.Item>
        <Timeline.Item time="2019-05-14 18:34" type="error">
            审核失败
        </Timeline.Item>
    </Timeline>
);
```

### 自定义节点

可以通过 `dot` 自定义图标，`color` 自定义圆点色值。通过设置 `children` 的样式可以自定义节点样式。

```jsx live=true
import React from 'react';
import { Timeline } from '@douyinfe/semi-ui';
import { IconAlertTriangle } from '@douyinfe/semi-icons';

() => (
    <Timeline>
        <Timeline.Item time="2019-07-14 10:35">默认样式的节点</Timeline.Item>
        <Timeline.Item time="2019-06-13 16:17" dot={<IconAlertTriangle />} type="warning">
            自定义图标
        </Timeline.Item>
        <Timeline.Item time="2019-05-14 18:34" color="pink">
            自定义节点颜色
        </Timeline.Item>
        <Timeline.Item time="2019-04-10 12:20">
            <span style={{ fontSize: '18px' }}>自定义节点样式</span>
        </Timeline.Item>
    </Timeline>
);
```

### 时间轴位置

通过 `mode` 属性可以设置时间的位置，共有 4 种模式可选：`left`， `center`， `alternate`， `right`。

#### 时间轴在左侧（默认）

```jsx live=true
import React from 'react';
import { Timeline } from '@douyinfe/semi-ui';

() => (
    <Timeline mode="left">
        <Timeline.Item time="2019-07-14 10:35" extra="节点辅助说明信息">
            第一个节点内容
        </Timeline.Item>
        <Timeline.Item time="2019-06-13 16:17" extra="节点辅助说明信息">
            第二个节点内容
        </Timeline.Item>
        <Timeline.Item time="2019-05-14 18:34" extra="节点辅助说明信息">
            第三个节点内容
        </Timeline.Item>
        <Timeline.Item time="2019-05-09 09:12" extra="节点辅助说明信息">
            第四个节点内容
        </Timeline.Item>
    </Timeline>
);
```

#### 时间节点在左侧

```jsx live=true
import React from 'react';
import { Timeline } from '@douyinfe/semi-ui';

() => (
    <Timeline mode="center">
        <Timeline.Item time="2019-07-14 10:35" extra="节点辅助说明信息">
            第一个节点内容
        </Timeline.Item>
        <Timeline.Item time="2019-06-13 16:17" extra="节点辅助说明信息">
            第二个节点内容
        </Timeline.Item>
        <Timeline.Item time="2019-05-14 18:34" extra="节点辅助说明信息">
            第三个节点内容
        </Timeline.Item>
        <Timeline.Item time="2019-05-09 09:12" extra="节点辅助说明信息">
            第四个节点内容
        </Timeline.Item>
    </Timeline>
);
```

#### 交替展现

```jsx live=true
import React from 'react';
import { Timeline } from '@douyinfe/semi-ui';

() => (
    <Timeline mode="alternate">
        <Timeline.Item time="2019-07-14 10:35" extra="节点辅助说明信息">
            第一个节点内容
        </Timeline.Item>
        <Timeline.Item time="2019-06-13 16:17" extra="节点辅助说明信息">
            第二个节点内容
        </Timeline.Item>
        <Timeline.Item time="2019-05-14 18:34" extra="节点辅助说明信息">
            第三个节点内容
        </Timeline.Item>
        <Timeline.Item time="2019-05-09 09:12" extra="节点辅助说明信息">
            第四个节点内容
        </Timeline.Item>
    </Timeline>
);
```

#### 时间轴在右侧

```jsx live=true
import React from 'react';
import { Timeline } from '@douyinfe/semi-ui';

() => (
    <Timeline mode="right">
        <Timeline.Item time="2019-07-14 10:35" extra="节点辅助说明信息">
            第一个节点内容
        </Timeline.Item>
        <Timeline.Item time="2019-06-13 16:17" extra="节点辅助说明信息">
            第二个节点内容
        </Timeline.Item>
        <Timeline.Item time="2019-05-14 18:34" extra="节点辅助说明信息">
            第三个节点内容
        </Timeline.Item>
        <Timeline.Item time="2019-05-09 09:12" extra="节点辅助说明信息">
            第四个节点内容
        </Timeline.Item>
    </Timeline>
);
```

### 使用 dataSource

```jsx live=true
import React from 'react';
import { Timeline } from '@douyinfe/semi-ui';
import { IconAlertTriangle } from '@douyinfe/semi-icons';

() => (
    <Timeline
        mode="alternate"
        dataSource={[
            {
                time: '2019-07-14 10:35',
                extra: '节点辅助说明信息',
                content: '第一个节点内容',
                type: 'ongoing',
            },
            {
                time: '2019-06-13 16:17',
                extra: '节点辅助说明信息',
                content: <span style={{ fontSize: '18px' }}>第二个节点内容</span>,
                color: 'pink',
            },
            {
                time: '2019-05-14 18:34',
                extra: '节点辅助说明信息',
                dot: <IconAlertTriangle />,
                content: '第三个节点内容',
                type: 'warning',
            },
            {
                time: '2019-05-09 09:12',
                extra: '节点辅助说明信息',
                content: '第四个节点内容',
                type: 'success',
            },
        ]}
    />
);
```

## API 参考

### TimeLine

| 属性 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| className | 类名 | string | - |
| mode | 通过设置 mode 可以改变时间轴和内容的相对位置 | `left`\|`right`\|`center`\|`alternate` | `left` |
| style | 样式 | CSSProperties | - |
| dataSource | 时间轴数据源 **v>=1.16.0**，支持 content 属性及 TimeLine.Item 的所有属性 | array | - |

### TimeLine.Item

| 属性 | 说明 | 类型 | 默认值 | 版本 |
| --- | --- | --- | --- | --- |
| className | 类名 | string | - | - |
| color | 自定义的圆圈色值 | string | - | - |
| dot | 自定义时间轴点 | ReactNode | - | - |
| extra | 自定义辅助内容 | ReactNode | - | - |
| position | 自定义节点位置，可以覆盖 TimeLine 的模式选项 | `left`\|`right` | - | - |
| style | 样式 | CSSProperties | - | - |
| time | 时间文本 | string | - | - |
| type | 当前圆圈的模式 | `default`\|`ongoing`\|`success`\|`warning`\|`error` | `default` | - |
| onClick | 鼠标点击事件的回调 | (e: MouseEvent) => void | - | 2.2.0 |

## Accessibility

### ARIA
- 组件中时间点的连线以及时间点本身被设置了 `aria-hidden`，不会响应 Accessibility API
- 可以通过传入 `aria-label` 设置 TimeLine 组件的标签
```text
<Timeline aria-label="xx事故处理过程时间线">
    <Timeline.Item time="2015-09-01">创建服务现场</Timeline.Item>
    <Timeline.Item time="2015-09-02">初步排除网络异常</Timeline.Item>
    <Timeline.Item time="2015-09-03">技术测试异常</Timeline.Item>
    <Timeline.Item time="2015-09-05">网络异常正在修复</Timeline.Item>
</Timeline>
```
## 设计变量

<DesignToken/>
