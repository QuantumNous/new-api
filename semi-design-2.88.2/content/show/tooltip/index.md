---
localeCode: zh-CN
order: 83
category: 展示类
title: Tooltip 工具提示
icon: doc-tooltip
width: 65%
brief: 工具提示用于对一个元素进行标识或者附上少量辅助信息，最典型的场景是向用户解释图标的含义、展示被截断的文本、显示图片的描述等。
---

## 代码演示

### 如何引入

```jsx import
import { Tooltip } from '@douyinfe/semi-ui';
```

### 注意事项

Tooltip 需要将 DOM 事件监听器应用到 children 中，如果子元素是自定义的组件，你需要确保它能将属性传递至底层的 DOM 元素

同时为了计算弹出层的定位，需要获取到 children 的真实 DOM 元素，因此 Tooltip 支持如下类型的 children

1. 使用 forwardRef 包裹后的函数式组件，将 props 与 ref 透传到 children 内真实的 DOM 节点上
2. 真实 DOM 节点, 如 span，div，p...
3. Class Component，不强制绑定ref，但需要确保 props 可被透传至真实的 DOM 节点上 (**注**: 此条规则仅在 React 版本低于 v19 时使用 @douyinfe/semi-ui 可行， 在 React v19 版本使用 @douyinfe/semi-ui-19 不可行，详情见 [React v19 适配注意事项](/zh-CN/start/react19#%E6%B3%A8%E6%84%8F%E4%BA%8B%E9%A1%B9))


```jsx live=true noInline=true dir="column"
import React, { forwardRef } from 'react';
import { Tooltip, Space } from '@douyinfe/semi-ui';

const style={ border: '2px solid var(--semi-color-border)', paddingLeft: 4, paddingRight: 4, borderRadius: 4 };

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

function Demo() {
    return (
        <Space>
            <Tooltip content={'semi design'}>
                <FCChildren />
            </Tooltip>
            <Tooltip content={'semi design'}>
                <MyComponent />
            </Tooltip>
            <Tooltip content={'semi design'}>
                <span style={style}>DOM</span>
            </Tooltip>
        </Space>
    );
}
render(Demo);

```

### 位置

可以通过 position 配置弹出层方向以及对齐位置，position 详细可选值请参考下方 API 文档  
配置为 `top` 时 向上弹出  
配置为 `topLeft` 时，向上弹出，且弹出层与 children 左对齐（当arrowPointAtCenter=false时）  
配置为 `topRight` 时，向上弹出，且弹出层与 children 右对齐（当arrowPointAtCenter=false时）    
其他方向同理  

```jsx live=true dir="column"
import React from 'react';
import { Tooltip, Tag } from '@douyinfe/semi-ui';

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
        <div>
            <div style={{ marginLeft: 80, whiteSpace: 'nowrap' }}>
                {tops.map((pos, index) => (
                    <Tooltip
                        content={
                            <article>
                                <p>hi bytedance</p>
                                <p>hi bytedance</p>
                            </article>
                        }
                        arrowPointAtCenter={false}
                        position={Array.isArray(pos) ? pos[0] : pos}
                        key={index}
                    >
                        <Tag style={{ margin: 8, padding: 20 }}>{Array.isArray(pos) ? pos[1] : pos}</Tag>
                    </Tooltip>
                ))}
            </div>
            <div style={{ width: 80, float: 'left' }}>
                {lefts.map((pos, index) => (
                    <Tooltip
                        content={
                            <article>
                                <p>hi bytedance</p>
                                <p>hi bytedance</p>
                            </article>
                        }
                        arrowPointAtCenter={false}
                        position={Array.isArray(pos) ? pos[0] : pos}
                        key={index}
                    >
                        <Tag style={{ margin: 8, padding: 20, width: 60 }}>{Array.isArray(pos) ? pos[1] : pos}</Tag>
                    </Tooltip>
                ))}
            </div>
            <div style={{ width: 40, marginLeft: 300 }}>
                {rights.map((pos, index) => (
                    <Tooltip
                        content={
                            <article>
                                <p>hi bytedance</p>
                                <p>hi bytedance</p>
                            </article>
                        }
                        arrowPointAtCenter={false}
                        position={Array.isArray(pos) ? pos[0] : pos}
                        key={index}
                    >
                        <Tag style={{ margin: 8, padding: 20, width: 60 }}>{Array.isArray(pos) ? pos[1] : pos}</Tag>
                    </Tooltip>
                ))}
            </div>
            <div style={{ marginLeft: 80, clear: 'both', whiteSpace: 'nowrap' }}>
                {bottoms.map((pos, index) => (
                    <Tooltip
                        content={
                            <article>
                                <p>hi bytedance</p>
                                <p>hi bytedance</p>
                            </article>
                        }
                        arrowPointAtCenter={false}
                        position={Array.isArray(pos) ? pos[0] : pos}
                        key={index}
                    >
                        <Tag style={{ margin: 8, padding: 20, width: 60 }}>{Array.isArray(pos) ? pos[1] : pos}</Tag>
                    </Tooltip>
                ))}
            </div>
        </div>
    );
}
```
### 指向元素中心

默认情况下 `arrowPointAtCenter=true`，小三角始终指向 children 元素中心位置。
你可以将其设置为 false，此时小三角将不再保持指向元素中心。弹出层与 children 边缘对齐

```jsx live=true
import React from 'react';
import { Tooltip, Button } from '@douyinfe/semi-ui';

function Demo() {
    return (
        <>
            <div>
                <Tooltip
                    position='topLeft'
                    content='semi design tooltip'>
                    <Button type='secondary' style={{ marginRight: 8 }}>指向元素中心</Button>
                </Tooltip>
            </div>

            <div style={{ marginTop: 20 }}>
                <Tooltip
                    content='semi design tooltip'
                    arrowPointAtCenter={false}
                    position='topLeft'
                >
                    <Button type='secondary' style={{ marginRight: 8, width: 120 }}>边缘对齐</Button>
                </Tooltip>
            </div>
        </>
    );
};

```
### 触发时机

-   配置触发展示的时机，默认为 `hover`，可选 `hover`/`focus`/`click`/`custom`/ 'contextMenu' 
-   设为 `custom` 时，需要配合 `visible` 属性使用，此时显示与否完全受控
-   contextMenu 右键触发在 v 2.42.0 后开始提供

```jsx live=true hideInDSM
import React, { useState } from 'react';
import { Tooltip, Button, Input, RadioGroup, Radio } from '@douyinfe/semi-ui';

function Demo() {
    const [visible, setVisible] = useState(false);
    // container 需要设置 position: relative
    const getPopupContainer = () => document.querySelector('#tooltip-container');

    return (
        <div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }} id="tooltip-container">
            <div style={{ width: '150%', height: '150%', paddingLeft: 50, paddingTop: 50 }}>
                <Tooltip content={'hi bytedance'} getPopupContainer={getPopupContainer}>
                    <Button theme='solid' type='tertiary' style={{ marginBottom: 20 }}>悬停显示</Button>
                </Tooltip>
                <br />
                <Tooltip content={'hi bytedance'} trigger="click" getPopupContainer={getPopupContainer}>
                    <Button style={{ marginBottom: 20 }}>点击显示</Button>
                </Tooltip>
                <br />
                <Tooltip content={'hi bytedance'} trigger="focus" getPopupContainer={getPopupContainer}>
                    <Input style={{ width: 100, marginBottom: 20 }} placeholder="聚焦显示" />
                </Tooltip>
                <br />
                <Tooltip content={'hi bytedance'} trigger="contextMenu" getPopupContainer={getPopupContainer}>
                    <Button theme='solid' type='secondary' style={{ marginBottom: 20 }}>右键点击展示</Button>
                </Tooltip>
                <br />
                <Tooltip
                    content={'hi bytedance'}
                    trigger="custom"
                    visible={visible}
                    getPopupContainer={getPopupContainer}
                >
                    <span style={{ display: 'inline-block' }}>
                        <RadioGroup type='button' onChange={(e) => setVisible(e.target.value)} value={visible}>
                            <Radio value={true}>受控显示</Radio>
                            <Radio value={false}>受控隐藏</Radio>
                        </RadioGroup>
                    </span>
                </Tooltip>
            </div>
        </div>
    );
}
```

### 覆盖特定样式

你可以通过 className、style 为弹出层配置特定样式，例如覆盖默认的 maxWidth （240px）
```jsx live=true
import React from 'react';
import { Tooltip, Tag } from '@douyinfe/semi-ui';

() => {
    return (
        <div>
            <Tooltip
                style={{
                    maxWidth: 320
                }}
                className='another-classname'
                content={'hi semi semi semi semi semi semi semi'}
            >
                <Tag style={{ marginRight: '8px' }}>Custom Style And ClassName</Tag>
            </Tooltip>
        </div>
    );
};
```
### 渲染至指定 DOM

传入 `getPopupContainer`，弹层将会渲染至该函数返回的 DOM 中。 这会改变浮层 DOM 树位置，但不会改变视图渲染位置。

**需要注意的是：** 返回的容器如果不是 `document.body`，**`position` 需要设为 `"relative"`**

```jsx live=true hideInDSM
import React from 'react';
import { Tooltip, Tag } from '@douyinfe/semi-ui';

function Demo() {
    return (
        <div id="tooltip-wrapper" style={{ position: 'relative' }}>
            <Tooltip
                position="right"
                content="浮层被渲染至#tooltip-wrapper元素中"
                trigger="click"
                getPopupContainer={() => document.querySelector('#tooltip-wrapper')}
            >
                <Tag>点击此处</Tag>
            </Tooltip>
        </div>
    );
}
```
### 搭配 Popover 或 Popconfirm 使用

Tooltip、Popconfirm、Popover 都需要劫持 children 的相关事件（onMouseEnter/onMouseLeave/onClick....），用于配置 trigger。  
如果直接嵌套使用的话，会使外层 trigger 失效。  
需要在中间加一层元素（div 或 span）以防止 trigger 的事件劫持失效。

```jsx live=true hideInDSM
import React from 'react';
import { Tooltip, Popconfirm, Button } from '@douyinfe/semi-ui';

() => (
    <Popconfirm content="是否确认删除" title='确认' style={{ width: 320 }}>
        <span style={{ display: 'inline-block' }}>
            <Tooltip content={'删除评价'}>
                <Button type="danger">删除</Button>
            </Tooltip>
        </span>
    </Popconfirm>
);
```

### 仅当内容宽度超出时展示 Tooltip

Semi 为这种场景提供了 Typography 组件，可以更简单快捷地满足需求。不需要自己再对 Tooltip 的出现做条件判断，详细的使用请参考[Typography 组件文档](/zh-CN/basic/typography#%E7%9C%81%E7%95%A5%E6%96%87%E6%9C%AC)

```jsx live=true hideInDSM
import React from 'react';
import { Typography } from '@douyinfe/semi-ui';

function Demo() {
    const { Paragraph, Title, Text } = Typography;

    return (
        <div>
            <Title heading={5} ellipsis={{ showTooltip: true }} style={{ width: 250 }}>
                是一个很长很长很长很长5号标题
            </Title>
            <br />
            <Text link ellipsis={{ showTooltip: true, pos: 'middle' }} style={{ width: 150 }}>
                是一个很长很长很长很长的链接
            </Text>
            <br />
            <br />
            <Paragraph
                ellipsis={{ rows: 3, showTooltip: { type: 'popover', opts: { style: { width: 300 } } } }}
                style={{ width: 300 }}
            >
                多行截断，展示 Popover：Semi Design 是由抖音前端团队与 UED
                团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
                Web 应用。
            </Paragraph>
        </div>
    );
}
```

## API 参考

---

| 属性 | 说明                                                                                                                                                   | 类型 | 默认值 | 版本 |
| --- |------------------------------------------------------------------------------------------------------------------------------------------------------| --- | --- | --- |
| autoAdjustOverflow | 弹出层被遮挡时是否自动调整方向                                                                                                                                      | boolean | true |  |
| arrowPointAtCenter | “小三角”是否指向元素中心，需要同时传入"showArrow=true"                                                                                                                 | boolean | true |  |
| content | 弹出层内容                                                                                                                                                | string\|ReactNode |  |  |
| className | 弹出层的样式名                                                                                                                                              | string |  |  |
| clickToHide | 点击弹出层及内部任一元素时是否自动关闭弹层                                                                                                                                | boolean | false |  |
| disableFocusListener | trigger为`hover`时，不响应键盘聚焦弹出浮层事件，详见[issue#977](https://github.com/DouyinFE/semi-design/issues/977)                                                     | boolean | false | **2.17.0** |
| getPopupContainer | 指定父级 DOM，弹层将会渲染至该 DOM 中，自定义需要设置 `position: relative` 这会改变浮层 DOM 树位置，但不会改变视图渲染位置。                                                                                                 | function():HTMLElement | () => document.body |  |
| keepDOM | 关闭时是否保留内部组件不销毁                                                                                                                                       | boolean | false | **2.31.0** |
| margin | 计算溢出时的增加的冗余值，详见[issue#549](https://github.com/DouyinFE/semi-design/issues/549)                                                                       | number ｜ <ApiType detail='{ marginLeft: number; marginTop: number; marginRight: number; marginBottom: number }'>MarginObject</ApiType> | 0 |  **2.23.0**|
| mouseEnterDelay | 鼠标移入后，延迟显示的时间，单位毫秒（仅当 trigger 为 hover/focus 时生效）                                                                                                     | number | 50 |  |
| mouseLeaveDelay | 鼠标移出后，延迟消失的时间，单位毫秒（仅当 trigger 为 hove/focus 时生效），不小于 mouseEnterDelay                                                                                  | number | 50 |  |
| motion | 是否展示弹出层动画                                                                                                                                            | boolean | true |  |
| position | 弹出层展示位置，可选值：`top`, `topLeft`, `topRight`, `left`, `leftTop`, `leftBottom`, `right`, `rightTop`, `rightBottom`, `bottom`, `bottomLeft`, `bottomRight` | string | 'top' |  |
| prefixCls | 弹出层 wrapper div 的 `className` 前缀，设置该项时，弹出层将不再带 Tooltip 的样式                                                                                           | string | 'semi-tooltip' |  |
| preventScroll | 指示浏览器是否应滚动文档以显示新聚焦的元素，作用于组件内的 focus 方法                                                                                                               | boolean |  |  |
| rePosKey | 可以更新该项值手动触发弹出层的重新定位                                                                                                                                  | string\|number |  |  |
| style    | 弹出层的内联样式                                                                                                                                             | object |  |  |
| spacing | 弹出层与 `children` 元素的距离，单位 px（object类型自 v2.45后支持）                                                                                                                     | number ｜ <ApiType detail='{ x: number; y: number }'>SpacingObject</ApiType>  | 8 |  |
| showArrow | 是否显示箭头三角形                                                                                                                                            | boolean | true |  |
| stopPropagation | 是否阻止弹层上的点击事件冒泡                                                                                                                                       | boolean | false |  |
| transformFromCenter | 是否从包裹的元素水平或垂直中心处变换，该参数仅影响动效变换的 `transform-origin`，一般无需改动                                                                                             | boolean | true |  |
| trigger | 触发展示的时机，可选值：`hover` / `focus` / `click` / `custom` / `contextMenu` (v2.42后提供)                                                                                                   | string | 'hover' |  |
| visible | 是否展示弹出层, 需配合 trigger='custom' 使用                                                                                                                                            | boolean |  |  |
| wrapperClassName | 当 children 为 disabled ，或者 children 为多个元素时，外层将会包裹一层 span 元素，该 api 用于设置此 span 的样式类名                                                                    | string |  |  |
| wrapperId | 弹出层 wrapper 节点的 id，trigger 的 aria 属性指向此 id，若不设置组件会随机生成一个 id                                                                                          | string |  | 2.11.0  |
| zIndex | 弹层层级                                                                                                                                                 | number | 1060 |  |
| onVisibleChange | 弹出层展示/隐藏时触发的回调                                                                                                                                       | function(isVisible:boolean) |  |  |
| onClickOutSide | 当弹出层处于展示状态，点击非Children、非浮层内部区域时的回调（仅trigger为custom、click时有效）                                                                                         | function(e:event) |  | **2.1.0** |

## Accessibility

### ARIA

- Tooltip 具有 `tooltip` role，遵循 [WAI-ARIA](https://www.w3.org/TR/wai-aria-practices/#tooltip) 规范中对于 Tooltip 的定义
- Tooltip 的 content 与 children
  - 关于 content
      - content 的 wrapper 会被自动添加 id 属性，用于与 children 的 `aria-describedby` 匹配，关联 content 与 children
  - 关于 children
       - Tooltip 的内容（content）与其触发器（children）之间应当具有显式联系。Tooltip 会自动为 children 元素添加 `aria-describedby` 属性，值为 content wraper的 id
       - 若你 Tooltip的children 是Icon，不包含可见文本，我们推荐你在 children 上添加 `aria-label` 属性进行相应描述

```js
// Good practices, add aria-label to description tooltip children
/* eslint-disable */
<Tooltip content={<p id='description'>Edit your setting</p>}>
    <IconSetting aria-label='Settings'> 
    </IconSetting>
</Tooltip>
```

## 文案规范
- 只展示信息说明和引导，不展示报错信息
- 不在 tooltip 里只能是额外的链接和按钮
- 尽量精简至一句话进行说明，不展示标点符号

## 设计变量

<DesignToken/>

## FAQ

-   **为什么 Tooltip content 配置很长很长的内容时，某些情况下内容会超出显示区域?**  
    在 v2.36.0 版本以前，考虑到不同语言内容（纯英文、中文、中英文混合、其他语种混合）对换行的需求不太一致，所以组件层没有做这个预设。在接收到较多使用反馈后，自 v2.36.0 版本，Tooltip 内部通过设置 <a href="https://developer.mozilla.org/en-US/docs/Web/CSS/overflow-wrap" target="_blank" rel="noopener noreferrer">word-wrap</a> 为 break-word 处理文本换行。对于任意版本，如果默认设置不符合预期，使用方都可以通过 style/className API 设置换行相关 CSS 属性进行调整。


<!-- ## 相关物料

```material
41
``` -->
## 相关物料
<semi-material-list code="41"></semi-material-list>