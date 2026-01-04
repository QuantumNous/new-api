---
localeCode: en-US
order: 68
category: Show
title: Description
subTitle: Descriptions
icon: doc-descriptions
dir: column
breif: The description list is used to render key-value pairs.
---

## Demos

### How to import

```jsx import
import { Descriptions } from '@douyinfe/semi-ui';
```

### Basic Usage

Data can be passed in as an array of key-value pairs `{ key: value }` through `props.data`
Both key and value support the `ReactNode` type. You can pass in a string or a higher degree of freedom ReactNode to freely customize the render dom.

```jsx live=true dir="column"
import React from 'react';
import { Descriptions, Tag } from '@douyinfe/semi-ui';

() => {
    const data = [
        { key: 'Actual Users', value: '1,480,000' },
        { key: '7-day Rentention', value: '98%' },
        { key: 'Security Level', value: 'III' },
        { key: 'Category Tag', value: <Tag style={{ margin: 0 }}>E-commerce</Tag> },
        { key: 'Authorized State', value: 'Unauthorized' },
    ];
    return <Descriptions data={data} />;
};
```

### Alignment

You can use `align` to set alignment of key-value. Supporting values including: `center`(default), `justify`, `left`, and `plain`.
When `row` is true, this configuration is invalid

```jsx live=true dir="column"
import React from 'react';
import { Descriptions, Tag } from '@douyinfe/semi-ui';

() => {
    const data = [
        { key: 'Actual Users', value: '1,480,000' },
        { key: '7-day Rentention', value: '98%' },
        { key: 'Security Level', value: 'III' },
        { key: 'Category Tag', value: <Tag style={{ margin: 0 }}>E-commerce</Tag> },
        { key: 'Authorized State', value: 'Unauthorized' },
    ];
    const style = {
        boxShadow: 'var(--semi-shadow-elevated)',
        backgroundColor: 'var(--semi-color-bg-2)',
        borderRadius: '4px',
        padding: '10px',
        margin: '10px',
        width: '240px',
    };
    return (
        <>
            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                <Descriptions align="center" data={data} style={style} />
                <Descriptions align="justify" data={data} style={style} />
                <Descriptions align="left" data={data} style={style} />
                <Descriptions align="plain" data={data} style={style} />
            </div>
        </>
    );
};
```

### Row Display

Set `row` to display the data to two-row, supporting three sizes: `small`, `medium`(default), and `large`.

```jsx live=true dir="column"
import React from 'react';
import { Descriptions } from '@douyinfe/semi-ui';
import { IconArrowUp } from '@douyinfe/semi-icons';

() => {
    const data = [
        { key: 'Actual Users', value: '1,480,000' },
        {
            key: '7-day Rentention',
            value: (
                <span>
                    98%
                    <IconArrowUp size="small" style={{ color: 'red', marginLeft: '4px' }} />
                </span>
            ),
        },
        { key: 'Security Level', value: 'III' },
    ];
    const style = {
        boxShadow: 'var(--semi-shadow-elevated)',
        backgroundColor: 'var(--semi-color-bg-2)',
        borderRadius: '4px',
        padding: '10px',
        marginRight: '20px',
        width: '600px',
    };
    return (
        <div>
            <Descriptions data={data} row size="small" style={style} />
            <br />
            <Descriptions data={data} row style={style} />
            <br />
            <Descriptions data={data} row size="large" style={style} />
        </div>
    );
};
```

### Descriptions Using JSX

Version: >= 1.17.0

```jsx live=true dir="column"
import React from 'react';
import { Descriptions } from '@douyinfe/semi-ui';

() => {
    return (
        <Descriptions>
            <Descriptions.Item itemKey="Actual Users">1,480,000</Descriptions.Item>
            <Descriptions.Item itemKey="7-day Rentention">98%</Descriptions.Item>
            <Descriptions.Item itemKey="Security Level">III</Descriptions.Item>
            <Descriptions.Item itemKey="Category Tag">E-commerce</Descriptions.Item>
            <Descriptions.Item itemKey="Authorized State">Unauthorized</Descriptions.Item>
        </Descriptions>
    );
};
```

### Set layout mode

The layout mode can be set through `layout`, which supports `horizontal` and `vertical` (support after v2.54.0) . Default is `vertical`.     
When horizontal is set, column can be used to specify the maximum number of columns per row.

```jsx live=true dir="column"
import React from 'react';
import { Descriptions, Space, Tag } from '@douyinfe/semi-ui';

() => {
    const data = [
        { key: 'UID', value: 'SemiDesign' },
        { key: 'Anchor Type', value: 'Freelance anchor' },
        { key: 'Security Level', value: 'Level 3' },
        { key: 'Classification', value: <Tag size="small" shape='circle' color='amber'>Tech News</Tag>
           
        },
        { key: 'Videos Count', value: '88888888' },
        { key: 'Certification status', value: 'This is a long, long, long value that needs to be automatically wrapped and displayed.', span: 3 },
    ];
    return (
        <> 
            <Descriptions layout='horizontal' align='plain' data={data} column={4} />
        </>
    );
};

```

## API Reference

### Descriptions

| Properties | Instructions                                                               | type       | Default  |
| ---------- | -------------------------------------------------------------------------- | ---------- | -------- |
| align      | Alignment of the key-value data, one of `center`, `left`, `plain`          | string     | `center` |
| className  | Classname                                                                  | string     | -        |
| data       | Data to display                                                            | DataItem[] | -        |
| row        | Toggle whether to display data in double-row                               | boolean    | `false`  |
| size       | Size of the list for double-row display, one of `small`, `medium`, `large` | string     | `medium` |
| style      | Inline style                                                               | CSSProperties     | -        |
| layout    | List layout mode  **v>=2.54.0**                                         | string        | `vertical` |
| column    | Total number of columns in landscape layout  **v>=2.54.0**                                       | number        | 3          |

### DataItem

| Properties   | Instructions                                                      | type                        | Default |
| ------ | --------------------------------------------------------- | --------------------------- | ------ |
| key    | Key value                                       | ReactNode           | -      |
| value  | Data value                                                | ReactNode \| (() => ReactNode) | -      |
| hidden | Toggle whether the data should be displayed **v>=1.12.0** | boolean                     | -      |
| span   | The number of columns the cell should span **v>=2.54.0**               | number      | 1                 |

### Descriptions.Item

**v>=1.17.0**

| Properties | Instructions                                | type              | Default |
| ---------- | ------------------------------------------- | ----------------- | ------- |
| itemKey    | Key value                         | ReactNode | -       |
| hidden     | Toggle whether the data should be displayed | boolean           | -       |
| className  | Item external wrapper: class name of tr DOM element    | string            | -       |
| style      | Item external wrapper: inline style of tr DOM element  | CSSProperties     | -       |
| span   | The number of columns the cell should span **v>=2.54.0**                | number      | 1                 |

## Content Guidelines

- Field names and values ​​are written in upper and lower case according to the Sentence case principle

## Design Tokens

<DesignToken/>
