---
localeCode: en-US
order: 93
category: Feedback
title: Toast
subTitle: Toast
icon: doc-toast
width: 65%
brief: Toast component is used to give timely feedback to user's operations. It could be the result feedback of the operation, such as success, failure, error, warning, etc.
---

## Demos

### How to import

Calling Toast's related methods to show timely feedback to user's operations.
It is recommended to set the `stack` property to apply the stacking style to multiple Toasts on the same screen, and expand them by hovering, which can effectively prevent multiple parallel Toasts at one time. (this API is supported after v2.42.0)

```jsx
import { Toast } from '@douyinfe/semi-ui';
```

### Basic Usage

```jsx live=true noInline=true
import React from 'react';
import { Toast, Button } from '@douyinfe/semi-ui';
import { throttle } from 'lodash-es';

function Demo() {
    const opts = {
        content: 'Hi, Bytedance dance dance',
        duration: 3,
        stack: true,
    };

    const handleClose = () => {
        throttled.cancel();
    };
    const throttleOpts = {
        content: 'Hi, Bytedance dance dance',
        duration: 10,
        onClose: handleClose,
        stack: true,
    };
    const throttled = throttle(() => Toast.info(throttleOpts), 10000, { trailing: false });

    return (
        <div>
            <Button onClick={() => Toast.info(opts)}>Display Toast</Button>
            <br />
            <br />
            <Button onClick={throttled}>Throttled Toast</Button>
        </div>
    );
}
render(Demo);
```

### Other Types

Use different methods to show different Toast including success, warning, error and info.

```jsx live=true noInline=true
import React from 'react';
import { Toast, Button } from '@douyinfe/semi-ui';

function Demo() {
    let opts = {
        content: 'Hi, Bytedance dance dance',
        duration: 3,
    };

    return (
        <>
            <Button style={{ color: `var(--semi-color-success)` }} onClick={() => Toast.success('Hi,Bytedance dance dance')}>Success</Button>
            <br />
            <br />
            <Button type="warning" onClick={() => Toast.warning(opts)}>
                Warning
            </Button>
            <br />
            <br />
            <Button type="danger" onClick={() => Toast.error(opts)}>
                Error
            </Button>
        </>
    );
}
render(Demo);
```

### Colored Background

You could use `theme` for a colored background style. Default is `normal`.

```jsx live=true noInline=true
import React from 'react';
import { Toast, Button } from '@douyinfe/semi-ui';

function Demo() {
    let opts = {
        content: 'Hi, Bytedance dance dance',
        duration: 3,
        theme: 'light',
    };

    return (
        <>
            <Button onClick={() => Toast.info(opts)}>Info</Button>
            <br />
            <br />
            <Button style={{ color: `var(--semi-color-success)` }} onClick={() => Toast.success(opts)}>Success</Button>
            <br />
            <br />
            <Button type="warning" onClick={() => Toast.warning(opts)}>
                Warning
            </Button>
            <br />
            <br />
            <Button type="danger" onClick={() => Toast.error(opts)}>
                Error
            </Button>
        </>
    );
}
render(Demo);
```

### Stacking styles
You can apply stacking styles to multiple Toasts on the same screen through the stack property, and Hover expands them. （>=2.42.0）


```jsx live=true
import { Toast, Typography, Button } from '@douyinfe/semi-ui';

()=>{
    
    const opts = {
        content: 'Hi, Bytedance dance dance',
        duration: 10,
        stack: true,
    };

    
    return <Button onClick={() => {
         Toast.info(opts)
    }}>Click multiple times</Button>
}

```

### Custom Children with Link

Informational feedback

```jsx live=true noInline=true
import React from 'react';
import { Toast, Typography, Button } from '@douyinfe/semi-ui';

function Demo() {
    const { Text } = Typography;

    let opts = {
        content: (
            <span>
                <Text>Hi, Bytedance dance dance</Text>
                <Text link style={{ marginLeft: 12 }}>
                    More Info
                </Text>
            </span>
        ),
        duration: 3,
    };

    let multiLineOpts = {
        content: (
            <>
                <div>Hi, Bytedance dance dance</div>
                <div style={{ marginTop: 8 }}>
                    <Text link>More Info</Text>
                    <Text link style={{ marginLeft: 20 }}>
                        Later
                    </Text>
                </div>
            </>
        ),
        duration: 3,
    };

    return (
        <>
            <Button onClick={() => Toast.info(opts)}>Display Toast</Button>
            <br />
            <br />
            <Button onClick={() => Toast.info(multiLineOpts)}>Display Multi-line Toast</Button>
        </>
    );
}
render(Demo);
```

### Delay

Use `duration` to set up time delay. By default it closes after 3 seconds.

```jsx live=true noInline=true hideInDSM
import React from 'react';
import { Toast, Button } from '@douyinfe/semi-ui';

function Demo() {
    let opts = {
        content: 'Hi, Bytedance dance dance',
        duration: 10,
    };

    return <Button onClick={() => Toast.info(opts)}>Close After 10s</Button>;
}
render(Demo);
```

### Manual Close

Set `duration` to 0 if you do not want the Notification to close by itself. In this case, it could only be closed manually.

```jsx live=true noInline=true hideInDSM
import React, { useState } from 'react';
import { Toast, Button } from '@douyinfe/semi-ui';

function Demo() {
    const [toastId, setToastId] = useState();
    function show() {
        if (toastId) {
            return;
        }
        let id = Toast.info(opts);
        setToastId(id);
    }
    function hide() {
        Toast.close(toastId);
        destroy();
    }
    function destroy() {
        setToastId(null);
    }
    let opts = {
        content: 'Not auto close',
        duration: 0,
        onClose: destroy,
    };
    return (
        <>
            <Button type="primary" onClick={show}>
                Show Toast
            </Button>
            <br />
            <br />
            <Button type="primary" onClick={hide}>
                Hide Toast
            </Button>
        </>
    );
}

render(Demo);
```

### Update Toast Content

Use unique Toast `id` to update toast content.

```jsx live=true noInline=true hideInDSM
import React, { useState } from 'react';
import { Toast, Button } from '@douyinfe/semi-ui';

function Demo() {
    function show() {
        const id = 'toastid';
        Toast.info({ content: 'Update Content By Id', id });
        setTimeout(() => {
            Toast.success({ content: 'Id By Content Update', id });
        }, 1000);
    }

    return (
        <Button type="primary" onClick={show}>
            Update Content By Id
        </Button>
    );
}

render(Demo);
```

### Destroy all

Globally Destroy (>= 0.25.0):

-   `Toast.destroyAll()`


### Consume Context

You could use `Toast.useToast` to create a `contextHolder` that could access context. Created toast will be inserted to where contextHolder is placed.

```jsx live=true noInline=true hideInDSM
import React from 'react';
import { Toast, Button } from '@douyinfe/semi-ui';

const ReachableContext = React.createContext();

function Demo(props = {}) {
    const [toast, contextHolder] = Toast.useToast();
    const config = {
        duration: 0,
        title: 'This is a success message',
        content: <ReachableContext.Consumer>{name => `ReachableContext: ${name}`}</ReachableContext.Consumer>,
    };

    return (
        <ReachableContext.Provider value="Light">
            <div>
                <Button
                    onClick={() => {
                        toast.success(config);
                    }}
                >
                    Hook Toast
                </Button>
            </div>
            {contextHolder}
        </ReachableContext.Provider>
    );
}

render(Demo);
```


### Create Toast with different configurations

<Notice>
Commonly used to override global configuration
</Notice>

-   `ToastFactory.create(config) => Toast`  
    If you need Toast with different configs in your application, you can use ToastFactory.create(config)to create a new Toast (>= 1.23):

```jsx live=true noInline=true
import React from 'react';
import { Button, ToastFactory } from '@douyinfe/semi-ui';

function Demo() {
    const ToastInCustomContainer = ToastFactory.create({
        getPopupContainer: () => document.getElementById('custom-toast-container'),
    });
    return (
        <div>
            <Button onClick={() => Toast.info('Toast')}>Default Toast</Button>
            <br />
            <br />
            <Button onClick={() => ToastInCustomContainer.info('Toast in some container')}>
                Toast in custom container
            </Button>
            <div id="custom-toast-container">custom container</div>
        </div>
    );
}
render(Demo);
```

Globally Destroy (>= 0.25.0):

-   `Toast.destroyAll()`

Consume Context

-   `Toast.useToast` **v>=1.2.0**  
    When you need access Context, you could use `Toast.useToast` to create a `contextHolder` and insert to corresponding DOM tree. Toast created by hooks will be able to access the context where `contextHolder` is inserted. Hook toast has following methods: `info`, `success`, `warning`, `error`, `close`.


## API Reference

The static methods provided are as follows: Display: You can pass in `options` object or string directly. Methods return the value of `toastId`: `const toastId = Toast.info({ /*...options*/ })`

**The global configuration is set before any method call, and takes effect only once (>= 0.25.0)**
-   `Toast.config(config)`

** Show Toast Directly

-   `Toast.info(options || string)`
-   `Toast.error(options || string)`
-   `Toast.warning(options || string)`
-   `Toast.success(options || string)`

**`info` `error` `warning` `success` return the `toastId`, can be used for manually closing **
- `Toast.close(toastId)`  Close Manually 


## Options

**Toast Options supports the following APIs as well as the APIs in Config**

| Properties | Instructions                                       | type | Default | version |
| --- |----------------------------------------------------| --- | --- |---------|
| content | Toast content                                      | string | ReactNode | ''      |  |
| icon | Custom icons                                       | ReactNode |  | 0.25.0  |
| showClose | Toggle Whether show close button                   | boolean | true | 0.25.0  |
| textMaxWidth | Maximum width of content                           | number \| string | 450 | 0.25.0  |
| onClose | Callback function when closing toast               | () => void |  |         |
| stack | Whether to stack toast                             | boolean | false | 2.42.0  |
| id           | Custom ToastId   | number        |  |  |

## Config

**The following API supports global configuration to change the default configuration of the current Toast**

| Properties | Instructions                                                                                                                                                | type | Default | version |
| --- |-------------------------------------------------------------------------------------------------------------------------------------------------------------| --- | --- | --- |
| bottom | Pop-up position bottom                                                                                                                                      | number \| string | - | 0.25.0 |
| left | Pop-up position left                                                                                                                                        | number \| string | - | 0.25.0 |
| right | Pop-up position right                                                                                                                                       | number \| string | - | 0.25.0 |
| top | Pop-up position top                                                                                                                                         | number \| string | - | 0.25.0 |
| zIndex | Z-index value                                                                                                                                               | number | 1010 |  |
| theme | Style of background fill, one of `light`, `normal` | string | `normal` | 2.54.0   |
| duration | Automatic close delay, no auto-close when set to 0 | number | 3 |         |
| getPopupContainer | Specifies the parent DOM, and the bullet layer will be rendered to the DOM, you need to set container and inner .semi-toast-wrapper  'position: relative`   This will change the DOM tree position, but not the view's rendering position.  | () => HTMLElement \| null | () => document.body | 0.34.0 |
## Accessibility

### ARIA

- The role of Toast is alert

## Content Guidelines

<div style={{ border: '1px solid var(--semi-color-border)', padding: 10, marginBottom: 24, justifyContent: 'center', display: 'flex' }}>
    <ToastCard type='success' content='Ticket transferred' />
</div>

- Keep it simple
- Do not use periods at the end of sentences
- Explain using the noun + verb format

| ✅ Recommended usage | ❌ Deprecated usage |
| --- | --- |
| Language added | New language has been added successfully |
| Ticket transfer failed | Can't transfer ticket |

- Provide prompt message for action
  - only provide one action
  - Don't use actions like "read" like OK, Got it, Dismiss, Cancel

| ✅ Recommended usage | ❌ Deprecated usage |
| --- | --- |
|  <ToastCard type='error' content={<div>Ticket transfer failed <span style={{ color: 'var(--semi-color-primary)', marginLeft: 4, cursor: 'pointer' }}>Retry</span> </div>} /> |  <ToastCard type='error' content={<div>Ticket transfer failed <span style={{ color: 'var(--semi-color-primary)', marginLeft: 4, cursor: 'pointer' }}>Dismiss</span> </div>} /> |

## Design Tokens

<DesignToken/>
