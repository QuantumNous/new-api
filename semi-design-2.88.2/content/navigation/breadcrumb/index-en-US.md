---
localeCode: en-US
order: 55
category: Navigation
title:  Breadcrumb
subTitle: Breadcrumb
icon: doc-breadcrumb
brief: Breadcrumbs allow users to make selections from a range of values and provide an auxiliary navigation that can return to previous page.
---


## Demos

### How to import

```jsx
import { Breadcrumb } from '@douyinfe/semi-ui';
```
### Basic Usage

```jsx live=true
import React from 'react';
import { Breadcrumb } from '@douyinfe/semi-ui';

() => (
    <Breadcrumb>
        <Breadcrumb.Item>Semi-ui</Breadcrumb.Item>
        <Breadcrumb.Item>Breadcrumb</Breadcrumb.Item>
        <Breadcrumb.Item>Default</Breadcrumb.Item>
    </Breadcrumb>
);
```

### With Icons

```jsx live=true
import React from 'react';
import { Breadcrumb } from '@douyinfe/semi-ui';
import { IconHome, IconArticle } from '@douyinfe/semi-icons';

() => (
    <Breadcrumb>
        <Breadcrumb.Item icon={<IconHome />}></Breadcrumb.Item>
        <Breadcrumb.Item icon={<IconArticle />}>Breadcrumb</Breadcrumb.Item>
        <Breadcrumb.Item>With Icon</Breadcrumb.Item>
    </Breadcrumb>
);
```

### Size

You can set the `compact` property to `false` to increase the size of icons and texts.

```jsx live=true
import React from 'react';
import { Breadcrumb } from '@douyinfe/semi-ui';
import { IconHome } from '@douyinfe/semi-icons';

() => (
    <div>
        <Breadcrumb compact>
            <Breadcrumb.Item icon={<IconHome />}></Breadcrumb.Item>
            <Breadcrumb.Item>Breadcrumb</Breadcrumb.Item>
            <Breadcrumb.Item>Loose</Breadcrumb.Item>
        </Breadcrumb>
        <br/>
        <Breadcrumb compact={false}>
            <Breadcrumb.Item icon={<IconHome />}></Breadcrumb.Item>
            <Breadcrumb.Item>Breadcrumb</Breadcrumb.Item>
            <Breadcrumb.Item>Loose</Breadcrumb.Item>
        </Breadcrumb>
    </div>
);
```

### Custom Separator

Default separator is `/`.

```jsx live=true
import React from 'react';
import { Breadcrumb, Tag } from '@douyinfe/semi-ui';
import { IconArrowRight } from '@douyinfe/semi-icons';

() => (
    <div>
        <Breadcrumb separator={'>'}>
            <Breadcrumb.Item>Semi-ui</Breadcrumb.Item>
            <Breadcrumb.Item>Breadcrumb</Breadcrumb.Item>
            <Breadcrumb.Item>Default</Breadcrumb.Item>
        </Breadcrumb>
        <br/>
        <Breadcrumb separator={<IconArrowRight size={'small'} />}>
            <Breadcrumb.Item>Semi-ui</Breadcrumb.Item>
            <Breadcrumb.Item>Breadcrumb</Breadcrumb.Item>
            <Breadcrumb.Item>Default</Breadcrumb.Item>
        </Breadcrumb>
        <Tag>{`v>=1.16.0`}</Tag>
        <br/>
        <Breadcrumb size={'small'} >
            <Breadcrumb.Item separator=":">Semi-ui</Breadcrumb.Item>
            <Breadcrumb.Item>Breadcrumb</Breadcrumb.Item>
            <Breadcrumb.Item>Default</Breadcrumb.Item>
        </Breadcrumb>
    </div>
);
```

### Truncated Logic
After **v0.34.0**, the truncation happens if the text is overflowed. Default max-width is set to 150px. You could use `showTooltip` to customize ellipsis behavior.

```jsx live=true
import React from 'react';
import { Breadcrumb, Typography } from '@douyinfe/semi-ui';

() => {
    const routes = ['Home', 'The is a very very very very long title', 'Detail'];
    const { Text } = Typography;
    return (
        <>
            <Text size="small">Default</Text>
            <Breadcrumb
                routes={routes}
            />
            <br/>
            <Text size="small">No tooltip</Text>
            <Breadcrumb
                showTooltip={false}
                routes={routes}
            />
            <br/>
            <Text size="small">No truncation</Text>
            <Breadcrumb
                showTooltip={{ width: 'auto' }}
                routes={routes}
            />
            <br/>
            <Text size="small">Ellipsis from middle of text</Text>
            <Breadcrumb
                showTooltip={{ ellipsisPos: 'middle' }}
                routes={routes}
            />
            <br/>
            <Text size="small">Customize tooltip</Text>
            <Breadcrumb
                showTooltip={{ opts: { position: 'topLeft' } }}
                routes={routes}
            />
        </>
    );
};
```

When the path exceeds 4 levels, the second level to the penultimate one will be replaced by ellipsis. You can click the ellipsis to reveal all levels.
For **v>=1.9.0** , you could use `maxItemCount` to set the number exceeded to trigger auto collapse.

```jsx live=true
import React from 'react';
import { Breadcrumb } from '@douyinfe/semi-ui';

() => (
    <Breadcrumb>
        <Breadcrumb.Item>Home</Breadcrumb.Item>
        <Breadcrumb.Item>Many levels</Breadcrumb.Item>
        <Breadcrumb.Item>Another level</Breadcrumb.Item>
        <Breadcrumb.Item>Another level again</Breadcrumb.Item>
        <Breadcrumb.Item>Here is another one</Breadcrumb.Item>
        <Breadcrumb.Item>Penultimate</Breadcrumb.Item>
        <Breadcrumb.Item>Detail</Breadcrumb.Item>
    </Breadcrumb>
);
```

### Custom Ellipsis

There are two ellipsis area rendering types provided inside the component. You can set and select the desired rendering type through `moreType`. The optional values of `moreType` are `default` and `popover`.

```jsx live=true
import React from 'react';
import { Breadcrumb } from '@douyinfe/semi-ui';

() => (
    <Breadcrumb moreType='popover'>
        <Breadcrumb.Item>Home</Breadcrumb.Item>
        <Breadcrumb.Item>Many levels</Breadcrumb.Item>
        <Breadcrumb.Item>Another level</Breadcrumb.Item>
        <Breadcrumb.Item>Another level again</Breadcrumb.Item>
        <Breadcrumb.Item>Here is another one</Breadcrumb.Item>
        <Breadcrumb.Item>Penultimate</Breadcrumb.Item>
        <Breadcrumb.Item>Detail</Breadcrumb.Item>
    </Breadcrumb>
);
```

If you want to customize other forms of rendering for the ellipsis area, you can use the `renderMore()` method.

```jsx live=true
import React from 'react';
import { Breadcrumb, Popover } from '@douyinfe/semi-ui';
import { IconMore } from '@douyinfe/semi-icons';

function Demo() {
    const separator = '-'; // Separator for splicing restItem array items
    const renderMore = restItem => {
        const content = (
            <>
                {
                    restItem.map((item, idx) => (
                        <React.Fragment key={`restItem-${idx}`}>
                            {item}
                            {idx !== restItem.length - 1 &&
                                <span style={{ color: 'var(--semi-color-text-2)', marginRight: '6px' }}>
                                    {separator}
                                </span>
                            }
                        </React.Fragment>
                    ))
                }
            </>
        );
        return (
            <Popover
                content={content}
                style={{ padding: 12 }}
                showArrow
            >
                <IconMore />
            </Popover>
        );
    };
    return (
        <>
            <Breadcrumb
                renderMore={restItem => renderMore(restItem)}
                onClick={(item, e) => console.log(item, e)}
            >
                <Breadcrumb.Item>Home</Breadcrumb.Item>
                <Breadcrumb.Item>Many levels</Breadcrumb.Item>
                <Breadcrumb.Item>Another level</Breadcrumb.Item>
                <Breadcrumb.Item>Another level again</Breadcrumb.Item>
                <Breadcrumb.Item>Here is another one</Breadcrumb.Item>
                <Breadcrumb.Item>Penultimate</Breadcrumb.Item>
                <Breadcrumb.Item>Detail</Breadcrumb.Item>
            </Breadcrumb>
        </>
    );
}
```

### Route Object

Breadcrumb supports passing in an array of strings or route objects consisting of `{ name, path, href, icon }`. You can also use `renderItem` to render React.nodes. Breadcrumbs created in this way will also be truncated.

-   `name`: Name displayed, default with an empty string. When route passed in is a string only, it is set to name property.
-   `path`: Routing path.
-   `href`: Link destination and is mounted on the `<a>` tag.
-   `icon`: Icon displayed.
 
```jsx live=true hideInDSM
import React from 'react';
import { Breadcrumb } from '@douyinfe/semi-ui';
import { IconHome, IconArticle } from '@douyinfe/semi-icons';

() => (
    <div>
        <Breadcrumb
            routes={['Semi-ui', 'Breadcrumb', 'Default']}
        />
        <br/>
        <Breadcrumb
            routes={
                [
                    {
                        path: '/', 
                        Href: '/', 
                        icon: <IconHome />
                    },
                    { 
                        path: '/breadcrumb', 
                        href: '/en-US/navigation/breadcrumb', 
                        name: 'breadcrumb', 
                        icon: <IconArticle />
                    },
                    'with icon'
                ]
            }
        />
        <br/>
        <Breadcrumb
            routes={['Index', 'This is a very long level', 'Detail']}
        />
    </div>
);
```

## API reference

### Breadcrumb

| Properties | Instructions                                                                                                                                                                        | type                                         | Default   | version |
| ---------- |-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------| -------------------------------------------- | --------- | ------- |
| activeIndex| Controlled use, currently selected navigation index                                                                                                                                 | - | 2.61.0 |
| autoCollapse      | Toggle whether to auto collapse when exceed maxItemCount                                                                                                                            | boolean                                     | true     |    1.9.0   |
| className  | Class name                                                                                                                                                                          | string                                       | -         |         |
| compact    | Compact sizing                                                                                                                                                                      | boolean                                      | true      |         |
| maxItemCount      | Set the number of item when reached to collapse                                                                                                                                     | number                                     | 4    | 1.9.0       |
|moreType| ...area rendering type，one of 'default'、'popover'                                                                                                                                   |string|'default'|1.27.0|
| renderItem | Custom function, used with routes                                                                                                                                                   | (Route: [Route](#Route)) => React Node               | -         | 0.27.0  |
|renderMore| Custom ... area rendering                                                                                                                                                           |(restItem: ReactNode[]) => ReactNode|-|1.27.0|
| routes     | Routing information, an array of route objects or strings, format reference: [Route](#Route)                                                                                        | Array<[Route](#Route) \| string\>                              | -         |         |
| separator  | Customized delimiter                                                                                                                                                                | string                                       | ReactNode | '/'     |  |
| showTooltip | Toggle whether to show tooltip if text overflowed. If passed in as an object: width, overflowed width; ellipsisPos, ways of truncation;  opts, passed directly to Tooltip component | boolean \| showToolTipProps             | {width: 150, ellipsisPos: 'end', opts: { autoAdjustOverflow: true, position: "bottomLeft" }}      | 0.34.0 |
| style      | Inline style                                                                                                                                                                        | CSSProperties                                       | -         |         |
| onClick    | Click event                                                                                                                                                                         |  (item: [Route](#Route), e: Event) => void| -         | 0.27.0  |

### Breadcrumb.Item

| Properties | Instructions           | type                             | Default | version |
| ---------- | ---------------------- | -------------------------------- | ------- | ------- |
| href       | Destinations for links | string                           | -       |         |
| icon       | Displayed icon         | ReactNode                           | -       |         |
| onClick    | Click event            | function (item: Route, e: Event) | -       | 0.27.0  |
| separator    | Separator, used to override parent separator          | ReactNode | -       | 1.16.0 |
| noLink    | To remove hover and active effect on an item | boolean | false     | 1.16.0 |


### Route

| Properties | Instructions      | type   | Default   | version |
| ---------- | ----------------- | ------ | --------- | ------- |
| href       | Link destinations | string | -         | 0.27.0  |
| icon       | Displayed icon    | ReactNode |  | -       | 
| name       | Routing name      | string | -         |         |
| path       | Routing path      | string | -         |         |

After **v>=1.16.0**, other props in Breadcrumb.Item are also supported correspondingly.

## Accessibility

- Breadcrumb supports the `aria-label` props to indicate the function of the Breadcrumb
- Breadcrumb will set `aria-current='page'` for the current item

## Content Guidelines

- Each page link should be short and clearly reflect the location or entity it links to
- Write in sentence case

## Design Tokens
<DesignToken/>

<!-- ## Related Material
```material
87
``` -->
