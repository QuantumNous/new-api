---
localeCode: en-US
order: 92
category: Feedback
title: Spin
subTitle: Spin
icon: doc-spin
brief: Spin is used to inform the user that the content is loading and may take an uncertain period of time.
---

## Demos

### How to import

```jsx
import { Spin } from '@douyinfe/semi-ui';
```

### Basic usage

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

### Size

Supports three sizes: `large`, `medium` (default), and `small`.

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

### With Description

Use `tip` to set the description texts when Spin is used as a wrapping element

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

### Customized Indicator

Use `indicator` property to customize Spin's indicator style.

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

### Delay

Delayed to display Spin.

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
                Delayed spin
            </Button>
            <Spin delay={1000} spinning={loading}></Spin>
        </div>
    );
};
```

### Controlled

Use `spinning` to determine if the component is in loading status

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
                Controlled Spin
            </Button>
            <Spin spinning={loading}></Spin>
        </div>
    );
};
```

## API Reference

| Properties       | Instructions                                              | type       | Default  |
| ---------------- | --------------------------------------------------------- | ---------- | -------- |
| childStyle       | Inline style for children element **v>=1.0.0**            | CSSProperties     | -        |
| delay            | Delay timing to display Spin                              | number(ms) | 0        |
| indicator        | Indicators                                                | ReactNode  | -        |
| size             | Size, one of `small`, `middle`, `large`                   | string     | `middle` |
| spinning         | Toggle whether it is in loading                           | boolean    | true     |
| style            | Inline style                                              | CSSProperties     | -        |
| tip              | Description texts when Spin is used as a wrapping element | ReactNode     | -        |
| wrapperClassName | Class name of wrapping element                            | string     | -        |

## Design Tokens

<DesignToken/>

## Content Guidelines
- Precisely state the loading status, using words such as "Loading", "Submitting", "Processing", etc.
- Use as few words as possible to describe the state

## FAQ

-   **How to modify the color of the spin icon? **

    You can override the original color by adding the color property to the .semi-spin-wrapper class (it is recommended to override with a higher weight).

    ```
    .custom .semi-spin-wrapper {
      color: red;
    }
    ```
