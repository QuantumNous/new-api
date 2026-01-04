---
localeCode: en-US
order: 89
category: Feedback
title:  Popconfirm
subTitle: Popconfirm
icon: doc-popconfirm
brief: Used when the operation of the target element requires further confirmation from the user. Compared with Popover, it has a built-in series of configurable action buttons. Compared with Modal, it does not force full-screen centering, and the interaction is lighter.
---


## Demos

### How to import

```jsx import
import { Popconfirm } from '@douyinfe/semi-ui';
```
### Basic Usage

`Popconfirm` is based on the `Tooltip` component. Children support the same type as `Tooltip`. For details, please refer to [Tooltip Cautions](/en-US/show/tooltip#Cautions)

```jsx live=true
import React from 'react';
import { Popconfirm, Button, Toast } from '@douyinfe/semi-ui';

() => {
    const onConfirm = () => {
        Toast.success('Confirm save!');
    };

    const onCancel = () => {
        Toast.warning('Cancel save!');
    };
    return (
        <Popconfirm
            title="Are you sure you want to save this modification?"
            content="This modification will be irreversible"
            onConfirm={onConfirm}
            onCancel={onCancel}
        >
            <Button>Save</Button>
        </Popconfirm>
    );
};
```

### Type collocation

Developers can use scenario-based `OK Type`/`Cancel Type`/`icon` Equal parameters are matched with different styles of bubble confirmation boxes.

```jsx live=true
import React, { useState } from 'react';
import { Popconfirm, Radio, RadioGroup, Button } from '@douyinfe/semi-ui/';
import { IconAlertTriangle } from '@douyinfe/semi-icons';

function TypesConfirmDemo(props = {}) {
    const typeMap = {
        default: {
            icon: <IconAlertTriangle size="extra-large" />,
        },
        warning: {
            icon: <IconAlertTriangle style={{ color: 'var(--semi-color-warning)' }} size="extra-large" />,
        },
        danger: {
            okType: 'danger',
            icon: <IconAlertTriangle style={{ color: 'var(--semi-color-danger)' }} size="extra-large" />,
        },
        tertiary: {
            icon: <IconAlertTriangle style={{ color: 'var(--semi-color-tertiary)' }} size="extra-large" />,
        },
    };

    const keys = Object.keys(typeMap);
    const [type, setType] = useState('default');
    const [visible, _setVisible] = useState(true);

    const changeType = e => {
        const type = e && e.target && e.target.value;
        if (type && keys.includes(type)) {
            setType(type);
        }
    };

    const setVisible = visible => _setVisible(visible);
    const toggleVisible = () => setVisible(!visible);

    return (
        <div>
            <RadioGroup onChange={changeType} value={type} style={{ marginTop: 14, marginBottom: 14 }}>
                {keys.map(key => (
                    <Radio key={key} value={key}>
                        <strong style={{ color: `var(--semi-color-${key === 'default' ? 'primary' : key})` }}>{key}</strong>
                    </Radio>
                ))}
            </RadioGroup>
            <div>
                <Popconfirm
                    {...typeMap[type]}
                    visible={visible}
                    onVisibleChange={setVisible}
                    trigger="custom"
                    title="Are you sure to save this modification?"
                    content="This modification will be irreversible"
                >
                    <Button onClick={toggleVisible}>Click here</Button>
                </Popconfirm>
            </div>
        </div>
    );
}
```


### Delay hide

`onOk` and `onCancel` can be closed after click through return Promise (supported after v2.19). When onCancel and onOk are triggered, the corresponding Button will automatically switch to `loading: true`  
promise solve will close the bubble confirmation box, the bubble will remain when promise reject, and button loading will automatically switch to false  

```jsx live=true
import React from 'react';
import { Popconfirm, Button, Toast } from '@douyinfe/semi-ui';

() => {
    const onConfirm = () => {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                console.log('resolve, close popconfirm');
                resolve();
            }, 2000);
        });
    };

    const onCancel = () => {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                console.log('reject, popconfirm still exist');
                reject();
            }, 2000);
        });
    };

    return (
        <Popconfirm
            title="Are you sure to save this modification?"
            content="This modification will be irreversible"
            onConfirm={onConfirm}
            onCancel={onCancel}
        >
            <Button>Save</Button>
        </Popconfirm>
    );
};
```

### Initialize the Focus Position of Popup Layer

`okButtonProps` and `cancelButtonProps` support passing in the `autoFocus` parameter, which will automatically focus at this position when the panel is opened. Version 2.30.0 supported.

`content` supports function, and its parameter is an object, which binds `initialFocusRef` to the focusable DOM or component, and it will automatically focus at this position when the panel is opened. Version 2.30.0 supported.

```jsx live=true
import React from 'react';
import { Button, Popconfirm, Space } from '@douyinfe/semi-ui';

() => {
    return (
        <Space>
            <Popconfirm
                title="Are you sure you want to save this edit?"
                content="This modification will be irreversible"
                okButtonProps={{
                    autoFocus: true,
                    type: 'danger',
                }}
            >
                <Button>Confirm focus</Button>
            </Popconfirm>
            <Popconfirm
                title="Are you sure you want to save this edit?"
                content="This modification will be irreversible"
                cancelButtonProps={{
                    autoFocus: true,
                }}
            >
                <Button>Cancel focus</Button>
            </Popconfirm>
            <Popconfirm
                title="Are you sure you want to save this edit?"
                content={({ initialFocusRef }) => {
                    return <input ref={initialFocusRef} placeholder="focus here" />;
                }}
            >
                <Button>Content focus</Button>
            </Popconfirm>
        </Space>
    );
};
```

### Use with Tooltip or Popover

Please refer to [Use with Tooltip/Popover](https://semi.design/en-US/show/tooltip#Use%20with%20Popver%20or%20Popconfirm)

## API Reference

| Properties         | Instructions                                                                                                                                                          | Type                       | Default             | Version           |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ------------------- | ----------------- |
| arrowPointAtCenter | Whether the "small triangle" points to the center of the element, you need to pass in "showArrow = true" at the same time                                             | boolean                    | false               | **0.34.0** |
| cancelText         | Cancel button text                                                                                                                                                    | string                     | "Cancel"            |
| cancelButtonProps  | Properties for cancel button                                                                                                                                          | object                     |                     | **0.29.0**        |
| cancelType         | Cancel button type                                                                                                                                                    | string                     | "tertiary"          |
| closeOnEsc         | Whether to close the panel by pressing the Esc key in the trigger or popup layer. It does not take effect when visible is under controlled | boolean | true | **2.8.0** |
| content            | Content displayed (function type, supported in version 2.30.0)                                                                                                         | ReactNode\|({ initialFocusRef }) => ReactNode        |                     |
| defaultVisible     | Bubble box is displayed by default                                                                                                                                    | boolean                    |                     | **0.19.0**        |
| disabled           | Click on the Pop confirmation box to see if the bubbles pop up.                                                                                                       | boolean                    | false               |
| getPopupContainer  | Specify the parent DOM, and the pop-up layer will be rendered into the DOM. Customization needs to set `position: relative`   This will change the DOM tree position, but not the view's rendering position.                                                                                                      | Function():HTMLElement           | () => document.body |
| guardFocus         | When the focus is in the popup layer, toggle whether the Tab makes the focus loop in the popup layer | boolean | true | **2.8.0** |
| icon               | Custom pop bubble Icon icon                                                                                                                                           |  ReactNode        | <IconAlertTriangle size="extra-large" />    |
| motion             | Whether there is animation when the drop-down list appears/hidden. You can customize animation by passing in an object that conforms to the structure | boolean | true |
| position           | Directions, optional values: `top`, `topLeft`, `topRight`, `leftTop`, `leftBottom`, `rightTop`, `rightTop`, `rightBottom`, `bottomLeft`, `bottomRight`, `bottomRight` | string                     | "bottomLeft"        |
| okText             | Confirm button text                                                                                                                                | string                           | "Confirm"              |
| okType             | Confirm button type                                                                                                                                | string                           | "primary"           |
| okButtonProps      | Confirm button props                                                                                                                            | object                           |                     | **0.29.0**        |
| showArrow          | Whether to show arrow triangle                                                                                                                         | boolean                          | false               |                   |
| stopPropagation    | Whether to prevent the click event on the bomb layer from bubbling                                                                                                                | boolean                          | true                | **0.34.0** |
| position           | Popup layer position，Optional value：`top`,`topLeft`,`topRight`,`left`,`leftTop`,`leftBottom`,<br/>`right`,`rightTop`,`rightBottom`,`bottom`,`bottomLeft`,`bottomRight` | string                           | "bottomLeft"        |
| returnFocusOnClose | After pressing the Esc key, whether the focus returns to the trigger, it only takes effect when the trigger is set to click | boolean | true | **2.8.0** |
| title              | Displayed title                                                                                                                                  | string\|ReactNode                |                     |
| trigger            | Timing to trigger the display, optional value：hover / focus / click / custom                                                                                         | string              |   'click'                  |
| visible            | Whether the bubble box displays controlled attributes                                                                                                                   | boolean                        |                     | **0.19.0**        |
| zIndex             | Floating layer z-index value                                                                                                                                          | number                   | 1030                |
| onConfirm          | Click the confirmation button to call back. Promise support after v2.19                                                                                                                           | (e) => void \| Promise                |                     |
| onCancel           | Click the Cancel button to call back. Promise support after v2.19                                                                                                                          | (e) => void \| Promise                |                     |
| onVisibleChange    | Bubble box toggle shows hidden callbacks                                                                                                                              | (visible: boolean) => void | () => {}            | **0.19.0**        |
| onEscKeyDown | Called when Esc key is pressed in trigger or popup layer | function(e:event) | | **2.8.0** |
| onClickOutSide     | Callback when the pop-up layer is in the display state and the non-Children, non-floating layer inner area is clicked                                                 | (e: event) => void         |                     | **2.1.0**        |

## Accessibility

### ARIA

For ARIA, please refer to [Popover](https://semi.design/en-US/show/popover#ARIA)

### Keyboard and focus

- Popconfirm must have trigger, trigger can be focused, use `Enter` key to open Popconfirm
- After Popconfirm is activated, press the arrow key ⬇️ to move the focus to Popconfirm. The initial focus of Popconfirm should follow several principles:
    - If the Popconfirm contains the last step of an irreversible process, such as: deleting data, etc., then this initial focus is preferably on the least destructive interactable element, such as: the cancel button (by passing the `autoFocus` to the object `cancelButtonProps`)
    - If you only read text in Popconfirm, it is recommended to set the initial focus on the most likely interactive elements, such as: confirm button (implemented by passing `autoFocus` to the object `okButtonProps` )
- Keyboard users can dismiss Popconfirm by pressing `Esc` and focus should return to the trigger. After the user closes the Pop through the interactive element within the Popconfirm, the focus should also return to the trigger (only when trigger is `click`)
- When it is opened, after the user clicks `Esc` in the blank space in Popconfirm, the focus will also return to the trigger (only when trigger is `click`)

## Design Tokens
<DesignToken/>

## FAQ

- **Why does the Popconfirm floating layer lose its width and wrap unexpectedly when the width is not enough near the screen border?**

    After Chromium 104, the wrapping rendering strategy when the width of the screen border text is not enough has changed. For details, see [issue #1022](https://github.com/DouyinFE/semi-design/issues/1022), the semi-side has been This problem was fixed in v2.17.0.