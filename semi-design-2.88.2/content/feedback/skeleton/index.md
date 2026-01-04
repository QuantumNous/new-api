---
localeCode: zh-CN
order: 91
category: 反馈类
title: Skeleton 骨架屏
icon: doc-skeleton
brief: 在需要等待加载内容的位置提供的占位组件。
---

## 概述

-   `Avatar`：占位头像，默认为圆形，默认尺寸：Avatar medium: `width: 48px`，`height: 48px`。支持 Avatar 的 size、shape 属性 (v2.20后支持)
-   `Image`：占位图像，默认尺寸：`width: 100%`，`height: 100%`。
-   `Title`：占位标题，默认尺寸：`width: 100%`， `height: 24px`。
-   `Paragraph`：占位内容部分，默认尺寸：`width: 100%`，`height: 16px`，`margin-bottom: 10px`。
-   `Button`：占位按钮，默认尺寸：`width: 115px`，`height: 32px`。

> 注意：默认样式均可通过 `className` 或 `style` 进行自定义。

## 代码演示

### 如何引入

```jsx import
import { Skeleton } from '@douyinfe/semi-ui';
```

### 基本使用

```jsx live=true
import React, { useState } from 'react';
import { Skeleton, Switch, Avatar, Button } from '@douyinfe/semi-ui';

() => {
    const [loading, setLoading] = useState(true);
    const showContent = () => {
        setLoading(!loading);
    };
    return (
        <>
            <span style={{ display: 'flex', alignItems: 'center' }}>
                <Switch onChange={() => showContent()} />
                <span style={{ marginLeft: '10px' }}>显示加载内容</span>
            </span>
            <br />
            <Skeleton placeholder={<Skeleton.Avatar />} loading={loading}>
                <Avatar color="blue" style={{ marginBottom: 10 }}>
                    U
                </Avatar>
            </Skeleton>
            <br />
            <Skeleton style={{ width: 200, height: 150 }} placeholder={<Skeleton.Image />} loading={loading}>
                <img
                    src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/dy.png"
                    height="150"
                    alt="avatar"
                />
            </Skeleton>
            <br />
            <Skeleton
                style={{ width: 80 }}
                placeholder={<Skeleton.Title style={{ marginBottom: 10 }} />}
                loading={loading}
            >
                <h4 style={{ marginBottom: 0 }}>Semi UI</h4>
            </Skeleton>
            <Skeleton style={{ width: 240 }} placeholder={<Skeleton.Paragraph rows={2} />} loading={loading}>
                <p style={{ width: 240 }}>精心打磨每一个组件的用户体验，从用户的角度考虑每个组件的使用场景。</p>
            </Skeleton>
            <br />
            <Skeleton placeholder={<Skeleton.Button />} loading={loading}>
                <Button>Button</Button>
            </Skeleton>
        </>
    );
};
```

### 组合使用

图片和标题。

```jsx live=true
import React from 'react';
import { Skeleton } from '@douyinfe/semi-ui';

() => {
    const placeholder = (
        <div>
            <Skeleton.Image style={{ width: 200, height: 150 }} />
            <Skeleton.Title style={{ width: 120, marginTop: 10 }} />
        </div>
    );

    return (
        <Skeleton placeholder={placeholder} loading={true}>
            <img
                src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/dy.png"
                height="150"
                alt="avatar"
            />
            <h4>Semi UI</h4>
        </Skeleton>
    );
};
```

统计数字。

```jsx live=true
import React from 'react';
import { Skeleton, Descriptions } from '@douyinfe/semi-ui';

() => {
    const placeholder = (
        <div>
            <Skeleton.Paragraph rows={1} style={{ width: 80, marginBottom: 10 }} />
            <Skeleton.Title style={{ width: 120 }} />
        </div>
    );

    const data = [{ key: '实际用户数量', value: '1,480,000' }];

    return (
        <Skeleton placeholder={placeholder} loading={true}>
            <Descriptions data={data} row />
        </Skeleton>
    );
};
```

头像和标题。

```jsx live=true
import React from 'react';
import { Skeleton, Avatar } from '@douyinfe/semi-ui';

() => {
    const placeholder = (
        <div style={{ display: 'flex', alignItems: 'center' }}>
            <Skeleton.Avatar style={{ marginRight: 12 }} />
            <Skeleton.Title style={{ width: 120 }} />
        </div>
    );

    return (
        <Skeleton placeholder={placeholder} loading={true}>
            <Avatar color="blue" style={{ marginRight: 12 }}>
                UI
            </Avatar>
            <span>Semi UI</span>
        </Skeleton>
    );
};
```

居中段落和按钮。

```jsx live=true
import React from 'react';
import { Skeleton, Button } from '@douyinfe/semi-ui';

() => {
    const style = {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '300px',
        marginBottom: '10px',
    };

    const placeholder = (
        <div style={style}>
            <Skeleton.Paragraph style={style} rows={3} />
            <Skeleton.Button />
        </div>
    );

    return (
        <Skeleton placeholder={placeholder} loading={true} style={{ textAlign: 'center' }}>
            <div style={{ textAlign: 'center' }}>
                <p>Hi, Bytedance dance dance.</p>
                <p>Hi, Bytedance dance dance.</p>
                <Button>Button</Button>
            </div>
        </Skeleton>
    );
};
```

头像、标题和段落。

```jsx live=true
import React from 'react';
import { Skeleton, Avatar } from '@douyinfe/semi-ui';

() => {
    const style = {
        display: 'flex',
        alignItems: 'flex-start',
    };

    const placeholder = (
        <div style={style}>
            <Skeleton.Avatar style={{ marginRight: 12 }} />
            <div>
                <Skeleton.Title style={{ width: 120, marginBottom: 12, marginTop: 12 }} />
                <Skeleton.Paragraph style={{ width: 240 }} rows={3} />
            </div>
        </div>
    );

    return (
        <Skeleton placeholder={placeholder} loading={true}>
            <div style={style}>
                <Avatar color="blue" style={{ marginRight: 12 }}>
                    UI
                </Avatar>
                <div>
                    <h3>Semi UI</h3>
                    <p>Hi, Bytedance dance dance.</p>
                    <p>Hi, Bytedance dance dance.</p>
                    <p>Hi, Bytedance dance dance.</p>
                </div>
            </div>
        </Skeleton>
    );
};
```

表格。

```jsx live=true hideInDSM
import React from 'react';
import { Skeleton, Table } from '@douyinfe/semi-ui';

() => {
    const data = {
        columns: [
            {
                title: 'Name',
                dataIndex: 'name',
            },
            {
                title: 'Age',
                dataIndex: 'age',
            },
            {
                title: 'Address',
                dataIndex: 'address',
            },
        ],
        content: [
            {
                key: '1',
                name: 'John Brown',
                age: 32,
                address: 'New York No. 1 Lake Park, New York No. 1 Lake Park',
            },
            {
                key: '2',
                name: 'Jim Green',
                age: 42,
                address: 'London No. 1 Lake Park',
            },
            {
                key: '3',
                name: 'Joe Black',
                age: 32,
                address: 'Sidney No. 1 Lake Park',
            },
            {
                key: '4',
                name: 'Disabled User',
                age: 99,
                address: 'Sidney No. 1 Lake Park',
            },
        ],
    };

    const skData = {
        columns: [1, 2, 3].map(key => {
            const item = {};
            item.title = <Skeleton.Title style={{ width: '0' }} />;
            item.dataIndex = `${key}`;
            return item;
        }),
        dataSource: [1, 2, 3, 4].map(key => {
            const item = {};
            item.key = key;
            [1, 2, 3].forEach(i => {
                const width = 50 * i;
                item[i] = <Skeleton.Paragraph style={{ width: width }} rows={1} />;
            });
            return item;
        }),
    };

    const placeholder = (
        <div style={{ position: 'relative' }}>
            <Table
                style={{ backgroundColor: 'var(--semi-color-bg-1)' }}
                columns={skData.columns}
                dataSource={skData.dataSource}
                pagination={false}
            />
            <div style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}></div>
        </div>
    );

    return (
        <Skeleton placeholder={placeholder} loading={true}>
            <div>
                <Table columns={data.columns} dataSource={data.content} pagination={false} />
            </div>
        </Skeleton>
    );
};
```

### 加载动画

通过设置 `active` 属性可以展示动画效果。

```jsx live=true hideInDSM
import React from 'react';
import { Skeleton, Avatar } from '@douyinfe/semi-ui';

() => {
    const style = {
        display: 'flex',
        alignItems: 'flex-start',
    };

    const placeholder = (
        <div style={style}>
            <Skeleton.Avatar style={{ marginRight: 12 }} />
            <div>
                <Skeleton.Title style={{ width: 120, marginBottom: 12, marginTop: 12 }} />
                <Skeleton.Paragraph style={{ width: 240 }} rows={3} />
            </div>
        </div>
    );

    return (
        <Skeleton placeholder={placeholder} loading={true} active>
            <div style={style}>
                <Avatar color="blue" style={{ marginRight: 12 }}>
                    UI
                </Avatar>
                <div>
                    <h3>Semi UI</h3>
                    <p>Hi, Bytedance dance dance.</p>
                    <p>Hi, Bytedance dance dance.</p>
                    <p>Hi, Bytedance dance dance.</p>
                </div>
            </div>
        </Skeleton>
    );
};
```

## API 参考

### Skeleton

| 属性        | 说明                                       | 类型          | 默认值 |
| ----------- | ------------------------------------------ | ------------- | ------ |
| active      | 是否展示动画效果                           | boolean       | false  |
| className   | 类名                                       | string        | -      |
| loading     | 为 true 时，显示占位元素。反之则显示子组件 | boolean       | true   |
| placeholder | 加载等待时的占位元素                       | ReactNode     | -      |
| style       | 样式                                       | CSSProperties | -      |

### Skeleton.Avatar

> `Skeleton.Image`，`Skeleton.Title`，`Skeleton.Button` 大部分API 与 `Skeleton.Avatar` 相同。其中 shape 仅 `Skeleton.Avatar支持`

| 属性 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| className | 类名 | string | - |
| size | 设置头像的大小，支持 `extra-extra-small`, `extra-small`、`small`、`medium`、`large`、`extra-large` | string | `medium` |
| style | 样式 | CSSProperties | - |
| shape | 指定头像的形状，支持 `circle`、`square` | string | `circle` |

### Skeleton.Paragraph

| 属性      | 说明                 | 类型          | 默认值 |
| --------- | -------------------- | ------------- | ------ |
| className | 类名                 | string        | -      |
| rows      | 设置段落占位图的行数 | number        | 4      |
| style     | 样式                 | CSSProperties | -      |

## 文案规范

-   不变的固定内容直接展示固定内容，可变的内容使用骨架屏展示

## 设计变量

<DesignToken/>
