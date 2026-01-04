---
localeCode: en-US
order: 76
category: Show
title: OverflowList
subTitle: OverflowList
icon: doc-overflowList
brief: OverflowList is a behavior component used to take list of items and display as many items as can fit inside itself. Overflowed items that do not fit are collected and rendered by callback function. The visible items will be recomputed when a resize is detected.
---
## Demos

### How to import

```jsx import
import { OverflowList } from '@douyinfe/semi-ui';
```

### Collapse Mode - Simple

You could use `renderMode="collapse"` (default) to render items.

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

### Collapse Mode - Direction

`collapse` mode supports two `collapseFrom` directions: `start` and `end` (default).

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

### Collapse Mode - Visible

`collapse` mode supports to set up minimum visible items that will not be collected.

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

### Scroll Mode

You could use `renderMode="scroll"` for a scrollable list.  
If you need certain element in the list to scrollIntoView, use `` document.querySelector(`.item-cls[data-scrollkey="${key}"] `` to select to corresponding DOM.

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

## API Reference

| Properties | Instructions                           | type                  | Default | version |
| ---------- |----------------------------------------| --------------------- | ------- | ------- |
| className  | Class name.                            | string                | -       | 1.1.0   |
| onVisibleStateChange | Hide and display state change callback | (visibleState: Map\<string, boolean\>) => void; | -          | 2.61.0 |
| renderMode | Render mode.                           | `collapse`\| `scroll` | `true`  | -       |
| style      | OverflowList style                     | React.CSSProperties   | -       | 1.1.0   |

### renderMode='collapse'

| Properties | Instructions | type | Default | version |
| --- | --- | --- | --- | --- |
| collapseFrom | Which direction the items should collapse from: start or end of the children. | `start`\| `end` | `end` | 1.1.0 |
| items | All items to display in the list. | Record<string, any>[] | `true` | - |
| minVisibleItems | The minimum number of visible items that should never collapse into the overflow menu. | number | 0 | 1.1.0 |
| onOverflow | Callback invoked when the overflowed items change. | (overflowItems: Record<string, any>[]) => void | - | 1.1.0 |
| overflowRenderer | Callback invoked to render the overflowed items. | (overflowItems: Record<string, any>[]) => React.ReactNode | - | 1.1.0 |
| visibleItemRenderer | Callback invoked to render each visible item. | (item: Record<string, any>, index: number) => React.ReactElement | - | 1.1.0 |

### renderMode='scroll'

| Properties | Instructions | type | Default | version |
| --- | --- | --- | --- | --- |
| items | All items to display in the list. **Key is required.** | Record<string, any>[] | `true` | - |
| onIntersect | Callback invoked when the overflowed items change. | ({[key: string]: [IntersectionObserverEntry](https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserverEntry)}) => void | - | 1.1.0 |
| overflowRenderer | Callback invoked to render the overflowed items. | (overflowItems: Record<string, any>[]) => React.ReactNode[] | - | 1.1.0 |
| threshold | At what percentage of the target's visibility the observer's callback should be executed. | number | 0.75 | 1.1.0 |
| visibleItemRenderer | allback invoked to render each visible item. | (item: Record<string, any>, index: number) => React.ReactElement | - | 1.1.0 |
| wrapperClassName | Scroll wrapper classname. | string | - | 1.1.0 |
| wrapperStyle | Scroll wrapper style. | React.CSSProperties | - | 1.1.0 |
