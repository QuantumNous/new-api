---
localeCode: zh-CN
order: 76
category: 展示类
title: OverflowList 折叠列表
icon: doc-overflowList
brief: OverflowList 是一个行为组件，用于展示列表，并支持自适应来展示尽可能多的项目。因过长而溢出项目将折叠为一个元素。当检测到调整大小时，可见项将被重新计算。
---

## 代码演示

### 如何引入

```jsx import
import { OverflowList } from '@douyinfe/semi-ui';
```

### 折叠模式 - 默认

通过 `renderMode="collapse"` (默认) 来实现内容的折叠。

```jsx live=true
import React from 'react';
import { OverflowList, Tag, Slider } from '@douyinfe/semi-ui';
import { IconAlarm, IconBookmark, IconCamera, IconDuration, IconEdit, IconFolder } from '@douyinfe/semi-icons';

() => {
    const [width, setWidth] = useState(100);
    const renderOverflow = items => {
        return items.length ? <Tag style={{ flex: '0 0 auto', fontVariantNumeric: 'tabular-nums' }}>+{items.length}</Tag> : null;
    };
    const renderItem = (item, ind) => {
        return (
            <Tag color="blue" key={item.key} style={{ marginRight: 8, flex: '0 0 auto' }}>
                {item.icon}
                {item.key}
            </Tag>
        );
    };

    const items = [
        { icon: <IconAlarm style={{ marginRight: 4 }} />, key: 'alarm' },
        { icon: <IconBookmark style={{ marginRight: 4 }} />, key: 'bookmark' },
        { icon: <IconCamera style={{ marginRight: 4 }} />, key: 'camera' },
        { icon: <IconDuration style={{ marginRight: 4 }} />, key: 'duration' },
        { icon: <IconEdit style={{ marginRight: 4 }} />, key: 'edit' },
        { icon: <IconFolder style={{ marginRight: 4 }} />, key: 'folder' },
    ];

    return (
        <div>
            <Slider step={1} value={width} onChange={value => setWidth(value)} />
            <br />
            <br />
            <div style={{ width: `${width}%` }}>
                <OverflowList items={items} overflowRenderer={renderOverflow} visibleItemRenderer={renderItem} />
            </div>
        </div>
    );
};
```

### 折叠模式 - 方向

`collapse` 模式下支持 collapseFrom 设置折叠方向。

```jsx live=true
import React from 'react';
import { OverflowList, Tag, Slider } from '@douyinfe/semi-ui';
import { IconAlarm, IconBookmark, IconCamera, IconDuration, IconEdit, IconFolder } from '@douyinfe/semi-icons';

() => {
    const [width, setWidth] = useState(100);
    const renderOverflow = items => {
        return items.length ? <Tag style={{ marginRight: 8, flex: '0 0 auto', fontVariantNumeric: 'tabular-nums' }}>+{items.length}</Tag> : null;
    };
    const renderItem = (item, ind) => {
        return (
            <Tag color="blue" key={item.key} style={{ marginRight: 8, flex: '0 0 auto' }}>
                {item.icon}
                {item.key}
            </Tag>
        );
    };

    const items = [
        { icon: <IconAlarm style={{ marginRight: 4 }} />, key: 'alarm' },
        { icon: <IconBookmark style={{ marginRight: 4 }} />, key: 'bookmark' },
        { icon: <IconCamera style={{ marginRight: 4 }} />, key: 'camera' },
        { icon: <IconDuration style={{ marginRight: 4 }} />, key: 'duration' },
        { icon: <IconEdit style={{ marginRight: 4 }} />, key: 'edit' },
        { icon: <IconFolder style={{ marginRight: 4 }} />, key: 'folder' },
    ];

    return (
        <div>
            <Slider step={1} value={width} onChange={value => setWidth(value)} />
            <br />
            <br />
            <div style={{ width: `${width}%` }}>
                <OverflowList
                    items={items}
                    collapseFrom="start"
                    overflowRenderer={renderOverflow}
                    visibleItemRenderer={renderItem}
                />
            </div>
        </div>
    );
};
```

### 折叠模式 - 最小展示的数目

`collapse` 模式下支持 minVisibleItems 设置最小展示的数目。

```jsx live=true
import React from 'react';
import { OverflowList, Tag, Slider } from '@douyinfe/semi-ui';
import { IconAlarm, IconBookmark, IconCamera, IconDuration, IconEdit, IconFolder } from '@douyinfe/semi-icons';

() => {
    const [width, setWidth] = useState(100);
    const renderOverflow = items => {
        return items.length ? <Tag style={{ flex: '0 0 auto', fontVariantNumeric: 'tabular-nums' }}>+{items.length}</Tag> : null;
    };
    const renderItem = (item, ind) => {
        return (
            <Tag color="blue" key={item.key} style={{ marginRight: 8, flex: '0 0 auto' }}>
                {item.icon}
                {item.key}
            </Tag>
        );
    };

    const items = [
        { icon: <IconAlarm style={{ marginRight: 4 }} />, key: 'alarm' },
        { icon: <IconBookmark style={{ marginRight: 4 }} />, key: 'bookmark' },
        { icon: <IconCamera style={{ marginRight: 4 }} />, key: 'camera' },
        { icon: <IconDuration style={{ marginRight: 4 }} />, key: 'duration' },
        { icon: <IconEdit style={{ marginRight: 4 }} />, key: 'edit' },
        { icon: <IconFolder style={{ marginRight: 4 }} />, key: 'folder' },
    ];

    return (
        <div>
            <Slider step={1} value={width} onChange={value => setWidth(value)} />
            <br />
            <br />
            <div style={{ width: `${width}%` }}>
                <OverflowList
                    items={items}
                    minVisibleItems={3}
                    overflowRenderer={renderOverflow}
                    visibleItemRenderer={renderItem}
                />
            </div>
        </div>
    );
};
```

### 滚动模式

通过 `renderMode="scroll"` 来使用滚动模式的折叠列表。如果需要 scrollIntoView，可以通过选择器： `` document.querySelector(`.item-cls[data-scrollkey="${key}"] `` 来选取。

```jsx live=true
import React from 'react';
import { OverflowList, Tag, Slider } from '@douyinfe/semi-ui';
import { IconAlarm, IconBookmark, IconCamera, IconDuration, IconEdit, IconFolder } from '@douyinfe/semi-icons';

() => {
    const [width, setWidth] = useState(100);
    const renderOverflow = items => {
        return items.map(item => <Tag style={{ marginRight: 8, marginLeft: 8, flex: '0 0 auto', fontVariantNumeric: 'tabular-nums' }} key={item.key}>+{item.length}</Tag>);
    };
    const renderItem = (item, ind) => {
        return (
            <span key={item.key} className="item-cls">
                <Tag color="blue" style={{ marginRight: 8, flex: '0 0 auto' }}>
                    {item.icon}
                    {item.key}
                </Tag>
            </span>
        );
    };

    const items = [
        { icon: <IconAlarm style={{ marginRight: 4 }} />, key: 'alarm' },
        { icon: <IconBookmark style={{ marginRight: 4 }} />, key: 'bookmark' },
        { icon: <IconCamera style={{ marginRight: 4 }} />, key: 'camera' },
        { icon: <IconDuration style={{ marginRight: 4 }} />, key: 'duration' },
        { icon: <IconEdit style={{ marginRight: 4 }} />, key: 'edit' },
        { icon: <IconFolder style={{ marginRight: 4 }} />, key: 'folder' },
    ];

    return (
        <div>
            <Slider step={1} value={width} onChange={value => setWidth(value)} />
            <br />
            <br />
            <div style={{ width: `${width}%` }}>
                <OverflowList
                    items={items}
                    renderMode="scroll"
                    overflowRenderer={renderOverflow}
                    visibleItemRenderer={renderItem}
                />
            </div>
        </div>
    );
};
```

## API 参考

| 属性       | 说明     | 类型                                              | 默认值        | 版本     |
| ---------- | -------- |-------------------------------------------------|------------|--------|
| className  | 类名     | string                                          | -          | 1.1.0  |
| renderMode | 渲染模式 | `collapse`\| `scroll`                           | `collapse` | 1.1.0  |
| style      | OverflowList的样式 | React.CSSProperties                             | -          | 1.1.0  |

### renderMode='collapse'

| 属性                | 说明                   | 类型                                           | 默认值 | 版本  |
| ------------------- | ---------------------- | ---------------------------------------------- | ------ | ----- |
| collapseFrom        | 折叠方向               | `start`\| `end`                                | `end`  | 1.1.0 |
| items               | 渲染项目               | Record<string, any>[]                                          | -      | 1.1.0 |
| minVisibleItems     | 最小展示的可见项数目   | number                                         | 0      | 1.1.0 |
| onOverflow          | 溢出回调               | (overflowItems: Record<string, any>[]) => void                 | -      | 1.1.0 |
| overflowRenderer    | 溢出项的自定义渲染函数 | (overflowItems: Record<string, any>[]) => React.ReactNode      | -      | 1.1.0 |
| visibleItemRenderer | 展示项的自定义渲染函数 | (item: Record<string, any>, index: number) => React.ReactElement | -      | 1.1.0 |

### renderMode='scroll'

| 属性 | 说明 | 类型                                                                                                                                 | 默认值 | 版本 |
| --- | --- |------------------------------------------------------------------------------------------------------------------------------------| --- | --- |
| items | 渲染项目，**要求必含 key 项** | Record<string, any>[]                                                                                                              | - | 1.1.0 |
| onIntersect | 溢出回调 | ({[key: string]: [IntersectionObserverEntry](https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserverEntry)}) => void | - | 1.1.0 |
| onVisibleStateChange | 隐藏显示状态变化回调 | (visibleState: Map\<string, boolean\>) => void; | -          | 2.61.0 |
| overflowRenderer | 溢出项的自定义渲染函数 | (overflowItems: Record<string, any>[]) => React.ReactNode[]                                                                        | - | 1.1.0 |
| threshold | 触发溢出回调的阈值 | number                                                                                                                             | 0.75 | 1.1.0 |
| visibleItemRenderer | 展示项的自定义渲染函数 | (item: Record<string, any>, index: number) => React.ReactElement                                                                   | - | 1.1.0 |
| wrapperClassName | 滚动 wrapper 的类名 | string                                                                                                                             | - | 1.1.0 |
| wrapperStyle | 滚动 wrapper 的样式 | React.CSSProperties | - | 1.1.0 |

