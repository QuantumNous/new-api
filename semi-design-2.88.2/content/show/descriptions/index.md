---
localeCode: zh-CN
order: 68
category: 展示类
title: Descriptions 描述列表
icon: doc-descriptions
dir: column
brief: 描述列表用于键值对的呈现。
---

## 代码演示

### 如何引入

```jsx import
import { Descriptions } from '@douyinfe/semi-ui';
```

### 基本用法

可以通过 `props.data` 以键值对 `{ key: value }` 数组方式传入数据  
key、value 均支持 ReactNode 类型，你可以传入字符串或更高自由度的 ReactNode 自由定制渲染效果

```jsx live=true dir="column"
import React from 'react';
import { Descriptions, Tag } from '@douyinfe/semi-ui';
import { IconArrowUp } from '@douyinfe/semi-icons';

() => {
    const data = [
        { key: '实际用户数量', value: '1,480,000' },
        { key: '7天留存', value: <div>98%<IconArrowUp size="small" style={{ color: 'var(--semi-color-success)', marginLeft: '2px' }} /></div> },
        { key: '安全等级', value: '3级' },
        { key: '垂类标签', value: <Tag style={{ margin: 0 }}>电商</Tag> },
        { key: '认证状态', value: '未认证' },
    ];
    return <Descriptions data={data} />;
};
```

### 设置对齐方式

可以通过设置 `align` 值选择对齐方式，支持 `center`, `justify`, `left`, 和 `plain`。默认对齐方式为 `center`  
当 row 为 true 时，该配置无效

```jsx live=true dir="column"

import React from 'react';
import { Descriptions, Tag, Card } from '@douyinfe/semi-ui';

() => {
    const data = [
        { key: '实际用户数量', value: '1,480,000' },
        { key: '7天留存', value: '98%' },
        { key: '安全等级', value: '3级' },
        { key: '垂类标签', value: <Tag style={{ margin: 0 }}>电商</Tag> },
        { key: '认证状态', value: '未认证' },
    ];
    const style = {
        margin: '10px',
    };
    return (
        <>
            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                <Card shadows='always' style={style}>
                    <Descriptions align="center" data={data} />
                </Card>
                <Card shadows='always' style={style}>
                    <Descriptions align="justify" data={data} />
                </Card>
                <Card shadows='always' style={style}>
                    <Descriptions align="left" data={data} />
                </Card>
                <Card shadows='always' style={style}>
                    <Descriptions align="plain" data={data} />
                </Card>
            </div>
        </>
    );
};

```


### JSX 写法

除了通过 props.data 声明数据外，还可以通过 Children JSX 写法声明数据（在 v1.17.0 版本后支持）  
注意 `Description.Item` 应当是 `Description` 的直接子元素。

```jsx live=true dir="column"

import React from 'react';
import { Descriptions } from '@douyinfe/semi-ui';

() => {
    return (
        <Descriptions>
            <Descriptions.Item itemKey="实际用户数量">1,480,000</Descriptions.Item>
            <Descriptions.Item itemKey="7天留存">98%</Descriptions.Item>
            <Descriptions.Item itemKey="安全等级">3级</Descriptions.Item>
            <Descriptions.Item itemKey="垂类标签">电商</Descriptions.Item>
            <Descriptions.Item itemKey="认证状态">未认证</Descriptions.Item>
        </Descriptions>
    );
};
```

### 设置布局模式

可以通过 `layout` 设置布局模式（v2.54.0 后支持）, 默认为 `vertical` 纵向布局 。 

```jsx live=true dir="column"
import React from 'react';
import { Descriptions, Space, Tag } from '@douyinfe/semi-ui';

() => {
    const data = [
        { key: '抖音号', value: 'SemiDesign' },
        { key: '主播类型', value: '自由主播' },
        { key: '安全等级', value: '3级' },
        { key: '垂类标签', value: <Space>
            <Tag size="small" shape='circle' color='amber'>互联网资讯</Tag>
            <Tag size="small" shape='circle' color='violet'>编程</Tag>
        </Space>
        },
        { key: '作品数量', value: '88888888' },
        { key: '认证状态', value: '这是一个很长很长很长很长很长很长很长很长很长的值', span: 3 },
    ];
    return (
        <> 
            <Descriptions layout='vertical' align='plain' data={data} column={4} />
        </>
    );
};
```

横向布局可设置 layout为 `horizontal` 。当设置 horizontal 时，可配合 column 指定每行最大列数

```jsx live=true dir="column"
import React from 'react';
import { Descriptions, Space, Tag } from '@douyinfe/semi-ui';

() => {
    const data = [
        { key: '抖音号', value: 'SemiDesign' },
        { key: '主播类型', value: '自由主播' },
        { key: '安全等级', value: '3级' },
        { key: '垂类标签', value: <Tag size="small" shape='circle' color='violet'>编程</Tag>},
        { key: '作品数量', value: '88888888' },
        { key: '认证状态', value: '这是一个很长很长很长很长很长很长很长很长很长的值', span: 3 },
        { key: '上次直播时间', value: '2024-05-01 12:00:00', span: 3 },
    ];
    return (
        <> 
            <Descriptions layout='horizontal' align='plain' data={data} column={5} />
        </>
    );
};

```


### 双行显示

可以通过设置 `row` 可选择双行显示，支持三种不同的大小：`small`, `medium`, `large`。默认大小为 `medium`，此时 align 配置不再生效

```jsx live=true dir="column"

import React from 'react';
import { Descriptions } from '@douyinfe/semi-ui';
import { IconArrowUp } from '@douyinfe/semi-icons';

() => {
    const data = [
        { key: '实际用户数量', value: '1,480,000' },
        {
            key: '7天留存',
            value: (
                <span>
                    98%
                    <IconArrowUp size="small" style={{ color: 'red', marginLeft: '4px' }} />
                </span>
            ),
        },
        { key: '安全等级', value: '3级' },
    ];
    const style = {
        boxShadow: 'var(--semi-shadow-elevated)',
        backgroundColor: 'var(--semi-color-bg-2)',
        borderRadius: '4px',
        padding: '10px',
        marginRight: '20px',
        width: '600px',
    };
    return (
        <div>
            <Descriptions data={data} row size="small" style={style} />
            <br />
            <Descriptions data={data} row style={style} />
            <br />
            <Descriptions data={data} row size="large" style={style} />
        </div>
    );
};
```

## API 参考

### Descriptions

| 属性      | 说明                                                             | 类型       | 默认值   |
| --------- | ---------------------------------------------------------------- | ---------- | -------- |
| align     | 描述列表的对齐方式，可选 `center`、 `justify`、 `left`、 `plain` | string     | `center` |
| className | 类名                                                             | string     | 无       |
| data      | 列表显示的内容                                                   | DataItem[] | 无       |
| row       | 是否双行显示                                                     | boolean    | `false`  |
| size      | 设置双行显示时的列表的大小，可选 `small`、 `medium`、 `large`    | string     | `medium` |
| style     | 列表的样式                                                       | CSSProperties     | 无       |
| layout    | 列表布局模式，可选 `vertical`、`horizontal`  **v>=2.54.0**          | string        | `vertical` |
| column    | `horizontal` 横向布局下，每行的总列数 **v>=2.54.0**                | number        | 3          |

### DataItem

| 属性   | 说明                             | 类型                        | 默认值 |
| ------ | -------------------------------- | --------------------------- | ------ |
| key    | 键值        | ReactNode           | -      |
| value  | 属性值                           | ReactNode \| (() => ReactNode) | -      |
| hidden | 该数据是否需要展示 **v>=1.12.0** | boolean                     | -      |
| span   | 单元格应跨越的列数 **v>=2.54.0** | number      | 1                 |

### DescriptionItem

| 属性      | 说明                      | 类型              | 默认值 |
| --------- | ------------------------- | ----------------- | ------ |
| itemKey   | 键值 | ReactNode | -      |
| hidden    | 该数据是否需要展示        | boolean           | -      |
| className | Item 外部wrapper: tr 的类名                      | string            | -     |
| style     | Item 外部wrapper: tr 的内联样式                | CSSProperties            | -     |
| span   | 单元格应跨越的列数 **v>=2.54.0**  | number      | 1                 |



## 文案规范
- 字段名和值都按 Sentence case 原则书写大小写

## 设计变量

<DesignToken/>
