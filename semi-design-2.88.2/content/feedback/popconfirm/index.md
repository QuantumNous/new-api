---
localeCode: zh-CN
order: 89
category: 反馈类
title:  Popconfirm 气泡确认框
icon: doc-popconfirm
brief: 目标元素的操作需要用户进一步的确认时使用。与 Popover 相比它内置了一系列可配置的操作按钮，与 Modal 相比它不强制全屏居中显示，交互也更轻量
---

## 代码演示

### 如何引入

```jsx import
import { Popconfirm } from '@douyinfe/semi-ui';
```

### 基本使用

Popconfirm 底层基于 Tooltip 封装，Children 支持类型同 Tooltip，注意事项详情可查阅 [Tooltip注意事项](/zh-CN/show/tooltip#%E6%B3%A8%E6%84%8F%E4%BA%8B%E9%A1%B9)

```jsx live=true
import React from 'react';
import { Popconfirm, Button, Toast } from '@douyinfe/semi-ui';

() => {
    const onConfirm = () => {
        Toast.success('确认保存！');
    };

    const onCancel = () => {
        Toast.warning('取消保存！');
    };
    return (
        <Popconfirm
            title="确定是否要保存此修改？"
            content="此修改将不可逆"
            onConfirm={onConfirm}
            onCancel={onCancel}
        >
            <Button>保存</Button>
        </Popconfirm>
    );
};
```

### 类型搭配

开发者可以基于场景使用 `okType`/`cancelType`/`icon` 等参数搭配出不同风格的气泡式确认框。

```jsx live=true
import React, { useState } from 'react';
import { Popconfirm, Radio, RadioGroup, Button } from '@douyinfe/semi-ui';
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
            <RadioGroup type="button" onChange={changeType} value={type} style={{ marginTop: 14, marginBottom: 14 }}>
                {keys.map(key => (
                    <Radio key={key} value={key}>
                        <span style={{ color: `var(--semi-color-${key === 'default' ? 'primary' : key})` }}>{key}</span>
                    </Radio>
                ))}
            </RadioGroup>
            <div>
                <Popconfirm
                    {...typeMap[type]}
                    visible={visible}
                    onVisibleChange={setVisible}
                    trigger="custom"
                    title="确定是否要保存此修改？"
                    content="此修改将不可逆"
                >
                    <Button onClick={toggleVisible}>点击此处</Button>
                </Popconfirm>
            </div>
        </div>
    );
}
```

### 延时关闭

onOk、onCancel 可以通过 return Promise 实现点击后延时关闭 （v2.19后支持）  
onCancel、onOk 被触发时，对应的 Button 会自动切换为 loading: true, promise solve 会关闭气泡确认框， promise reject时气泡依然保留，同时 button loading 自动切换为 false

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
            title="确定是否要保存此修改？"
            content="此修改将不可逆"
            onConfirm={onConfirm}
            onCancel={onCancel}
        >
            <Button>保存</Button>
        </Popconfirm>
    );
};
```

### 初始化弹出层焦点位置

okButtonProps 和 cancelButtonProps 支持传入 `autoFocus` 参数，传入后打开面板时会自动聚焦在该位置。2.30.0 版本支持。

content 支持传入函数，它的入参是一个对象，将 `initialFocusRef` 绑定在可聚焦 DOM 或组件上，打开面板时会自动聚焦在该位置。2.30.0 版本支持。

```jsx live=true
import React from 'react';
import { Button, Popconfirm, Space } from '@douyinfe/semi-ui';

() => {
    return (
        <Space>
            <Popconfirm
                title="确定是否要保存此修改？"
                content="此修改将不可逆"
                okButtonProps={{
                    autoFocus: true,
                    type: 'danger',
                }}
            >
                <Button>确认聚焦</Button>
            </Popconfirm>
            <Popconfirm
                title="确定是否要保存此修改？"
                content="此修改将不可逆"
                cancelButtonProps={{
                    autoFocus: true,
                }}
            >
                <Button>取消聚焦</Button>
            </Popconfirm>
            <Popconfirm
                title="确定是否要保存此修改？"
                content={({ initialFocusRef }) => {
                    return <input ref={initialFocusRef} placeholder="focus here" />;
                }}
            >
                <Button>内容聚焦</Button>
            </Popconfirm>
        </Space>
    );
};
```

### 搭配 Tooltip 或 Popover 使用

请参考[搭配使用](/zh-CN/show/tooltip#%E6%90%AD%E9%85%8D%20Popover%20%E6%88%96%20Popconfirm%20%E4%BD%BF%E7%94%A8)

## API 参考

| 属性 | 说明                                                                                                                                        | 类型 | 默认值 | 版本 |
| --- |-------------------------------------------------------------------------------------------------------------------------------------------| --- | --- | --- |
| arrowPointAtCenter | “小三角”是否指向元素中心，需要同时传入"showArrow=true"                                                                                                      | boolean | false | |
| cancelText | 取消按钮文字                                                                                                                                    | string | "取消" |
| cancelButtonProps | 取消按钮的 props                                                                                                                               | object |  | **0.29.0** |
| cancelType | 取消按钮类型                                                                                                                                    | string | "tertiary" |
| closeOnEsc | 在 trigger 聚焦时或在弹出层内聚焦元素上按 Esc 键是否关闭面板，受控时不生效                                                                                              | boolean | true | **2.8.0** |
| content | 显示的内容（函数类型，2.10.0 版本支持）                                                                                                                   | ReactNode\|({ initialFocusRef }) => ReactNode |  |
| defaultVisible | 气泡框默认是否展示                                                                                                                                 | boolean |  |  |
| disabled | 点击 Popconfirm 子元素是否弹出气泡确认框                                                                                                                | boolean | false |
| getPopupContainer | 指定父级 DOM，弹层将会渲染至该 DOM 中，自定义时容器需要设置 `position: relative` 这会改变浮层 DOM 树位置，但不会改变视图渲染位置。                                                                                   | Function():HTMLElement | () => document.body |
| guardFocus | 当焦点处于弹出层内时，切换 Tab 是否让焦点在弹出层内循环                                                                                                            | boolean | true | **2.8.0** |
| icon | 自定义弹出气泡 Icon 图标                                                                                                                           | ReactNode | <IconAlertTriangle size="extra-large" /> |
| motion | 下拉列表出现/隐藏时，是否有动画                                                                                                                          | boolean | true |
| okText | 确认按钮文字                                                                                                                                    | string | "确认" |
| okType | 确认按钮类型                                                                                                                                    | string | "primary" |
| okButtonProps | 确认按钮的 props                                                                                                                               | object |  |  |
| position | 方向，可选值：`top`,`topLeft`,`topRight`,`left`,`leftTop`,`leftBottom`,<br/>`right`,`rightTop`,`rightBottom`,`bottom`,`bottomLeft`,`bottomRight` | string | "bottomLeft" |
| returnFocusOnClose | 按下 Esc 键后，焦点是否回到 trigger 上，只有设置 trigger 为 click 时生效                                                                                       | boolean | true | **2.8.0** |
| showArrow | 是否显示箭头三角形                                                                                                                                 | boolean | false |  |
| stopPropagation | 是否阻止弹层上的点击事件冒泡                                                                                                                            | boolean | true |  |
| title | 显示的标题                                                                                                                                     | ReactNode |  |
| trigger | 触发展示的时机，可选值：hover / focus / click / custom                                                                                                | string | 'click' |
| visible | 气泡框是否展示的受控属性                                                                                                                              | boolean |  |  |
| zIndex | 浮层 z-index 值                                                                                                                              | number | 1030 |
| onConfirm | 点击确认按钮回调                                                                                                                                  | Function(e) |  |
| onCancel | 点击取消按钮回调                                                                                                                                  | Function(e) |  |
| onClickOutSide | 当弹出层处于展示状态，点击非 Children、非浮层内部区域时的回调                                                                                                       | Function(e) | |**2.1.0** |
| onEscKeyDown | 在 trigger 或弹出层按 Esc 键时调用                                                                                                                  | Function(e:event) |  | **2.8.0** |
| onVisibleChange | 气泡框切换显示隐藏的回调                                                                                                                              | Function(visible: boolean): void | () => {} | |

## Accessibility

### ARIA

语义化请参考 [Popover](https://semi.design/zh-CN/show/popover#ARIA)

### 键盘和焦点

- Popconfirm 必须带有触发器，触发器可被聚焦，使用 Enter 键打开 Popconfirm
- Popconfirm 激活后，按下方向键 ⬇️ 将焦点移动到 Popconfirm 上。Popconfirm 的初始焦点应当遵循以下几个原则：
    - 如果 Popconfirm 内包含一个不可逆转过程的最后一个步骤，比如：删除数据等，那么这个初始焦点最好放在破坏性最小的可交互元素上，如：关闭按钮 ( 通过向对象 cancelButtonProps 中传入 autoFocus 实现）
    - 如果 Popconfirm 内仅为阅读文本，那么建议将初始焦点设置在最可能常用的交互元素上，如：确定按钮 ( 通过向对象 okButtonProps 中传入 autoFocus 实现）
- 键盘用户能够通过按 Esc 关闭 Popconfirm，并且焦点应该返回到触发器上。用户通过 Popconfirm 内的交互元素关闭该 Pop 后，焦点也应当返回到触发器上（仅当 trigger 为 click 时）
- 打开的情况下，用户点击 Popconfirm 内的空白处 Esc 后，焦点也会回到触发器上 （仅当 trigger 为 click 时）

## 设计变量
<DesignToken/>

## FAQ

-   **为什么 Popconfirm 浮层在靠近屏幕边界宽度不够时，丢失宽度意外换行?**  
    在 chromium 104 后 对于屏幕边界文本宽度不够时的换行渲染策略发生变化，详细原因可查看 [issue #1022](https://github.com/DouyinFE/semi-design/issues/1022)，semi侧已经在v2.17.0版本修复了这个问题。