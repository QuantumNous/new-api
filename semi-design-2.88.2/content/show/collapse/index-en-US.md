---
localeCode: en-US
order: 66
category: Show
title: Collapse
subTitle: Collapse
icon: doc-accordion
brief: Display content areas can be expanded or folded.
---

## Demos

### How to import

```jsx import
import { Collapse } from '@douyinfe/semi-ui';
```

### Basic Usage

You can expand multiple panels at the same time, and use `defaultActiveKey` to set the panel to expand by default.

```jsx live=true
import React from 'react';
import { Collapse } from '@douyinfe/semi-ui';

() => (
    <Collapse>
        <Collapse.Panel header="This is panel header 1" ItemKey="1">
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

### Accordion

Use `accordion` to restrict one panel only to be expanded at one time.

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

### Disable Panel

Use `disabled` to disabled panel.

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

### Hide The Panel Icon

Use `showArrow` to hide the panel icon.

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

### Custom Icon

You can use `expandIcon` to set the expanding icon and `collapseIcon` for folded icon.

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

### Custom Extra Content on the Right-upper Corner

You can use `extra` to set extra content on the right-upper corner.

**Only works when `header` is string. If `header` is a ReactNode, it will take the entire header part including extra so that you could render whatever you need.**

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

## API reference

### Collapse

| Properties | Instructions | type | Default | version |
| --- | --- | --- | --- |---------|
| accordion | Accordion mode | boolean | `false` | -       |
| activeKey | Controlled property, key of the currently expanded panel | string \| string[] | - | -       |
| className | className of Collapse | string | '' | -       |
| clickHeaderToExpand | Click Header to expand and collapse, otherwise only respond to click arrow | boolean | true | 2.32.0  |
| collapseIcon | Custom collapsing icons | ReactNode | `<IconChevronDown />` | -       |
| defaultActiveKey | Key of the expanded panel when initialized | string \| string[] | - | -       |
| expandIcon | Custom expanding icon | ReactNode | `<IconChevronUp />` | -       |
| keepDOM | Whether to keep the hidden panel in DOM tree, destroyed by default | boolean | `false` | 0.25.0  |
| motion | Toggle whether to have animation | boolean | `true` | 1.4.0   |
| expandIconPosition | Expand icon position | `left`, `right` | `right` | 1.12.0  |
| lazyRender | Used with keepDOM, when true, the component will not be rendered when mounting                                         | boolean | `false` | 2.54.1  |
| style | Inline CSS style | CSSProperties | {} | -       |
| onChange | Callback function when switching panel | function(activeKey: string \| string[], e: event) | - | -       |

### Collapse.Panel
| Properties | Instructions                                                                                                            | type | Default | version       |
| --- |-------------------------------------------------------------------------------------------------------------------------| --- | --- |---------------|
| className | className of Panel                                                                                                      | string | - |               |
| disabled  | If true, the panel is disabled                                                                                          | boolean     |  false  | v2.17.0       |
| extra | Custom rendering of the auxiliary content in the upper right-hand corner of each panel(only work when header is string) | ReactNode | - |               |
| header | Panel head content                                                                                                      | ReactNode | - | -             ||
| itemKey | Required and must be unique, used to match `activeKey`, `defaultActiveKey`                                              | string | - |               |
| onMotionEnd | Animation end callback                                                                                                  | () => void | - | 2.47.0-beta.0 |
| reCalcKey | When reCalcKey changes, the height of children will be reset. Used for optimize dynamic content rendering.              | string \| number |-| 1.5.0         |
| showArrow | whether to show arrows icon                                                                                             | boolean                 |  true  | v2.17.0       |
| style | inline CSS style                                                                                                        | CSSProperties | - |               |


## Accessibility

### ARIA

- The button on the right side of the panel header is set to `aria-hidden=true`
- The interactive part of the panel header is set to the `aria-owns` value corresponding to the panel content
- The content of the panel is set with `aria-hidden`, and its value is automatically switched between true and false with the display of the panel content
- The panel `aria-disabled` is synchronized with the `disabled` property, indicating that the panel is disabled

## Content Guidelines

The essence of the folding panel is that the card container adds the function of folding and unfolding, so the copywriting specification of the folding panel needs to be the same as the [Card copywriting specification](/zh-CN/show/card#%E6%96%87%E6%A1%88%E8%A7%84%E8%8C%83)

## Design Tokens

<DesignToken/>

## FAQ

-   ##### Why is the data in Form cleared when using Collapse?

    When Collapse is collapsed, the related DOM is destroyed and so are the fields data stored in Form. You could set `keepDOM=true` to keep the DOM from being destroyed.

-   ##### Collapse.Header as a whole is used as a click hot zone for folding and expanding. If a custom element (such as Input) is placed in the Header, it will cause Collapse to collapse/expand when clicked. How to avoid it?
    You can prevent the event from bubbling to Collapse.Header in the onClick event callback of the custom element. If the custom element does not provide an event object, wrap a layer of div to prevent bubbling in the div onClick.

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
