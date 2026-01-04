---
localeCode: zh-CN
order: 62
category: 展示类
title:  Badge 徽章
icon: doc-badge
brief: 用徽章来给用户提示。
---

## 代码演示

### 如何引入

```jsx import
import { Badge } from '@douyinfe/semi-ui';
```

### 基本用法
Badge 的基本类型为 `count`。如果传入 `dot` 则显示为小圆点，两者互斥，优先渲染小圆点。当传入是节点类型时，将直接渲染该节点。

```jsx live=true
import React from 'react';
import { Badge, Avatar } from '@douyinfe/semi-ui';
import { IconLock } from '@douyinfe/semi-icons';

() => {
    const style = {
        width: '42px',
        height: '42px',
        borderRadius: '4px',
    };
    return (
        <div>
            <Badge count={5}>
                <Avatar color='blue' shape='square' style={style}>BM</Avatar>
            </Badge>
            <br/>
            <br/>
            <Badge dot>
                <Avatar color='blue' shape='square' style={style}>YL</Avatar>
            </Badge>
            <br/>
            <br/>
            <Badge count={<IconLock style={{ color: 'var(--semi-color-primary)' }}/>}>
                <Avatar color='light-blue' shape='square' style={style}>XZ</Avatar>
            </Badge>
            <br/>
            <br/>
            <Badge count='NEW' >
                <Avatar color='light-blue' shape='square' style={style}>WF</Avatar>
            </Badge>
        </div>
    );  
};
```

### 设置显示数字最大值

可以通过设置 `overflowCount` 值设置显示数字的最大值，当实际数值超过该值时将以 `${overflowCount}+` 的格式显示。

```jsx live=true
import React from 'react';
import { Badge, Avatar } from '@douyinfe/semi-ui';

() => {
    const style = {
        width: '42px',
        height: '42px',
        borderRadius: '4px',
    };
    return (
        <div>
            <Badge count={99} >
                <Avatar color='teal' shape='square' style={style}>ZH</Avatar>
            </Badge>
            <br/>
            <br/>
            <Badge count={100} >
                <Avatar color='teal' shape='square' style={style}>HS</Avatar>
            </Badge>
            <br/>
            <br/>
            <Badge count={99} overflowCount={10} >
                <Avatar color='green' shape='square' style={style}>DY</Avatar>
            </Badge>
            <br/>
            <br/>
            <Badge count={1000} overflowCount={999} >
                <Avatar color='green' shape='square' style={style}>TT</Avatar>
            </Badge>
        </div>
    );
};
```

### 设置徽标位置

可以通过设置 `position` 设置位置，支持：`leftTop`， `leftBottom`， `rightTop`（默认）， `rightBottom`。

```jsx live=true
import React from 'react';
import { Badge, Avatar } from '@douyinfe/semi-ui';

() => {
    const style = {
        width: '42px',
        height: '42px',
        borderRadius: '4px',
    };
    return (
        <div>
            <Badge count='VIP' position='rightTop' type='danger'>
                <Avatar color='amber' shape='square' style={style}>ZH</Avatar>
            </Badge>
            <br/>
            <br/>
            <Badge count='VIP' position='rightBottom' type='danger'>
                <Avatar color='amber' shape='square' style={style}>HS</Avatar>
            </Badge>
            <br/>
            <br/>
            <Badge count='VIP' position='leftTop' type='danger'>
                <Avatar color='orange' shape='square' style={style}>DY</Avatar>
            </Badge>
            <br/>
            <br/>
            <Badge count='VIP' position='leftBottom' type='danger'>
                <Avatar color='orange' shape='square' style={style}>TT</Avatar>
            </Badge>
        </div>
    );
};
```

### 设置徽标样式

可以通过设置 `theme` 和 `type` 设置徽标的样式。其中 `theme` 支持三种形式：`solid`, `light`, `inverted`。默认形式为 `solid`。

```jsx live=true
import React from 'react';
import { Badge, Avatar } from '@douyinfe/semi-ui';

() => {
    const bgStyle = {
        padding: '8px',
    };
    const style = {
        width: '42px',
        height: '42px',
        borderRadius: '4px',
    };
    return (
        <div style={{ display: 'flex' }}>
            <div style={bgStyle}>
                <Badge count={5} theme='solid' >
                    <Avatar color='indigo' shape='square' style={style}>XZ</Avatar>
                </Badge>
            </div>
            <div style={bgStyle}>
                <Badge count={5} theme='light' >
                    <Avatar color='indigo' shape='square' style={style}>YB</Avatar>
                </Badge>
            </div>
            <div style={bgStyle}>
                <Badge count={5} theme='inverted' >
                    <Avatar color='light-green' shape='square' style={style}>LX</Avatar>
                </Badge>
            </div>
            <br/>
            <div style={bgStyle}>
                <Badge dot theme='solid' >
                    <Avatar color='light-green' shape='square' style={style}>YZ</Avatar>
                </Badge>
            </div>
            <div style={bgStyle}>
                <Badge dot theme='light' >
                    <Avatar color='lime' shape='square' style={style}>HW</Avatar>
                </Badge>
            </div>
            <div style={{ padding: '8px', borderRadius: '4px', backgroundColor: 'var(--semi-color-fill-0)' }}>
                <Badge dot theme='inverted' >
                    <Avatar color='lime' shape='square' style={style}>XM</Avatar>
                </Badge>
            </div>
        </div>
    );
};
```

`type` 支持如下类型：`primary`，`secondary`，`tertiary`，`warning` 和 `danger`。默认类型为 `primary`。

```jsx live=true
import React from 'react';
import { Badge, Avatar } from '@douyinfe/semi-ui';

() => {
    const bgStyle = {
        padding: '8px 8px 3px 8px',
    };
    const style = {
        width: '42px',
        height: '42px',
        borderRadius: '4px',
    };
    return (
        <div style={{ display: 'flex' }}>
            <div style={bgStyle}>
                <Badge count={5} type='primary' >
                    <Avatar color='violet' shape='square' style={style}>MR</Avatar>
                </Badge>
            </div>
            <div style={bgStyle}>
                <Badge count={5} type='secondary' >
                    <Avatar color='violet' shape='square' style={style}>YL</Avatar>
                </Badge>
            </div>
            <div style={bgStyle}>
                <Badge count={5} type='tertiary' >
                    <Avatar color='red' shape='square' style={style}>ZW</Avatar>
                </Badge>
            </div>
            <br/>
            <div style={bgStyle}>
                <Badge count={5} type='warning' >
                    <Avatar color='red' shape='square' style={style}>JL</Avatar>
                </Badge>
            </div>
            <div style={bgStyle}>
                <Badge count={5} type='danger' >
                    <Avatar color='pink' shape='square' style={style}>RT</Avatar>
                </Badge>
            </div>
            <div style={bgStyle}>
                <Badge dot type='primary' >
                    <Avatar color='pink' shape='square' style={style}>YF</Avatar>
                </Badge>
            </div>
        </div>
    );
};
```

### 独立使用

当 Badge 作为独立元素时可以单独使用。

```jsx live=true
import React from 'react';
import { Badge } from '@douyinfe/semi-ui';

() => (
    <div>
        <Badge count={5} />
        <br/>
        <br/>
        <Badge count='NEW' theme='light' />
        <br/>
        <br/>
        <Badge count={99} overflowCount={10} type='danger' />
        <br/>
        <br/>
        <span><Badge dot type='primary' /> 进行中 processing</span>
        <br/>
        <span><Badge dot type='tertiary' /> 信息 info</span>
        <br/>
        <span><Badge dot type='success' /> 成功 success</span>
        <br/>
        <span><Badge dot type='warning' /> 提醒 warning</span>
        <br/>
        <span><Badge dot type='danger' /> 错误 error</span>
    </div>
);  
```

## API参考

| 属性             | 说明                                                                         | 类型   | 默认值 |
|----------------|----------------------------------------------------------------------------|-----------------|---|
| children       | 徽章的 base                                                                   | ReactNode | 无 | 
| className      | 外侧 className                                                               | string | - |
| count          | 展示的内容                                                                      | ReactNode  | 无 |
| countClassName | 内容区域 className                                                             |  string | 无 |
| dot            | 不展示数字，显示小圆点                                                                | boolean  | false |
| overflowCount  | 最大的展示数字值                                                                   | number | 无 |
| position       | 徽章位置，可选 `leftTop`、 `leftBottom`、 `rightTop`、 `rightBottom`                 | string | `rightTop` |
| countStyle     | 徽章内容的样式, v2.59.1后生效                                                        | CSSProperties | 无 | 
| theme          | 徽章主题，可选 `solid`、 `light`、 `inverted`                                       | string | `solid` |
| type           | 徽章类型，可选 `primary`、 `secondary`、 `tertiary`、 `danger`、 `warning`、 `success` | string | `primary` |

## 文案规范
- Badge内容若为英文时，首字母应大写
## 设计变量
<DesignToken/>

