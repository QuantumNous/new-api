---
localeCode: zh-CN
order: 75
category: 展示类
title: Modal 模态对话框
icon: doc-modal
brief: 模态对话框用于等待用户响应、告知用户重要信息或在不丢失上下文的情况下展示更多信息
---

## 代码演示

### 如何引入

```jsx import
import { Modal } from '@douyinfe/semi-ui';
```

### 基本

```jsx live=true
import React from 'react';
import { Modal, Button } from '@douyinfe/semi-ui';

() => {
    const [visible, setVisible] = useState(false);
    const showDialog = () => {
        setVisible(true);
    };
    const handleOk = () => {
        setVisible(false);
        console.log('Ok button clicked');
    };
    const handleCancel = () => {
        setVisible(false);
        console.log('Cancel button clicked');
    };
    const handleAfterClose = () => {
        console.log('After Close callback executed');
    };

    return (
        <>
            <Button onClick={showDialog}>打开弹窗</Button>
            <Modal
                title="基本对话框"
                visible={visible}
                onOk={handleOk}
                afterClose={handleAfterClose} //>=1.16.0
                onCancel={handleCancel}
                closeOnEsc={true}
            >
                This is the content of a basic modal.
                <br />
                More content...
            </Modal>
        </>
    );
};
```

### 底部撑满

设置 footerFill 为 true 可使 Modal footer 底部按钮撑满排列

```jsx live=true
import React from 'react';
import { Modal, Button } from '@douyinfe/semi-ui';

() => {
    const [visible, setVisible] = useState(false);
    const showDialog = () => {
        setVisible(true);
    };
    const handleOk = () => {
        setVisible(false);
        console.log('Ok button clicked');
    };
    const handleCancel = () => {
        setVisible(false);
        console.log('Cancel button clicked');
    };
    const handleAfterClose = () => {
        console.log('After Close callback executed');
    };

    return (
        <>
            <Button onClick={showDialog}>打开弹窗</Button>
            <Modal
                title="基本对话框"
                visible={visible}
                onOk={handleOk}
                afterClose={handleAfterClose} //>=1.16.0
                onCancel={handleCancel}
                closeOnEsc={true}
                footerFill={true}
            >
                This is the content of a basic modal.
                <br />
                More content...
            </Modal>
        </>
    );
};
```

### 点击遮罩层不可关闭

修改 `maskClosable` 为 `false` 则不可通过点击遮罩层来关闭对话框。

```jsx live=true
import React from 'react';
import { Modal, Button } from '@douyinfe/semi-ui';

class modalDemo extends React.Component {
    constructor() {
        super();
        this.state = { visible: false };
        this.showDialog = this.showDialog.bind(this);
        this.handleOk = this.handleOk.bind(this);
        this.handleCancel = this.handleCancel.bind(this);
    }
    showDialog() {
        this.setState({
            visible: true,
        });
    }
    handleOk(e) {
        this.setState({
            visible: false,
        });
    }
    handleCancel(e) {
        this.setState({
            visible: false,
        });
    }
    render() {
        return (
            <>
                <Button onClick={this.showDialog}>点击遮罩层不可关闭</Button>
                <Modal
                    title="对话框标题"
                    visible={this.state.visible}
                    onOk={this.handleOk}
                    onCancel={this.handleCancel}
                    maskClosable={false}
                >
                    <p>This is a modal that cannot be closed by clicking on the mask.</p>
                    <p>More content...</p>
                </Modal>
            </>
        );
    }
}
```

### 自定义按钮文字

通过设置 `okText` 与 `cancelText` 属性可自定义按钮显示的文字。

注意：命令式调用的 Modal 需要通过这两个属性来设置 i18 的文本，因为我们无法修改 React 组件树，命令式调用插入的 Component 无法消费到 Locale 相关的 Context

```jsx live=true
import React from 'react';
import { Modal, Button } from '@douyinfe/semi-ui';

class modalDemo extends React.Component {
    constructor() {
        super();
        this.state = { visible: false };
        this.showDialog = this.showDialog.bind(this);
        this.handleOk = this.handleOk.bind(this);
        this.handleCancel = this.handleCancel.bind(this);
    }
    showDialog() {
        this.setState({
            visible: true,
        });
    }
    handleOk(e) {
        this.setState({
            visible: false,
        });
    }
    handleCancel(e) {
        this.setState({
            visible: false,
        });
    }
    render() {
        return (
            <>
                <Button onClick={this.showDialog}>自定义按钮文字</Button>
                <Modal
                    title="自定义按钮文字"
                    visible={this.state.visible}
                    onOk={this.handleOk}
                    onCancel={this.handleCancel}
                    okText={'Sounds great!'}
                    cancelText={'No, thanks.'}
                >
                    <p>This is a modal with customized button texts.</p>
                    <p>More content...</p>
                </Modal>
            </>
        );
    }
}
```

### 自定义按钮属性

通过设置 `okButtonProps` 与 `cancelButtonProps` 属性可自定义按钮的属性。

```jsx live=true
import React from 'react';
import { Modal, Button } from '@douyinfe/semi-ui';

class modalDemo extends React.Component {
    constructor() {
        super();
        this.state = { visible: false };
        this.showDialog = this.showDialog.bind(this);
        this.handleOk = this.handleOk.bind(this);
        this.handleCancel = this.handleCancel.bind(this);
    }
    showDialog() {
        this.setState({
            visible: true,
        });
    }
    handleOk(e) {
        this.setState({
            visible: false,
        });
    }
    handleCancel(e) {
        this.setState({
            visible: false,
        });
    }
    render() {
        return (
            <>
                <Button onClick={this.showDialog}>自定义按钮属性</Button>
                <Modal
                    title="自定义按钮属性"
                    visible={this.state.visible}
                    onOk={this.handleOk}
                    onCancel={this.handleCancel}
                    okButtonProps={{ size: 'small', type: 'warning' }}
                    cancelButtonProps={{ size: 'small', disabled: true }}
                >
                    <p>This is a modal with customized button props.</p>
                    <p>More content...</p>
                </Modal>
            </>
        );
    }
}
```

### 自定义对话框头部和页脚

如果需要实现更丰富的个性化需求，可以通过 `header` 自定义头部，`footer` 自定义页脚的按钮。把 `header` 设为 `null`时则不展示头部区域；不需要显示任何按钮时，同样可以把 `footer` 设为 `null`。

```jsx live=true
import React from 'react';
import { Modal, Button } from '@douyinfe/semi-ui';

class modalDemo extends React.Component {
    constructor() {
        super();
        this.state = { visible: false };
        this.showDialog = this.showDialog.bind(this);
        this.handleOk = this.handleOk.bind(this);
        this.handleCancel = this.handleCancel.bind(this);
    }
    showDialog() {
        this.setState({
            visible: true,
        });
    }
    handleOk(e) {
        this.setState({
            visible: false,
        });
    }
    handleCancel(e) {
        this.setState({
            visible: false,
        });
    }
    render() {
        return (
            <>
                <Button onClick={this.showDialog}>自定义页脚样式</Button>
                <Modal
                    title="自定义页脚"
                    visible={this.state.visible}
                    onOk={this.handleOk}
                    onCancel={this.handleCancel}
                    footer={
                        <Button type="primary" onClick={this.handleOk}>
                            Yes, I Understand
                        </Button>
                    }
                >
                    <p>This is a modal with a customized footer.</p>
                    <p>More content...</p>
                </Modal>
            </>
        );
    }
}
```

### 自定义对话框的样式

通过设置 `style` 可以自定义样式及位置如 `style.top`，也可以通过 `centered` 使对话框居中显示。也可以通过设置 `maskStyle` 自定义遮罩样式，及 `bodyStyle` 自定义对话框内容样式。

```jsx live=true
import React from 'react';
import { Modal, Button } from '@douyinfe/semi-ui';

class modalDemo extends React.Component {
    constructor() {
        super();
        this.state = { visible: false };
        this.showDialog = this.showDialog.bind(this);
        this.handleOk = this.handleOk.bind(this);
        this.handleCancel = this.handleCancel.bind(this);
    }
    showDialog() {
        this.setState({
            visible: true,
        });
    }
    handleOk(e) {
        this.setState({
            visible: false,
        });
    }
    handleCancel(e) {
        this.setState({
            visible: false,
        });
    }
    render() {
        return (
            <>
                <Button onClick={this.showDialog}>自定义对话框样式</Button>
                <Modal
                    title="自定义样式"
                    visible={this.state.visible}
                    onOk={this.handleOk}
                    onCancel={this.handleCancel}
                    centered
                    bodyStyle={{ overflow: 'auto', height: 200 }}
                >
                    <p style={{ lineHeight: 1.8 }}>
                        Semi Design 是由抖音前端团队与 UED
                        团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
                        Web 应用。
                    </p>
                    <p style={{ lineHeight: 1.8 }}>
                        区别于其他的设计系统而言，Semi Design 以用户中心、内容优先、设计人性化为设计理念，具有以下优势：
                    </p>
                    <ul>
                        <li>
                            <p>Semi Design 以内容优先进行设计。</p>
                        </li>
                        <li>
                            <p>更容易地自定义主题。</p>
                        </li>
                        <li>
                            <p>适用国际化场景。</p>
                        </li>
                        <li>
                            <p>效率场景加入人性化关怀</p>
                        </li>
                    </ul>
                </Modal>
            </>
        );
    }
}
```

### 自定义的对话框

通过灵活使用使用 `header`，`footer`等属性可以实现一个完全自定义的对话框。

```jsx live=true
import React from 'react';
import { Modal, Button, List } from '@douyinfe/semi-ui';
import { IconVigoLogo, IconSemiLogo } from '@douyinfe/semi-icons';

class modalDemo extends React.Component {
    constructor() {
        super();
        this.state = { visible: false };
        this.showDialog = this.showDialog.bind(this);
        this.handleOk = this.handleOk.bind(this);
        this.handleCancel = this.handleCancel.bind(this);
    }
    showDialog() {
        this.setState({
            visible: true,
        });
    }
    handleOk(e) {
        this.setState({
            visible: false,
        });
    }
    handleCancel(e) {
        this.setState({
            visible: false,
        });
    }
    render() {
        const data = [
            {
                icon: <IconSemiLogo style={{ fontSize: 48 }} />,
                title: 'Boost new feature adoption with Integration',
                content: 'Sample data is prepared for you to demostrate how Integration may be useful for your team',
            },
            {
                icon: <IconVigoLogo style={{ fontSize: 48 }} />,
                title: 'Introducing Dark Mode',
                content: 'Sample data is prepared for you to demostrate how Integration may be useful for your team',
            },
            {
                icon: <IconSemiLogo style={{ fontSize: 48 }} />,
                title: 'New List Component',
                content: 'Sample data is prepared for you to demostrate how Integration may be useful for your team',
            },
        ];
        const btnStyle = {
            width: 240,
            margin: '4px 50px',
        };
        const footer = (
            <div style={{ textAlign: 'center' }}>
                <Button type="primary" theme="solid" onClick={this.handleOk} style={btnStyle}>
                    Continue
                </Button>
                <Button type="primary" theme="borderless" onClick={this.handleCancel} style={btnStyle}>
                    Learn more features
                </Button>
            </div>
        );
        return (
            <>
                <Button onClick={this.showDialog}>自定义对话框</Button>
                <Modal
                    header={null}
                    visible={this.state.visible}
                    onOk={this.handleOk}
                    onCancel={this.handleCancel}
                    footer={footer}
                >
                    <h3 style={{ textAlign: 'center', fontSize: 24, margin: 40 }}>Semi Design New Features</h3>
                    <List
                        dataSource={data}
                        split={false}
                        renderItem={item => (
                            <List.Item
                                header={item.icon}
                                main={
                                    <div>
                                        <h6 style={{ margin: 0, fontSize: 16 }}>{item.title}</h6>
                                        <p style={{ marginTop: 4, color: 'var(--semi-color-text-1)' }}>
                                            {item.content}
                                        </p>
                                    </div>
                                }
                            />
                        )}
                    />
                </Modal>
            </>
        );
    }
}
```

### 全屏 Modal

使用 `fullScreen={true}` 可以开启全屏对话框

```jsx live=true
import React from 'react';
import { Modal, Button } from '@douyinfe/semi-ui';

() => {
    const [visible, setVisible] = useState(false);
    const onClose = () => {
        setVisible(false);
    };
    return (
        <>
            <Button onClick={() => setVisible(true)}>打开全屏弹窗</Button>
            <Modal title="全屏对话框标题" fullScreen visible={visible} onOk={onClose} onCancel={onClose}>
                <p>This is a full screen modal</p>
                <p>More content...</p>
            </Modal>
        </>
    );
};
```

### 命令式调用

使用 `confirm()` 可以设置一个确认框。支持各种类型的信息提示。命令式调用也可以自定义 icon , 支持 string 和 ReactNode 类型。其他 Modal 支持的 props 都可以传入。

```jsx live=true hideInDSM
import React from 'react';
import { Modal, Button } from '@douyinfe/semi-ui';
import { IconSend } from '@douyinfe/semi-icons';

ModalComponent = function(props) {
    function success() {
        Modal.success({ title: 'This is a success message', content: 'bla bla bla...' });
    }

    function info() {
        Modal.info({ title: 'Here is some info', content: 'bla bla bla...' });
    }

    function error() {
        Modal.error({ title: 'Unfortunately, there is an error', content: 'bla bla bla...' });
    }

    function warning() {
        Modal.warning({ title: 'Warning: be cautious ahead', content: 'bla bla bla...' });
    }

    function confirm() {
        Modal.confirm({ title: 'Are you sure ?', content: 'bla bla bla...' });
    }

    function custom() {
        Modal.info({
            title: 'This is a custom modal',
            content: 'bla bla bla...',
            icon: <IconSend />,
            cancelButtonProps: { theme: 'borderless' },
            okButtonProps: { theme: 'solid' },
        });
    }

    return (
        <div>
            <Button onClick={info}>Info</Button>
            <br />
            <br />
            <Button onClick={success}>Success</Button>
            <br />
            <br />
            <Button onClick={error} type="danger">
                Error
            </Button>
            <br />
            <br />
            <Button onClick={warning} type="warning">
                Warning
            </Button>
            <br />
            <br />
            <Button onClick={confirm} type="primary">
                Confirm
            </Button>
            <br />
            <br />
            <Button onClick={custom}>Custom</Button>
        </div>
    );
};
```

### Hooks 用法

通过 Modal.useModal 创建支持读取 context 的 contextHolder。

```jsx live=true hideInDSM
import React from 'react';
import { ConfigProvider, Button, Modal } from '@douyinfe/semi-ui';
import en_GB from '@douyinfe/semi-ui/lib/es/locale/source/en_GB';

function Demo(props = {}) {
    const [modal, contextHolder] = Modal.useModal();
    const config = { title: 'This is a success message', content: 'Context consumer' };

    return (
        <ConfigProvider locale={en_GB}>
            <div>
                <Button
                    onClick={() => {
                        modal.confirm(config);
                    }}
                >
                    Confirm Modal
                </Button>
            </div>
            {contextHolder}
        </ConfigProvider>
    );
}
```

### 可拖拽 Modal

通过 `modalRender` 自定义渲染 Modal 内容，可拖拽 Modal 通过 DragMove 组件实现。

```jsx live=true hideInDSM
import React, { useState } from 'react';
import { ConfigProvider, Button, Modal, DragMove } from '@douyinfe/semi-ui';

function Demo(props = {}) {
    const [visible, setVisible] = useState(false);
    return (
        <div>
            <Button onClick={() => setVisible(true)}>Open Modal</Button>
            <Modal
                title="可拖拽Modal"
                visible={visible}
                onCancel={() => setVisible(false)}
                modalRender={(modal) => (
                    <DragMove>{modal}</DragMove>
                )}
            >
                <p>This is the content of a basic sidesheet.</p>
                <p>Here is more content...</p>
            </Modal>
        </div>
    );
}
```

## API 参考

### Modal

| 属性 | 说明                                                                                                        | 类型 | 默认值 |
| --- |-----------------------------------------------------------------------------------------------------------| --- | --- |
| afterClose | 对话框完全关闭后的回调函数 <br/>**v1.16.0 后提供**                                                                        | () => void | 无 |
| bodyStyle | 对话框内容的样式                                                                                                  | CSSProperties | 无 |
| cancelButtonProps | 取消按钮的 props                                                                                               | [ButtonProps](/zh-CN/input/button#API参考) | 无 |
| cancelText | 取消按钮的文字                                                                                                   | string | 无 |
| centered | 是否居中显示                                                                                                    | boolean | false |
| className | 可用于设置样式类名                                                                                                 | string | 无 |
| closable | 是否显示右上角的关闭按钮                                                                                              | boolean | true |
| closeIcon | 关闭按钮的 icon <br/>**v1.0.0 后提供**                                                                            | ReactNode | <IconClose /\> |
| closeOnEsc | 允许通过键盘事件 Esc 触发关闭 <br/>**v1.0.0 后提供**                                                                     | boolean | true |
| confirmLoading | 确认按钮 loading                                                                                              | boolean | false |
| content | 对话框内容                                                                                                     | ReactNode | 无 |
| footer | 对话框底部                                                                                                     | ReactNode | 无 |
| fullScreen | 对话是否是全屏（会覆盖 width height） <br/>**v1.18.0 后提供**                                                            | boolean | false |
| getPopupContainer | 指定父级 DOM，弹层将会渲染至该 DOM 中，自定义需要设置 `position: relative` 这会改变浮层 DOM 树位置，但不会改变视图渲染位置。  <br/>**v0.33.0 后提供**                                | () => HTMLElement | () => document.body |
| hasCancel | 是否显示取消按钮                                                                                                  | boolean | true |
| header | 对话框头部                                                                                                     | ReactNode | 无 |
| height | 高度                                                                                                        | number | 无 |
| icon | 自定义 icon <br/>**v1.1.0 后提供**                                                                              | ReactNode | - |
| keepDOM | 关闭对话框时是否保留内部组件不销毁 <br/>**v1.0.0 后提供**                                                                     | boolean | false |
| lazyRender | 配合 keepDOM 使用，为 true 时挂载时不会渲染对话框组件 <br/>**v1.0.0 后提供**                                                    | boolean | true |
| mask | 是否显示遮罩                                                                                                    | boolean | true |
| maskClosable | 是否允许通过点击遮罩来关闭对话框                                                                                          | boolean | true |
| maskStyle | 遮罩的样式                                                                                                     | CSSProperties | 无 |
| modalContentClass | 可用于设置对话框内容的样式类名 | string | 无 |
| modalRender | 自定义渲染 Modal | (modal: ReactNode) => ReactNode | - |
| motion | 动画效果开关                                                                                                    | boolean | true |
| okButtonProps | 确认按钮的 props                                                                                               | [ButtonProps](/zh-CN/input/button#API参考) | 无 |
| okText | 确认按钮的文字                                                                                                   | string | 无 |
| okType | 确认按钮的类型, 可选: 'primary'、'secondary'、'tertiary'、'warning'、'danger'                                          | string | primary |
| preventScroll | 指示浏览器是否应滚动文档以显示新聚焦的元素，作用于组件内的 focus 方法，不包含用户传入的组件                                                         | boolean |  |  |
| size | 对话框宽度尺寸，支持 `small`(448px)， `medium`(684px), `large`(920px)，`full-width`(100vw - 64px) <br/>**v1.0.0 后提供** | string | 'small' |
| style | 可用于设置样式                                                                                                   | CSSProperties | 无 |
| title | 对话框的标题                                                                                                    | ReactNode | 无 |
| visible | 对话框是否可见                                                                                                   | boolean | false |
| width | 宽度                                                                                                        | number | 448 |
| zIndex | 遮罩的 z-index 值                                                                                             | number | 1000 |
| onCancel | 取消对话框时的回调函数，返回 Promise 时，取消按钮会出现 loading 态                                                                | (e: any) => void \| Promise<any\> | 无 |
| onOk | 点击确认按钮时的回调函数，返回 Promise 时，确认按钮会出现 loading 态                                                               | (e: any) => void \| Promise<any\> | 无 |

### Modal.method()

-   `Modal.info`
-   `Modal.success`
-   `Modal.error`
-   `Modal.warning`
-   `Modal.confirm`

| 属性 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| bodyStyle | 对话框内容的样式 | CSSProperties | 无 |
| cancelButtonProps | 取消按钮的 props | [ButtonProps](/zh-CN/input/button#API参考) | 无 |
| cancelText | 取消按钮的文字 | string | 无 |
| centered | 是否居中显示 | boolean | false |
| className | 可用于设置样式类名 | string | 无 |
| closable | 是否显示右上角的关闭按钮 | boolean | true |
| confirmLoading | 确认按钮 loading | boolean | false |
| content | 对话框内容 | ReactNode | 无 |
| footer | 对话框底部 | ReactNode | 无 |
| footerFill| 底部按钮是否撑满 (>= 2.xx.0 ) | boolean | false | 
| header | 对话框头部 | ReactNode | 无 |
| height | 高度 | number | 无 |
| icon | 自定义 icon | ReactNode | - |
| mask | 是否显示遮罩 | boolean | true |
| maskClosable | 是否允许通过点击遮罩来关闭对话框 | boolean | true |
| maskStyle | 遮罩的样式 | CSSProperties | 无 |
| modalContentClass | 可用于设置对话框内容的样式类名 | string | 无 |
| modalRender | 自定义渲染 Modal | (modal: ReactNode) => ReactNode | - |
| okButtonProps | 确认按钮的 props | [ButtonProps](/zh-CN/input/button#API参考) | 无 |
| okText | 确认按钮的文字 | string | 无 |
| okType | 确认按钮的类型 | string | primary |
| style | 可用于设置样式 | CSSProperties | 无 |
| title | 对话框的标题 | ReactNode | 无 |
| width | 宽度 | number | 520 |
| zIndex | 遮罩的 z-index 值 | number | 1000 |
| onCancel | 取消回调，参数为关闭函数，返回 promise 时 resolve 后自动关闭 | (e: any) => void \| Promise<any\> | 无 |
| onOk | 点击确定回调，参数为关闭函数，返回 promise 时 resolve 后自动关闭 | (e: any) => void \| Promise<any\> | 无 |

以上函数调用后，会返回一个引用，可以通过该引用更新和关闭弹窗。

```
const modal = Modal.info();

modal.update({
  title: '更新的标题',
  content: '更新的内容',
});

modal.destroy();
```

-   `Modal.destroyAll` **v>=0.37.0**

使用 Modal.destroyAll() 可以销毁命令式及以上`.info()`等创建的弹窗。

-   `Modal.useModal` **v>=1.2.0**  
    当你需要使用 Context 时，可以通过 Modal.useModal 创建一个 contextHolder 插入相应的节点中。此时通过 hooks 创建的 Modal 将会得到 contextHolder 所在位置的所有上下文。创建的 modal 对象拥有与 [Modal.method](<#Modal.method()>) 相同的创建通知方法。

## Accessibility

### ARIA

WAI-ARIA: https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/

-   role 设置为 `dialog`
-   aria-modal 设置为 true
-   aria-labelledby 对应 Modal header
-   aria-describedby 对应 Modal body

### 键盘和焦点

-   Modal 在弹出时自动获得焦点，关闭时焦点自动回归到打开前元素。
-   键盘用户可以使用 `Tab` 键和 `Shift + Tab`，将焦点在 Modal 内移动，包括 Modal 自带的关闭按钮和确定取消按钮，此时 Modal 背后元素不可被 tab 聚焦。
-   Modal 打开时默认聚焦到取消按钮, 可通过在 cancelButtonProps 或 okButtonProps 传入 autoFocus 来控制该行为。
-   可通过在 Modal 内容中需要聚焦的表单元素上添加 autoFocus 来让 Modal 打开时自动聚焦到该元素 (需同时设置 cancelButtonProps 的 autoFocus 为 false)。
-   修改 closeOnEsc 默认值为 true，允许用户通过键盘直接关闭 Modal 带来更好的体验

## 文案规范

-   命令式 Modal 与 默认 Modal 两种模态对话框的标题使用 动词 + 名词 的格式，无论是陈述句还是问句

| ✅ 推荐用法   | ❌ 不推荐用法                         |
| ------------- | ------------------------------------- |
| Edit ticket   | Edit                                  |
| Delete form？ | Are you sure you want to delete form? |

-   两种模态对话框的操作按钮在保证标题描述清楚的前提下，只需要使用标题内的动词即可

| ✅ 推荐用法 | ❌ 不推荐用法 |
| ----------- | ------------- |
| Edit        | Edit ticket   |

-   命令式 Modal 的正文规范
    -   对标题进行具体的解释说明，不要重复标题的信息
    -   确保用户知道在必要时如何采取行动

## 设计变量

<DesignToken/>

## FAQ

-  #### 为什么使用 LocaleProvider 后， Modal.confirm 确认、取消按钮的文本没有国际化？
   Modal 使用 Portal 将浮层节点插入到 DOM 树中。但这个操作仅能改变节点在 DOM 树中的位置，无法改变节点在 React 节点树中的位置，LocalProvider是基于 Context 机制传递的，必须是从属的 React 子结点才可消费到 Local 相关 Context。因此命令式的 Modal 的内置文本无法自动适配国际化。
   你可以通过 `okText` 和 `cancelText` 这两个属性来根据 Locale 重新设置 i18 的文本。   
   在1.2版本之后，你也可以通过 Modal.useModal 方法来返回 modal 实体以及 contextHolder 节点。将 contextHolder 插入到你需要获取 context 位置，即可使 Modal 获取到对应的 Context，如 ConfigProvider 或者 LocaleProvider 的配置。

-  #### 为什么 title 和 content 的间距在命令式调用和非命令式调用下不同?
   命令式调用场景下，标题和内容的相关性更强，所以用更近的距离表达这种强相关性，符合预期。用户如果不想要这种效果，可以自己做样式覆盖。

<!-- ## 相关物料
```material
1, 55
``` -->

## 相关物料
<semi-material-list code="1"></semi-material-list>