---
localeCode: en-US
order: 82
category: Show
title:  Timeline
subTitle: Timeline
icon: doc-timeline
brief: Timeline component is used to display a series of information vertically.
---


## Demos

### How to import

```jsx import
import { Timeline } from '@douyinfe/semi-ui';
```

### Basic Usage

```jsx live=true
import React from 'react';
import { Timeline } from '@douyinfe/semi-ui';

() => (
    <Timeline>
        <Timeline.Item time='2019-07-14 10:35'>First Node Content</Timeline.Item>
        <Timeline.Item time='2019-06-13 16:17'>Second Node Content</Timeline.Item>
        <Timeline.Item time='2019-05-14 18:34'>Third Node Content</Timeline.Item>
    </Timeline>
);
```

### Type

You can use `type` to set the type of a time node, using one of: `default`,`ongoing`, `success`, `warning`, `Error`. The corresponding dot will have a corresponding color.

```jsx live=true
import React from 'react';
import { Timeline } from '@douyinfe/semi-ui';

() => (
    <Timeline>
        <Timeline.Item time='2019-07-14 10:35' type='ongoing'>Processing</Timeline.Item>
        <Timeline.Item time='2019-06-13 16:17' type='success'>Succeed</Timeline.Item>
        <Timeline.Item time='2019-05-14 18:34' type='error'>Failed</Timeline.Item>
    </Timeline>
);
```

### Custom node

You can use `dot` to customize icon, `color` to customize color or pass in `children` with style.

```jsx live=true
import React from 'react';
import { Timeline } from '@douyinfe/semi-ui';
import { IconAlertTriangle } from '@douyinfe/semi-icons';

() => (
    <Timeline>
        <Timeline.Item time='2019-07-14 10:35'>Default Style</Timeline.Item>
        <Timeline.Item time='2019-06-13 16:17' dot={(<IconAlertTriangle />)} type='warning'>Customized Icon</Timeline.Item>
        <Timeline.Item time='2019-05-14 18:34' color='pink'>Customized Color</Timeline.Item>
        <Timeline.Item time='2019-04-10 12:20'><span style={{ fontSize: '18px' }}>Customized Node Style</span></Timeline.Item>
    </Timeline>
);
```

### Timeline Position

Use `mode` to set the position of the timeline, using one of: `left`, `center`, `alternate`, `right`.

#### Left (default)

```jsx live=true
import React from 'react';
import { Timeline } from '@douyinfe/semi-ui';

() => (
    <Timeline mode='left'>
        <Timeline.Item time='2019-07-14 10:35' extra='Extra Information'>First Node Content</Timeline.Item>
        <Timeline.Item time='2019-06-13 16:17' extra='Extra Information'>Second Node Content</Timeline.Item>
        <Timeline.Item time='2019-05-14 18:34' extra='Extra Information'>Third Node Content</Timeline.Item>
        <Timeline.Item time='2019-05-09 09:12' extra='Extra Information'>Forth Node Content</Timeline.Item>
    </Timeline>
);
```

#### Center

```jsx live=true
import React from 'react';
import { Timeline } from '@douyinfe/semi-ui';

() => (
    <Timeline mode='center'>
        <Timeline.Item time='2019-07-14 10:35' extra='Extra Information'>First Node Content</Timeline.Item>
        <Timeline.Item time='2019-06-13 16:17' extra='Extra Information'>Second Node Content</Timeline.Item>
        <Timeline.Item time='2019-05-14 18:34' extra='Extra Information'>Third Node Content</Timeline.Item>
        <Timeline.Item time='2019-05-09 09:12' extra='Extra Information'>Forth Node Content</Timeline.Item>
    </Timeline>
);
```

#### Alternate

```jsx live=true
import React from 'react';
import { Timeline } from '@douyinfe/semi-ui';

() => (
    <Timeline mode='alternate'>
        <Timeline.Item time='2019-07-14 10:35' extra='Extra Information'>First Node Content</Timeline.Item>
        <Timeline.Item time='2019-06-13 16:17' extra='Extra Information'>Second Node Content</Timeline.Item>
        <Timeline.Item time='2019-05-14 18:34' extra='Extra Information'>Third Node Content</Timeline.Item>
        <Timeline.Item time='2019-05-09 09:12' extra='Extra Information'>Forth Node Content</Timeline.Item>
    </Timeline>
);
```

#### Right

```jsx live=true
import React from 'react';
import { Timeline } from '@douyinfe/semi-ui';

() => (
    <Timeline mode='right'>
        <Timeline.Item time='2019-07-14 10:35' extra='Extra Information'>First Node Content</Timeline.Item>
        <Timeline.Item time='2019-06-13 16:17' extra='Extra Information'>Second Node Content</Timeline.Item>
        <Timeline.Item time='2019-05-14 18:34' extra='Extra Information'>Third Node Content</Timeline.Item>
        <Timeline.Item time='2019-05-09 09:12' extra='Extra Information'>Forth Node Content</Timeline.Item>
    </Timeline>
);
```

### DataSource

```jsx live=true
import React from 'react';
import { Timeline } from '@douyinfe/semi-ui';
import { IconAlertTriangle } from '@douyinfe/semi-icons';

() => (
    <Timeline 
        mode='alternate' 
        dataSource={[
            {
                time: '2019-07-14 10:35',
                extra: 'Extra Information',
                content: 'First Node Content',
                type: 'ongoing',
            },
            {
                time: '2019-06-13 16:17',
                extra: 'Extra Information',
                content: <span style={{ fontSize: '18px' }}>Second Node Content</span>,
                color: 'pink',
            },
            {
                time: '2019-05-14 18:34',
                extra: 'Extra Information',
                dot: <IconAlertTriangle />,
                content: 'Third Node Content',
                type: 'warning',
            },
            {
                time: '2019-05-09 09:12',
                extra: 'Extra Information',
                content: 'Forth Node Content',
                type: 'success',
            }    
        ]} 
    />
);
```

## API reference

### TimeLine

| Properties | Instruction                                                                                                   | type                                   | Default |
| ---------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ------- |
| className  | Class name                                                                                                    | string                                 | -       |
| mode       | The relative Position of the timeline and content                                                             | `left`\|`right`\|`center`\|`alternate` | `left`  |
| style      | Inline style                                                                                                  | CSSProperties                                 | -       |
| dataSource | DataSource array for Timeline **v>=1.16.0**, Support content attribute and all attributes of TimeLine.Item   | array                                  | -       |

### TimeLine.Item

| Properties | Instruction                                              | type                                                | Default   | Version   |
| ---------- | -------------------------------------------------------- | --------------------------------------------------- | --------- | --------- |
| className  | Class name                                               | string                                              | -         | -         |
| color      | Color of dot                                             | string                                              | -         | -         |
| dot        | Custom dot                                               | React Node                                          | -         | -         |
| extra      | Custom extra content                                     | React Node                                          | -         | -         |
| position   | Custom node location to override TimeLine's mode setting | `left`\|`right`                                     | -         | -         |
| style      | Inline style                                             | CSSProperties                                       | -         | -         |
| time       | Time value                                               | string                                              | -         | -         |
| type       | Pattern of dot                                           | `default`\|`ongoing`\|`success`\|`warning`\|`error` | `default` | -         |
| onClick    | Click event                                              | (e: MouseEvent) => void                             | -         | 2.2.0     |



## Accessibility

### ARIA
- The element of dot and line between dots in TimeLine have a `aria-hidden`, indicates that they do not support Accessibility API.
- Supporting API `aria-label` to specify TimeLine's label.
```text
<Timeline aria-label="Accident timeline">
    <Timeline.Item time="2015-09-01">Accident started</Timeline.Item>
    <Timeline.Item time="2015-09-01">Process</Timeline.Item>
</Timeline>
```

## Design Tokens
<DesignToken/>
