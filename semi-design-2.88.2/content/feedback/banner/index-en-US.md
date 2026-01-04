---
localeCode: en-US
order: 86
category: Feedback
title:  Banner
subTitle: Banner
icon: doc-banner
dir: column
brief: The Banner component is usually used to identify the status or notification of the full page. It is usually resident and requires the user to close it initiatively.
---


## Demos

### How to import

```jsx import
import { Banner } from '@douyinfe/semi-ui';
```

### Basic Usage

```jsx live=true dir="column"
import React, { useState } from 'react';
import { Banner, Layout, Button } from '@douyinfe/semi-ui';

() => {
    const [visible, setVisible] = useState(false);
    const changeVisible = () => {
        setVisible(!visible);
    };
    const { Header, Footer, Content } = Layout;
    const banner = (
        <Banner 
            onClose={changeVisible}
            description="A pre-released version is available"
        />
    );
    return (
        <>
            <Layout className='components-layout-demo banner-basic'>
                <Header>Header</Header>
                {visible? banner : null}
                <Content>Content</Content>
                <Footer>Footer</Footer>
            </Layout>
            <Button
                onClick={changeVisible}
                style={{
                    display: 'block',
                    width: '120px',
                    margin: '0 auto'
                }}
            >
                { visible ? 'Hide Banner' : 'Show Banner' }
            </Button>
        </>
    );
};
```

### Types

The `type` prop supports one of: `default`(default),`danger`,`warning`, `success`.

```jsx live=true dir="column"
import React from 'react';
import { Banner } from '@douyinfe/semi-ui';

() => (
    <>
        <Banner 
            type="info"
            description="A pre-released version is available."
        />
        <br/>
        <Banner 
            type="warning"
            description="This version of the document is going to expire after 4 days."
        />
        <br/>
        <Banner 
            type="danger"
            description="This document was deprecated since Jan 1, 2019."
        />
        <br/>
        <Banner 
            type="success"
            description="You are viewing the latest version of this document."
        />
    </>
);
```


### Use in Container
You could set  `fullMode={false}` to use style for non-fullscreen mode。
Also, use `bordered` for bordered style.

```jsx live=true dir="column"
import React from 'react';
import { Banner, Typography } from '@douyinfe/semi-ui';

function Demo() {
    const { Text } = Typography;
  
    return (
        <div style={{ width: 640 }} className="components-banner-demo">
            <Banner fullMode={false} type="info" bordered icon={null} closeIcon={null}
                title={<div style={{ fontWeight: 600, fontSize: '14px', lineHeight: '20px' }}>{`Don't know AppKey?`}</div>}
                description={<div>You can contact the corresponding R & D students to confirm whether you have applied for an application on <Text link={{ href: 'https://semi.design/' }}>the application cloud platform</Text> , and fill in the corresponding information.</div>}
            /><br/>
            <Banner fullMode={false} type="warning" bordered icon={null} closeIcon={null}
                title={<div style={{ fontWeight: 600, fontSize: '14px', lineHeight: '20px' }}>{`Don't know AppKey?`}</div>}
                description={<div>You can contact the corresponding R & D students to confirm whether you have applied for an application on <Text link={{ href: 'https://semi.design/' }}>the application cloud platform</Text> , and fill in the corresponding information.</div>}
            /><br/>
            <Banner fullMode={false} type="danger" bordered icon={null} closeIcon={null}
                title={<div style={{ fontWeight: 600, fontSize: '14px', lineHeight: '20px' }}>{`Don't know AppKey?`}</div>}
                description={<div>You can contact the corresponding R & D students to confirm whether you have applied for an application on <Text link={{ href: 'https://semi.design/' }}>the application cloud platform</Text> , and fill in the corresponding information.</div>}
            /><br/>
            <Banner fullMode={false} type="success" bordered icon={null} closeIcon={null}
                title={<div style={{ fontWeight: 600, fontSize: '14px', lineHeight: '20px' }}>{`Don't know AppKey?`}</div>}
                description={<div>You can contact the corresponding R & D students to confirm whether you have applied for an application on <Text link={{ href: 'https://semi.design/' }}>the application cloud platform</Text> , and fill in the corresponding information.</div>}
            />
        </div>
    );
}
```

```css
.components-banner-demo {
    .semi-banner-info.semi-banner-bordered {
        border: 1px solid var(--semi-color-primary-disabled);
    }
    .semi-banner-warning.semi-banner-bordered {
        border: 1px solid var(--semi-color-warning-light-active);
    }
    .semi-banner-danger.semi-banner-bordered {
        border: 1px solid var(--semi-color-danger-light-active);
    }
    .semi-banner-success.semi-banner-bordered {
        border: 1px solid var(--semi-color-success-light-active);
    }
}
```

### Customized Content
Use `children` to create customized content.
```jsx live=true dir="column"
import React from 'react';
import { Banner } from '@douyinfe/semi-ui';

() => (
    <div style={{ width: 500, padding: 20, border: '1px solid var(--semi-color-border)' }}>
        <Banner
            fullMode={false}
            title="Title"
            type="warning"
            bordered
            description="Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat"
        >
            <div className="semi-modal-footer">
                <button className="semi-button semi-button-tertiary semi-button-light" type="button">No, thanks.</button>
                <button className="semi-button semi-button-warning" type="button">Sounds great!</button>
            </div>
        </Banner>
        <br/>
    </div>
);
```

## API Reference

| Properties | Instructions                                                                             | Type     | Default               | Version | 
| ---------- | ---------------------------------------------------------------------------------------- | -------- | --------------------- | --- |
| bordered | Toggle if show border, only affects in non-fullscreen mode | boolean | false | 1.0 |
| className | Classname | string | - |- |
| closeIcon | Custom close icon，no icon if passed null | ReactNode | - | 1.0 |
| description | Description texts | ReactNode | - | 1.0 |
| fullMode| Toggle if banner is full screen | boolean | true | 1.0 |
| icon | Custom icon, no icon if passed null | ReactNode | - | 1.0 |
| onClose | Callback function when close banner | function | - |- |
| style | Style | object | - |- |
| title | Title | ReactNode | - | 1.0 |
| type | Type of banner, one of `info`, `success`, `danger`, `warning` | string | `info` | - |

## Accessibility

### ARIA

- The component has a `role` of 'alert'.
- The close icon has a `aria-label` of 'Close'.

### Keyboard and Focus

- The close button of the Banner can be focused with the `Tab` key. After the button is focused, hit the `Enter` key or the `Space` key to close the banner.

## Content Guidelines

- Full screen Banner
  - Try to keep the content displayed completely on one line
  - Use correct punctuation, commas within sentences and periods between sentences
- Non-fullscreen Banner
  - title
    - Instructions in condensed language
    - Try to avoid using commas, periods and other punctuation marks in the title, and support the use of question marks at the end when there are and only interrogative sentences
  - text
    - On the premise of complete information transmission, try to compress the text to 1-2 sentences
    - A detailed description or explanation of the title, rather than a repetition of the title
    - Use correct punctuation, commas within sentences and periods between sentences

## Design Tokens

<DesignToken/>