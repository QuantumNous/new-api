---
localeCode: zh-CN
order: 69
category: 展示类
title: Dropdown 下拉框
icon: doc-dropdown
brief: 向下弹出的菜单。
---

## 代码演示

### 如何引入

```jsx import
import { Dropdown } from '@douyinfe/semi-ui';
```

### 基本用法

-   在 Dropdown 的 children 中为它的 Trigger 触发器：默认为 hover 展示，可通过 props.trigger 修改为 `click`、`custom`、`contextMenu`等值指定不同触发方式  
-   通过 render 指定下拉框的具体内容：使用 `Dropdown.Menu` 作为父容器，组合使用 `Dropdown.Item`、`Dropdown.Divider`、`Dropdown.Title` 。  
    当然简单场景你也可以仅搭配 `Dropdown.Menu` 与 `Dropdown.Item`，其他元素不是必须的。  
-   `Dropdown.Item` 通过设置 `disabled` 可以禁用某个选项，配置 `type`，可以展示不同颜色的文本，上设置 `icon` 可以快速配置图标。更复杂的自定义结构，你可以通过 children 传入 ReactNode自定义渲染

```jsx live=true
import React from 'react';
import { Dropdown, Button, HotKeys } from '@douyinfe/semi-ui';
import { IconBox, IconSetting, IconForward, IconRefresh, IconSearch, IconAlertCircle } from "@douyinfe/semi-icons";
import { IconToken } from "@douyinfe/semi-icons-lab";

function Demo() {
    return (
        <Dropdown
            position="bottomLeft"
            render={
                <Dropdown.Menu>
                    <Dropdown.Title>分组1</Dropdown.Title>
                    <Dropdown.Item icon={<IconBox />}>
                        Menu Item 1
                        <HotKeys
                            style={{ marginLeft: 20 }}
                            hotKeys={[HotKeys.Keys.Control, HotKeys.Keys.B]}
                            content={['Ctrl', 'B']}
                        ></HotKeys>
                    </Dropdown.Item>
                    <Dropdown.Item icon={<IconSetting />}>
                        Menu Item 2
                        <HotKeys
                            style={{ marginLeft: 20 }}
                            hotKeys={[HotKeys.Keys.Control, HotKeys.Keys.V]}
                            content={['Ctrl', 'V']}
                        ></HotKeys>
                    </Dropdown.Item>
                    <Dropdown.Item disabled icon={<IconForward />}>
                        Menu Item 3
                        <HotKeys
                            style={{ marginLeft: 20 }}
                            hotKeys={[HotKeys.Keys.Control, HotKeys.Keys.F3]}
                            content={['Ctrl', 'F3']}
                        ></HotKeys>
                    </Dropdown.Item>
                    <Dropdown.Divider />
                    <Dropdown.Title>分组2</Dropdown.Title>
                    <Dropdown.Item type="tertiary" icon={<IconRefresh />}>tertiary</Dropdown.Item>
                    <Dropdown.Item type="warning" icon={<IconSearch />}>
                        warning
                    </Dropdown.Item>
                    <Dropdown.Item type="danger" icon={<IconAlertCircle />}>danger</Dropdown.Item>
                </Dropdown.Menu>
            }
        >
            <Button theme="outline" type="tertiary" icon={<IconToken />}>
                Hover Me
            </Button>
        </Dropdown>
    );
}

```

### 嵌套使用

用户可以对 `Dropdown` 进行嵌套使用，此类情况适合具有多个子级选项的情况。

```jsx live=true
import React, { useMemo } from 'react';
import { Dropdown, Button, HotKeys } from '@douyinfe/semi-ui';
import { IconToken } from "@douyinfe/semi-icons-lab";

function Demo() {
    const subDropdown = useMemo(
        () => (
            <Dropdown.Menu>
                <Dropdown.Item>Nested Menu Item 1</Dropdown.Item>
                <Dropdown.Item>Nested  Menu Item 2</Dropdown.Item>
                <Dropdown.Item>Nested  Menu Item 3</Dropdown.Item>
            </Dropdown.Menu>
        ),
        []
    );

    return (
        <div style={{ margin: 100 }}>
            <Dropdown
                render={
                    <Dropdown.Menu>
                        <Dropdown position={'rightTop'} render={subDropdown}>
                            <Dropdown.Item>Menu Item 1</Dropdown.Item>
                        </Dropdown>
                        <Dropdown position={'leftTop'} render={subDropdown}>
                            <Dropdown.Item>Menu Item 2</Dropdown.Item>
                        </Dropdown>
                        <Dropdown.Item>Menu Item 3</Dropdown.Item>
                    </Dropdown.Menu>
                }
            >
                <Button theme="outline" type="tertiary" icon={<IconToken />}>
                    Hover Me
                </Button>
            </Dropdown>
        </div>
    );
}
```

### 弹出位置

支持的位置同 [Tooltip](https://semi.design/zh-CN/show/tooltip#%E4%BD%8D%E7%BD%AE)，常用的是："bottom", "bottomLeft", "bottomRight" 这三种。

```jsx live=true
import React from 'react';
import { Dropdown, Tag } from '@douyinfe/semi-ui';

function Demo() {
    return (
        <div>
            <Dropdown
                position={'bottom'}
                render={
                    <Dropdown.Menu>
                        <Dropdown.Item>Menu Item 1</Dropdown.Item>
                        <Dropdown.Item>Menu Item 2</Dropdown.Item>
                        <Dropdown.Item>Menu Item 3</Dropdown.Item>
                    </Dropdown.Menu>
                }
            >
                <Tag>Bottom</Tag>
            </Dropdown>
            <br />
            <br />
            <Dropdown
                position={'bottomLeft'}
                render={
                    <Dropdown.Menu>
                        <Dropdown.Item>Menu Item 1</Dropdown.Item>
                        <Dropdown.Item>Menu Item 2</Dropdown.Item>
                        <Dropdown.Item>Menu Item 3</Dropdown.Item>
                    </Dropdown.Menu>
                }
            >
                <Tag>bottomLeft</Tag>
            </Dropdown>
            <br />
            <br />
            <Dropdown
                position={'bottomRight'}
                render={
                    <Dropdown.Menu>
                        <Dropdown.Item>Menu Item 1</Dropdown.Item>
                        <Dropdown.Item>Menu Item 2</Dropdown.Item>
                        <Dropdown.Item>Menu Item 3</Dropdown.Item>
                    </Dropdown.Menu>
                }
            >
                <Tag>bottomRight</Tag>
            </Dropdown>
        </div>
    );
}
```

### 触发方式

默认是移入触发，可通过获取焦点(focus)，点击(click)或自定义事件触发菜单展开。  
contextMenu 方式在 v2.42 后提供

```jsx live=true
import React from 'react';
import { Dropdown, Tag, Input, Button } from '@douyinfe/semi-ui';

function Demo() {
    return (
        <div>
            <Dropdown
                trigger={'hover'}
                position={'bottomLeft'}
                render={
                    <Dropdown.Menu>
                        <Dropdown.Item>Menu Item 1</Dropdown.Item>
                        <Dropdown.Item>Menu Item 2</Dropdown.Item>
                        <Dropdown.Item>Menu Item 3</Dropdown.Item>
                    </Dropdown.Menu>
                }
            >
                <Tag>Hover me</Tag>
            </Dropdown>
            <br />
            <br />
            <Dropdown
                trigger={'focus'}
                position={'bottomLeft'}
                render={
                    <Dropdown.Menu tabIndex={-1}>
                        <Dropdown.Item>Menu Item 1</Dropdown.Item>
                        <Dropdown.Item>Menu Item 2</Dropdown.Item>
                        <Dropdown.Item>Menu Item 3</Dropdown.Item>
                    </Dropdown.Menu>
                }
            >
                <div
                    style={{
                        border: '1px solid var(--semi-color-border)',
                        borderRadius: 4,
                        height: 36,
                        width: 220,
                    }}
                >
                    Please use Tab to focus this div
                </div>
            </Dropdown>
            <br />
            <br />
            <Dropdown
                trigger={'click'}
                position={'bottomLeft'}
                render={
                    <Dropdown.Menu>
                        <Dropdown.Item>Menu Item 1</Dropdown.Item>
                        <Dropdown.Item>Menu Item 2</Dropdown.Item>
                        <Dropdown.Item>Menu Item 3</Dropdown.Item>
                    </Dropdown.Menu>
                }
            >
                <Button>Click me</Button>
            </Dropdown>
            <br />
            <br />
            <Dropdown
                trigger={'contextMenu'}
                position={'bottomRight'}
                render={
                    <Dropdown.Menu>
                        <Dropdown.Item>Menu Item 1</Dropdown.Item>
                        <Dropdown.Item>Menu Item 2</Dropdown.Item>
                        <Dropdown.Item>Menu Item 3</Dropdown.Item>
                    </Dropdown.Menu>
                }
            >
                <Button theme="solid" type="secondary" style={{ marginBottom: 20 }}>
                    Right click (ContextMenu)
                </Button>
            </Dropdown>
        </div>
    );
}
```

### 触发事件

点击菜单项后可触发不同鼠标事件，支持 `onClick`，`onMouseEnter`， `onMouseLeave` 和 `onContextMenu`。

```jsx live=true
import React from 'react';
import { Dropdown, Button, Toast } from '@douyinfe/semi-ui';
import { IconToken } from "@douyinfe/semi-icons-lab";

() => {
    return (
        <Dropdown
            trigger={'click'}
            position={'bottomLeft'}
            render={
                <Dropdown.Menu>
                    <Dropdown.Item onClick={() => Toast.info({ content: 'You clicked me!' })}>
                        1: click me!
                    </Dropdown.Item>
                    <Dropdown.Item onMouseEnter={() => Toast.info({ content: 'Nice to meet you!' })}>
                        2: mouse enter
                    </Dropdown.Item>
                    <Dropdown.Item onMouseLeave={() => Toast.info({ content: 'See ya!' })}>
                        3: mouse leave
                    </Dropdown.Item>
                    <Dropdown.Item onContextMenu={() => Toast.info({ content: 'Right clicked!' })}>
                        4: right click
                    </Dropdown.Item>
                </Dropdown.Menu>
            }
        >
            <Button theme="outline" type="tertiary" icon={<IconToken />}>
                Click Me
            </Button>
        </Dropdown>
    );
};
```

### Json 用法

可以通过 menu 属性，传入 JSON Array 快速配置出下拉框菜单

```jsx live=true
import React from 'react';
import { Dropdown, Button } from '@douyinfe/semi-ui';
import { IconToken } from "@douyinfe/semi-icons-lab";

function DropdownEvents() {
    const menu = [
        { node: 'title', name: '分组1' },
        { node: 'item', name: 'primary1', type: 'primary', onClick: () => console.log('click primary') },
        { node: 'item', name: 'secondary', type: 'secondary' },
        { node: 'divider' },
        { node: 'title', name: '分组2' },
        { node: 'item', name: 'tertiary', type: 'tertiary' },
        { node: 'item', name: 'warning', type: 'warning', active: true },
        { node: 'item', name: 'danger', type: 'danger' },
    ];
    return (
        <Dropdown trigger={'click'} showTick position={'bottomLeft'} menu={menu}>
            <Button theme="outline" type="tertiary" icon={<IconToken />}>
                Click Me
            </Button>
        </Dropdown>
    );
}
```

## API 参考

### Dropdown

| 属性 | 说明 | 类型 | 默认值 | 版本 |
| --- | --- | --- | --- | --- |
| autoAdjustOverflow | 弹出层被遮挡时是否自动调整方向 | boolean | true |  |
| closeOnEsc | 在 trigger 或 弹出层按 Esc 键是否关闭面板，受控时不生效 | boolean | true ｜ **2.13.0** |
| className | 下拉弹层外层样式类名 | string |  |  |
| children | 触发弹出层的 Trigger 元素 | ReactNode |  |  |
| clickToHide | 在弹出层内点击时是否自动关闭弹出层 | boolean |  | |
| contentClassName | 下拉菜单根元素类名 | string |  |  |
| disableFocusListener | trigger为`hover`时，不响应键盘聚焦弹出浮层事件，详见[issue#977](https://github.com/DouyinFE/semi-design/issues/977) | boolean | false | **2.17.0** |
| getPopupContainer | 指定父级 DOM，弹层将会渲染至该 DOM 中，自定义需要设置 `position: relative` 这会改变浮层 DOM 树位置，但不会改变视图渲染位置。 | function():HTMLElement | () => document.body |  |
| keepDOM | 关闭时是否保留内部组件 DOM 不销毁 | boolean | false | **2.31.0** |
| margin | 弹出层计算溢出时的增加的冗余值，详见[issue#549](https://github.com/DouyinFE/semi-design/issues/549)，作用同 Tooltip margin | number\|object |  | **2.25.0** |
| mouseEnterDelay | 鼠标移入 Trigger 后，延迟显示的时间，单位毫秒（仅当 trigger 为 hover/focus 时生效） | number | 50 |  |
| mouseLeaveDelay | 鼠标移出弹出层后，延迟消失的时间，单位毫秒（仅当 trigger 为 hover/focus 时生效） | number | 50 |  |
| menu | 通过传入 JSON Array 来快速配置 Dropdown 内容 | Array<DropdownMenuItem\> | [] |  |
| position | 弹出菜单的位置，常用："bottom", "bottomLeft", "bottomRight"，更多详见[Tooltip 位置](https://semi.design/zh-CN/show/tooltip#%E4%BD%8D%E7%BD%AE) | string | "bottom" |  |
| render | 弹出层的内容，由 `Dropdown.Menu` 及 `Dropdown.Item`、`Dropdown.Title` 构成 | ReactNode |  |  |
| rePosKey | 可以更新该项值手动触发弹出层的重新定位 | string \| number |  |  |
| spacing | 弹出层与 Trigger 元素（即 Dropdown children）的距离，单位 px | number | 4 |  |
| style | 弹出层内联样式 | object |  |  |
| showTick | 是否自动在 active 的 Dropdown.Item 项左侧展示表示选中的勾 | boolean | false |  |
| stopPropagation | 是否阻止弹出层上的点击事件冒泡 | boolean | false |  |
| trigger | 触发下拉的行为，可选 "hover", "focus", "click", "custom", "contextMenu"(v2.42 后提供) | string | "hover" |  |
| visible | 是否显示菜单，需配合 trigger custom 使用 | boolean | 无 |  |
| zIndex | 弹出层 z-index 值 | number | 1050 |  |
| onClickOutSide | 当弹出层处于展示状态，点击非 Children、非弹出层内部区域时的回调（仅 trigger 为 custom、click 时有效） | function(e:event) |  | **2.1.0** |
| onEscKeyDown | 在 trigger 或 弹出层按 Esc 键时调用 | function(e:event) |  | **2.13.0** |
| onVisibleChange | 弹出层显示状态改变时的回调 | function(visible: boolean) |  |  |

### Dropdown.Menu

| 属性      | 说明                                                                 | 类型      | 默认值 | 版本       |
| --------- | -------------------------------------------------------------------- | --------- | ------ | ---------- |
| className | 下拉弹层菜单样式类名                                                 | string    |        |  |
| children  | 下拉弹层菜单包裹的子元素，一般为 `Dropdown.Item` 或 `Dropdown.Title` | ReactNode |        |            |
| style     | 下拉弹层菜单样式                                                     | object    |        |  |

### Dropdown.Item

| 属性 | 说明 | 类型 | 默认值 | 版本 |
| --- | --- | --- | --- | --- |
| active | 当前项是否处于激活态，激活态时左侧有 √，字体加粗，颜色加深。当 Dropdown 的 showTick 为 false 时，即使 Dropdown.Item 的 active 为 true，√ 也不会展示 | bool | false |  |
| className | 样式类名 | string |  |  |
| disabled | 是否禁用菜单 | boolean | false |  |
| icon | 图标 | ReactNode |  |  |
| style | 内联样式 | object |  |  |
| type | 类型，可选值："primary"、"secondary"、"tertiary"、"warning"、"danger" | string | "tertiary" |  |
| onClick | 单击触发的回调事件 | function | 无 |  |
| onMouseEnter | MouseEnter 触发的回调事件 | function | 无 |  |
| onMouseLeave | MouseLeave 触发的回调事件 | function | 无 |  |
| onContextMenu | 点击鼠标右键触发的回调事件 | function | 无 |  |

### Dropdown.Title

| 属性      | 说明     | 类型   | 默认值 |
| --------- | -------- | ------ | ------ |
| className | 样式类名 | string | ""     |
| style     | 内联样式 | object | {}     |

### DropdownMenuItem

| 属性                                     | 说明                                       | 类型   | 默认值 |
| ---------------------------------------- | ------------------------------------------ | ------ | ------ |
| node                                     | 按钮类型，可选：`title`，`item`，`divider` | string |        |
| name                                     | 菜单文本，标题或 Item 的内容               | string |        |
| 其他属性与 Title、Item、Divider 属性对应 |                                            |        |        |

## Accessibility

### ARIA

-   Dropdown.Menu `role` 设置为 `menu`，`aria-orientatio` 设置为 `vertical`
-   Dropdown.Item `role` 设置为 `menuitem`
-   ### 键盘和焦点
-   Dropdown 的触发器可被聚焦，目前支持 3 种触发方式：
    -   触发方式设置为 hover 或 focus 时：鼠标悬浮或聚焦时打开 Dropdown，Dropdown 打开后，用户可以使用 `下箭头` 将焦点移动到 Dropdown 内
    -   触发方式设置为 click 时：点击触发器或聚焦时使用 `Enter` 或 `Space` 键可以打开 Dropdown，此时焦点自动聚焦到 Dropdown 中的第一个非禁用项上
-   当焦点位于 Dropdown 内的菜单项上时：
    -   键盘用户可以使用键盘 `上箭头` 或 `下箭头` 切换可交互元素
    -   使用 `Enter` 键 或 `Space` 键可以激活聚焦的菜单项, 若菜单项绑定了 onClick，事件会被触发
-   键盘用户可以通过按 `Esc` 关闭 Dropdown，关闭后焦点返回到触发器上
-   键盘交互暂未完整支持嵌套场景

## 文案规范

-   下拉框内选项内容需要表述准确且包含信息，使用户在浏览时更加容易在选项中选择
-   使用语句式的大小写，并且简洁明了地书写选项
-   如果是动作选项，使用动词或者动词短语来描述用户选择该选项后会发生的动作。举个例子，"Move", "Log time", or "Hide labels"
-   不使用介词

| ✅ 推荐用法 | ❌ 不推荐用法 |
| --- | --- |
| <div style={{ height: 150}}><Dropdown visible trigger={'custom'} autoAdjustOverflow={false} position={'bottomLeft'} menu={[{ node: 'item', name: 'Add text' },{ node: 'item', name: 'Add link' },{ node: 'item', name: 'Add image' },{ node: 'item', name: 'Add video' }]} /></div> | <div style={{ height: 150}}><Dropdown visible trigger={'custom'} autoAdjustOverflow={false} position={'bottomLeft'} menu={[{ node: 'item', name: 'Add a text' },{ node: 'item', name: 'Add a link' },{ node: 'item', name: 'Add a image' },{ node: 'item', name: 'Add a video' }]} /></div> |

## 设计变量

<DesignToken/>

## FAQ

-   **为什么 Dropdown 浮层在靠近屏幕边界宽度不够时，丢失宽度意外换行?**  
    在 chromium 104 后 对于屏幕边界文本宽度不够时的换行渲染策略发生变化，详细原因可查看 [issue #1022](https://github.com/DouyinFE/semi-design/issues/1022)，semi 侧已经在 v2.17.0 版本修复了这个问题。

<!--
## 相关物料

```material
5
``` -->

## 相关物料

<semi-material-list code="5"></semi-material-list>
