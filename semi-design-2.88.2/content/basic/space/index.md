---
localeCode: zh-CN
order: 26
category: 基础
title:  Space 间距
icon: doc-space
brief: 设置组件之间的间距。
---

## 代码演示

### 如何引入

```jsx import
import { Space } from '@douyinfe/semi-ui';
```
### 基本用法

```jsx live=true hideInDSM
import React from 'react';
import { Space, Button, Switch } from '@douyinfe/semi-ui';

() => (
    <Space>
        <Switch defaultChecked={true}/>     
        <Button type="secondary">次要</Button>
        <Button type="tertiary">第三</Button>
        <Button type="warning">警告</Button>
    </Space>
);
```
### 对齐方式

可使用 `align` 设置对齐方式，可选值：`start`、`center`（默认）、`end`、`baseline`。

```jsx live=true hideInDSM
import React from 'react';
import { Space, Button, Tag } from '@douyinfe/semi-ui';

() => {
    const divStyle = {
        width: 80,
        height: 100,
        lineHight: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid var(--semi-color-border)',
        borderRadius: 3
    };
    return (
        <Space vertical>
            <Space align='start'>
                <div style={divStyle}>文本</div>
                <Button theme='solid' type='primary'>按钮</Button>
                <Tag color='green' size='large'>标签</Tag>
            </Space>
            <Space align='center'>
                <div style={divStyle}>文本</div>
                <Button theme='solid' type='primary'>按钮</Button>
                <Tag color='green' size='large'>标签</Tag>
            </Space>
            <Space align='end'>
                <div style={divStyle}>文本</div>
                <Button theme='solid' type='primary'>按钮</Button>
                <Tag color='green' size='large'>标签</Tag>
            </Space>
            <Space align='baseline'>
                <div style={divStyle}>文本</div>
                <Button theme='solid' type='primary'>按钮</Button>
                <Tag color='green' size='large'>标签</Tag>
            </Space>
        </Space>
    );
};
```

### 间距尺寸

可使用 `spacing` 设置间距大小，内置可选值：`tight`（8px，默认）、`medium`（16px）、`loose`（24px），并且支持传入 number 来自定义间距大小，也支持传入 array 来同时设置水平和垂直方向的间距。

```jsx live=true hideInDSM
import React from 'react';
import { Space, Tabs, TabPane, Button } from '@douyinfe/semi-ui';

() => (
    <Tabs type="line">
        <TabPane tab="tight" itemKey="1">
            <Space spacing='tight' style={{ marginTop: '15px' }}>
                <Button theme='solid' type='primary'>按钮</Button>
                <Button theme='solid' type='primary'>按钮</Button>
                <Button theme='solid' type='primary'>按钮</Button>
                <Button theme='solid' type='primary'>按钮</Button>
            </Space>
        </TabPane>
        <TabPane tab="medium" itemKey="2">
            <Space spacing='medium' style={{ marginTop: '15px' }}>
                <Button theme='solid' type='primary'>按钮</Button>
                <Button theme='solid' type='primary'>按钮</Button>
                <Button theme='solid' type='primary'>按钮</Button>
                <Button theme='solid' type='primary'>按钮</Button>
            </Space>
        </TabPane>
        <TabPane tab="loose" itemKey="3">
            <Space spacing='loose' style={{ marginTop: '15px' }}>
                <Button theme='solid' type='primary'>按钮</Button>
                <Button theme='solid' type='primary'>按钮</Button>
                <Button theme='solid' type='primary'>按钮</Button>
                <Button theme='solid' type='primary'>按钮</Button>
            </Space>
        </TabPane>
        <TabPane tab="array" itemKey="4">
            <Space spacing={[8, 16]} wrap style={{ marginTop: '15px' }}>
                <Button theme='solid' type='primary'>按钮</Button>
                <Button theme='solid' type='primary'>按钮</Button>
                <Button theme='solid' type='primary'>按钮</Button>
                <Button theme='solid' type='primary'>按钮</Button>
                <Button theme='solid' type='primary'>按钮</Button>
                <Button theme='solid' type='primary'>按钮</Button>
                <Button theme='solid' type='primary'>按钮</Button>
                <Button theme='solid' type='primary'>按钮</Button>
                <Button theme='solid' type='primary'>按钮</Button>
                <Button theme='solid' type='primary'>按钮</Button>
            </Space>
        </TabPane>
    </Tabs>
);
```

### 间距方向

可使用 `vertical` 设置间距是否为垂直方向，默认情况下为 false。

```jsx live=true hideInDSM
import React from 'react';
import { Space, Button } from '@douyinfe/semi-ui';

() => (
    <Space vertical>
        <Button theme='solid' type='primary'>按钮</Button>
        <Button theme='solid' type='primary'>按钮</Button>
        <Button theme='solid' type='primary'>按钮</Button>
        <Button theme='solid' type='primary'>按钮</Button>
    </Space>
);
```

### 设置换行

当间距为水平方向时，可使用 `wrap` 设置是否自动换行，默认情况下为 false。

```jsx live=true hideInDSM
import React from 'react';
import { Space, Button } from '@douyinfe/semi-ui';

() => (
    <Space wrap>
        {new Array(10).fill(null).map((item, idex) => (
            <Button theme='solid' type='secondary' key={idex}>按钮</Button>
        ))}
    </Space>
);
```

## API参考

|属性|说明|类型|默认值|版本|
|-|-|-|-|-|
|align|对齐方式, 支持 `start`、`end`、`center`、`baseline`|string|`center`|>=1.17.0|
|className|样式类名|string|-|>=1.17.0|
|spacing|间距尺寸, 支持 `loose`、`medium`、`tight` 或 number、array|string\|number\|array|`tight`|>=1.17.0|
|style|内联样式|CSSProperties|-|>=1.17.0|
|vertical|是否为垂直间距|boolean|false|>=1.17.0|
|wrap|是否自动换行|boolean|false|>=1.17.0|

## 设计变量
<DesignToken/>