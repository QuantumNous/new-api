---
localeCode: en-US
order: 53
category: Navigation
title:  Anchor
subTitle: Anchor
icon: doc-anchor
brief: The Anchor component is used to create a hyper Link navigation bar.
---


## Demos

### How to import

```jsx
import { Anchor } from '@douyinfe/semi-ui';
```

### Basic Usage

Use `Link` to create an anchor, click it to jump to the hash tag location.

```jsx live=true
import React from 'react';
import { Anchor } from '@douyinfe/semi-ui';

() => (
    <Anchor>
        <Anchor.Link href="#Basic_Usage" title="Basic Usage" />
        <Anchor.Link href="#Components" title="Components" />
        <Anchor.Link href="#Design" title="Design" />
        <Anchor.Link href="#Blocks" title="Blocks" />
        <Anchor.Link href="#Theme" title="Theme" />
    </Anchor>
);
```

### Integrated Usage

You can use `getContainer`, `targetOffset`, `offsetTop`, and `style` to create a out of the box hyperAnchor.Link navigation bar.

-   getContainer：you can set the container of scroll content with `getContainer` property. Its default value is `window`.

-   targetOffset: you can set the distance between the anchor point and the top of the container by setting `targetOffset`. **v>=1.9**

-   style：the default `position` of Anchor is `relative`. You can customize it with `style` object.

-   offsetTop：`offsetTop` can trigger the current Link switch when the scrolling content reaches a specified offset from the top of the container.

```jsx
import React from 'react';
import { Anchor } from '@douyinfe/semi-ui';

() => {
    const getContainer = () => {
        return document.querySelector('window');
    };
    return (
        <div>
            <span>See the fixed Anchor on the right </span>
            <Anchor
                getContainer={getContainer}
                offsetTop={100}
                targetOffset={100} // v>=1.9
                style={{ position: 'fixed', right: '20px', top: '100px', width: '200px', zIndex: 3 }} >
                <Anchor.Link href="#Basic_Usage" title="Fixed Anchor" />
                <Anchor.Link href="#Integrated_Usage" title="Integrated Usage" />
                <Anchor.Link href="#Size" title="Size" />
                <Anchor.Link href="#Rail_Theme" title="Rail Theme" />
                <Anchor.Link href="#Auto_Collapse" title="Auto Collapse" />
                <Anchor.Link href="#Show_Tooltip" title="Show Tooltip" />
                <Anchor.Link href="#Tooltip_Position" title="Tooltip Position" />
                <Anchor.Link href="#API_Reference" title="API Reference">
                    <Anchor.Link href="#Anchor" title="Anchor" />
                    <Anchor.Link href="#Anchor.Link" title="Anchor.Link" />
                </Anchor.Link>
            </Anchor>
        </div>
    );
};
```

### Size

You can change Anchor size with `size` property.

```jsx live=true
import React from 'react';
import { Anchor } from '@douyinfe/semi-ui';

() => (
    <Anchor size={'default'}>
        <Anchor.Link href="#Components" title="Components" />
        <Anchor.Link href="#Design" title="Design" />
        <Anchor.Link href="#Blocks" title="Blocks" />
        <Anchor.Link href="#Theme" title="Theme" />
    </Anchor>
);
```

```jsx live=true
import React from 'react';
import { Anchor } from '@douyinfe/semi-ui';

() => (
    <Anchor size={'small'}>
        <Anchor.Link href="#Components" title="Components" />
        <Anchor.Link href="#Design" title="Design" />
        <Anchor.Link href="#Blocks" title="Blocks" />
        <Anchor.Link href="#Theme" title="Theme" />
    </Anchor>
);
```

### Rail Theme

You can change rail color with `railTheme` property. Three themes are supported and the default value is `primary`.

```jsx live=true
import React from 'react';
import { Anchor } from '@douyinfe/semi-ui';

() => {
    const getContainer = () => {
        return document.querySelector('window');
    };
    return (
        <div>
            <Anchor
                railTheme={'primary'}
                getContainer={getContainer}
                targetOffset={60}
                offsetTop={100}>
                <Anchor.Link href="#Size" title="Size" />
                <Anchor.Link href="#Rail_Theme" title="Rail Theme" />
                <Anchor.Link href="#Design" title="Design" />
                <Anchor.Link href="#Blocks" title="Blocks" />
                <Anchor.Link href="#Theme" title="Theme" />
            </Anchor>
        </div>
    );
};
```

```jsx live=true
import React from 'react';
import { Anchor } from '@douyinfe/semi-ui';

() => {
    const getContainer = () => {
        return document.querySelector('window');
    };
    return (
        <div>
            <Anchor
                railTheme={'tertiary'}
                getContainer={getContainer}
                targetOffset={60}
                offsetTop={100}>
                <Anchor.Link href="#Size" title="Size" />
                <Anchor.Link href="#Rail_Theme" title="Rail Theme" />
                <Anchor.Link href="#Design" title="Design" />
                <Anchor.Link href="#Blocks" title="Blocks" />
                <Anchor.Link href="#Theme" title="Theme" />
            </Anchor>
        </div>
    );
};
```

```jsx live=true
import React from 'react';
import { Anchor } from '@douyinfe/semi-ui';

() => {
    const getContainer = () => {
        return document.querySelector('window');
    };
    return (
        <div>
            <Anchor
                railTheme={'muted'}
                getContainer={getContainer}
                targetOffset={60}
                offsetTop={100}>
                <Anchor.Link href="#Size" title="Size" />
                <Anchor.Link href="#Rail_Theme" title="Rail Theme" />
                <Anchor.Link href="#Design" title="Design" />
                <Anchor.Link href="#Blocks" title="Blocks" />
                <Anchor.Link href="#Theme" title="Theme" />
            </Anchor>
        </div>
    );
};
```

### Auto Collapse

Anchor can dynamically display child links with `autoCollapse` property. The default is `false`.

```jsx live=true
import React from 'react';
import { Anchor } from '@douyinfe/semi-ui';

() => {
    const getContainer = () => {
        return document.querySelector('window');
    };
    return (
        <div>
            <Anchor
                autoCollapse={true}
                getContainer={getContainer}
                targetOffset={60}
                offsetTop={100}>
                <Anchor.Link href="#Auto_Collapse" title="1. Auto Collapse">
                    <Anchor.Link href="#Components" title="1.1 Components">
                        <Anchor.Link href="#Avatar" title="1.1.1 Avatar" />
                        <Anchor.Link href="#Button" title="1.1.2 Button" />
                        <Anchor.Link href="#Icon" title="1.1.3 Icon" />
                    </Anchor.Link>
                    <Anchor.Link href="#Blocks" title="1.2 Blocks" />
                    <Anchor.Link href="#Theme" title="1.3 Theme" />
                </Anchor.Link>
                <Anchor.Link href="#Design" title="2. Design" />
            </Anchor>
        </div>
    );
};
```

```jsx live=true
import React from 'react';
import { Anchor } from '@douyinfe/semi-ui';

() => {
    const getContainer = () => {
        return document.querySelector('window');
    };
    return (
        <div>
            <Anchor
                autoCollapse={false}
                getContainer={getContainer}
                targetOffset={60}
                offsetTop={100}>
                <Anchor.Link href="#Auto_Collapse" title="1. Auto Collapse">
                    <Anchor.Link href="#Components" title="1.1 Components">
                        <Anchor.Link href="#Avatar" title="1.1.1 Avatar" />
                        <Anchor.Link href="#Button" title="1.1.2 Button" />
                        <Anchor.Link href="#Icon" title="1.1.3 Icon" />
                    </Anchor.Link>
                    <Anchor.Link href="#Blocks" title="1.2 Blocks" />
                    <Anchor.Link href="#Theme" title="1.3 Theme" />
                </Anchor.Link>
                <Anchor.Link href="#Design" title="2. Design" />
            </Anchor>
        </div>
    );
};
```

### Show Tooltip

`showTooltip` can display the title of link when it exceeds the max-width. The default value is `false`.

```jsx live=true
import React from 'react';
import { Anchor } from '@douyinfe/semi-ui';

() => {
    const getContainer = () => {
        return document.querySelector('window');
    };
    return (
        <div>
            <Anchor
                showTooltip={true}
                getContainer={getContainer}
                targetOffset={60}
                offsetTop={100}
            >
                <Anchor.Link href="#Show_Tooltip" title="Tooltip is a useful tool that displays the entire content when text is abbreviated." />
                <Anchor.Link href="#Components" title="Components" />
                <Anchor.Link href="#Design" title="Design" />
                <Anchor.Link href="#Blocks" title="Blocks" />
                <Anchor.Link href="#Theme" title="Theme" />
            </Anchor>
        </div>
    );
};
```

### Tooltip Position

You can change the Tooltip position with `position` property. It only works when `showTooltip` is `true`.

```jsx live=true
import React from 'react';
import { Anchor } from '@douyinfe/semi-ui';

() => {
    const getContainer = () => {
        return document.querySelector('window');
    };
    return (
        <div>
            <Anchor
                showTooltip={true}
                position={'right'}
                getContainer={getContainer}
                targetOffset={60}
                offsetTop={100}
            >
                <Anchor.Link href="#Tooltip_Position" title="Tooltip is a useful tool that displays the entire content when text is abbreviated." />
                <Anchor.Link href="#Components" title="Components" />
                <Anchor.Link href="#Design" title="Design" />
                <Anchor.Link href="#Blocks" title="Blocks" />
                <Anchor.Link href="#Theme" title="Theme" />
            </Anchor>
        </div>
    );
};
```

## API Reference

### Anchor

| PROPERTIES   | INSTRUCTIONS                                                                                                        | TYPE                                | DEFAULT   |  VERSION |
| ------------ | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | --------- | - |
| autoCollapse | Dynamically display child link                                                                                      | boolean                             | false     | |
| className    | Class name                                                                                                          | string                              | -         | |
| defaultAnchor | Default highlight anchor                                     | string                              | -         |  |
| getContainer | Scroll container                                                                                                    | () => HTMLElement                   | window    | |
| maxHeight    | max-height of Anchor                                                                                                | string \| number                    | `750px`   | |
| maxWidth     | max-width of Anchor                                                                                                 | string \| number                    | `200px`   | |
| offsetTop    | Trigger the current link switch when the scrolling content reaches a specified offset from the top of the container | number                              | 0         | |
| onChange     | Change event                                                                                                        | (currentLink, previousLink) => void | -         | |
| onClick      | Click event                                                                                                         | (event, currentLink) => void        | -         | |
| position     | Tooltip position，same as `position` property of Tooltip component                                                  | string                              | -         | |
| railTheme    | Style of scroll rail，one of `primary`，`tertiary`，`muted`                                                         | string                              | `primary` | |
| scrollMotion | Animation of scroll behavior                                                                                        | boolean                             | false     | |
| showTooltip  | Toggle whether to show tooltip, if passed in as object: type，type of component to show tooltip, support Tooltip and Popover, the default is Tooltip; opts, properties that will be passed directly to the component. The object form setting is provided since version 2.36.0   | boolean \| {type: 'tooltip'\|'popover', opts: object}                             | false     | |
| size         | Size of Anchor，one of `small`，`default`                                                                           | string                              | `default` | |
| style        | Style object                                                                                                        | object                              | -         | |
| targetOffset | Anchor offset from top of target                                                                     | number                              | 0         | 1.9.0 |

### Anchor.Link

| PROPERTIES | INSTRUCTIONS              | TYPE              | DEFAULT |
| ---------- | ------------------------- | ----------------- | ------- |
| className  | Class name                | string            | -       |
| href       | The target of hyper link  | string            | -       |
| style      | Style object              | object            | -       |
| title      | The content of hyper link | string\|ReactNode | -       |

## Content Guidelines
- Write in sentence case
- Keep it concise and avoid line breaks

## Design Tokens
<DesignToken/>

## FAQ

1. **Why didn't my link highlight and slide to follow?**  
    Check whether you can scroll to the specified position by clicking the anchor:
    - No, it means there is a problem with the id. check whether the id exists in the document;
    - Yes, it may be that the scrolling container is not set correctly to ensure that the content of the document is wrapped in the scrolling container. The default scrolling container is window. If your container is a div of .my-container, you should set the scrolling container to this div.
    
    ```text
    import React from 'react';
    import { Anchor } from '@douyinfe/semi-ui';

    function App() {
        const getContainer = () => {
            return document.querySelector('.my-container');
        };
        return (
            <Anchor
                /* Other props */
                getContainer={getContainer}
            >
                /* Links */
            </Anchor>
        )
    }
    ```
