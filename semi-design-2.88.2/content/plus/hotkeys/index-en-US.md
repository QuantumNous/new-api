---
localeCode: en-US
order: 32
category: Plus
title:  HotKeys
icon: doc-configprovider
width: 60%
brief: used to facilitate the customization of keyboard shortcut
---


## When to use
When it is necessary to express the usage method of shortcut key combinations to users, using the `Hotkeys` component can quickly render the corresponding UI elements and automatically obtain event bindings.

## Demos

### How to import
PinCode supported from 2.66.0

```jsx import 
import { HotKeys } from '@douyinfe/semi-ui';
```

### Explaination
The hotkeys only support combinations of modifier keys like Shift, Control, Meta, and Alt with other keys.

> [Meta](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/metaKey) corresponds to Command on macOS and Win on Windows.

When setting a shortcut that overlaps with common shortcuts like Ctrl/Meta + C, the preventDefault setting can be used to control whether the default event is triggered.



### Basic Usage

Pass in key combinations via `hotKeys` and bind a shortcut handler function using `onHotKey` to respond to the action.

When pressing `Ctrl + Shift + A`, it opens the modal. By default, it listens on the body, making it effective globally.

[values reference](https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values)

It's also recommended to use the `HotKeys.Keys` wrapper to set hotkeys.

```jsx live=true
import React, { useState } from 'react';
import { HotKeys, Modal } from '@douyinfe/semi-ui';

function Demo() {
  const [visible, setVisible] = useState(false);
  const showDialog = () => {
      setVisible(true);
  };
  const handleOk = () => {
      setVisible(false);
  };
  const handleCancel = () => {
      setVisible(false);
  };
  const hotKeys = [HotKeys.Keys.Control, 'Shift', HotKeys.Keys.A]
  
  return (
    <div>
      <HotKeys hotKeys={hotKeys} onHotKey={showDialog} ></HotKeys>
      <Modal
          title="Dialog"
          visible={visible}
          onOk={handleOk}
          onCancel={handleCancel}
      >
          This is the Modal opened by hotkey: {hotKeys.join('+')}.
      </Modal>
    </div>
  );
}
```

### Custom content

Set the characters through `content`

```jsx live=true
import React, { useState } from 'react';
import { HotKeys, Modal } from '@douyinfe/semi-ui';

function Demo() {
  const [visible, setVisible] = useState(false);
  const showDialog = () => {
      setVisible(true);
  };
  const handleOk = () => {
      setVisible(false);
  };
  const handleCancel = () => {
      setVisible(false);
  };
  const hotKeys = [HotKeys.Keys.Control, 'Shift', HotKeys.Keys.B]
  
  return (
    <div>
      <HotKeys hotKeys={hotKeys} onHotKey={showDialog} content={['Ctrl', 'Shift', 'B']}></HotKeys>
      <Modal
          title="Dialog"
          visible={visible}
          onOk={handleOk}
          onCancel={handleCancel}
      >
          This is the Modal opened by hotkey: {hotKeys.join('+')}.
      </Modal>
    </div>
  );
}
```

Replace the element through `render`

```jsx live=true
import React, { useState } from 'react';
import { HotKeys, Modal, Tag } from '@douyinfe/semi-ui';

function Demo() {
  const [visible, setVisible] = useState(false);
  const showDialog = () => {
      setVisible(true);
  };
  const handleOk = () => {
      setVisible(false);
  };
  const handleCancel = () => {
      setVisible(false);
  };
  const hotKeys = [HotKeys.Keys.Control, HotKeys.Keys.R]
  
  const newHotKeys = <Tag>Press Ctrl+R to Open Modal</Tag>
  return (
    <div>
      <HotKeys hotKeys={hotKeys} onHotKey={showDialog} render={newHotKeys}></HotKeys>
      <Modal
          title="Dialog"
          visible={visible}
          onOk={handleOk}
          onCancel={handleCancel}
      >
          This is the Modal opened by hotkey: {hotKeys.join('+')}.
      </Modal>
    </div>
  );
}
```

### prevent Default event

Control the default event by setting `preventDefault`.
```jsx live=true
import React, { useState } from 'react';
import { HotKeys, Modal } from '@douyinfe/semi-ui';

function Demo() {
  const [visible, setVisible] = useState(false);
  const showDialog = () => {
      setVisible(true);
  };
  const handleOk = () => {
      setVisible(false);
  };
  const handleCancel = () => {
      setVisible(false);
  };
  const hotKeys = [HotKeys.Keys.Meta, HotKeys.Keys.S]

  return (
    <div>
      <HotKeys hotKeys={hotKeys} onHotKey={showDialog} preventDefault></HotKeys>
      <br />
      <HotKeys hotKeys={[HotKeys.Keys.Control, HotKeys.Keys.S]} onHotKey={showDialog} preventDefault></HotKeys>
      <Modal
          title="Dialog"
          visible={visible}
          onOk={handleOk}
          onCancel={handleCancel}
      >
          This is the Modal opened by hotkey: {'Meta/Control + S'}.
      </Modal>
    </div>
  );
}
```

### change the DOM element the listener is mounted on
The hotkey is listened to on the body by default, through `getListenerTarget`
```jsx live=true
import React, { useState, useRef } from 'react';
import { HotKeys, Input, Modal } from '@douyinfe/semi-ui';

function Demo() {
  const hotKeys = ["Control", "q"]
  const [visible, setVisible] = useState(false);
  const showDialog = () => {
      setVisible(true);
  };
  const handleOk = () => {
      setVisible(false);
  };
  const handleCancel = () => {
      setVisible(false);
  };

  const inputRef = useRef(null);
  return (
    <div>
      <Input ref={inputRef} placeholder='test for target'></Input>
      <HotKeys hotKeys={hotKeys} onHotKey={showDialog} 
        getListenerTarget={() => inputRef.current}>
      </HotKeys>
      <Modal
          title="Dialog"
          visible={visible}
          onOk={handleOk}
          onCancel={handleCancel}
      >
          This is the Modal opened by hotkey: {hotKeys.join('+')}.
      </Modal>
    </div>
  );
}
```

## API Reference

### HotKeys


| Property          | Instructions                                                                                                                                                                                  | type                            | Default   |
|-------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------|-----------|
| className         | class name               | string                          |           |                                     
| content | Set the characters                                         | string[]                          | -         |
| getListenerTarget         | change the DOM element the listener is mounted on            | () => HTMLElement                       |  document.body         |
| hotKeys  | Define keyboard shortcut，[values](https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values)                                          | KeyboardEvent.key[]                          | -         |
| onClick        | callback that clicking triggers                                                             |   () => void                      |    -       |
| onHotKey      | callback that hotKeys triggers                                                        | (e: KeyboardEvent) => void                       |   -      |
| preventDefault  | Whether to prevent the default behavior of the shortcut                                         | boolean                          | false        |
| render        |    Replace the element                                               | () => ReactNode \| ReactNode                       |           |
| style             | style                                                                  | CSSProperties                   |           |

## Design Tokens
<DesignToken/>

<!-- ## Related Material
```material
44, 46
``` -->

## Related Material
<semi-material-list code="46"></semi-material-list>
