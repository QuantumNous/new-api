---
localeCode: en-US
order: 67
category: Show
title: Collapsible
subTitle: Collapsible
icon: doc-collapsible
brief: The collapsible component is a container component used to put long sections of information under a block that can be expanded or collapsed.
---

## When to use

-   `Collapsible`is a behavior component with animation effect by default. It is used in various components in Semi Components, including: `Navigation`, `Collapse`, `Tree`, `TreeSelect`, and `Typography`.
-   When the above components do not meet requirements or customized collapsed behavior, you can use `Collapsible` to put in contents that need to be expanded or folded.

## Demos

### How to import

```jsx import 
import { Collapsible } from '@douyinfe/semi-ui';
```

### Basic Usage

Use `isOpen` to control the expansion or folding of the content.

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
            <li>Nothing can ever happen twice.</li>
            <li>In consequence, the sorry fact is</li>
            <li>that we arrive here improvised</li>
            <li>and leave without the chance to practice. </li>
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

### Custom Animation Duration

You can use `duration` to set animation duration or turn off animation by setting `motion={false}`.

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
            <li>Nothing can ever happen twice.</li>
            <li>In consequence, the sorry fact is</li>
            <li>that we arrive here improvised</li>
            <li>and leave without the chance to practice. </li>
        </ul>
    );
    return (
        <div>
            <label>Set animation duration：</label>
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

### Nested use

```jsx live=true hideInDSM
import React from 'react';
import { Collapsible, Button } from '@douyinfe/semi-ui';

() => {
    const [isOpen, setOpen] = useState(false);
    const [isChildOpen, setChildOpen] = useState(false);

    const collapsed = (
        <ul>
            <li>Nothing can ever happen twice.</li>
            <li>In consequence, the sorry fact is</li>
            <li>that we arrive here improvised</li>
            <li>and leave without the chance to practice. </li>
        </ul>
    );
    return (
        <div>
            <Button onClick={() => setOpen(!isOpen)}>Toggle</Button>
            <br />
            <Collapsible isOpen={isOpen}>
                <div>
                    <span>Conntent of first level</span>
                    <Button onClick={() => setChildOpen(!isChildOpen)}>Toggle List</Button>
                </div>
                <Collapsible isOpen={isChildOpen}>{collapsed}</Collapsible>
            </Collapsible>
        </div>
    );
};
```

### Custom CollapseHeight

You could use `collapseHeight` to customize collapsed height. **v>=1.0.0**

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
            <li>Nothing can ever happen twice.</li>
            <li>In consequence, the sorry fact is</li>
            <li>that we arrive here improvised</li>
            <li>and leave without the chance to practice. </li>
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

## API reference

| Properties | Instructions                                                                                               | type | Default | version |
| --- |------------------------------------------------------------------------------------------------------------| --- |---------|---------|
| className | Class name                                                                                                 | string | -       | 0.34.0  |
| collapseHeight | Collapse height                                                                                            | number | 0       | 1.0.0   |
| duration | Time of animation execution                                                                                | number | 250     | -       |
| isOpen | Toggle whether to expand the content area                                                                  | boolean | `false` | -       |
| keepDOM | Whether to keep the hidden panel in DOM tree, destroyed by default                                         | boolean | `false` | 0.25.0  |
| lazyRender | Used with keepDOM, when true, the component will not be rendered when mounting                                         | boolean | `false` | 2.54    |
| motion | Toggle whether to turn on animation                                                                        | Motion | `true`  | -       |
| onMotionEnd | Animation end callback                                                                                     | () => void | -       | -       |
| reCalcKey | When reCalcKey changes, the height of children will be reset. Used for optimize dynamic content rendering. | number \| string | -       | 1.5.0   |
| style | Style object                                                                                               | CSSProperties | -       | 0.34.0  |
| aria-controls | [aria-controls](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-controls)  | string | -       | 2.3.0   |

## Accessibility

### ARIA

- Collapsible has `id` props, the value passed in will be set as the id of the wrapper element, which can be used with other components' `aria-controls` to indicate the control relationship, see the usage example below.

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

-   Why Collapsible does not expand as expected?  
     Check if the display of parent item of `Collapsible` once was set to `none`. In this case, `Collapsible` could not get height of node properly. If this is not the issue, contact Semi developers to see if other issues exist.
