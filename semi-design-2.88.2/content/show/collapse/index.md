---
localeCode: zh-CN
order: 66
category: 展示类
title: Collapse 折叠面板
icon: doc-accordion
brief: 可以展开或折叠展示内容区域。
---

## 代码演示

### 如何引入

```jsx import
import { Collapse } from '@douyinfe/semi-ui';
```

### 基本用法

可以同时展开多个面板，可以通过 `defaultActiveKey` 设置默认展开的面板。

```jsx live=true
import React from 'react';
import { Collapse } from '@douyinfe/semi-ui';

() => (
    <Collapse>
        <Collapse.Panel header="This is panel header 1" itemKey="1">
            <p>Hi, bytedance dance dance. This is the docsite of Semi UI. </p>
        </Collapse.Panel>
        <Collapse.Panel header="This is panel header 2" itemKey="2">
            <p>Hi, bytedance dance dance. This is the docsite of Semi UI. </p>
        </Collapse.Panel>
        <Collapse.Panel header="This is panel header 3" itemKey="3">
            <p>Hi, bytedance dance dance. This is the docsite of Semi UI. </p>
        </Collapse.Panel>
    </Collapse>
);
```

### 手风琴效果

可以通过设置 `accordion` 使每次只允许展开一个面板。

```jsx live=true
import React from 'react';
import { Collapse } from '@douyinfe/semi-ui';

() => (
    <Collapse accordion>
        <Collapse.Panel header="This is panel header 1" itemKey="1">
            <p>Hi, bytedance dance dance. This is the docsite of Semi UI. </p>
        </Collapse.Panel>
        <Collapse.Panel header="This is panel header 2" itemKey="2">
            <p>Hi, bytedance dance dance. This is the docsite of Semi UI. </p>
        </Collapse.Panel>
        <Collapse.Panel header="This is panel header 3" itemKey="3">
            <p>Hi, bytedance dance dance. This is the docsite of Semi UI. </p>
        </Collapse.Panel>
    </Collapse>
);
```

### 禁用面板

可以通过设置 `disabled` 禁用面板。

```jsx live=true
import React from 'react';
import { Collapse } from '@douyinfe/semi-ui';

() => (
    <Collapse accordion>
        <Collapse.Panel header="This is panel header 1" itemKey="1" disabled>
            <p>Hi, bytedance dance dance. This is the docsite of Semi UI. </p>
        </Collapse.Panel>
        <Collapse.Panel header="This is panel header 2" itemKey="2">
            <p>Hi, bytedance dance dance. This is the docsite of Semi UI. </p>
        </Collapse.Panel>
        <Collapse.Panel header="This is panel header 3" itemKey="3">
            <p>Hi, bytedance dance dance. This is the docsite of Semi UI. </p>
        </Collapse.Panel>
    </Collapse>
);
```

### 隐藏面板展开/收起图标

可以通过设置 `showArrow` 隐藏面板展开/收起图标。

```jsx live=true
import React from 'react';
import { Collapse } from '@douyinfe/semi-ui';

() => (
    <Collapse accordion>
        <Collapse.Panel header="This is panel header 1" itemKey="1" showArrow={false}>
            <p>Hi, bytedance dance dance. This is the docsite of Semi UI. </p>
        </Collapse.Panel>
        <Collapse.Panel header="This is panel header 2" itemKey="2">
            <p>Hi, bytedance dance dance. This is the docsite of Semi UI. </p>
        </Collapse.Panel>
        <Collapse.Panel header="This is panel header 3" itemKey="3">
            <p>Hi, bytedance dance dance. This is the docsite of Semi UI. </p>
        </Collapse.Panel>
    </Collapse>
);
```

### 自定义展开图标

可以通过 `expandIcon` 设置展开图标，`collapseIcon` 设置折叠图标。

```jsx live=true
import React from 'react';
import { Collapse } from '@douyinfe/semi-ui';
import { IconPlus, IconMinus } from '@douyinfe/semi-icons';

() => (
    <Collapse expandIcon={<IconPlus />} collapseIcon={<IconMinus />}>
        <Collapse.Panel header="This is panel header 1" itemKey="1">
            <p>Hi, bytedance dance dance. This is the docsite of Semi UI. </p>
        </Collapse.Panel>
        <Collapse.Panel header="This is panel header 2" itemKey="2">
            <p>Hi, bytedance dance dance. This is the docsite of Semi UI. </p>
        </Collapse.Panel>
        <Collapse.Panel header="This is panel header 3" itemKey="3">
            <p>Hi, bytedance dance dance. This is the docsite of Semi UI. </p>
        </Collapse.Panel>
    </Collapse>
);
```

### 自定义右上角辅助区域内容

通过 `extra` 设置右上角辅助区域内容。

**仅在 header 为 string 时生效， 如果 header 为 ReactNode 会包含 extra 所在的区域，可以自行渲染**

```jsx live=true
import React from 'react';
import { Collapse, Tag } from '@douyinfe/semi-ui';
import { IconCopy } from '@douyinfe/semi-icons';

() => (
    <Collapse>
        <Collapse.Panel header="This is panel header 1" itemKey="1" extra="1234">
            <p>Hi, bytedance dance dance. This is the docsite of Semi UI. </p>
        </Collapse.Panel>
        <Collapse.Panel header="This is panel header 2" itemKey="2" extra={<IconCopy />}>
            <p>Hi, bytedance dance dance. This is the docsite of Semi UI. </p>
        </Collapse.Panel>
        <Collapse.Panel
            header="This is panel header 3"
            itemKey="3"
            extra={
                <Tag color="violet" style={{ margin: 0 }}>
                    {' '}
                    Recommended{' '}
                </Tag>
            }
        >
            <p>Hi, bytedance dance dance. This is the docsite of Semi UI. </p>
        </Collapse.Panel>
    </Collapse>
);
```

## API 参考

### Collapse

| 属性 | 说明 | 类型 | 默认值 | 版本     |
| --- | --- | --- | --- |--------|
| accordion | 手风琴模式 | boolean | `false` | -      |
| activeKey | 受控属性, 当前展开的面板的 key | string \| string[] | 无 | -      |
| className | 样式类名 | string | '' | -      |
| clickHeaderToExpand | 点击 Header 展开收起，否则只响应点击箭头 | boolean | true | 2.32.0 |
| collapseIcon | 自定义折叠图标 | ReactNode | `<IconChevronDown />` | -      |
| defaultActiveKey | 初始化选中面板的 key | string \| string[] | 无 | -      |
| expandIcon | 自定义展开图标 | ReactNode | `<IconChevronUp />` | -      |
| expandIconPosition | 展开图标位置 | `left`, `right` | `right` | 1.12.0 |
| keepDOM | 是否保留隐藏的面板 DOM 树，默认销毁 | bool | `false` | 0.25.0 |
| motion | 是否开启动画 | boolean | `true` | 1.4.0  |
| lazyRender | 配合 keepDOM 使用，为 true 时挂载时不会渲染组件 | boolean | `false` | 2.54.1 |
| style | 内联 CSS 样式 | CSSProperties | {} | -      |
| onChange | 切换面板的回调 | function(activeKey: string \| string[], e: event) | 无 | -      |

### Collapse.Panel

| 属性      | 说明                                                                  | 类型                   | 默认值 | 版本            |
| --------- | --------------------------------------------------------------------- | ---------------------- | ------ |---------------|
| className | 样式类名                                                              | string                 |   无     |               |
| disabled  | 面板是否被禁用                                                         | boolean                 |  false  | v2.17.0       |
| extra     | 自定义渲染每个面板右上角的辅助内容（仅当 header 为 string 时生效）    | ReactNode              | 无     |               |
| header    | 面板头内容                                                            | ReactNode      | 无     |               |
| itemKey   | 必填且唯一，选中状态匹配 `activeKey`，`defaultActiveKey`              | string                 | 无     |               |
| onMotionEnd | 动画结束的回调 | () => void | - | 2.47.0-beta.0 |
| reCalcKey | 当 reCalcKey 改变时，将重新计算子节点的高度，用于优化动态渲染时的计算 | string \| number |无| 1.5.0         |
| showArrow | 是否展示箭头                                                          | boolean                 |  true  | v2.17.0       |
| style     | 内联 CSS 样式                                                         | CSSProperties                 |  无  |               |

## Accessibility

### ARIA

- 面板 header 右侧按钮 设置了 `aria-hidden=true`
- 面板 header 可交互部分 设置了 `aria-owns` 值为对应面板内容
- 面板内容 设置了 `aria-hidden` 随面板内容展现隐藏其值在 true 和 false 之间自动切换
- 面板 `aria-disabled` 与 `disabled` 属性同步，表示面板禁用

## 文案规范
折叠面板本质是卡片容器增加了收起和展开的功能，所以折叠面板的文案规范需要和 [卡片文案规范](/zh-CN/show/card#%E6%96%87%E6%A1%88%E8%A7%84%E8%8C%83) 保持一致

## 设计变量

<DesignToken/>

## FAQ

-   ##### Collapse 内嵌表单收起后表单数据会清空 ?

    Collapse 收起之后，默认会销毁相应的 DOM 。所以相应的 field 被卸载了，数据也被清空。可以通过给 collapse 增加 `keepDOM=true`，保留对应的 DOM 节点。

-   ##### Collapse 中 Typography 截断逻辑失效 ?

    如果开启了 `keepDOM` 会导致面板样式 `display: none`，此时会影响截断长度的计算。

-   ##### Collapse.Header 整体作为折叠、展开的点击热区， 如果在 Header 中放置了自定义元素（例如 Input），点击时候会导致 Collapse 收起/展开。如何避免？
    可以在自定义元素的 onClick 事件回调中，阻止事件冒泡至 Collapse.Header 即可。若自定义元素未提供 event 对象，再包裹一层 div，于 div onClick 中阻止冒泡亦可。

```jsx
import React from 'react';
import { Collapse, Input } from '@douyinfe/semi-ui';

() => (
    <Collapse>
        <Collapse.Panel
            header={
                <div style={{ display: 'inline-flex' }} onClick={e => e.stopPropagation()}>
                    <span>Panel header</span>
                    <Input />
                </div>
            }
            itemKey="1"
        >
            <p>Hi, bytedance dance dance. This is the docsite of Semi UI. </p>
        </Collapse.Panel>
    </Collapse>
);
```
