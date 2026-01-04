---
localeCode: zh-CN
order: 77
category: 展示类
title: Popover 气泡卡片
icon: doc-popover
brief: 点击/鼠标移入元素，弹出气泡式的卡片浮层。
---

## 使用场景

Popover 气泡卡片是由用户自主打开的临时性浮层卡片，能够承载一些额外内容和交互行为而不影响原页面。

和 Tooltip 的区别是，它可以承载更复杂的内容，而不仅仅是提示文本。

## 代码演示

### 如何引入

```jsx import
import { Popover } from '@douyinfe/semi-ui';
```

### 注意事项

Popover 需要将 DOM 事件监听器应用到 children 中，如果子元素是自定义的组件，你需要确保它能将属性传递至底层的 DOM 元素

同时为了计算弹出层的定位，需要获取到 children 的真实 DOM 元素，因此 Popover 支持如下类型的 children

1. Class Component，不强制绑定ref，但需要确保 props 可被透传至真实的 DOM 节点上
2. 使用 forwardRef 包裹后的函数式组件，将 props 与 ref 透传到 children 内真实的 DOM 节点上
3. 真实 DOM 节点, 如 span，div，p...

```jsx live=true noInline=true dir="column"
import React, { forwardRef } from 'react';
import { Popover, Space, Empty } from '@douyinfe/semi-ui';
import { IllustrationSuccess, IllustrationSuccessDark } from '@douyinfe/semi-illustrations';

const style = { border: '2px solid var(--semi-color-border)', paddingLeft: 4, paddingRight: 4, borderRadius: 4 };

// 将props属性传递，绑定ref
const FCChildren = forwardRef((props, ref) => {
    return (<span {...props} ref={ref} style={style}>Functional Component</span>);
});

// 将props属性传递
class MyComponent extends React.Component {
    render() {
        return (<span {...this.props} style={style}>ClassComponent</span>);
    }
};

const content = (
    <Empty
        title={'先进的设计 / 研发协作方式'}
        image={<IllustrationSuccess style={{ width: 150, height: 150 }} />}
        darkModeImage={<IllustrationSuccessDark style={{ width: 150, height: 150 }} />}
        description="使用 Semi D2C 快速还原 Figma 设计稿，一键转代码"
        style={{ width: 400, margin: '0 auto', display: 'flex', padding: 20 }}
    />
);

function Demo() {
    return (
        <Space>
            <Popover content={content}>
                <FCChildren />
            </Popover>
            <Popover content={content}>
                <MyComponent />
            </Popover>
            <Popover content={content}>
                <span style={style}>DOM</span>
            </Popover>
        </Space>
    );
}
render(Demo);


```
### 基本使用

将浮层的触发器 Trigger 作为`children`，使用 Popover 包裹（如下的例子中触发器为 Tag 元素）。浮层内容通过`content`传入   
注意事项同 [Tooltip](/zh-CN/show/tooltip#%E6%B3%A8%E6%84%8F%E4%BA%8B%E9%A1%B9) 

```jsx live=true
import React from 'react';
import { Popover, Tag, Empty } from '@douyinfe/semi-ui';
import { IllustrationSuccess, IllustrationSuccessDark } from '@douyinfe/semi-illustrations';

function Demo() {
    return (
        <Popover
            content={
                <Empty
                    title={'先进的设计 / 研发协作方式'}
                    image={<IllustrationSuccess style={{ width: 150, height: 150 }} />}
                    darkModeImage={<IllustrationSuccessDark style={{ width: 150, height: 150 }} />}
                    description="使用 Semi D2C 快速还原 Figma 设计稿，一键转代码"
                    style={{ width: 400, margin: '0 auto', display: 'flex', padding: 20 }}
                />
            }
        >
            <Tag>悬停此处</Tag>
        </Popover>
    );
}
```

### 弹出位置

支持通过`position`设置浮层弹出方向，共支持十二个方向。

```jsx live=true
import React from 'react';
import { Popover, Tag, Empty } from '@douyinfe/semi-ui';
import { IllustrationSuccess, IllustrationSuccessDark } from '@douyinfe/semi-illustrations';

function Demo() {
    const tops = [
        ['topLeft', 'TL'],
        ['top', 'Top'],
        ['topRight', 'TR'],
    ];
    const lefts = [
        ['leftTop', 'LT'],
        ['left', 'Left'],
        ['leftBottom', 'LB'],
    ];
    const rights = [
        ['rightTop', 'RT'],
        ['right', 'Right'],
        ['rightBottom', 'RB'],
    ];
    const bottoms = [
        ['bottomLeft', 'BL'],
        ['bottom', 'Bottom'],
        ['bottomRight', 'BR'],
    ];

    const article = (
        <Empty
            title={'先进的设计 / 研发协作方式'}
            image={<IllustrationSuccess style={{ width: 150, height: 150 }} />}
            darkModeImage={<IllustrationSuccessDark style={{ width: 150, height: 150 }} />}
            description="使用 Semi D2C 快速还原 Figma 设计稿，一键转代码"
            style={{ width: 400, margin: '0 auto', display: 'flex', padding: 20 }}
        />
    );

    return (
        <div>
            <div style={{ marginLeft: 80, whiteSpace: 'nowrap' }}>
                {tops.map((pos, index) => (
                    <Popover
                        content={article}
                        position={Array.isArray(pos) ? pos[0] : pos}
                        key={index}
                    >
                        <Tag style={{ margin: 8, padding: 20 }}>{Array.isArray(pos) ? pos[1] : pos}</Tag>
                    </Popover>
                ))}
            </div>
            <div style={{ width: 80, float: 'left' }}>
                {lefts.map((pos, index) => (
                    <Popover
                        content={article}
                        position={Array.isArray(pos) ? pos[0] : pos}
                        key={index}
                    >
                        <Tag style={{ margin: 8, padding: 20, width: 60 }}>{Array.isArray(pos) ? pos[1] : pos}</Tag>
                    </Popover>
                ))}
            </div>
            <div style={{ width: 40, marginLeft: 300 }}>
                {rights.map((pos, index) => (
                    <Popover
                        content={article}
                        position={Array.isArray(pos) ? pos[0] : pos}
                        key={index}
                    >
                        <Tag style={{ margin: 8, padding: 20, width: 60 }}>{Array.isArray(pos) ? pos[1] : pos}</Tag>
                    </Popover>
                ))}
            </div>
            <div style={{ marginLeft: 80, clear: 'both', whiteSpace: 'nowrap' }}>
                {bottoms.map((pos, index) => (
                    <Popover
                        content={article}
                        position={Array.isArray(pos) ? pos[0] : pos}
                        key={index}
                    >
                        <Tag style={{ margin: 8, padding: 20, width: 60 }}>{Array.isArray(pos) ? pos[1] : pos}</Tag>
                    </Popover>
                ))}
            </div>
        </div>
    );
}
```

### 受控显示

设置`trigger='custom'`，此场景下，Popover 的显示与否完全受到参数 `visible` 的控制。

```jsx live=true
import React, { useState } from 'react';
import { Popover, Button, RadioGroup, Radio, Empty } from '@douyinfe/semi-ui';
import { IllustrationSuccess, IllustrationSuccessDark } from '@douyinfe/semi-illustrations';

() => {
    const content = (
        <Empty
            title={'先进的设计 / 研发协作方式'}
            image={<IllustrationSuccess style={{ width: 150, height: 150 }} />}
            darkModeImage={<IllustrationSuccessDark style={{ width: 150, height: 150 }} />}
            description="使用 Semi D2C 快速还原 Figma 设计稿，一键转代码"
            style={{ width: 400, margin: '0 auto', display: 'flex', padding: 20 }}
        />
    );
    const [visible, setVisible] = useState(false);
    return (
        <Popover visible={visible} content={content} trigger="custom">
            <RadioGroup type='button' onChange={(e) => setVisible(e.target.value)} value={visible}>
                <Radio value={true}>受控显示</Radio>
                <Radio value={false}>受控隐藏</Radio>
            </RadioGroup>
        </Popover>
    );
}
```

### 显示小三角

通过设置`showArrow`, Popover 同样也支持展示一个小三角。

> 这种模式下浮层会拥有一个默认的样式，你可以通过传递 style 参数来覆盖掉。

```jsx live=true
import React from 'react';
import { Popover, Tag } from '@douyinfe/semi-ui';

function Demo() {
    const tops = [
        ['topLeft', 'TL'],
        ['top', 'Top'],
        ['topRight', 'TR'],
    ];
    const lefts = [
        ['leftTop', 'LT'],
        ['left', 'Left'],
        ['leftBottom', 'LB'],
    ];
    const rights = [
        ['rightTop', 'RT'],
        ['right', 'Right'],
        ['rightBottom', 'RB'],
    ];
    const bottoms = [
        ['bottomLeft', 'BL'],
        ['bottom', 'Bottom'],
        ['bottomRight', 'BR'],
    ];

    return (
        <div style={{ paddingLeft: 40 }} className="tag-margin-right">
            <div style={{ marginLeft: 40, whiteSpace: 'nowrap' }}>
                {tops.map((pos, index) => (
                    <Popover
                        showArrow
                        content={
                            <article>
                                Hi ByteDancer, this is a popover.
                                <br /> We have 2 lines.
                            </article>
                        }
                        position={Array.isArray(pos) ? pos[0] : pos}
                        key={index}
                    >
                        <Tag>{Array.isArray(pos) ? pos[1] : pos}</Tag>
                    </Popover>
                ))}
            </div>
            <div style={{ width: 40, float: 'left' }}>
                {lefts.map((pos, index) => (
                    <Popover
                        showArrow
                        content={
                            <article>
                                Hi ByteDancer, this is a popover.
                                <br /> We have 2 lines.
                            </article>
                        }
                        position={Array.isArray(pos) ? pos[0] : pos}
                        key={index}
                    >
                        <Tag>{Array.isArray(pos) ? pos[1] : pos}</Tag>
                    </Popover>
                ))}
            </div>
            <div style={{ width: 40, marginLeft: 180 }}>
                {rights.map((pos, index) => (
                    <Popover
                        showArrow
                        content={
                            <article>
                                Hi ByteDancer, this is a popover.
                                <br /> We have 2 lines.
                            </article>
                        }
                        position={Array.isArray(pos) ? pos[0] : pos}
                        key={index}
                    >
                        <Tag>{Array.isArray(pos) ? pos[1] : pos}</Tag>
                    </Popover>
                ))}
            </div>
            <div style={{ marginLeft: 40, clear: 'both', whiteSpace: 'nowrap' }}>
                {bottoms.map((pos, index) => (
                    <Popover
                        showArrow
                        content={
                            <article>
                                Hi ByteDancer, this is a popover.
                                <br /> We have 2 lines.
                            </article>
                        }
                        position={Array.isArray(pos) ? pos[0] : pos}
                        key={index}
                    >
                        <Tag>{Array.isArray(pos) ? pos[1] : pos}</Tag>
                    </Popover>
                ))}
            </div>
        </div>
    );
}
```

### 指向元素中心

在**显示小三角**的条件（`showArrow=true`）下，可以传入 `arrowPointAtCenter=true` 使得小三角始终指向元素中心位置。

```jsx live=true
import React from 'react';
import { Popover, Tag } from '@douyinfe/semi-ui';

function Demo() {
    const tops = [
        ['topLeft', 'TL'],
        ['top', 'Top'],
        ['topRight', 'TR'],
    ];
    const lefts = [
        ['leftTop', 'LT'],
        ['left', 'Left'],
        ['leftBottom', 'LB'],
    ];
    const rights = [
        ['rightTop', 'RT'],
        ['right', 'Right'],
        ['rightBottom', 'RB'],
    ];
    const bottoms = [
        ['bottomLeft', 'BL'],
        ['bottom', 'Bottom'],
        ['bottomRight', 'BR'],
    ];

    return (
        <div style={{ paddingLeft: 40 }} className="tag-margin-right">
            <div style={{ marginLeft: 40, whiteSpace: 'nowrap' }}>
                {tops.map((pos, index) => (
                    <Popover
                        showArrow
                        arrowPointAtCenter
                        content={
                            <article>
                                Hi ByteDancer, this is a popover.
                                <br /> We have 2 lines.
                            </article>
                        }
                        position={Array.isArray(pos) ? pos[0] : pos}
                        key={index}
                    >
                        <Tag>{Array.isArray(pos) ? pos[1] : pos}</Tag>
                    </Popover>
                ))}
            </div>
            <div style={{ width: 40, float: 'left' }}>
                {lefts.map((pos, index) => (
                    <Popover
                        showArrow
                        arrowPointAtCenter
                        content={
                            <article>
                                Hi ByteDancer, this is a popover.
                                <br /> We have 2 lines.
                            </article>
                        }
                        position={Array.isArray(pos) ? pos[0] : pos}
                        key={index}
                    >
                        <Tag>{Array.isArray(pos) ? pos[1] : pos}</Tag>
                    </Popover>
                ))}
            </div>
            <div style={{ width: 40, marginLeft: 180 }}>
                {rights.map((pos, index) => (
                    <Popover
                        showArrow
                        arrowPointAtCenter
                        content={
                            <article>
                                Hi ByteDancer, this is a popover.
                                <br /> We have 2 lines.
                            </article>
                        }
                        position={Array.isArray(pos) ? pos[0] : pos}
                        key={index}
                    >
                        <Tag>{Array.isArray(pos) ? pos[1] : pos}</Tag>
                    </Popover>
                ))}
            </div>
            <div style={{ marginLeft: 40, clear: 'both', whiteSpace: 'nowrap' }}>
                {bottoms.map((pos, index) => (
                    <Popover
                        showArrow
                        arrowPointAtCenter
                        content={
                            <article>
                                Hi ByteDancer, this is a popover.
                                <br /> We have 2 lines.
                            </article>
                        }
                        position={Array.isArray(pos) ? pos[0] : pos}
                        key={index}
                    >
                        <Tag>{Array.isArray(pos) ? pos[1] : pos}</Tag>
                    </Popover>
                ))}
            </div>
        </div>
    );
}
```

### 设置浮层背景色

如果你需要定制浮层的背景色或边框颜色，请**务必单独声明 `style` 中的 `backgroundColor` 和 `borderColor` 属性**，这样能够使得“小三角”也能应用相同的背景色和边框颜色。

```jsx live=true
import React from 'react';
import { Popover, Tag } from '@douyinfe/semi-ui';

function Demo() {
    return (
        <div id='popup-parent' style={{ position: 'relative' }}>
            <Popover
                content={
                    <article style={{ padding: 4 }}>
                        Hi, Semi UI Popover.
                    </article>
                }
                getPopupContainer={() => document.querySelector('#popup-parent')}
                trigger='custom'
                visible
                position='right'
                showArrow
                style={{
                    backgroundColor: 'rgba(var(--semi-blue-4),1)',
                    borderColor: 'rgba(var(--semi-blue-4),1)',
                    color: 'var(--semi-color-white)',
                    borderWidth: 1,
                    borderStyle: 'solid',
                }}
            >
                <Tag
                    style={{
                        backgroundColor: 'rgba(var(--semi-blue-4),1)',
                        color: 'var(--semi-color-white)'
                    }}
                >
                    Colorful Popover
                </Tag>
            </Popover>
        </div>
    );
}
```

### 初始化弹出层焦点位置

Popover content 支持传入函数，它的入参是一个对象，将 `initialFocusRef` 绑定在可聚焦 DOM 或组件上，打开面板时会自动聚焦在该位置。

```jsx live=true
import React from 'react';
import { Button, Input, Popover, Space } from '@douyinfe/semi-ui';

() => {
    const renderContent = ({ initialFocusRef }) => {
        return (
            <div style={{ padding: 12 }}>
                <Space>
                    <Button>first focusable element</Button>
                    <Input ref={initialFocusRef} placeholder="focus here" />
                </Space>
            </div>
        );
    };

    return (
        <Popover content={renderContent} trigger="click">
            <Button>click me</Button>
        </Popover>
    );
};
```

### 搭配 Tooltip 或 Popconfirm 使用

请参考[搭配使用](/zh-CN/show/tooltip#%E6%90%AD%E9%85%8D%20Popover%20%E6%88%96%20Popconfirm%20%E4%BD%BF%E7%94%A8)


## API 参考

| 属性               | 说明                      | 类型                       | 默认值                                      | 版本         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------- |------------|
| autoAdjustOverflow | 是否自动调整弹出层展开方向，用于边缘遮挡时自动调整展开方向                                                                                  | boolean                    | true                                        |            |
| arrowPointAtCenter | “小三角”是否指向元素中心，需要同时传入"showArrow=true"                                                                                      | boolean                    | true                                        | **0.34.0** |
| className | 弹出层的样式名                                                                                                                                              | string |  |  |
| closeOnEsc         | 在 trigger 或 弹出层按 Esc 键是否关闭面板，受控时不生效 | boolean | true | **2.8.0**  |
| content            | 显示的内容（函数类型，2.8.0 版本支持）                                                                                                                                  | ReactNode \| ({ initialFocusRef }) => ReactNode          |            |            |
| clickToHide        | 点击弹出层及内部任一元素时是否自动关闭弹层                                                                                                  | boolean                    | false                                       | **0.24.0** |
| disableFocusListener | trigger为`hover`时，不响应键盘聚焦弹出浮层事件，详见[issue#977](https://github.com/DouyinFE/semi-design/issues/977) | boolean | true | **2.17.0** |
| getPopupContainer  | 指定父级 DOM，弹层将会渲染至该 DOM 中，自定义需要设置 `position: relative`  这会改变浮层 DOM 树位置，但不会改变视图渲染位置。                                                                 | function():HTMLElement     | () => document.body                         |            |
| guardFocus         | 当焦点处于弹出层内时，切换 Tab 是否让焦点在弹出层内循环 | boolean | true | **2.8.0**  |
| keepDOM | 关闭时是否保留内部组件不销毁 | boolean | false | **2.31.0** |
| margin     |  弹出层计算溢出时的增加的冗余值，详见[issue#549](https://github.com/DouyinFE/semi-design/issues/549)，作用同 Tooltip margin                        | number\|object                     |            |  **2.25.0**   |
| mouseEnterDelay    | 鼠标移入后，延迟显示的时间，单位毫秒（仅当 trigger 为 hover/focus 时生效）                                                                  | number                     | 50                                          |            |
| mouseLeaveDelay    | 鼠标移出后，延迟消失的时间，单位毫秒（仅当 trigger 为 hover/focus 时生效）                                                                  | number                     | 50                                          |            |
| rePosKey           | 可以更新该项值手动触发弹出层的重新定位                                                                                                         | string\|number             |            |             |
| returnFocusOnClose | 按下 Esc 键后，焦点是否回到 trigger 上，设置 trigger 为 hover, focus, click 时生效 | boolean | true  | **2.8.0**  |
| position           | 方向，可选值：`top`,`topLeft`,`topRight`,`left`,`leftTop`,`leftBottom`,`right`,`rightTop`,`rightBottom`,`bottom`,`bottomLeft`,`bottomRight` | string                     | "bottom"                                    |            |
| spacing            | 弹出层与 children 元素的距离，单位 px（object类型自 v2.45后支持）                                                                                                       | number｜ <ApiType detail='{ x: number; y: number }'>SpacingObject</ApiType>                       | 4(showArrow=false 时) 10(showArrow=true 时) |            |
| showArrow          | 是否显示“小三角”                                                                                                                            | boolean                    |                                             |            |
| stopPropagation    | 是否阻止弹出层上的点击事件冒泡                                                                                                              | boolean                    | false                                       | **0.34.0** |
| style    | 弹出层的内联样式                                                                                                                                             | object |  |  |
| trigger            | 触发方式，可选值：`hover`, `focus`, `click`, `custom`, `contextMenu`（v2.42支持）                                                          | string                     | 'hover'                                     |            |
| visible            | 是否显示，配合trigger='custom'可实现完全受控                                                                                                                                    | boolean                    |                                             |            |
| zIndex             | 弹出层 z-index 值                                                                                                                             | number                     | 1030                                        |            |
| onClickOutSide     | 当弹出层处于展示状态，点击非Children、非浮层内部区域时的回调（仅trigger为custom、click时有效）| function(e:event) |  | **2.1.0**  |
| onEscKeyDown       | 在 trigger 或 弹出层按 Esc 键时调用        | function(e:event) | | **2.8.0**  |
| onVisibleChange    | 弹出层展示/隐藏时触发的回调                                                                                                                 | function(isVisible:boolean) |                                             |            |

## Accessibility

### ARIA

-  关于 role
   - 当 Popover 的 trigger 为 click、custom时，Popover的 content 具有 `dialog` role
   - 当trigger为hover时，Popover的content 具有 `tooltip` role
- Popover 的 content
   - content 的 wrapper 会被自动添加 `id` 属性
- Popover 的 children 
  - 会被自动添加 [aria-expanded](https://www.w3.org/TR/wai-aria-1.1/#aria-expanded) 属性，当 Popover 可见时，属性值为 `true`，不可见时为 `false`
  - 会被自动添加 [aria-haspopup](https://www.w3.org/TR/wai-aria-1.1/#aria-haspopup) 属性，为 `dialog`
  - 会被自动添加 [aria-controls](https://www.w3.org/TR/wai-aria-1.1/#aria-controls) 属性，为 content 的 wrapper 的 id

### 键盘和焦点

- Popover 触发方式设置为 hover 时：鼠标悬浮或聚焦时打开 Popover
- Popover 触发方式设置为 click 时：点击触发器或聚焦时并使用 Enter 键打开 Popover
- Popover 激活后，按下方向键 ⬇️ 将焦点移动到 Popover 上，此时焦点默认处于 Popover 中第一个可交互元素上，用户也可自定义焦点位置（若 Popover 内无可交互元素则表现为无响应）
- 焦点处于 Popover 内时使用 Tab 键，焦点会在 Popover 内循环，使用 Shift + Tab 会反方向移动焦点
- 键盘用户能够通过按 Esc 关闭 Popover，关闭后焦点返回到触发器上（仅当 trigger 为 click 时）

## 设计变量
<DesignToken/>

## FAQ

-   **为什么 Popover 浮层卡片的位置和浮层的触发器的相对位置不符合预期?**  
    Popover 底层依赖了 Tooltip，Tooltip 为了计算定位，需要获取到 children 的真实 DOM 元素，因此 Popover 类型目前支持如下类型的 children：

    1. Class Component，不强制绑定ref，但需要确保 props 可被透传至真实的 DOM 节点上
    2. 使用 forwardRef 包裹后的函数式组件，将 props 与 ref 透传到 children 内真实的 DOM 节点上
    3. 真实 DOM 节点, 如 span，div，p...

    若通过 ref 或 findDOMNode 获取到的真实 DOM 节点宽高并非是你的 children 元素的全部，则位置可能有出入。例如设置了 prefix、suffix 的 Input，Popover位置仍是相对于不包含前缀部分的 input 框进行定位，此时只要在 Input 外层再套一个 div 就能解决问题。

-   **为什么 Popover 浮层卡片在靠近屏幕边界宽度不够时，丢失宽度意外换行?**  
    在 chromium 104 后 对于屏幕边界文本宽度不够时的换行渲染策略发生变化，详细原因可查看 [issue #1022](https://github.com/DouyinFE/semi-design/issues/1022)，semi侧已经在v2.17.0版本修复了这个问题。