---
localeCode: en-US
order: 87
category: Feedback
title:  Notification
subTitle: Notification
icon: doc-notification
width: 65%
brief: Notifications are used to actively send message notifications to users.
---


## Demos

### How to import

```jsx import
import { Notification } from '@douyinfe/semi-ui';
```
### Basic Usage

Close after 3 seconds.

```jsx live=true
import React from 'react';
import { Notification, Button } from '@douyinfe/semi-ui';

() => (
    <Button
        onClick={()=> Notification.open({
            title: 'Hi, Bytedance',
            content: 'ies dance dance dance',
            with: 3
        })}
    >
        Display Notification
    </Button>
);

```

### Position

Use `position` to set pop up position, supporting one of: `top`、`bottom`、`topLeft`、`topRight`(default)、`bottomLeft`、`bottomRight`。

```jsx live=true
import React from 'react';
import { Notification, Button, ButtonGroup } from '@douyinfe/semi-ui';

() => {
    let opts = {
        with: 3,
        Position: 'topRight',
        content: 'semi-ui-notification',
        title: 'Hi bytedance',
    };

    return (
        <>
            <ButtonGroup>
                <Button onClick={() => Notification.info({ ...opts, position: 'top' })}>top</Button>
                <Button onClick={() => Notification.info({ ...opts, position: 'topLeft' })}>topLeft</Button>
                <Button onClick={() => Notification.info(opts)}>topRight</Button>
            </ButtonGroup>
            <br/><br/>
            <ButtonGroup>
                <Button onClick={() => Notification.info({ ...opts, position: 'bottom' })}>bottom</Button>
                <Button onClick={() => Notification.info({ ...opts, position: 'bottomRight' })}>bottomRight</Button>
                <Button onClick={() => Notification.info({ ...opts, position: 'bottomLeft' })}>bottomLeft</Button>
            </ButtonGroup>
        </>
    );
};
```

### With Icons

Use different methods to show Notification with icons or you can pass in `icon` for customized icon.

```jsx live=true
import React from 'react';
import { Notification, Button } from '@douyinfe/semi-ui';
import { IconToutiaoLogo, IconVigoLogo } from '@douyinfe/semi-icons';

() => {
    let opts = {
        title: 'Hi, Bytedance',
        content: 'ies dance dance dance',
        duration: 3,
    };

    return (
        <>
            <h5>Default Icon</h5>
            <Button type='primary' onClick={()=>Notification.success(opts)} style={{ margin: 4 }}>
                Success
            </Button>
            <Button onClick={() => Notification.info(opts)} style={{ margin: 4 }}>
                Info
            </Button>
            <Button type="warning" onClick={()=>Notification.warning(opts)} style={{ margin: 4 }}>
                Warning
            </Button>
            <Button type="danger" onClick={()=>Notification.error(opts)} style={{ margin: 4 }}>
                Error
            </Button>
            <h5>Customized Icon</h5>
            <Button
                icon={<IconToutiaoLogo />}
                style={{ marginRight: 5 }}
                onClick={() =>
                    Notification.info({
                        ...opts,
                        icon: <IconToutiaoLogo style={{ color: 'red' }} />,
                    })
                }
            ></Button>
            <Button
                icon={<IconVigoLogo />}
                style={{ marginRight: 5 }}
                onClick={() => Notification.info({ ...opts, icon: <IconVigoLogo /> })}
            ></Button>
            <Button
                icon={<IconVigoLogo />}
                onClick={() => Notification.info({ ...opts, icon: <IconVigoLogo style={{ color: 'pink' }} /> })}
            ></Button>
        </>
    );
};
```

### Colored Background
You could use `theme` for a colored background style. Default is `normal`.

```jsx live=true
import React from 'react';
import { Notification, Button } from '@douyinfe/semi-ui';

() => {
    let opts = {
        title: 'Hi, Bytedance',
        content: 'Hi, Bytedance dance dance',
        duration: 3,
        theme: 'light'
    };

    return (
        <>
            <Button onClick={() => Notification.info(opts)}>
                Info
            </Button>
            <br/>
            <br/>
            <Button onClick={() => Notification.success(opts)}>
                Success
            </Button>
            <br/>
            <br/>
            <Button type="warning" onClick={() => Notification.warning(opts)}>
                Warning
            </Button>
            <br/>
            <br/>
            <Button type="danger" onClick={() => Notification.error(opts)}>
                Error
            </Button>
        </>
    );
};
```

### Custom Children with Link

Use with Typography to create operation links for more complicated situations.

```jsx live=true
import React from 'react';
import { Notification, Button, Typography } from '@douyinfe/semi-ui';

() => {
    const { Text } = Typography;

    let opts = {
        title: 'This is a title',
        content: (
            <>
                <div>Hi, Bytedance dance dance</div>
                <div style={{ marginTop: 8 }}>
                    <Text link>More Info</Text>
                    <Text link style={{ marginLeft: 20 }}>Show Later</Text>
                </div>
            </>),
        duration: 3,
    };

    return (
        <Button
            onClick={() => Notification.info(opts)}
        >
            Display Notification
        </Button>
    );
};
```

### Delay

Use `duration` to set up time delay. By default it closes after 3 seconds.

```jsx live=true
import React from 'react';
import { Notification, Button } from '@douyinfe/semi-ui';

() => {
    let opts = {
        content: 'Hi, Bytedance dance dance',
        duration: 10,
    };

    return (
        <Button onClick={() => Notification.info(opts)}>
            Close After 10s
        </Button>
    );
};
```

### Manual Close

Set `duration` to 0 if you do not want the Notification to close by itself. In this case, it could only be closed manually.

```jsx live=true
import React from 'react';
import { Notification, Button } from '@douyinfe/semi-ui';

() => {
    let opts = {
        content: 'Not auto close',
        title: 'Hi',
        duration: 0,
    };
    const [ids, setIds] = useState([]);
    function show() {
        let id = Notification.info(opts);
        setIds([...ids, id]);
    }
    function hide() {
        let idsTmp = [...ids];
        Notification.close(idsTmp.shift());
        setIds(idsTmp);
    }
    return (
        <>
            <Button type="primary" onClick={show}>
                Show Notification
            </Button>
            <br />
            <br />
            <Button type="primary" onClick={hide}>
                Hide Notification
            </Button>
        </>
    );
};
```

### Update content

You can use id to update notification content. >=2.45.0

```jsx live=true
import React from 'react';
import { Notification, Button } from '@douyinfe/semi-ui';

() => (
    <Button
        onClick={() => {
            const id = Notification.open({
                title: 'Hi, Bytedance',
                content: 'ies dance dance dance',
                duration: 3,
            })
            setTimeout(() => {
                Notification.open({
                    title: 'Hi, Bytedance',
                    content: 'updated',
                    duration: 10,
                    id
                })
            }, 1000)
        }
        }
    >
        Display Notification
    </Button>
);


```

## API Reference

The static methods provided are as follows:

Display: You can pass in options object directly. Methods return the value of `id`: `const id = Notification.open({ /*...options*/ })`

-   `Notification.open({content: 'message', duration: 3})`
-   `Notification.info({content: 'message', duration: 3})`
-   `Notification.error({content: 'message', duration: 3})`
-   `Notification.warning({content: 'message', duration: 3})`
-   `Notification.success({content: 'message', duration: 3})`

Close Manually (`id` is the return value of the display methods)

-   `Notification.close(id)`

| Properties   | Instructions                                                                                                      | type                 | Default    | version |
| ------------ |-------------------------------------------------------------------------------------------------------------------| -------------------- | ---------- | ------- |
| content      | Content                                                                                                           | ReactNode | ''      |  |
| duration     | Automatic close delay, no auto-close when set to 0                                                                | number               | 3          |         |
| getPopupContainer | Specifies the parent DOM, and the bullet layer will be rendered to the DOM, you need to set 'position: relative` This will change the DOM tree position, but not the view's rendering position. | () => HTMLElement | () => document.body    |  0.34.0     |
| icon         | Topleft icon                                                                                                      | ReactNode               |  |         |  |
| position     | Pop-up position, one of `top`、`bottom`、`topLeft`、`topRight`、`bottomLeft`、`bottomRight`                            | string               | `topRight` |         |
| showClose    | Toggle Whether show close button                                                                                  | boolean              | true       | 0.25.0  |
| theme | Style of background fill, one of `light`, `normal`                                                                | string | `normal`   |  1.0.0     |
| title        | Title                                                                                                             | string               | ReactNode | ''      |  |
| zIndex       | Z-index value. Only take effect for the first time.                                                               | number               | 1010       |         |
| onClick      | Callback function when clicking the notification                                                                  | (e: event) => void   |            | 0.27 .0 |
| onClose      | Callback function when closing notification, triggered for either auto-close or manually close                    | () => void |            |         |
| onCloseClick | Callback function when actively clicking on the close button                                                      | (id: string \| number) => void |            |         |

The global configuration is set before any method call, and takes effect only once (>= 0.25.0):

-   `Notification.config(config)`

| Properties | Instructions                                                                                | type           | Default    | version |
| ---------- | ------------------------------------------------------------------------------------------- | -------------- | ---------- | ------- |
| bottom     | Bottom, absolute position                                                                   | number \| string | -          | 0.25.0  |
| duration   | Automatic close delay, no auto-close when set to 0                                          | number(second) | 3          | 0.25.0  |
| left       | Left, absolute position                                                                     | number \| string | -          | 0.25.0  |
| position   | Pop-up position, one of `top`、`bottom`、`topLeft`、`topRight`、`bottomLeft`、`bottomRight` | string         | `topRight` | 0.25.0  |
| right      | Right, absolute position                                                                    | number \| string | -          | 0.25.0  |
| top        | Top, absolute position                                                                      | number \| string | -          | 0.25.0  |
| zIndex     | Z-index                                                                                     | number         | 1010       | 0.25.0  |

Globally Destroy (>= 0.25.0):

-   `Notification.destroyAll()` ( >= 0.25.0 )

Hook Notification ( >= 1.2.0 )
-   `Notification.useNotification`

When you need access Context, you could use ``Notification.useNotification` to create a `contextHolder` and insert to corresponding DOM tree. Notification created by hooks will be able to access the context where `contextHolder` is inserted. Hook Notification has following methods: `info`, `success`, `warning`, `error`, `open`, `close`. For more usage demo, refer to [useToast](/en-US/components/toast#useToast_Hooks)

## Accessibility

### ARIA

- The `role` of the component is'alert'
- The notification's `aria-labelledby` is marked as the corresponding notification title

## Content Guidelines

<div style={{ border: '1px solid var(--semi-color-border)', padding: 10, marginBottom: 24, justifyContent: 'center', display: 'flex' }}>
    <NotificationCard
        type='info'
        title='Task completed'
        content={
            <div>
                400 tasks succeed and 600 failed
                <div style={{ color: 'var(--semi-color-primary)', marginTop: 4, fontWeight: 600 }}>Check failed tasks</div>
            </div>
        }
    />
</div>

- Title
  - Explain in clear and concise language
  - Avoid punctuation such as commas, periods, etc.
- Text
  - On the premise of complete information transmission, try to compress the text to 1-2 sentences
  - A detailed description or explanation of the title, rather than a repetition of the title
  - Use correct punctuation, commas within sentences and periods between sentences
- Operate
  - The copy needs to show the specific meaning of the operation

## Design Tokens

<DesignToken/>
