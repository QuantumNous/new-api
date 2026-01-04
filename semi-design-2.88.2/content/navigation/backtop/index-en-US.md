---
localeCode: en-US
order: 54
category: Navigation
title: BackTop
subTitle: BackTop
icon: doc-backtop
---

## Demos

### How to import

```jsx
import { BackTop } from '@douyinfe/semi-ui';
```
### Basic Usage

BackTop can be used directly with the default styles.

```jsx live=true
import React from 'react';
import { BackTop } from '@douyinfe/semi-ui';

class Demo extends React.Component {
    render() {
        return (
            <div>
                <span>Scroll down to see the bottom-right gray button.</span>
                <BackTop />
            </div>
        );
    }
}
```

### Customized Style

The default styles for BackTop component could be overwritten.

```jsx live=true
import React from 'react';
import { BackTop } from '@douyinfe/semi-ui';
import { IconArrowUp } from '@douyinfe/semi-icons';

class Custom extends React.Component {
    target() {
        return document.querySelector('.scroll-wrapper');
    }

    render() {
        const style = {
            height: 30,
            width: 30,
            borderRadius: '100%',
            backgroundColor: '#0077fa',
            color: '#fff',
            paddingTop: 5,
            bottom: 100,
        };

        return (
            <div>
                <span>
                    Scroll down to see the bottom-right <span style={{ color: '#0077fa' }}>blue circular</span> button.
                </span>
                <BackTop style={style}>
                    <IconArrowUp />
                </BackTop>
            </div>
        );
    }
}
```

## API Reference

| Properties       | Instructions                                                                    | type     | Default      |
| ---------------- | ------------------------------------------------------------------------------- | -------- | ------------ |
| className        | Class name                                                                      | string   | -            |
| duration         | Time used to scroll to the top.                                                 | number   | 450          |
| style            | Style                                                                           | CSSProperties   | -            |
| target           | A function that returns the DOM element to add listener to its scrolling event. | () => any | () => window |
| visibilityHeight | The scrolling heights to be reached in order to show up BackTop.                | number   | 400          |
| onClick          | The callback to onClick event.                                                  | (e: MouseEvent) => void | -            |
## Design Tokens
<DesignToken/>