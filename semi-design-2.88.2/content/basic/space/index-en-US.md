---
localeCode: en-US
order: 26
category: basic
title:  Space
icon: doc-space
brief: Set the spacing between components.
---

## Demos

### How to import

```jsx import
import { Space } from '@douyinfe/semi-ui';
```
### Basic Usage

```jsx live=true hideInDSM
import React from 'react';
import { Space, Button, Switch } from '@douyinfe/semi-ui';

() => (
    <Space>
        <Switch defaultChecked={true}/>     
        <Button type="secondary">secondary</Button>
        <Button type="tertiary">tertiary</Button>
        <Button type="warning">warning</Button>
    </Space>
);
```

### Alignment

You can use `align` to set the alignment, optional: `start`, `center`（default）, `end`, `baseline`.


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
                <div style={divStyle}> text </div>
                <Button theme='solid' type='primary'>button</Button>
                <Tag color='green' size='large'> tag </Tag>
            </Space>
            <Space align='center'>
                <div style={divStyle}> text </div>
                <Button theme='solid' type='primary'>button</Button>
                <Tag color='green' size='large'> tag </Tag>
            </Space>
            <Space align='end'>
                <div style={divStyle}> text </div>
                <Button theme='solid' type='primary'>button</Button>
                <Tag color='green' size='large'> tag </Tag>
            </Space>
            <Space align='baseline'>
                <div style={divStyle}> text </div>
                <Button theme='solid' type='primary'>button</Button>
                <Tag color='green' size='large'> tag </Tag>
            </Space>
        </Space>
    );
};
```

### Spacing

You can use `spacing` to set the spacing size, optional: `tight` (8px, default), `medium` (16px), `loose` (24px), and allow to pass in number to customize the spacing size, and also support to pass in array to set the horizontal and vertical spacing at the same time.

```jsx live=true hideInDSM
import React from 'react';
import { Space, Tabs, TabPane, Button } from '@douyinfe/semi-ui';

() => (
    <Tabs type="line">
        <TabPane tab="tight" itemKey="1">
            <Space spacing='tight' style={{ marginTop: '15px' }}>
                <Button theme='solid' type='primary'>button</Button>
                <Button theme='solid' type='primary'>button</Button>
                <Button theme='solid' type='primary'>button</Button>
                <Button theme='solid' type='primary'>button</Button>
            </Space>
        </TabPane>
        <TabPane tab="medium" itemKey="2">
            <Space spacing='medium' style={{ marginTop: '15px' }}>
                <Button theme='solid' type='primary'>button</Button>
                <Button theme='solid' type='primary'>button</Button>
                <Button theme='solid' type='primary'>button</Button>
                <Button theme='solid' type='primary'>button</Button>
            </Space>
        </TabPane>
        <TabPane tab="loose" itemKey="3">
            <Space spacing='loose' style={{ marginTop: '15px' }}>
                <Button theme='solid' type='primary'>button</Button>
                <Button theme='solid' type='primary'>button</Button>
                <Button theme='solid' type='primary'>button</Button>
                <Button theme='solid' type='primary'>button</Button>
            </Space>
        </TabPane>
        <TabPane tab="array" itemKey="4">
            <Space spacing={[8, 16]} wrap style={{ marginTop: '15px' }}>
                <Button theme='solid' type='primary'>button</Button>
                <Button theme='solid' type='primary'>button</Button>
                <Button theme='solid' type='primary'>button</Button>
                <Button theme='solid' type='primary'>button</Button>
                <Button theme='solid' type='primary'>button</Button>
                <Button theme='solid' type='primary'>button</Button>
                <Button theme='solid' type='primary'>button</Button>
                <Button theme='solid' type='primary'>button</Button>
                <Button theme='solid' type='primary'>button</Button>
                <Button theme='solid' type='primary'>button</Button>
            </Space>
        </TabPane>
    </Tabs>
);
```

### Direction

You can use `vertical` to set whether the spacing is vertical, the default is false.

```jsx live=true hideInDSM
import React from 'react';
import { Space, Button } from '@douyinfe/semi-ui';

() => (
    <Space vertical>
        <Button theme='solid' type='primary'>button</Button>
        <Button theme='solid' type='primary'>button</Button>
        <Button theme='solid' type='primary'>button</Button>
        <Button theme='solid' type='primary'>button</Button>
    </Space>
);
```

### Wrap

When the spacing is horizontal，you can use `wrap` to set whether to wrap automatically, the default is false.

```jsx live=true hideInDSM
import React from 'react';
import { Space, Button } from '@douyinfe/semi-ui';

() => (
    <Space wrap>
        {new Array(10).fill(null).map((item, idex) => (
            <Button theme='solid' type='secondary' key={idex}>button</Button>
        ))}
    </Space>
);
```

## API Reference

|Properties|Instructions|Type|Default|Version|
|-|-|-|-|-|
|align|Alignment, optional:  `start`、`end`、`center`、`baseline`|string|`center`|>=1.17.0|
|className|Class name|string|-|>=1.17.0|
|spacing|The space size, optional:  `loose`、`medium`、`tight` 、number and array|string\|number\|array|`medium`|>=1.17.0|
|style|Inline style|CSSProperties|-|>=1.17.0|
|vertical|Set to vertical spacing|boolean|false|>=1.17.0|
|wrap|Whether to wrap|boolean|false|>=1.17.0|

## Design Tokens
<DesignToken/>