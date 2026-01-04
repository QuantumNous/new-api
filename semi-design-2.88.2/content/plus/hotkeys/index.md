---
localeCode: zh-CN
order: 32
category: Plus
title: HotKeys 快捷键
icon: doc-configprovider
width: 60%
brief: 用于方便用户自定义快捷键及相关操作
---

## 使用场景
需要向用户表达快捷键组合的使用方式时，使用 Hotkeys 组件可快速渲染出对应的 UI 元素且自动获得事件绑定


## 代码演示

### 如何引入
HotKeys 从 2.66.0 开始支持

```jsx import
import { HotKeys } from '@douyinfe/semi-ui';
```


### 说明
快捷键仅支持修饰键组合`Shift`,`Control`,`Meta`,`Alt`与其他键的组合。
> [Meta](https://developer.mozilla.org/zh-CN/docs/Web/API/KeyboardEvent/metaKey) 在MacOS中为`Command`，在Windows中为`Win`

当设定快捷键与常用快捷键如`Ctrl/Meta + C`相同时，可以通过设置`preventDefault`控制默认事件是否触发。

### 基本用法

基本使用，通过`hotKeys`传入快捷键组合，通过 `onHotKey` 绑定快捷键处理函数，作出响应动作。

按下 Ctrl + Shift + A， 唤起modal。默认在 body.document 监听，全局生效。

[hotKeys取值参考](https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values)，也可以使用`HotKeys.Keys`进行设置

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
    const hotKeys = [HotKeys.Keys.Control, 'Shift', HotKeys.Keys.A];
  
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

### 自定义内容

通过`content`传入渲染的字符

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
    const hotKeys = [HotKeys.Keys.Control, 'Shift', HotKeys.Keys.B];
  
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

通过`render`传入代替渲染的元素

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
    const hotKeys = [HotKeys.Keys.Control, HotKeys.Keys.R];
  
    const newHotKeys = <Tag>Press Ctrl+R to Open Modal</Tag>;
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

### 阻止默认事件

通过设置`preventDefault`控制默认事件是否触发。
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
    const hotKeys = [HotKeys.Keys.Meta, HotKeys.Keys.S];

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

### 修改监听挂载DOM
快捷键默认在 body 监听，通过`getListenerTarget`修改快捷键监听挂载的DOM
```jsx live=true
import React, { useState, useRef } from 'react';
import { HotKeys, Input, Modal } from '@douyinfe/semi-ui';

function Demo() {
    const hotKeys = ["Control", "q"];
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

## API 参考

### HotKeys

| 属性              | 说明                                                                  | 类型                            | 默认值    |
| ----------------- | --------------------------------------------------------------------- | ------------------------------- | --------- |
| className         | 类名                                                                  | string                          |           |
| content | 设置显示内容                                          | string[]                          | -         |
| getListenerTarget         | 用于设置监听器挂载的DOM            | () => HTMLElement                       |  document.body         |
| hotKeys  | 设置快捷键组合，[取值参考](https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values)                                          | KeyboardEvent.key[]                          | -         |
| onClick        | 点击回调函数                                                              |   () => void                      |    -       |
| onHotKey        | 快捷键回调函数                                                              |   (e: KeyboardEvent) => void                      |    -       |
| preventDefault        | 是否阻止快捷键默认行为                                                                  | boolean                          | false          |
| render        |    覆盖组件渲染                                               | () => ReactNode \| ReactNode                       |           |
| style             | 样式                                                                  | CSSProperties                   |           |


## 设计变量
<DesignToken/>

<!-- ## 相关物料
```material
44, 46
``` -->

## 相关物料
<semi-material-list code="46"></semi-material-list>

