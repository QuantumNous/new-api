---
localeCode: zh-CN
order: 67
category: 展示类
title: Collapsible 折叠
icon: doc-collapsible
brief: 行为组件，是一个用于展开或折叠内容的容器。
---

## 使用场景

-   `Collapsible` 是一个行为组件，默认开启动画效果。它被用于 Semi 的各种组件中，如：`Navigation`， `Collapse`, `Tree`， `TreeSelect`，以及 `Typography` 中。
-   当上述组件不能满足需求或者需要自定义一些折叠行为时，可以使用 `Collapsible` 来包裹需要展开或者折叠的内容。

## 代码演示

### 如何引入

```jsx import
import { Collapsible } from '@douyinfe/semi-ui';
```

### 基本用法

通过 `isOpen` 来控制内容的展开或者折叠。

```jsx live=true hideInDSM
import React, { useState } from 'react';
import { Collapsible, Button } from '@douyinfe/semi-ui';

() => {
    const [isOpen, setOpen] = useState();
    const toggle = () => {
        setOpen(!isOpen);
    };
    const collapsed = (
        <ul>
            <li>
                <p>Semi Design 以内容优先进行设计。</p>
            </li>
            <li>
                <p>更容易地自定义主题。</p>
            </li>
            <li>
                <p>适用国际化场景。</p>
            </li>
            <li>
                <p>效率场景加入人性化关怀。</p>
            </li>
        </ul>
    );
    return (
        <div>
            <Button onClick={toggle}>Toggle</Button>
            <Collapsible isOpen={isOpen}>{collapsed}</Collapsible>
        </div>
    );
};
```

### 自定义动画时间

通过 `duration` 设置动画展开或者折叠的时间，也可以通过 `motion` 来关闭动画。

```jsx live=true hideInDSM
import React, { useState } from 'react';
import { Collapsible, InputNumber, Button } from '@douyinfe/semi-ui';

() => {
    const [isOpen, setOpen] = useState(false);
    const [duration, setDuration] = useState(250);
    const toggle = () => {
        setOpen(!isOpen);
    };
    const collapsed = (
        <ul>
            <li>
                <p>Semi Design 以内容优先进行设计。</p>
            </li>
            <li>
                <p>更容易地自定义主题。</p>
            </li>
            <li>
                <p>适用国际化场景。</p>
            </li>
            <li>
                <p>效率场景加入人性化关怀。</p>
            </li>
        </ul>
    );
    return (
        <div>
            <label>设置动画时间：</label>
            <InputNumber min={0} defaultValue={250} style={{ width: 120 }} onChange={(val) => setDuration(val)} step={10} />
            <br />
            <Button onClick={toggle}>Toggle</Button>
            <Collapsible isOpen={isOpen} duration={duration}>
                {collapsed}
            </Collapsible>
        </div>
    );
};
```

### 嵌套使用

```jsx live=true hideInDSM
import React from 'react';
import { Collapsible, Button } from '@douyinfe/semi-ui';

() => {
    const [isOpen, setOpen] = useState(false);
    const [isChildOpen, setChildOpen] = useState(false);

    const collapsed = (
        <ul>
            <li>
                <p>Semi Design 以内容优先进行设计。</p>
            </li>
            <li>
                <p>更容易地自定义主题。</p>
            </li>
            <li>
                <p>适用国际化场景。</p>
            </li>
            <li>
                <p>效率场景加入人性化关怀。</p>
            </li>
        </ul>
    );
    return (
        <div>
            <Button onClick={() => setOpen(!isOpen)}>Toggle</Button>
            <br />
            <Collapsible isOpen={isOpen}>
                <div>
                    <span>Semi Design的设计原则包括：</span>
                    <Button onClick={() => setChildOpen(!isChildOpen)}>Toggle List</Button>
                </div>
                <Collapsible isOpen={isChildOpen}>{collapsed}</Collapsible>
            </Collapsible>
        </div>
    );
};
```

### 自定义折叠高度

可以使用 collapseHeight 自定义收起的高度，需要版本 **v>=1.0.0**

```jsx live=true hideInDSM
import React, { useState } from 'react';
import { Collapsible, Button } from '@douyinfe/semi-ui';

() => {
    const [isOpen, setOpen] = useState(false);
    const maskStyle = isOpen
        ? {}
        : {
            WebkitMaskImage:
                    'linear-gradient(to bottom, black 0%, rgba(0, 0, 0, 1) 60%, rgba(0, 0, 0, 0.2) 80%, transparent 100%)',
        };
    const collapsed = (
        <ul>
            <li>
                <p>Semi Design 以内容优先进行设计。</p>
            </li>
            <li>
                <p>更容易地自定义主题。</p>
            </li>
            <li>
                <p>适用国际化场景。</p>
            </li>
            <li>
                <p>效率场景加入人性化关怀。</p>
            </li>
        </ul>
    );
    const toggle = () => {
        setOpen(!isOpen);
    };
    const linkStyle = {
        position: 'absolute',
        left: 0,
        right: 0,
        textAlign: 'center',
        bottom: -10,
        fontWeight: 700,
        cursor: 'pointer',
    };
    return (
        <>
            <Button onClick={toggle}>Toggle</Button>
            <div style={{ position: 'relative' }}>
                <Collapsible isOpen={isOpen} collapseHeight={60} style={{ ...maskStyle }}>
                    {collapsed}
                </Collapsible>
                {isOpen ? null : (
                    <a onClick={toggle} style={{ ...linkStyle }}>
                        + Show More
                    </a>
                )}
            </div>
        </>
    );
};
```

## API 参考

| 属性 | 说明 | 类型 | 默认值     | 版本     |
| -- | --- | --- |---------|--------|
| className | 类名 | string | -       | 0.34.0 |
| collapseHeight | 折叠高度 | number | 0       | 1.0.0  |
| duration | 动画执行的时间 | number | 250     | -      |
| fade | 是否开启淡入淡出 | boolean | false   | 2.21.0 |
| isOpen | 是否展开内容区域 | boolean | `false` | -      |
| keepDOM | 是否保留隐藏的面板 DOM 树，默认销毁 | boolean | `false` | 0.25.0 |
| lazyRender | 配合 keepDOM 使用，为 true 时挂载时不会渲染组件 | boolean | `false` | 2.54.0   |
| motion | 是否开启动画 | boolean | `true`  | -      |
| onMotionEnd | 动画结束的回调 | () => void | -       | -      |
| reCalcKey | 当 reCalcKey 改变时，将重新计算子节点的高度，用于优化动态渲染时的计算 | number \| string | -       | 1.5.0  |
| style | 样式 | CSSProperties | -       | 0.34.0 |
| id | id | html id string type | -       | 2.3.0  |
## Accessibility

### ARIA

-   Collapsible 具有 `id` props，传入的值会被设置为 wrapper 元素的id, 可以配合其他组件的 `aria-controls` 指明控制关系, 见下方使用示例。

```jsx
import Collapsible from './index';


()=>{
    const collapseId = 'myCollapsible';
    const [visible, setVisible]=useState(false);
    return <>
        <Button onClick={()=>setVisible(!visible)} aria-controls={`${collapseId}`}>{visible?'hide':'show'}</Button>    
        <Collapsible isOpen={visible} id={collapseId}>
            <div>hide content</div>
        </Collapsible>
    </>;
};

```

## FAQ

-   为什么使用 Collapsible 没有正常展开?  
     检查 Collapsible 父级是否设置 display:none，此时因为无法拿到节点高度，会出现无法展开的问题。如果没有设置，可以联系 Semi 客服看是否存在其他问题。
