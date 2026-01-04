---
localeCode: zh-CN
order: 57
category: 导航类
title:  Pagination 翻页器
icon: doc-pagination
width: 60%
brief: 分页器帮助用户在多个页之间进行导航
---

## 代码演示

### 如何引入

```jsx import
import { Pagination } from '@douyinfe/semi-ui';
```

### 基本

基础分页，通过 `total` 设置总条数，`pageSize` 设置每页容量

```jsx live=true width=60%
import React from 'react';
import { Pagination } from '@douyinfe/semi-ui';

() => (
    <div>
        <Pagination total={30} style={{ marginBottom: 12 }}></Pagination>
        <Pagination total={80} style={{ marginBottom: 12 }}></Pagination>
        <Pagination total={200} style={{ marginBottom: 12 }}></Pagination>
        <Pagination total={80} pageSize={30} style={{ marginBottom: 12 }}></Pagination>
    </div>
);
```

### 禁用

通过 `disabled` 设置禁用

```jsx live=true width=60%
import React from 'react';
import { Pagination } from '@douyinfe/semi-ui';

() => (
    <Pagination total={30} disabled style={{ marginBottom: 12 }}></Pagination>
);
```

### 总页数显示

通过 `showTotal` 属性控制是否展示总页数

```jsx live=true width=55%
import React from 'react';
import { Pagination } from '@douyinfe/semi-ui';

() => (
    <div>
        <Pagination total={80} showTotal style={{ marginBottom: 12 }}></Pagination>
        <Pagination total={200} showTotal style={{ marginBottom: 12 }}></Pagination>
    </div>
);
```

### 指定当前页码

可以通过 `defaultCurrentPage` 指定当前激活的页码

```jsx live=true width=55%
import React from 'react';
import { Pagination } from '@douyinfe/semi-ui';

() => (
    <div>
        <Pagination total={80} showTotal defaultCurrentPage={3}></Pagination>
    </div>
);
```

### 每页容量切换

通过设置 `showSizeChanger` 为 `true`，允许通过 Select 组件快速切换每页容量

```jsx live=true width=55%
import React from 'react';
import { Pagination } from '@douyinfe/semi-ui';

() => (
    <div>
        <Pagination total={80} showSizeChanger style={{ marginBottom: 12 }}></Pagination>
        <Pagination total={300} showSizeChanger></Pagination>
    </div>
);
```

### 快速跳转至某页
通过设置 `showQuickJumper` 为 `true`, 允许通过Input控件输入页码，快速跳转  
当Input失去焦点时，若Input中为有效数字，会直接进行跳转。你亦可在Input聚焦时，输入期望跳转的页码后直接敲击回车进行跳转  
若你输入页码大于分页器总页数，我们会自动为你跳转至最后一页  
showQuickJumper于 v1.31后提供

```jsx live=true width=50%
import React from 'react';
import { Pagination } from '@douyinfe/semi-ui';

() => (
    <div>
        <Pagination total={80} showQuickJumper style={{ marginBottom: 12 }}></Pagination>
        <Pagination total={300} showQuickJumper></Pagination>
    </div>
);
```
### 页码受控

传入 `currentPage` 后，分页器即为受控组件，一般配合 `onPageChange` 使用。当前激活页码完全取决于传入的 `currentPage`的 值

```jsx live=true width=60%
import React, { useState } from 'react';
import { Pagination } from '@douyinfe/semi-ui';

() => {
    const [page, setPage] = useState(3);
    function onPageChange(currentPage) {
        setPage(currentPage);
    }
    return (
        <Pagination
            total={200}
            currentPage={page}
            onPageChange={onPageChange}>
        </Pagination>
    );
};
```

### 预设每页容量可选值

传入 `pageSizeOpts` 数组，指定切换每页容量的可选值

```jsx live=true width=55%
import React from 'react';
import { Pagination } from '@douyinfe/semi-ui';

() => (
    <div>
        <Pagination
            total={300}
            showSizeChanger
            style={{ marginBottom: 12 }}
            pageSizeOpts={[50, 80, 90, 200]}>
        </Pagination>
        <Pagination
            total={300}
            showSizeChanger
            pageSizeOpts={[10, 20, 50, 200]}>
        </Pagination>
    </div>
);
```

### 迷你版本

`size` 设置为 `small`

```jsx live=true width=50%
import React from 'react';
import { Pagination } from '@douyinfe/semi-ui';

() => (
    <Pagination total={90} size="small"></Pagination>
);
```

开启 hoverShowPageSelect，可以 hover 页码快速切换（v1.27.0后提供）

```jsx live=true width=50%
import React from 'react';
import { Pagination } from '@douyinfe/semi-ui';

() => (
    <Pagination total={90} size="small" hoverShowPageSelect></Pagination>
);

```
## API 参考

| 属性               | 说明                                                                              | 类型                                            | 默认值              |  版本|
| ------------------ | --------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------- |------------- |
| className          | 类名                                                                              | string                                          |                     |
| currentPage        | 当前页码                                                                          | number                                          |                     |
| defaultCurrentPage | 默认的当前页码                                                                    | number                                          |                     |
| disabled           | 禁用                                                                             | boolean                                         |false                  | 2.37.0
| hideOnSinglePage   | 总页数小于 2 时，是否自动隐藏分页器，当 showSizeChanger 为true时，此开关不再生效           | boolean                                            | false               |
| hoverShowPageSelect  | hover 页码时是否展示切换页数的Select控件，仅当 size = 'small'时生效  | boolean             | false               | 1.27.0|
| nextText           | 下一页文本                                                                        | string\|ReactNode                               |                     |
| pageSize           | 每页条数                                                                          | number                                          | 10                  |
| pageSizeOpts       | 指定每页显示多少条                                                                | array                                           | \[10, 20, 40, 100\] |
| popoverPosition    | 浮层方向，具体可见 [Popover·API 参考·position](/zh-CN/show/popover#API参考) | string                                          | "bottomLeft"        |
| popoverZIndex      | 浮层 z-index 值                                                                   | number                                          |  1030                   |
| prevText           | 上一页文本                                                                        | string\|ReactNode                               |                     |
| style              | 样式                                                                              | object                                          |                     |
| size               | 尺寸                                                                              | string                                          |                     |
| showTotal          | 是否显示总页数                                                                    | boolean                                         |                     |
| showSizeChanger    | 是否显示切换页容量的 Select，size为small时不生效                                                       | boolean                                         | false               |
| showQuickJumper    | 是否显示切换页码的 Input                                  | boolean                                         | false               | 1.31.0|
| total              | 总条数                                                                            | number                                          | 1                   |
| onChange           | 页码、每页容量变化时的回调函数                                                    | function(currentPage: number, pageSize: number) |                     |
| onPageChange       | 页码变化的回调函数                                                                | function(currentPage: number)                   |                     |
| onPageSizeChange   | 每页容量变化时的回调函数                                                          | function(pageSize: number)                      |                     |

## Accessibility

### ARIA

- `aria-label`: 描述组件内页码、前一页、后一页等元素的标签
- `aria-current`: 指向当前页的页码元素

## 设计变量
<DesignToken/>

## FAQ

-   **为什么页数下拉选择器最多只有`1,000,000`条？**  
    因为创建列表时, 浏览器对Array.from()创建数组的大小存在[限制](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Errors/Invalid_array_length); 同时为了兼顾Array.from()的开销，我们设定了`1,000,000`这个阈值。