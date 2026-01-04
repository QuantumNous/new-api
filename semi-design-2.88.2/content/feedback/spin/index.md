---
localeCode: zh-CN
order: 92
category: 反馈类
title: Spin 加载器
icon: doc-spin
brief: 加载器组件用于告知用户内容正在加载且需要一段不确定的时长。
---

## 代码演示

### 如何引入

```jsx import
import { Spin } from '@douyinfe/semi-ui';
```

### 基本用法

```jsx live=true
import React from 'react';
import { Spin } from '@douyinfe/semi-ui';

() => (
    <div style={{ marginLeft: 30 }}>
        <div style={{ marginBottom: 10 }}>A basic spin.</div>
        <Spin />
    </div>
);
```

### 尺寸

组件定义了三种尺寸：大、中（默认）、小。

```jsx live=true
import React from 'react';
import { Spin } from '@douyinfe/semi-ui';

() => (
    <div style={{ marginLeft: 30 }}>
        <div style={{ marginBottom: 5 }}>size: small</div>
        <Spin size="small" />
        <br />
        <br />
        <div style={{ marginBottom: 10 }}>size: middle</div>
        <Spin size="middle" />
        <br />
        <br />
        <div style={{ marginBottom: 15 }}>size: large</div>
        <Spin size="large" />
    </div>
);
```

### 带文字的

通过 `tip` 属性可设置当 Spin 用作包裹元素时的文字。

```jsx live=true
import React from 'react';
import { Spin } from '@douyinfe/semi-ui';

() => (
    <div>
        <Spin tip="I am loading...">
            <div
                style={{
                    border: '1px solid var(--semi-color-primary)',
                    borderRadius: '4px',
                    paddingLeft: '8px',
                }}
            >
                <p>Here are some texts.</p>
                <p>And more texts on the way.</p>
            </div>
        </Spin>
    </div>
);
```

### 自定义指示符

可以通过设置 `indicator` 属性自定义 Spin 的指示符样式。

```jsx live=true
import React from 'react';
import { Spin } from '@douyinfe/semi-ui';
import { IconLoading } from '@douyinfe/semi-icons';

() => (
    <div style={{ marginLeft: 30 }}>
        <div>A spin with customized indicator.</div>
        <Spin indicator={<IconLoading />} />
    </div>
);
```

### 延迟显示

通过 delay 设置延迟显示 `loading` 的效果  
组件是否处于 `loading` 状态由传入的 `spinning` 值决定，loading 为受控属性

```jsx live=true hideInDSM
import React, { useState } from 'react';
import { Spin, Button } from '@douyinfe/semi-ui';

() => {
    const [loading, toggleLoading] = useState(false);

    const toggle = () => {
        toggleLoading(!loading);
    };
    return (
        <div>
            <Button onClick={toggle} style={{ marginRight: 20 }}>
                延迟显示的spin
            </Button>
            <Spin delay={1000} spinning={loading}></Spin>
        </div>
    );
};
```

## API 参考

| 属性             | 说明                                          | 类型       | 默认值   |
| ---------------- | --------------------------------------------- | ---------- | -------- |
| childStyle       | 内部子元素的样式 **v>=1.0.0**                 | CSSProperties     | -        |
| delay            | 延迟显示加载效果的时间                        | number(ms) | 0        |
| indicator        | 加载指示符                                    | ReactNode  | 无       |
| size             | 组件大小，可选值为 `small`, `middle`, `large` | string     | `middle` |
| spinning         | 是否处于加载中的状态                          | boolean    | true     |
| style            | 内联样式                                      | CSSProperties     | -        |
| tip              | 当 spin 作为包裹元素时，可以自定义描述文字    | ReactNode     | 无       |
| wrapperClassName | 包裹元素的类名                                | string     | 无       |

## 设计变量

<DesignToken/>

## 文案规范
- 准确地说明加载状态，使用比如“Loading”, “Submitting”, “Processing”等词
- 使用尽量少的词汇去描述状态

## FAQ

-   **怎么修改 icon 的颜色？**

    可以通过给 .semi-spin-wrapper 类添加 color 属性覆盖原有的颜色（推荐以更高权重覆盖）

    ```
    .custom .semi-spin-wrapper {
      color: red;
    }
    ```
