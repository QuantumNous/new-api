---
localeCode: en-US
order: 22
category: Basic
title:  FloatButton
icon: doc-floatButton
brief: A floating button is an actionable button that can float on the page
showNew: true
---

## Demos

### How to import

FloatButton is supported since 2.85.0.

```jsx import
import { FloatButton } from '@douyinfe/semi-ui';
```

### Basic usage

```jsx live=true
import React from 'react';
import { FloatButton } from '@douyinfe/semi-ui';
import { IconAIEditLevel1 } from '@douyinfe/semi-icons';

() => {
    const onClick = () => {
        console.log('float button clicked');
    };

    return (<>
        <span>Basic usage: Row one, third column at the bottom right of the page </span>
        <FloatButton icon={<IconAIEditLevel1 />} style={{ bottom: '270px' }} onClick={onClick}/>
    </>
    );
};
```

### Size

Three sizes are supported: default, small, large.

```jsx live=true
import React from 'react';
import { FloatButton } from '@douyinfe/semi-ui';
import { IconAIEditLevel1 } from '@douyinfe/semi-icons';

() => {
    const onClick = () => {
        console.log('float button clicked');
    };
    return (<>
        <span>Large size: Row two, third column at the bottom right of the page </span>
        <FloatButton size="large" icon={<IconAIEditLevel1 />} style={{ bottom: '200px' }} onClick={onClick}/>
    </>);
};
```

### Shape

Two shapes are defined by default: square (default) and circle.

```jsx live=true
import React from 'react';
import { FloatButton } from '@douyinfe/semi-ui';
import { IconAIEditLevel1 } from '@douyinfe/semi-icons';

() => {
    const onClick = () => {
        console.log('float button clicked');
    };
    return (<>
        <span>Square: Row three, third column at the bottom right of the page </span>
        <FloatButton shape="square" icon={<IconAIEditLevel1 />} style={{ bottom: '150px' }} onClick={onClick}/>
    </>);
};
```

### Click to jump

You can set the jump address through `href`, and `target` specifies the window or frame in which the target web page should be opened.

```jsx live=true
import React from 'react';
import { FloatButton } from '@douyinfe/semi-ui';
import { IconAIEditLevel1 } from '@douyinfe/semi-icons';

() => {
    const onClick = () => {
        console.log('float button clicked');
    };
    return (<>
        <span>Click to jump: Row four, third column at the bottom right of the page</span>
        <FloatButton
            icon={<IconAIEditLevel1 />} 
            style={{ bottom: '100px' }} 
            href={'https://semi.design'}
            target={'_blank'}
        />
    </>);
};
```

### AI style - Colorful floating buttons

You can set `colorful` to true to display colorful floating buttons.

```jsx live=true
import React from 'react';
import { FloatButton } from '@douyinfe/semi-ui';
import { IconAIEditLevel1 } from '@douyinfe/semi-icons';

() => {
    const onClick = () => {
        console.log('float button clicked');
    };
    return (<>
        <span>Colorful buttons: The first column at the bottom right of the page</span>
        <FloatButton
            colorful
            icon={<IconAIEditLevel1 />} 
            style={{ bottom: '110px', insetInlineEnd: '150px' }} 
            href={'https://semi.design'}
            target={'_blank'}
        />
    </>);
};
```

### Badge

```jsx live=true
import React from 'react';
import { FloatButton } from '@douyinfe/semi-ui';
import { IconAIEditLevel1 } from '@douyinfe/semi-icons';

() => {
    return (<>
        <span>With badge: second column from the bottom right of the page</span>
        <FloatButton
            disabled
            icon={<IconAIEditLevel1 />}  
            badge={{ dot: true, type: 'danger' }} 
            style={{ bottom: 270, insetInlineEnd: '100px' }} 
        />
        <FloatButton
            badge={{ count: 1000, overflowCount: 999 }} 
            size={"large"}
            icon={<IconAIEditLevel1 />}  
            style={{ bottom: 210, insetInlineEnd: 100 }} 
        />
        <FloatButton 
            icon={<IconAIEditLevel1 />}  
            badge={{ dot: true }} 
            colorful 
            style={{ bottom: 170, insetInlineEnd: 100 }} 
        />
        <FloatButton 
            icon={<IconAIEditLevel1 />}  
            colorful
            size="large"
            badge={{ count: 'VIP', type: "danger" }}
            style={{ bottom: 110, insetInlineEnd: 100 }} 
        />
    </>);
};
```

### Floating button Group

Subitems can be passed in via `items`.

```jsx live=true
import React from 'react';
import { FloatButtonGroup } from '@douyinfe/semi-ui';
import { IconAIEditLevel1, IconAIStrokedLevel3, IconSearchStroked, IconHelpCircleStroked } from '@douyinfe/semi-icons';

() => {
    return (<>
        <span>页面右下方最后一行</span>
        <FloatButtonGroup 
            style={{
                insetInlineEnd: 24,
                bottom: 50,
            }}
            items={[
                {
                    icon: <IconAIStrokedLevel3 />,
                    content: "Edit"
                },
                {
                    icon: <IconSearchStroked />,
                    content: "Search"
                },
                {
                    icon: <IconHelpCircleStroked />,
                    content: "Help"
                }
            ]}
        />
    </>);
};
```

## API Reference

### FloatButton

| Properties | Instructions | Type | Default |
|-----|-----|------|-------|
| badge | Badge parameters | [BadgeProps](/en-US/show/badge#API%E5%8F%82%E8%80%83) | - |
| colorful | Use colorful floating buttons | boolean | false |
| className | Style class name |  string | - |
| disabled | Disabled state | boolean | false|
| href | Click the jump link, the same as [href](https://developer.mozilla.org/zh-CN/docs/Web/API/Location/href) | string | - |
| icon | Icon | ReactNode | - |
| onClick | Click callback function | string | - |
| shape | Shape, supports round, square | string | round |
| size | Size, supports default, small, large | string | default|
| style | Style | CSSProperties  | - |
| target | Specifies where to display the URL of the link, same as [target](https://developer.mozilla.org/zh-CN/docs/Web/HTML/Reference/Elements/a#target) | string | - |

### FloatButtonGroupItem

Add the following parameters based on FloatButtonProps

| Properties | Instructions | Type | Default |
|-----|-----|------|-------|
| content | Text content | String | - |

### FloatButtonGroup

| Properties | Instructions | Type | Default |
|-----|-----|------|-------|
| className | Style class name |  string | - |
| disabled | Disabled state | boolean | false|
| items | Information about a single child | FloatButtonGroupItem | - |
| style | style | CSSProperties  | - |
