---
localeCode: en-US
order: 91
category: Feedback
title: Skeleton
subTitle: Skeleton
icon: doc-skeleton
brief: A placeholder preview of content before the data loaded.
---

## Overview

-   `Avatar`: Avatar placeholder, by default uses Avatar medium sizing: `width: 48px`, `height: 48px`. Supports Avatar's size and shape attributes (after v2.20)
-   `Image`: Image placeholder, default size: `width: 100%`, `height: 100%`.
-   `Title`: Title placeholder, default size: `width: 100%`, `height: 24px`.
-   `Paragraph`: Content part placeholder, default size: `width: 100%`, `height: 16px`, `margin-bottom: 10px`.
-   `Button`: Button placeholder, default size: `width: 115px`, `height: 32px`.

> Note: Default styles could by overwritten through `className` or `style`.

## Demos

### How to import

```jsx
import { Skeleton } from '@douyinfe/semi-ui';
```

### Basic Usage

```jsx live=true
import React from 'react';
import { Skeleton, Switch, Button, Avatar } from '@douyinfe/semi-ui';

class Demo extends React.Component {
    constructor() {
        super();
        this.state = { loading: true };
    }

    showContent() {
        const { loading } = this.state;
        this.setState({
            loading: !loading,
        });
    }

    render() {
        const { loading } = this.state;
        return (
            <>
                <span style={{ display: 'flex', alignItems: 'center' }}>
                    <Switch onChange={() => this.showContent()} />
                    <span style={{ marginLeft: '10px' }}>Show Loading Content</span>
                </span>
                <br />
                <Skeleton placeholder={<Skeleton.Avatar />} loading={loading}>
                    <Avatar color="blue" style={{ marginBottom: 10 }}>
                        U
                    </Avatar>
                </Skeleton>
                <br />
                <Skeleton style={{ width: 200, height: 150 }} placeholder={<Skeleton.Image />} loading={loading}>
                    <img
                        src="https://sf6-cdn-tos.douyinstatic.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/avatarDemo.jpeg"
                        height="150"
                        alt="avatar"
                    />
                </Skeleton>
                <br />
                <Skeleton
                    style={{ width: 80 }}
                    placeholder={<Skeleton.Title style={{ marginBottom: 10 }} />}
                    loading={loading}
                >
                    <h4 style={{ marginBottom: 0 }}>Semi UI</h4>
                </Skeleton>
                <Skeleton style={{ width: 240 }} placeholder={<Skeleton.Paragraph rows={2} />} loading={loading}>
                    <p style={{ width: 240 }}>Carefully polish the user experience of each component.</p>
                </Skeleton>
                <br />
                <Skeleton placeholder={<Skeleton.Button />} loading={loading}>
                    <Button>Button</Button>
                </Skeleton>
            </>
        );
    }
}
```

### Combinations

Image and caption.

```jsx live=true
import React from 'react';
import { Skeleton } from '@douyinfe/semi-ui';

() => {
    const placeholder = (
        <div>
            <Skeleton.Image style={{ width: 200, height: 150 }} />
            <Skeleton.Title style={{ width: 120, marginTop: 10 }} />
        </div>
    );

    return (
        <Skeleton placeholder={placeholder} loading={true}>
            <img
                src="https://sf6-cdn-tos.douyinstatic.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/avatarDemo.jpeg"
                height="150"
                alt="avatar"
            />
            <h4>Semi UI</h4>
        </Skeleton>
    );
};
```

Statistics.

```jsx live=true
import React from 'react';
import { Skeleton, Descriptions } from '@douyinfe/semi-ui';

() => {
    const placeholder = (
        <div>
            <Skeleton.Paragraph rows={1} style={{ width: 80, marginBottom: 10 }} />
            <Skeleton.Title style={{ width: 120 }} />
        </div>
    );

    const data = [{ key: 'Actual User', value: '1,480,000' }];

    return (
        <Skeleton placeholder={placeholder} loading={true}>
            <Descriptions data={data} row />
        </Skeleton>
    );
};
```

Avatar and title.

```jsx live=true
import React from 'react';
import { Skeleton, Avatar } from '@douyinfe/semi-ui';

() => {
    const placeholder = (
        <div style={{ display: 'flex', alignItems: 'center' }}>
            <Skeleton.Avatar style={{ marginRight: 12 }} />
            <Skeleton.Title style={{ width: 120 }} />
        </div>
    );

    return (
        <Skeleton placeholder={placeholder} loading={true}>
            <Avatar color="blue" style={{ marginRight: 12 }}>
                UI
            </Avatar>
            <span>Semi UI</span>
        </Skeleton>
    );
};
```

Centered paragraphs and button.

```jsx live=true
import React from 'react';
import { Skeleton, Button } from '@douyinfe/semi-ui';

() => {
    const style = {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '300px',
        marginBottom: '10px',
    };

    const placeholder = (
        <div style={style}>
            <Skeleton.Paragraph style={style} rows={3} />
            <Skeleton.Button />
        </div>
    );

    return (
        <Skeleton placeholder={placeholder} loading={true} style={{ textAlign: 'center' }}>
            <div style={{ textAlign: 'center' }}>
                <p>Hi, Bytedance dance dance.</p>
                <p>Hi, Bytedance dance dance.</p>
                <Button>Button</Button>
            </div>
        </Skeleton>
    );
};
```

Avatar, headline and paragraph.

```jsx live=true
import React from 'react';
import { Skeleton, Avatar } from '@douyinfe/semi-ui';

() => {
    const style = {
        display: 'flex',
        alignItems: 'flex-start',
    };

    const placeholder = (
        <div style={style}>
            <Skeleton.Avatar style={{ marginRight: 12 }} />
            <div>
                <Skeleton.Title style={{ width: 120, marginBottom: 12, marginTop: 12 }} />
                <Skeleton.Paragraph style={{ width: 240 }} rows={3} />
            </div>
        </div>
    );

    return (
        <Skeleton placeholder={placeholder} loading={true}>
            <div style={style}>
                <Avatar color="blue" style={{ marginRight: 12 }}>
                    UI
                </Avatar>
                <div>
                    <h3>Semi UI</h3>
                    <p>Hi, Bytedance dance dance.</p>
                    <p>Hi, Bytedance dance dance.</p>
                    <p>Hi, Bytedance dance dance.</p>
                </div>
            </div>
        </Skeleton>
    );
};
```

Table.

```jsx live=true
import React from 'react';
import { Skeleton, Table } from '@douyinfe/semi-ui';

() => {
    const data = {
        columns: [
            {
                title: 'Name',
                dataIndex: 'name',
            },
            {
                title: 'Age',
                dataIndex: 'age',
            },
            {
                title: 'Address',
                dataIndex: 'address',
            },
        ],
        content: [
            {
                key: '1',
                name: 'John Brown',
                age: 32,
                address: 'New York No. 1 Lake Park, New York No. 1 Lake Park',
            },
            {
                key: '2',
                name: 'Jim Green',
                age: 42,
                address: 'London No. 1 Lake Park',
            },
            {
                key: '3',
                name: 'Joe Black',
                age: 32,
                address: 'Sidney No. 1 Lake Park',
            },
            {
                key: '4',
                name: 'Disabled User',
                age: 99,
                address: 'Sidney No. 1 Lake Park',
            },
        ],
    };

    const skData = {
        columns: [1, 2, 3].map(key => {
            const item = {};
            item.title = <Skeleton.Title style={{ width: '0' }} />;
            item.dataIndex = key;
            return item;
        }),
        dataSource: [1, 2, 3, 4].map(key => {
            const item = {};
            item.key = key;
            [1, 2, 3].forEach(i => {
                const width = 50 * i;
                item[i] = <Skeleton.Paragraph style={{ width: width }} rows={1} />;
            });
            return item;
        }),
    };

    const placeholder = (
        <div style={{ position: 'relative' }}>
            <Table
                style={{ backgroundColor: 'var(--semi-color-bg-1)' }}
                columns={skData.columns}
                dataSource={skData.dataSource}
                pagination={false}
            />
            <div style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}></div>
        </div>
    );

    return (
        <Skeleton placeholder={placeholder} loading={true}>
            <div>
                <Table columns={data.columns} dataSource={data.content} pagination={false} />
            </div>
        </Skeleton>
    );
};
```

### Animated Loading

Use `active` property to display animated loading effects.

```jsx live=true hideInDSM
import React from 'react';
import { Skeleton, Avatar } from '@douyinfe/semi-ui';

() => {
    const style = {
        display: 'flex',
        alignItems: 'flex-start',
    };

    const placeholder = (
        <div style={style}>
            <Skeleton.Avatar style={{ marginRight: 12 }} />
            <div>
                <Skeleton.Title style={{ width: 120, marginBottom: 12, marginTop: 12 }} />
                <Skeleton.Paragraph style={{ width: 240 }} rows={3} />
            </div>
        </div>
    );

    return (
        <Skeleton placeholder={placeholder} loading={true} active>
            <div style={style}>
                <Avatar color="blue" style={{ marginRight: 12 }}>
                    UI
                </Avatar>
                <div>
                    <h3>Semi UI</h3>
                    <p>Hi, Bytedance dance dance.</p>
                    <p>Hi, Bytedance dance dance.</p>
                    <p>Hi, Bytedance dance dance.</p>
                </div>
            </div>
        </Skeleton>
    );
};
```

## API reference

### Skeleton

| Property | Instructions | type | Default |
| --- | --- | --- | --- |
| active | Toggle whether to show the animated loading effect | boolean | false |
| class Name | Class name | string | - |
| loading | When set to true, the placeholder element is displayed. Otherwise, child element is displayed | boolean | true |
| placeholder | Elements to be displayed while loading | ReactNode | - |
| style | Inline style | CSSProperties | - |

### Skeleton.Avatar

> `Skeleton.Image`,`Skeleton.Title`，`Skeleton.Button` have same APIs with `Skeleton.Avatar`. `shape` only supported in `Skeleton.Avatar`  

| Property | Instructions | type | Default |
| --- | --- | --- | --- |
| class Name | Class name | string | - |
| size | Size of the avatar, one of `extra-extra-small`, `extra-small`, `small`, `medium`, `large`, `extra-large` | string | `medium` |
| style | Inline style | CSSProperties | - |
| shape | Shape of the avatar, one of `circle`, `square` | string | `circle` |

### Skeleton.Paragraph

| Property  | Instructions                                        | type          | Default |
| --------- | --------------------------------------------------- | ------------- | ------- |
| className | Class name                                          | string        | -       |
| rows      | Set the number of rows in the placeholder paragraph | number        | 4       |
| style     | Inline style                                        | CSSProperties | -       |

## Content Guidelines

-   Unchanged fixed content directly displays fixed content, and variable content is displayed using skeleton screen

## Design Tokens

<DesignToken/>
