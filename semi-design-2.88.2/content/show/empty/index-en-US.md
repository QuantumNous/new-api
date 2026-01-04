---
localeCode: en-US
order: 70
category: Show
title: Empty
subTitle: Empty
icon: doc-empty
dir: column
brief: Placeholder component when the page is empty.
---

## Demos

### How to import

```jsx import
import { Empty } from '@douyinfe/semi-ui';
```

### Basic usage

By setting a placeholder image with `image`, you can manually import the corresponding illustration from `@douyinfe/semi-illustrations` (the default width and height of the illustration is 200x200), or you can import a custom illustration.

After **v>=1.13.0**, a series of dark mode illustrations are added, and the illustrations that need to be used in dark mode can be passed in through `darkModeImage` to better adapt to the dark mode.

```jsx live=true dir="column"
import React from 'react';
import { Empty } from '@douyinfe/semi-ui';
import { IllustrationConstruction, IllustrationConstructionDark } from '@douyinfe/semi-illustrations';

() => (
    <Empty
        image={<IllustrationConstruction style={{ width: 150, height: 150 }} />}
        darkModeImage={<IllustrationConstructionDark style={{ width: 150, height: 150 }} />}
        title={'Function under construction'}
        description="The current function is not yet open, so stay tuned."
    />
);
```

### Custom content

Custom description content can be achieved through `children`.

```jsx live=true dir="column"
import React from 'react';
import { Empty, Button } from '@douyinfe/semi-ui';
import { IllustrationNoContent, IllustrationNoContentDark } from '@douyinfe/semi-illustrations';

() => (
    <Empty
        image={<IllustrationNoContent style={{ width: 150, height: 150 }} />}
        darkModeImage={<IllustrationNoContentDark style={{ width: 150, height: 150 }} />}
        title="Empty status header"
        description="Start creating your first dashboard!"
    >
        <div>
            <Button style={{ padding: '6px 24px', marginRight: 12 }} type="primary">
                Secondary button
            </Button>
            <Button style={{ padding: '6px 24px' }} theme="solid" type="primary">
                Level 1 button
            </Button>
        </div>
    </Empty>
);
```

It is not necessary to use pictures.

```jsx live=true dir="column"
import React from 'react';
import { Empty, Typography } from '@douyinfe/semi-ui';

() => (
    <Empty
        title="No matching filter results found yet"
        description={
            <span>
                <Typography.Text>Try</Typography.Text>
                <Typography.Text link>Reset filter</Typography.Text>
            </span>
        }
    />
);
```

### Different layout

Two types of layouts are supported: `vertical`, `horizontal`. The default is `vertical`.

```jsx live=true dir="column"
import React from 'react';
import { Empty, Button } from '@douyinfe/semi-ui';
import { IllustrationSuccess, IllustrationSuccessDark } from '@douyinfe/semi-illustrations';

() => (
    <Empty
        title={'Created successfully'}
        image={<IllustrationSuccess style={{ width: 150, height: 150 }} />}
        darkModeImage={<IllustrationSuccessDark style={{ width: 150, height: 150 }} />}
        layout="horizontal"
        description="This is a very long description text. This layout is recommended when the text is too long. This is a very long description text. This layout is recommended when the text is too long. This is a very long description text. This layout is recommended when the text is too long."
        style={{ width: 800, margin: '0 auto' }}
    >
        <Button type="primary" theme="solid" style={{ padding: '6px 24px' }}>
            Start operation
        </Button>
    </Empty>
);
```

### Placeholder illustration (under construction)

Currently the following illustrations are supported in `@douyinfe/semi-illustrations`.

```jsx live=true dir="column"
import React from 'react';
import { Empty } from '@douyinfe/semi-ui';
import { IllustrationConstruction, IllustrationSuccess, IllustrationFailure, IllustrationNoAccess, IllustrationNoContent, IllustrationNotFound, IllustrationNoResult } from '@douyinfe/semi-illustrations';

/* The following is available after version 1.13.0 */
import { IllustrationIdle, IllustrationIdleDark, IllustrationConstructionDark, IllustrationSuccessDark, IllustrationFailureDark, IllustrationNoAccessDark, IllustrationNoContentDark, IllustrationNotFoundDark, IllustrationNoResultDark } from '@douyinfe/semi-illustrations';

() => {
    const emptyStyle = {
        padding: 30,
    };
    return (
        <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            <Empty
                image={<IllustrationSuccess style={{ width: 150, height: 150 }} />}
                darkModeImage={<IllustrationSuccessDark style={{ width: 150, height: 150 }} />}
                description={'Created successfully'}
                style={emptyStyle}
            />
            <Empty
                image={<IllustrationFailure style={{ width: 150, height: 150 }} />}
                darkModeImage={<IllustrationFailureDark style={{ width: 150, height: 150 }} />}
                description={'Failed to load'}
                style={emptyStyle}
            />
            <Empty
                image={<IllustrationNoAccess style={{ width: 150, height: 150 }} />}
                darkModeImage={<IllustrationNoAccessDark style={{ width: 150, height: 150 }} />}
                description={'Permission denied'}
                style={emptyStyle}
            />
            <Empty
                image={<IllustrationNoContent style={{ width: 150, height: 150 }} />}
                darkModeImage={<IllustrationNoContentDark style={{ width: 150, height: 150 }} />}
                description={'No content, please add'}
                style={emptyStyle}
            />
            <Empty
                image={<IllustrationNotFound style={{ width: 150, height: 150 }} />}
                darkModeImage={<IllustrationNotFoundDark style={{ width: 150, height: 150 }} />}
                description={'Page 404'}
                style={emptyStyle} />
            <Empty
                image={<IllustrationNoResult style={{ width: 150, height: 150 }} />}
                darkModeImage={<IllustrationNoResultDark style={{ width: 150, height: 150 }} />}
                description={'No search results'}
                style={emptyStyle} />
            <Empty
                image={<IllustrationConstruction style={{ width: 150, height: 150 }} />}
                darkModeImage={<IllustrationConstructionDark style={{ width: 150, height: 150 }} />}
                description={'under construction'}
                style={emptyStyle} />
            <Empty
                image={<IllustrationIdle style={{ width: 150, height: 150 }} />}
                darkModeImage={<IllustrationIdleDark style={{ width: 150, height: 150 }} />}
                description={'Wandering Quartet'}
                style={emptyStyle} />
        </div>
    );
};
```

## API reference

| Property | Description | Type | Default |
| --- | --- | --- | --- |
| className | class name | string |-|
| darkModeImage | The placeholder image after the dark mode is turned on, in response to the change of the theme-mode property of document.body | ReactNode |-|
| description | Content description | ReactNode |-|
| image | Placeholder image | ReactNode \| { id?: string; viewBox?: string; url?: string;} |-|
| imageStyle | Placeholder image style | CSSProperties |-|
| layout | Layout mode, support `vertical`, `horizontal` | string | `vertical` |
| style | Style name | CSSProperties |-|
| title | Title | ReactNode |-|

## Accessibility

### ARIA

- aria-hidden for Empty illustrations is true

## Content Guidelines

- Title
  - The title should be concise and easy to understand
- Text
  - The specific reasons for displaying the empty state can be displayed, and the subsequent operation behavior can also be displayed to help the user eliminate the empty state
  - Don't repeat the content on the title
  - Try to keep the body text within 1-2 sentences
- Action button
  - Button copy needs to be clear and easy to understand
  - Use the verb + noun format

## Design Token

<DesignToken/>

## FAQ
