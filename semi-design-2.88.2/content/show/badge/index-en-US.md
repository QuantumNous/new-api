---
localeCode: en-US
order: 62
category: Show
title:  Badge
subTitle: Badge
icon: doc-badge
brief: Badge generates a small badge to give users tips.
---


## Demos

### How to import

```jsx import
import { Badge } from '@douyinfe/semi-ui';
```
### Basic Usage

The basic type of Badge is `count`. The `dot` property changes a badge into a small dot. The two are mutually exclusive, giving priority to rendering `dot`. When passed in a node type, the node will be rendered directly.

```jsx live=true
import React from 'react';
import { Badge, Avatar } from '@douyinfe/semi-ui';
import { IconLock } from '@douyinfe/semi-icons';

() => {
    const style = {
        width: '42px',
        height: '42px',
        borderRadius: '4px',
    };
    return (
        <div>
            <Badge count={5}>
                <Avatar color='blue' shape='square' style={style}>BM</Avatar>
            </Badge>
            <br/>
            <br/>
            <Badge dot>
                <Avatar color='blue' shape='square' style={style}>YL</Avatar>
            </Badge>
            <br/>
            <br/>
            <Badge count={<IconLock style={{ color: 'var(--semi-color-primary)' }}/>}>
                <Avatar color='light-blue' shape='square' style={style}>XZ</Avatar>
            </Badge>
            <br/>
            <br/>
            <Badge count='NEW' >
                <Avatar color='light-blue' shape='square' style={style}>WF</Avatar>
            </Badge>
        </div>
    );
};
```

### Maximum Value

You can use the `overflowCount` property to cap the number value of the badge content. When the actual value exceeds that value, it will be formatted into `${overflowCount}+`.

```jsx live=true
import React from 'react';
import { Badge, Avatar } from '@douyinfe/semi-ui';

() => {
    const style = {
        width: '42px',
        height: '42px',
        borderRadius: '4px',
    };
    return (
        <div>
            <Badge count={99} >
                <Avatar color='teal' shape='square' style={style}>ZH</Avatar>
            </Badge>
            <br/>
            <br/>
            <Badge count={100} >
                <Avatar color='teal' shape='square' style={style}>HS</Avatar>
            </Badge>
            <br/>
            <br/>
            <Badge count={99} overflowCount={10} >
                <Avatar color='green' shape='square' style={style}>DY</Avatar>
            </Badge>
            <br/>
            <br/>
            <Badge count={1000} overflowCount={999} >
                <Avatar color='green' shape='square' style={style}>TT</Avatar>
            </Badge>
        </div>
    );
};
```

### Position

You can use the `position` property to set the position of the badge to its children. The prop uses one of: `leftTop`, `leftBottom`, `rightTop`(default), `rightBottom`.

```jsx live=true
import React from 'react';
import { Badge, Avatar } from '@douyinfe/semi-ui';

() => {
    const style = {
        width: '42px',
        height: '42px',
        borderRadius: '4px',
    };
    return (
        <div>
            <Badge count='VIP' position='rightTop' type='danger'>
                <Avatar color='amber' shape='square' style={style}>ZH</Avatar>
            </Badge>
            <br/>
            <br/>
            <Badge count='VIP' position='rightBottom' type='danger'>
                <Avatar color='amber' shape='square' style={style}>HS</Avatar>
            </Badge>
            <br/>
            <br/>
            <Badge count='VIP' position='leftTop' type='danger'>
                <Avatar color='orange' shape='square' style={style}>DY</Avatar>
            </Badge>
            <br/>
            <br/>
            <Badge count='VIP' position='leftBottom' type='danger'>
                <Avatar color='orange' shape='square' style={style}>TT</Avatar>
            </Badge>
        </div>
    );
};
```

### Theming

You can use the `theme` and `type` prop to customize the styling. `theme` supports the following values: `solid`(default), `light`, `inverted`.

```jsx live=true
import React from 'react';
import { Badge, Avatar } from '@douyinfe/semi-ui';

() => {
    const bgStyle = {
        padding: '8px',
    };
    const style = {
        width: '42px',
        height: '42px',
        borderRadius: '4px',
    };
    return (
        <div style={{ display: 'flex' }}>
            <div style={bgStyle}>
                <Badge count={5} theme='solid' >
                    <Avatar color='indigo' shape='square' style={style}>XZ</Avatar>
                </Badge>
            </div>
            <div style={bgStyle}>
                <Badge count={5} theme='light' >
                    <Avatar color='indigo' shape='square' style={style}>YB</Avatar>
                </Badge>
            </div>
            <div style={bgStyle}>
                <Badge count={5} theme='inverted' >
                    <Avatar color='light-green' shape='square' style={style}>LX</Avatar>
                </Badge>
            </div>
            <br/>
            <div style={bgStyle}>
                <Badge dot theme='solid' >
                    <Avatar color='light-green' shape='square' style={style}>YZ</Avatar>
                </Badge>
            </div>
            <div style={bgStyle}>
                <Badge dot theme='light' >
                    <Avatar color='lime' shape='square' style={style}>HW</Avatar>
                </Badge>
            </div>
            <div style={{ padding: '8px', borderRadius: '4px', backgroundColor: 'var(--semi-color-fill-0)' }}>
                <Badge dot theme='inverted' >
                    <Avatar color='lime' shape='square' style={style}>XM</Avatar>
                </Badge>
            </div>
        </div>
    );
};
```

`type` support the following values: `primary`(default),`secondary`,`tertiary`,`warning` and `danger`.

```jsx live=true
import React from 'react';
import { Badge, Avatar } from '@douyinfe/semi-ui';

() => {
    const bgStyle = {
        padding: '8px 8px 3px 8px',
    };
    const style = {
        width: '42px',
        height: '42px',
        borderRadius: '4px',
    };
    return (
        <div style={{ display: 'flex' }}>
            <div style={bgStyle}>
                <Badge count={5} type='primary' >
                    <Avatar color='violet' shape='square' style={style}>MR</Avatar>
                </Badge>
            </div>
            <div style={bgStyle}>
                <Badge count={5} type='secondary' >
                    <Avatar color='violet' shape='square' style={style}>YL</Avatar>
                </Badge>
            </div>
            <div style={bgStyle}>
                <Badge count={5} type='tertiary' >
                    <Avatar color='red' shape='square' style={style}>ZW</Avatar>
                </Badge>
            </div>
            <br/>
            <div style={bgStyle}>
                <Badge count={5} type='warning' >
                    <Avatar color='red' shape='square' style={style}>JL</Avatar>
                </Badge>
            </div>
            <div style={bgStyle}>
                <Badge count={5} type='danger' >
                    <Avatar color='pink' shape='square' style={style}>RT</Avatar>
                </Badge>
            </div>
            <div style={bgStyle}>
                <Badge dot type='primary' >
                    <Avatar color='pink' shape='square' style={style}>YF</Avatar>
                </Badge>
            </div>
        </div>
    );
};
```

### Independent Usage

Badge can be used alone when it is a stand-alone element.

```jsx live=true
import React from 'react';
import { Badge } from '@douyinfe/semi-ui';

() => (
    <div>
        <Badge count={5} />
        <br/>
        <br/>
        <Badge count='NEW' theme='light' />
        <br/>
        <br/>
        <Badge count={99} overflowCount={10} type='danger' />
        <br/>
        <br/>
        <span><Badge dot type='primary' /> processing</span>
        <br/>
        <span><Badge dot type='tertiary' /> info</span>
        <br/>
        <span><Badge dot type='success' /> success</span>
        <br/>
        <span><Badge dot type='warning' /> warning</span>
        <br/>
        <span><Badge dot type='danger' /> error</span>
    </div>
);
```

## API Reference

| Properties     | Instructions                                                                          | type       | Default    |
|----------------|---------------------------------------------------------------------------------------| ---------- |------------|
| children       | Base                                                                                  | ReactNode  | -          |
| className      | className                                                                             | string | - |
| count          | Display content                                                                       | ReactNode | -          |
| countClassName | count className                                                                       |  string | -          |
| dot            | Displayed as a little dot.                                                            | boolean    | false      |
| overflowCount  | Cap number value                                                                      | number     | -          |
| position       | Badge position, optional `left Top`, `left Bottom`, `right Top`, `right Bottom`       | string     | `rightTop` |
| countStyle     | style of content (>=v2.59.1)                                                          | CSSProperties     | -          |
| theme          | Badge theme, one of `solid`, `light`, `inverted`                                      | string     | `solid`    |
| type           | Badge type, one of `primary`, `secondary`, `tertiary`, `danger`, `warning`,`success`, | string     | `primary`  |

## Content Guidelines

- Capitalize the first letter

## Design Tokens
<DesignToken/>
