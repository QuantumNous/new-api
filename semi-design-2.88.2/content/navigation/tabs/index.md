---
localeCode: zh-CN
order: 59
category: 导航类
title: Tabs 标签栏
icon: doc-tabs
brief: 当内容需要分组并在不同模块页面中展示，可使用 Tabs 标签栏目对不同的组/页之间进行切换
---

## 代码演示

### 如何引入

```jsx import
import { Tabs, TabPane } from '@douyinfe/semi-ui';
```

### 基本用法

标签栏支持三种样式的显示：线条式，按钮式，卡片式，斜线式。默认选中第一项。  
标签页支持两种传入方式，两者渲染流程上有所区别：

-   通过 `tabList` 传入标签页对象的数组，当使用 `tabList` 时每次只渲染当前传入的节点
-   或使用 `<TabPane>` 逐项显式传入，使用 `<TabPane>` 时默认会渲染所有面板，可以通过设置 `keepDOM={false}` 只渲染当前面板，此时不会有动画效果。

<Notice title='注意事项'>
    1. tabList 与 TabPane Children 同时使用时，会优先渲染通过 tabList 传入的数据。不建议同时配置 <br/>
    2. 使用 TabPane Children 时， TabPane 必须为 Tabs 的直接子元素，否则 Tabs 将无法正确收集子组件如 itemKey 等相关属性
</Notice>

```jsx live=true
import React from 'react';
import { Tabs, TabPane } from '@douyinfe/semi-ui';

() => (
    <div>
        <Tabs type="line">
            <TabPane tab="文档" itemKey="1">
                <h3>文档</h3>
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
                        <p>效率场景加入人性化关怀。</p>
                    </li>
                </ul>
            </TabPane>
            <TabPane tab="快速起步" itemKey="2">
                <h3>快速起步</h3>
                <pre
                    style={{
                        margin: '24px 0',
                        padding: '20px',
                        border: 'none',
                        whiteSpace: 'normal',
                        borderRadius: 'var(--semi-border-radius-medium)',
                        color: 'var(--semi-color-text-1)',
                        backgroundColor: 'var(--semi-color-fill-0)',
                    }}
                >
                    <code>yarn add @douyinfe/semi-ui</code>
                </pre>
            </TabPane>
            <TabPane tab="帮助" itemKey="3">
                <h3>帮助</h3>
                <p style={{ lineHeight: 1.8, color: 'var(--semi-color-text-0)', fontWeight: 600 }}>
                    Q：有新组件需求、或者现有组件feature不能满足业务需求？
                </p>
                <p style={{ lineHeight: 1.8, color: 'var(--semi-color-text-1)' }}>
                    右上角问题反馈，提交issue，label选择Feature Request / New Component Request 我们会高优处理这些需求。
                </p>
                <p style={{ lineHeight: 1.8, color: 'var(--semi-color-text-0)', fontWeight: 600 }}>
                    Q：对组件的使用有疑惑？
                </p>
                <p style={{ lineHeight: 1.8, color: 'var(--semi-color-text-1)' }}>
                    欢迎进我们的客服lark群进行咨询提问。
                </p>
            </TabPane>
        </Tabs>
    </div>
);
```

```jsx live=true
import React from 'react';
import { Tabs, TabPane } from '@douyinfe/semi-ui';

() => (
    <Tabs type="button">
        <TabPane tab="文档" itemKey="1">
            文档
        </TabPane>
        <TabPane tab="快速起步" itemKey="2">
            快速起步
        </TabPane>
        <TabPane tab="帮助" itemKey="3">
            帮助
        </TabPane>
    </Tabs>
);
```

```jsx live=true
import React from 'react';
import { Tabs } from '@douyinfe/semi-ui';

class TabDemo extends React.Component {
    constructor() {
        super();
        this.state = { key: '1' };
        this.onTabClick = this.onTabClick.bind(this);
    }

    onTabClick(key, type) {
        this.setState({ [type]: key });
    }

    render() {
        // eslint-disable-next-line react/jsx-key
        const contentList = [<div>文档</div>, <div>快速起步</div>, <div>帮助</div>];
        const tabList = [
            { tab: '文档', itemKey: '1' },
            { tab: '快速起步', itemKey: '2' },
            { tab: '帮助', itemKey: '3' },
        ];
        return (
            <Tabs
                type="card"
                tabList={tabList}
                onChange={key => {
                    this.onTabClick(key, 'key');
                }}
            >
                {contentList[this.state.key - 1]}
            </Tabs>
        );
    }
}
```

```jsx live=true
import React from 'react';
import { Tabs } from '@douyinfe/semi-ui';

class TabDemo extends React.Component {
    constructor() {
        super();
        this.state = { key: '1' };
        this.onTabClick = this.onTabClick.bind(this);
    }

    onTabClick(key, type) {
        this.setState({ [type]: key });
    }

    render() {
        // eslint-disable-next-line react/jsx-key
        const contentList = [<div>文档</div>, <div>快速起步</div>, <div>帮助</div>];
        const tabList = [
            { tab: '文档', itemKey: '1' },
            { tab: '快速起步', itemKey: '2' },
            { tab: '帮助', itemKey: '3' },
        ];
        return (
            <Tabs
                type="slash"
                tabList={tabList}
                onChange={key => {
                    this.onTabClick(key, 'key');
                }}
            >
                {contentList[this.state.key - 1]}
            </Tabs>
        );
    }
}
```

### 带图标的

有图标的标签栏。

```jsx live=true
import React from 'react';
import { Tabs, TabPane } from '@douyinfe/semi-ui';
import { IconFile, IconGlobe, IconHelpCircle } from '@douyinfe/semi-icons';

() => (
    <Tabs>
        <TabPane
            tab={
                <span>
                    <IconFile />
                    文档
                </span>
            }
            itemKey="1"
        >
            文档
        </TabPane>
        <TabPane
            tab={
                <span>
                    <IconGlobe />
                    快速起步
                </span>
            }
            itemKey="2"
        >
            快速起步
        </TabPane>
        <TabPane
            tab={
                <span>
                    <IconHelpCircle />
                    帮助
                </span>
            }
            itemKey="3"
        >
            帮助
        </TabPane>
    </Tabs>
);
```

### 更多选项收入 More 展示

支持将多余 Tab 合并为 ”更多“ 下拉菜单，`more` 传入数字即可，数字表示收入下拉菜单的 Tab 数量。**（>=v2.59.0）**

```jsx live=true dir=column
import React from 'react';
import { Tabs, TabPane } from '@douyinfe/semi-ui';

function Demo() {
    return (
        <Tabs more={4} style={{ width: '60%', margin: '20px' }} type="card">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
                <TabPane tab={`Tab-${i}`} itemKey={`Tab-${i}`} key={i}>
                    Content of card tab {i}
                </TabPane>
            ))}
        </Tabs>
    );
}
```

也支持高级配置，向 `more` 传入对象，内可传入

-   `count`: 表示收入下拉菜单的 Tab 数量
-   `render`: 自定义 Trigger 的渲染函数，返回的 ReactNode 会被渲染为下拉菜单的 Trigger
-   `dropdownProps`: 传入 DropDown Props，会被透传到下拉菜单，如果需要自定义下拉菜单，使用 dropdownProps 中的 render 方法

```jsx live=true dir=column
import React from 'react';
import { Tabs, TabPane, Button } from '@douyinfe/semi-ui';

function Demo() {
    return (
        <Tabs
            more={{
                count: 4,
                render: () => {
                    return <Button type='tertiary'>Click to show More</Button>;
                },
                dropdownProps: { trigger: 'click', position: 'bottomRight' },
            }}
            style={{ width: '60%', margin: '20px' }}
            type="card"
        >
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
                <TabPane tab={`Tab-${i}`} itemKey={`Tab-${i}`} key={i}>
                    Content of card tab {i}
                </TabPane>
            ))}
        </Tabs>
    );
}
```

### 垂直的标签栏

`type` 为 `line`, `card`, `button` 支持水平和垂直两种模式，`tabPosition='left|top'`， 默认为 `top`。`type` 为 `slash` 仅支持水平模式，无需设置。

```jsx live=true
import React from 'react';
import { Tabs, TabPane, RadioGroup, Radio } from '@douyinfe/semi-ui';
import { IconFile, IconGlobe, IconHelpCircle } from '@douyinfe/semi-icons';

class App extends React.Component {
    constructor() {
        super();
        this.state = {
            type: 'line',
        };
    }

    onSelect(e) {
        this.setState({
            type: e.target.value,
        });
    }

    render() {
        return (
            <>
                <RadioGroup
                    onChange={e => this.onSelect(e)}
                    value={this.state.type}
                    type="button"
                    style={{
                        display: 'flex',
                        width: 200,
                        justifyContent: 'center',
                    }}
                >
                    <Radio value={'line'}>Line</Radio>
                    <Radio value={'card'}>Card</Radio>
                    <Radio value={'button'}>Button</Radio>
                </RadioGroup>
                <br />
                <br />
                <Tabs tabPosition="left" type={this.state.type}>
                    <TabPane
                        tab={
                            <span>
                                <IconFile />
                                文档
                            </span>
                        }
                        itemKey="1"
                    >
                        <div style={{ padding: '0 24px' }}>
                            <h3>文档</h3>
                            <p style={{ lineHeight: 1.8 }}>
                                Semi Design 是由抖音前端团队与 UED
                                团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
                                Web 应用。
                            </p>
                            <p style={{ lineHeight: 1.8 }}>
                                区别于其他的设计系统而言，Semi Design
                                以用户中心、内容优先、设计人性化为设计理念，具有以下优势：
                            </p>
                        </div>
                    </TabPane>
                    <TabPane
                        tab={
                            <span>
                                <IconGlobe />
                                快速起步
                            </span>
                        }
                        itemKey="2"
                    >
                        <div style={{ padding: '0 24px' }}>
                            <h3>快速起步</h3>
                            <pre
                                style={{
                                    margin: '24px 0',
                                    padding: '20px',
                                    border: 'none',
                                    whiteSpace: 'normal',
                                    borderRadius: '6px',
                                    color: 'var(--semi-color-text-1)',
                                    backgroundColor: 'var(--semi-color-fill-0)',
                                }}
                            >
                                <code>yarn add @douyinfe/semi-ui</code>
                            </pre>
                        </div>
                    </TabPane>
                    <TabPane
                        tab={
                            <span>
                                <IconHelpCircle />
                                帮助
                            </span>
                        }
                        itemKey="3"
                    >
                        <div style={{ padding: '0 24px' }}>
                            <h3>帮助</h3>
                            <p style={{ lineHeight: 1.8, color: 'var(--semi-color-text-0)', fontWeight: 600 }}>
                                Q：有新组件需求、或者现有组件feature不能满足业务需求？
                            </p>
                            <p style={{ lineHeight: 1.8, color: 'var(--semi-color-text-1)' }}>
                                右上角问题反馈，提交issue，label选择Feature Request / New Component Request
                                我们会高优处理这些需求。
                            </p>
                            <p style={{ lineHeight: 1.8, color: 'var(--semi-color-text-0)', fontWeight: 600 }}>
                                Q：对组件的使用有疑惑？
                            </p>
                            <p style={{ lineHeight: 1.8, color: 'var(--semi-color-text-1)' }}>
                                欢迎进我们的客服lark群进行咨询提问。
                            </p>
                        </div>
                    </TabPane>
                </Tabs>
            </>
        );
    }
}
```

### 滚动折叠

通过设置 `collapsible` 可以支持滚动折叠，目前只支持 horizontal 模式。

```jsx live=true dir=column
import React from 'react';
import { Tabs, TabPane } from '@douyinfe/semi-ui';

class App extends React.Component {
    render() {
        return (
            <Tabs style={{ width: '60%', margin: '20px' }} type="card" collapsible>
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
                    <TabPane tab={`Tab-${i}`} itemKey={`Tab-${i}`} key={i}>
                        Content of card tab {i}
                    </TabPane>
                ))}
            </Tabs>
        );
    }
}
```

**自定义滚动箭头渲染**

通过 renderArrow 修改滚动折叠模式下，左右切换箭头的渲染，入参为溢出的 items 和 位置, 点击处理函数，以及 defaultNode。

**注**：renderArrow 的前三个参数自 2.61.0 支持，defaultNode 自 2.66.0 支持。

```jsx live=true dir="column"
import React from 'react';
import { Tabs, TabPane, Dropdown } from '@douyinfe/semi-ui';

() => {
    const [activeKey, setActiveKey] = useState('Tab-0');
    const renderArrow = (items, pos, handleArrowClick, defaultNode) => {
        const style = {
            width: 32,
            height: 32,
            margin: '0 12px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            borderRadius: '100%',
            background: 'rgba(var(--semi-grey-1), 1)',
            color: 'var(--semi-color-text)',
            cursor: 'pointer',
        };
        return (
            <Dropdown
                render={
                    <Dropdown.Menu>
                        {items.map(item => {
                            return (
                                <Dropdown.Item onClick={() => setActiveKey(item.itemKey)}>{item.itemKey}</Dropdown.Item>
                            );
                        })}
                    </Dropdown.Menu>
                }
            >
                {pos === 'start' ? (
                    <div style={style} onClick={handleArrowClick}>
                        ←
                    </div>
                ) : (
                    <div style={style} onClick={handleArrowClick}>
                        →
                    </div>
                )}
            </Dropdown>
        );
    };

    return (
        <Tabs
            renderArrow={renderArrow}
            style={{ width: '50%', margin: '20px' }}
            activeKey={activeKey}
            type="card"
            collapsible
            onChange={k => setActiveKey(k)}
        >
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
                <TabPane tab={`Tab-${i}`} itemKey={`Tab-${i}`} key={i}>
                    Content of card tab {i}
                </TabPane>
            ))}
        </Tabs>
    );
};
```

**修改切换箭头的渲染位置**

通过 `arrowPosition` 来修改溢出指示器的位置，可选 `start` `both` `end`

```jsx live=true dir=column
import React from 'react';
import { Tabs, TabPane } from '@douyinfe/semi-ui';

class App extends React.Component {
    render() {
        return (
            <>
                <Tabs style={{ width: '60%', margin: '20px' }} type="card" collapsible arrowPosition={'start'}>
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
                        <TabPane tab={`Tab-${i}`} itemKey={`Tab-${i}`} key={i}>
                            Content of card tab {i}
                        </TabPane>
                    ))}
                </Tabs>
                <Tabs style={{ width: '60%', margin: '20px' }} type="card" collapsible arrowPosition={'both'}>
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
                        <TabPane tab={`Tab-${i}`} itemKey={`Tab-${i}`} key={i}>
                            Content of card tab {i}
                        </TabPane>
                    ))}
                </Tabs>
                <Tabs style={{ width: '60%', margin: '20px' }} type="card" collapsible arrowPosition={'end'}>
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
                        <TabPane tab={`Tab-${i}`} itemKey={`Tab-${i}`} key={i}>
                            Content of card tab {i}
                        </TabPane>
                    ))}
                </Tabs>
            </>
        );
    }
}
```

### 禁用

禁用标签栏中的某一个标签页。

```jsx live=true
import React from 'react';
import { Tabs, TabPane } from '@douyinfe/semi-ui';

class App extends React.Component {
    render() {
        return (
            <Tabs defaultActiveKey="1">
                <TabPane tab="文档" itemKey="1">
                    文档
                </TabPane>
                <TabPane tab="快速起步" itemKey="2" disabled>
                    快速起步
                </TabPane>
                <TabPane tab="帮助" itemKey="3">
                    帮助
                </TabPane>
            </Tabs>
        );
    }
}
```

### 标签栏内容扩展

传入 `tabBarExtraContent` 属性可以在标签栏右侧添加附加操作。

```jsx live=true
import React from 'react';
import { Tabs, TabPane, Button } from '@douyinfe/semi-ui';

() => (
    <Tabs
        defaultActiveKey="1"
        tabBarExtraContent={
            <Button
                onClick={() => {
                    alert('you have clicked me!');
                }}
            >
                Extra Action
            </Button>
        }
    >
        <TabPane tab="文档" itemKey="1">
            文档
        </TabPane>
        <TabPane tab="快速起步" itemKey="2">
            快速起步
        </TabPane>
        <TabPane tab="帮助" itemKey="3">
            帮助
        </TabPane>
    </Tabs>
);
```

### 标签栏二次封装

传入 `renderTabBar` 函数可对标签栏进行二次封装。

```jsx live=true
import React from 'react';
import { Tabs, TabPane } from '@douyinfe/semi-ui';

() => (
    <Tabs
        defaultActiveKey="1"
        renderTabBar={(tabBarProps, DefaultTabBar) => {
            return (
                <div className="tab-bar-box">
                    这是二次封装的Tab Bar，当前ActiveKey：{tabBarProps.activeKey}
                    <DefaultTabBar {...tabBarProps} />
                </div>
            );
        }}
    >
        <TabPane tab="文档" itemKey="1">
            文档
        </TabPane>
        <TabPane tab="快速起步" itemKey="2">
            快速起步
        </TabPane>
        <TabPane tab="帮助" itemKey="3">
            帮助
        </TabPane>
    </Tabs>
);
```

### 动态更新

通过绑定事件，可以使标签栏动态更新。

```jsx live=true hideInDSM
import React from 'react';
import { Tabs, TabPane, ButtonGroup, Button } from '@douyinfe/semi-ui';

class App extends React.Component {
    constructor(props) {
        super(props);
        this.newTabIndex = 0;
        const panes = [
            { title: 'Tab 1', content: 'Content of Tab Pane 1', itemKey: '1' },
            { title: 'Tab 2', content: 'Content of Tab Pane 2', itemKey: '2' },
        ];
        this.state = {
            panes,
            activeKey: panes[0].itemKey,
        };
    }

    add() {
        const { panes } = this.state;
        const index = this.newTabIndex++;
        panes.push({ title: `New Tab ${index}`, content: 'New Tab Pane', itemKey: `newTab${index}` });
        this.setState({ panes, activeKey: `newTab${index}` });
    }

    remove() {
        const { panes } = this.state;
        if (panes.length > 1) {
            panes.pop();
            this.setState({ panes, activeKey: panes[panes.length - 1].itemKey });
        }
    }

    handleChange(activeKey) {
        this.setState({ activeKey });
    }

    render() {
        const { panes, activeKey } = this.state;
        return (
            <Tabs
                defaultActiveKey="1"
                activeKey={activeKey}
                onChange={this.handleChange.bind(this)}
                tabBarExtraContent={
                    <ButtonGroup>
                        <Button onClick={() => this.add()}>新增</Button>
                        <Button onClick={() => this.remove()}>删除</Button>
                    </ButtonGroup>
                }
            >
                {panes.map(pane => (
                    <TabPane tab={pane.title} itemKey={pane.itemKey} key={pane.itemKey}>
                        {pane.content}
                    </TabPane>
                ))}
            </Tabs>
        );
    }
}
```

### 关闭

关闭标签栏中的某一个标签页。  
只有卡片样式的页签支持关闭选项。使用 `closable={true}` 来开启。

```jsx live=true
import React from 'react';
import { Tabs, TabPane } from '@douyinfe/semi-ui';

class App extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            tabList: [
                { tab: '文档', itemKey: '1', text: '文档', closable: true },
                { tab: '快速起步', itemKey: '2', text: '快速起步', closable: true },
                { tab: '帮助', itemKey: '3', text: '帮助' },
            ],
        };
    }
    close(key) {
        const newTabList = [...this.state.tabList];
        const closeIndex = newTabList.findIndex(t => t.itemKey === key);
        newTabList.splice(closeIndex, 1);
        this.setState({ tabList: newTabList });
    }
    render() {
        return (
            <Tabs type="card" defaultActiveKey="1" onTabClose={this.close.bind(this)}>
                {this.state.tabList.map(t => (
                    <TabPane closable={t.closable} tab={t.tab} itemKey={t.itemKey} key={t.itemKey}>
                        {t.text}
                    </TabPane>
                ))}
            </Tabs>
        );
    }
}
```

## API 参考

### Tab

| 属性 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| activeKey | 当前激活的 tab 页的 itemKey 值 | string | 无 |
| arrowPosition | 折叠模式下，左右切换箭头渲染位置 **>=2.61.0** | "start" "end" "both" | 无 |
| className | 类名 | string | 无 |
| collapsible | 折叠的 Tabs，**>=1.1.0** | boolean | false |
| dropdownProps | 用于在折叠模式下透传参数到下拉菜单的 Dropdown 组件 | { start: DropdownProps, end: DropdownProps } | 无 |
| visibleTabsStyle | 整体滚动区域 Style **>=2.61.0** | style: CSSProperties | 无 |
| contentStyle | 内容区域外层样式对象 | CSSProperties | 无 |
| defaultActiveKey | 初始化选中的 tab 页的 key 值 | string | '1' |
| keepDOM | 使用 TabPane 写法时是否渲染隐藏面板的 DOM 结构 | boolean | true |
| lazyRender | 懒渲染，仅当面板激活过才被渲染在 DOM 树中  | boolean | false |
| more | 将一部分 Tab 渲染到下拉菜单中 ** >= 2.59.0** | number \| {count:number,render:()=>ReactNode,dropdownProps:DropDownProps} | - |
| renderTabBar | 用于二次封装标签栏 | (tabBarProps: object, defaultTabBar: React.ComponentType) => ReactNode | 无 |
| renderArrow | 折叠滚动模式下，自定义左右切换箭头如何渲染，默认为箭头按钮 hover 时展开溢出项。前三个参数自 **>=2.61.0** 支持，defaultNode 参数自 **>=2.66.0** 支持| (items: OverflowItem[],pos:"start"\|"end", handleArrowClick:()=>void, defaultNode: ReactNode)=> ReactNode | 无 |
| preventScroll | 指示浏览器是否应滚动文档以显示新聚焦的元素，作用于组件内的 focus 方法 | boolean |  |  |
| showRestInDropdown | 是否将收起的 Tab 展示在下拉菜单中（仅当 collapsible 为 true 时生效） **>= 2.61.0** | boolean | true |
| size | 大小，提供 `large`、`medium`、`small` 三种类型，**>=1.11.0，目前仅支持线性 Tabs** | string | `large` |
| style | 样式对象 | CSSProperties | 无 |
| tabBarExtraContent | 用于扩展标签栏的内容 | ReactNode | 无 |
| tabList | 标签页对象组成的数组，该对象支持 itemKey（对应 activeKey，tab（标签页文字）及 icon（标签页图标） | TabPane[] | 无 |
| tabPaneMotion | 是否使用动画切换 tabs | boolean | true |
| tabPosition | tab 的位置，支持`top`(水平), `left`(垂直) | string | `top` |
| type | 标签栏的样式，可选`line`、 `card`、 `button`、`slash` | string | `line` |
| onChange | 切换 tab 页时的回调函数 | function(activeKey: string) | 无 |
| onTabClick | 单击事件 | function(key: string, e: Event) | 无 |
| onTabClose | 关闭 tab 页时的回调函数 **>=2.1.0** | function(tabKey: string) | 无 |
| onVisibleTabsChange | 折叠滚动模式下，溢出项切换变化回调 **>= 2.61.0** | (visibleState:Record\<string,bool\>)=>void | 无 |

### TabPane

| 属性      | 说明                     | 类型          | 默认值 |
| --------- | ------------------------ | ------------- | ------ |
| className | 类名                     | string        | 无     |
| disabled  | 标签页栏是否禁用         | boolean       | 无     |
| icon      | 标签页栏 icon            | ReactNode     | 无     |
| itemKey   | 对应 `activeKey`         | string        | 无     |
| style     | 样式对象                 | CSSProperties | 无     |
| tab       | 标签页栏显示文字         | ReactNode     | 无     |
| closable  | 允许关闭 tab **>=2.1.0** | boolean       | false  |

## Accessibility

### ARIA

-   关于 role
    -   TabBar 对应的 role 为 `tablist`
    -   TabBar 中的 Tab 对应的 role 为 `tab`
    -   TabPane 对应的 role 为 `tabpanel`
-   aria-orientation: 表明 TabBar 的方向，有 `vertical` 和 `horizontal` 两种。当传入 tabPosition 为 left 时, aria-orientation 会被设置为 `vertical`，tabPosition 为 top 时，设置为 `horizontal`
-   aria-disabled: 当 TabPane 设置为 disabled 时，对应 Tab 的 aria-disabled 会被设置为 true
-   aria-selected: 表明 Tab 是否被选中
-   aria-controls: 指向 Tab 标签所控制的 TabPane
-   aria-labelledby: 指向设置 TabPane 标签的元素

### 键盘和焦点

WAI-ARIA: https://www.w3.org/WAI/ARIA/apg/patterns/tabpanel/

-   选项卡可以被获取到焦点，但禁用的选项卡除外
-   键盘用户可以使用 `Tab` 键，将焦点移动到已被选择的选项卡元素的选项卡面板上
-   当焦点位于水平选项卡列表中的选项卡元素上时，使用 `左右箭头` 来切换选项
-   当焦点位于垂直选项卡列表中的选项卡元素上时，使用 `上下箭头` 来切换选项
-   当焦点位于选项卡列表中的未被激活的选项卡元素上时，可以使用 `Space` 或 `Enter` 键来激活该选项卡
-   当键盘用户想要直接将焦点聚焦到选项卡列表中的最后一个选项卡元素时：
    -   Mac 用户：`fn` + `右箭头`
    -   Windows 用户：`End`
-   当键盘用户想要直接将焦点聚焦到选项卡列表中的第一个选项卡元素时：
    -   Mac 用户：`fn` + `左箭头`
    -   Windows 用户：`Home`
-   当选项卡允许被删除时：
    -   用户可以使用 `Delete` 键删除选项卡
    -   删除后，焦点转移到被删除选项卡元素的后一个元素上；若被删除元素无后一个元素则转移到前一个元素上

## 设计变量

<DesignToken/>

## 文案规范

-   标签文案需要准确清晰地解释标签内容
-   用简短的，易区分的标签
-   尽量保持在一个词以内

## FAQ

-   **为什么在 Tabs 中使用 Typography 的省略 ellipsis 失效？**

    因为 Tabs 渲染 TabPane 时，默认是全部渲染 display: none。此时这些组件无法获取到正确的宽度或高度值。建议开启 lazyRender，或者关闭 keepDOM。

-   **为什么在 Tabs 中使用 Collapse/Collapsible/Resizable Table 等组件的高度或宽度值不对？**

    原因同上，另外如果 collapse 不需要动画，也可以通过设置 motion={false} 来关闭动画效果。此时无需获取组件的高度。
