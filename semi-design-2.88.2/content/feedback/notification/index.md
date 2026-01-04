---
localeCode: zh-CN
order: 87
category: 反馈类
title: Notification 通知
icon: doc-notification
width: 65%
brief: 通知用于主动向用户发出消息通知
---

## 代码演示

### 如何引入

```jsx import
import { Notification } from '@douyinfe/semi-ui';
```

### 普通通知

最基本的用法，3s 后自动关闭

```jsx live=true
import React from 'react';
import { Notification, Button } from '@douyinfe/semi-ui';

() => (
    <Button
        onClick={() =>
            Notification.open({
                title: 'Hi, Bytedance',
                content: 'ies dance dance dance',
                duration: 3,
            })
        }
    >
        Display Notification
    </Button>
);
```

### 不同位置弹出

可以从多个不同位置弹出：默认右上角 `topRight`。可选值：`top`、`bottom`、`topLeft`、`topRight`、`bottomLeft`、`bottomRight`。

```jsx live=true
import React from 'react';
import { Notification, Button, ButtonGroup } from '@douyinfe/semi-ui';

() => {
    let opts = {
        duration: 3,
        position: 'topRight',
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
            <br />
            <br />
            <ButtonGroup>
                <Button onClick={() => Notification.info({ ...opts, position: 'bottom' })}>bottom</Button>
                <Button onClick={() => Notification.info({ ...opts, position: 'bottomRight' })}>bottomRight</Button>
                <Button onClick={() => Notification.info({ ...opts, position: 'bottomLeft' })}>bottomLeft</Button>
            </ButtonGroup>
        </>
    );
};
```

### 带有图标的通知

包括成功、失败、警告、提示

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
            <h5>默认的图标</h5>
            <Button type="primary" onClick={() => Notification.success(opts)} style={{ margin: 4 }}>
                Success
            </Button>
            <Button onClick={() => Notification.info(opts)} style={{ margin: 4 }}>
                Info
            </Button>
            <Button type="warning" onClick={() => Notification.warning(opts)} style={{ margin: 4 }}>
                Warning
            </Button>
            <Button type="danger" onClick={() => Notification.error(opts)} style={{ margin: 4 }}>
                Error
            </Button>
            <h5>自定义图标</h5>
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

### 多色样式

可以使用 `theme` 设置浅色填充样式提高与界面的对比，默认为 'normal' 的白色模式。

```jsx live=true
import React from 'react';
import { Notification, Button } from '@douyinfe/semi-ui';

() => {
    let opts = {
        title: 'Hi, Bytedance',
        content: 'Hi, Bytedance dance dance',
        duration: 3,
        theme: 'light',
    };

    return (
        <>
            <Button onClick={() => Notification.info(opts)}>Info</Button>
            <br />
            <br />
            <Button onClick={() => Notification.success(opts)}>Success</Button>
            <br />
            <br />
            <Button type="warning" onClick={() => Notification.warning(opts)}>
                Warning
            </Button>
            <br />
            <br />
            <Button type="danger" onClick={() => Notification.error(opts)}>
                Error
            </Button>
        </>
    );
};
```

### 链接文本

配合 Typography 可以自定义操作区链接文本，用来配合更复杂的场景的使用。

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
                    <Text link>查看详情</Text>
                    <Text link style={{ marginLeft: 20 }}>
                        一会再看
                    </Text>
                </div>
            </>
        ),
        duration: 3,
    };

    return <Button onClick={() => Notification.info(opts)}>Display Notification</Button>;
};
```

### 修改延时

自定义时长 10s，默认时长为 3s

```jsx live=true
import React from 'react';
import { Notification, Button } from '@douyinfe/semi-ui';

() => {
    let opts = {
        content: 'Hi, Bytedance dance dance',
        duration: 10,
    };

    return <Button onClick={() => Notification.info(opts)}>Close After 10s</Button>;
};
```

### 手动关闭

设置 duration 为 0 时，通知将不会自动关闭，此时只能手动关闭。

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


### 更新内容

可以通过唯一的 id 来更新内容。 >=2.45.0

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

## API 参考

组件提供的静态方法，使用方式如下：

展示：可以直接传入 options 对象，返回值为`id`：`const id = Notification.open({ /*...options*/ })`

-   `Notification.open({content: 'message', duration: 3})`
-   `Notification.info({content: 'message', duration: 3})`
-   `Notification.error({content: 'message', duration: 3})`
-   `Notification.warning({content: 'message', duration: 3})`
-   `Notification.success({content: 'message', duration: 3})`

手动关闭 （id 为展示方法的返回值）

-   `Notification.close(id)`

| 属性 | 说明                                                                     | 类型 | 默认值 | 版本 |
| --- |------------------------------------------------------------------------| --- | --- | --- |
| content | 通知内容                                                                   |ReactNode | '' |  |
| duration | 自动关闭的延时，单位 s，设为 0 时不自动关闭                                               | number | 3 |  |
| getPopupContainer | 指定父级 DOM，弹层将会渲染至该 DOM 中，自定义需要设置 `position: relative` 这会改变浮层 DOM 树位置，但不会改变视图渲染位置。                   | () => HTMLElement | () => document.body | 0.34.0 |
| icon | 左上角 icon                                                               | React.Node |  |  |
| position | 弹出位置，可选 `top`、`bottom`、`topLeft`、`topRight`、`bottomLeft`、`bottomRight` | string | `topRight` |  |
| showClose | 是否展示关闭按钮                                                               | boolean | true | 0.25.0 |
| theme | 填充样式，支持`light`, `normal`                                               | string | `normal` | 1.0.0 |
| title | 通知标题                                                                   | ReactNode | '' |  |
| zIndex | 弹层 z-index 值，首次设置一次生效                                                  | number | 1010 |  |
| onClick | 点击通知的回调函数                                                              | (e: event) => void |  | 0.27.0 |
| onClose | 通知关闭的回调函数(主动关闭、延时到达关闭都会触发)                                             | () => void |  |  |
| onCloseClick | 主动点击关闭按钮时的回调函数                                                         | (id: string \| number) => void |  |  |

全局配置在调用前提前配置，全局一次生效 ( >= 0.25.0 )：

-   `Notification.config(config)`

| 属性 | 说明 | 类型 | 默认值 | 版本 |
| --- | --- | --- | --- | --- |
| bottom | 弹出位置 bottom | number \| string | - | 0.25.0 |
| duration | 自动关闭的延时，单位 s，设为 0 时不自动关闭 | number | 3 | 0.25.0 |
| left | 弹出位置 left | number \| string | - | 0.25.0 |
| position | 弹出位置，可选 `top`、`bottom`、`topLeft`、`topRight`、`bottomLeft`、`bottomRight` | string | `topRight` | 0.25.0 |
| right | 弹出位置 right | number \| string | - | 0.25.0 |
| top | 弹出位置 top | number \| string | - | 0.25.0 |
| zIndex | 弹层 z-index 值 | number | 1010 | 0.25.0 |


## Accessibility

### ARIA

- 组件的 `role` 为 'alert'
-  通知的 `aria-labelledby` 标记为对应通知标题


## 文案规范


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

- 标题
  - 使用简洁明了的语言进行说明
  - 避免使用逗号，句号等标点符号
- 正文
  - 在信息传递完整的前提下，尽可能地将正文压缩至 1 -2 句话
  - 对标题进行详尽地描述或者解释，而不是对标题的重复说明
  - 使用正确的标点符号，句子内使用逗号，句子间使用句号
- 操作
  - 文案需要展示操作的具体含义


| ✅ 推荐用法 | ❌ 不推荐用法 |   
| --- | --- | 
| <NotificationCard type='info' style={{ width: 350}} title='Task completed' content={<div> 400 tasks succeed and 600 failed <div style={{ color: 'var(--semi-color-primary)', marginTop: 4, fontWeight: 600 }}>Check failed tasks</div></div>} /> | <NotificationCard type='info' style={{ width: 350}} title='Status editing tasks completed' content={<div> 400 tasks succeed and 600 failed <div style={{ color: 'var(--semi-color-primary)', marginTop: 4, fontWeight: 600 }}>Check</div></div>} /> |



## 设计变量

<DesignToken/>


全局销毁 ( >= 0.25.0 )：

-   `Notification.destroyAll()` ( >= 0.25.0 )

Hook Notification ( >= 1.2.0 )：

-   `Notification.useNotification`  
    当你需要使用 Context 时，可以通过 Notification.useNotification 创建一个 contextHolder 插入相应的节点中。此时通过 hooks 创建的 Notification 将会得到 contextHolder 所在位置的所有上下文。创建的 notification 对象拥有与以下方法：`info`, `success`, `warning`, `error`, `open`, `close`。使用方法可以参考：[useToast](/zh-CN/feedback/toast#Hooks用法)
