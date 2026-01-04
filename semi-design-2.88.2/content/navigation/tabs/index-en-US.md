---
localeCode: en-US
order: 59
category: Navigation
title: Tabs
subTitle: Tabs
icon: doc-tabs
brief: When the content needs to be grouped and displayed in different modules or pages, you could use Tabs to switch between different groups or pages
---

## Demos

### How to import

```jsx
import { Tabs, TabPane } from '@douyinfe/semi-ui';
```

### Basic Usage

Tbs supports three types of styles: `line`, `button`, `card`, and `slash`. By default, the first tab is selected.

Tabs supports two declare ways, and the rendering process of the two is different:

-   Pass the array of objects through `tabList`, when using `tabList`, only render the currently passed node each time
-   Or use `<TabPane>` to explicitly pass in item by item. When using `<TabPane>`, all panels will be rendered by default. You can set `keepDOM={false}` to only render the current panel, and there will be no animation effect at this time .

<Notice title='Notice'>
    1. When tabList and TabPane Children are used at the same time, the data passed in through tabList will be rendered first. It is not recommended to configure both <br/>
    2. When using TabPane Children, TabPane must be a direct child element of Tabs, otherwise Tabs will not be able to correctly collect related attributes such as itemKey and other subcomponents
</Notice>

```jsx live=true
import React from 'react';
import { Tabs, TabPane } from '@douyinfe/semi-ui';

class App extends React.Component {
    render() {
        return (
            <div>
                <Tabs type="line">
                    <TabPane tab="Document" itemKey="1">
                        <h3>Document</h3>
                        <p style={{ lineHeight: 1.8 }}>
                            Semi Design is a design system developed and maintained by IES Front-end Team and UED Team
                        </p>
                        <p style={{ lineHeight: 1.8 }}>
                            Semi Design create a consistent, good-looking, easy-to-use, and efficient user experience
                            with a user-centric, content-first, and human-friendly design system.
                        </p>
                        <ul>
                            <li>
                                <p>Content-first</p>
                            </li>
                            <li>
                                <p>Customized theming</p>
                            </li>
                            <li>
                                <p>Internationalized</p>
                            </li>
                            <li>
                                <p>Humanism</p>
                            </li>
                        </ul>
                    </TabPane>
                    <TabPane tab="Quick Start" itemKey="2">
                        <h3>Quick Start</h3>
                        <p style={{ lineHeight: 1.8 }}>
                            If it is a new project, it is recommended that you use Eden to initialize the project and
                            initialize the project type to select the React direction.
                        </p>
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
                    <TabPane tab="Help" itemKey="3">
                        <h3>Help</h3>
                        <p style={{ lineHeight: 1.8, color: 'var(--semi-color-text-0)', fontWeight: 600 }}>
                            Q: Who should I look for if there are new component requirements, or existing component does
                            not meet my needs?
                        </p>
                        <p style={{ lineHeight: 1.8, color: 'var(--semi-color-text-1)' }}>
                            {`Give feedbacks in the upper right corner, submit an Issue, describe your needs as well as
                            the business scenario. We'll handle these issues with priorities.`}
                        </p>
                        <p style={{ lineHeight: 1.8, color: 'var(--semi-color-text-0)', fontWeight: 600 }}>
                            Q: Have questions when using components?
                        </p>
                        <p style={{ lineHeight: 1.8, color: 'var(--semi-color-text-1)' }}>
                            Welcome to ask anything in our Lark customer service group.
                        </p>
                    </TabPane>
                </Tabs>
            </div>
        );
    }
}
```

```jsx live=true
import React from 'react';
import { Tabs, TabPane } from '@douyinfe/semi-ui';

class App extends React.Component {
    render() {
        return (
            <Tabs type="button">
                <TabPane tab="Document" itemKey="1">
                    Document
                </TabPane>
                <TabPane tab="Quick Start" itemKey="2">
                    Quick Start
                </TabPane>
                <TabPane tab="Help" itemKey="3">
                    Help
                </TabPane>
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
        const contentList = [<div>Document</div>, <div>Quick Start</div>, <div>Help</div>];
        const tabList = [
            { tab: 'Document', itemKey: '1' },
            { tab: 'Quick Start', itemKey: '2' },
            { tab: 'Help', itemKey: '3' },
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
        const contentList = [<div>Document</div>, <div>Quick Start</div>, <div>Help</div>];
        const tabList = [
            { tab: 'Document', itemKey: '1' },
            { tab: 'Quick Start', itemKey: '2' },
            { tab: 'Help', itemKey: '3' },
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

### With Icon

```jsx live=true
import React from 'react';
import { Tabs, TabPane } from '@douyinfe/semi-ui';
import { IconFile, IconGlobe, IconHelpCircle } from '@douyinfe/semi-icons';

class App extends React.Component {
    render() {
        return (
            <Tabs>
                <TabPane
                    tab={
                        <span>
                            <IconFile />
                            Document
                        </span>
                    }
                    itemKey="1"
                >
                    Document
                </TabPane>
                <TabPane
                    tab={
                        <span>
                            <IconGlobe />
                            Quick Start
                        </span>
                    }
                    itemKey="2"
                >
                    Quick Start
                </TabPane>
                <TabPane
                    tab={
                        <span>
                            <IconHelpCircle />
                            Help
                        </span>
                    }
                    itemKey="3"
                >
                    Help
                </TabPane>
            </Tabs>
        );
    }
}
```

### More with Dropdown

Supports merging redundant tabs into a `more` drop-down menu. Just pass in a number for `more`. The number represents the number of tabs included in the drop-down menu. **（>=v2.59.0）**

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

Advanced configuration is also supported, passing the object to `more`, and it can be passed in

-   `count`: Represents the number of Tabs in the income drop-down menu
-   `render`: Customize the rendering function of Trigger. The returned ReactNode will be rendered as the Trigger of the drop-down menu.
-   `dropdownProps`: Incoming DropDown Props will be transparently transmitted to the drop-down menu. If you need to customize the drop-down menu, use the render method in dropdownProps

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

### Vertical mode

When `type` is `line`, `card`, or `button`, horizontal and vertical modes are supported, `tabPosition='left|top'`，default is top. When `type` is `slash`, only horizontal mode is supported.

```jsx live=true
import React from 'react';
import { Tabs, TabPane, Radio, RadioGroup } from '@douyinfe/semi-ui';
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
                                Document
                            </span>
                        }
                        itemKey="1"
                    >
                        <div style={{ padding: '0 24px' }}> Document </div>
                    </TabPane>
                    <TabPane
                        tab={
                            <span>
                                <IconGlobe />
                                Quick Start
                            </span>
                        }
                        itemKey="2"
                    >
                        <div style={{ padding: '0 24px' }}>Quick Start</div>
                    </TabPane>
                    <TabPane
                        tab={
                            <span>
                                <IconHelpCircle />
                                Help
                            </span>
                        }
                        itemKey="3"
                    >
                        <div style={{ padding: '0 24px' }}>Help</div>
                    </TabPane>
                </Tabs>
            </>
        );
    }
}
```

### Scrollable Tabs

**v>= 1.1.0**  
You could use `collapsible` for a scrollable tabs with dropdown menu. Horizontal mode only.

```jsx live=true dir=column
import React from 'react';
import { Tabs, TabPane } from '@douyinfe/semi-ui';

class App extends React.Component {
    render() {
        return (
            <Tabs style={{ width: '60%', margin: '20px' }} type="card" collapsible>
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((item, index) => (
                    <TabPane tab={`Tab-${item}`} itemKey={`Tab-${item}`} key={item}>
                        Content of card tab {index}
                    </TabPane>
                ))}
            </Tabs>
        );
    }
}
```

**Modify the scrolling rendering Arrow**

`renderArrow` modifies the Arrow, with the input parameters being the overflowed items, position, click function, and defaultNode.
 
**Attention**: The first three parameters of renderArrow are supported since 2.61.0，while defaultNode parameter is supported since 2.66.0.

```jsx live=true dir="column"
import React from 'react';
import { Tabs, TabPane, Dropdown } from '@douyinfe/semi-ui';

() => {
    const [activeKey, setActiveKey] = useState('Tab-0');
    const renderArrow = (items, pos, handleArrowClick) => {
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

**Modify Arrow rendering position**

Use `arrowPosition` to modify the overflow indicator position, optional start both end

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

### Disable

Disable one tab.

```jsx live=true
import React from 'react';
import { Tabs, TabPane } from '@douyinfe/semi-ui';

class App extends React.Component {
    render() {
        return (
            <Tabs defaultActiveKey="1">
                <TabPane tab="Document" itemKey="1">
                    Document
                </TabPane>
                <TabPane tab="Quick Start" itemKey="2" disabled>
                    Quick Start
                </TabPane>
                <TabPane tab="Help" itemKey="3">
                    Help
                </TabPane>
            </Tabs>
        );
    }
}
```

### Extra Content

Use `tabBarExtraContent` to add extra content on the right side of tabBar.

```jsx live=true
import React from 'react';
import { Tabs, TabPane, Button } from '@douyinfe/semi-ui';

class App extends React.Component {
    render() {
        return (
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
                <TabPane tab="Document" itemKey="1">
                    Document
                </TabPane>
                <TabPane tab="Quick Start" itemKey="2">
                    Quick Start
                </TabPane>
                <TabPane tab="Help" itemKey="3">
                    Help
                </TabPane>
            </Tabs>
        );
    }
}
```

### Custom Render

Use `renderTabBar` to customize tabBar render behavior.

```jsx live=true
import React from 'react';
import { Tabs, TabPane } from '@douyinfe/semi-ui';

class App extends React.Component {
    render() {
        return (
            <Tabs
                defaultActiveKey="1"
                renderTabBar={(tabBarProps, DefaultTabBar) => {
                    return (
                        <div className="tab-bar-box">
                            This is a custom rendered tabBar. Current activeKey is: {tabBarProps.activeKey}
                            <DefaultTabBar {...tabBarProps} />
                        </div>
                    );
                }}
            >
                <TabPane tab="Document" itemKey="1">
                    Document
                </TabPane>
                <TabPane tab="Quick Start" itemKey="2">
                    Quick Start
                </TabPane>
                <TabPane tab="Help" itemKey="3">
                    Help
                </TabPane>
            </Tabs>
        );
    }
}
```

### Dynamic Update

You can add events to update tabBar dynamically.

```jsx live=true
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
                        <Button onClick={() => this.add()}>Add</Button>
                        <Button onClick={() => this.remove()}>Delete</Button>
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

### Closeable

Close a tab in the tab bar. Only card style tabs support the close option. Use `closable={true}` to turn it on.

```jsx live=true
import React from 'react';
import { Tabs, TabPane } from '@douyinfe/semi-ui';

class App extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            tabList: [
                { tab: 'Doc', itemKey: '1', text: 'Doc', closable: true },
                { tab: 'Quick Start', itemKey: '2', text: 'Quick Start', closable: true },
                { tab: 'Help', itemKey: '3', text: 'Help' },
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

## API Reference

### Tab

| Property | Description | Type | Default Value |
| --- | --- | --- | --- |
| activeKey | The itemKey value of the currently active tab page | string | None |
| className | class name | string | None |
| collapsible | collapsed Tabs, **>=1.1.0** | boolean | false |
| dropdownProps | In collapsible mode, It is used to transparently transmit parameters to the Dropdown component of the drop-down menu, support since 2.66.0 | DropDownProps | { start: DropdownProps, end: DropdownProps } |
| visibleTabsStyle | Overall scrolling area style **>=2.61.0** | style: CSSProperties | None |
| contentStyle | The outer style object of the content area | CSSProperties | None |
| defaultActiveKey | Initialize the key value of the selected tab page | string | '1' |
| keepDOM | Whether to render the DOM structure of the hidden panel when using TabPane writing, **>=1.0.0** | boolean | true |
| lazyRender | Lazy rendering, only when the panel is activated will it be rendered in the DOM tree, **>=1.0.0** | boolean | false |
| more | Render a portion of the Tab into a drop-down menu ** >= 2.59.0** | number \| {count:number,render:()=>ReactNode,dropdownProps:DropDownProps} | - |
| renderTabBar | Used for secondary packaging tab bar | (tabBarProps: object, defaultTabBar: React.ComponentType) => ReactNode | None |
| renderArrow | Customize how overflow items indicator are rendered externally. By default, the overflow items are expanded when the arrow button is hovered. The first three parameters of renderArrow are supported since **>=2.61.0**, defaultNode is supported since **>=2.66.0** | (items: OverflowItem[],pos:"start"\|"end", handleArrowClick:()=>void, defaultNode: ReactNode)=> ReactNode | None |
| preventScroll | Indicates whether the browser should scroll the document to display the newly focused element, acting on the focus method inside the component, excluding the component passed in by the user | boolean |
| showRestInDropdown | Whether to display the collapsed Tab in the drop-down menu (only effective when collapsible is true) **>= 2.61.0** | boolean | true |
| size | Size, providing three types of `large`, `medium`, and `small`, **>=1.11.0, currently only supports linear Tabs** | string | `large` |
| style | style object | CSSProperties | None |
| tabBarExtraContent | Used to extend the content of the tab bar | ReactNode | None |
| tabList | An array of tab page objects that supports itemKey (corresponding to activeKey, tab (tab page text) and icon (tab page icon) | TabPane[] | None |
| tabPaneMotion | Whether to use animation to switch tabs | boolean | true |
| tabPosition | The position of the tab, support `top` (horizontal), `left` (vertical), **>=1.0.0** | string | `top` |
| type | The style of the label bar, optional `line`, `card`, `button` | string | `line` |
| onChange | Callback function when switching tab pages | function(activeKey: string) | None |
| onTabClick | Click event | function(key: string, e: Event) | None |
| onTabClose | executed when tab closed by user, **>=2.1.0** | function(tabKey: string) | None |
| arrowPosition | Arrow rendering position **>=2.61.0** | "start" "end" "both" | 无 |
| onVisibleTabsChange | Overflow item switching change callback **>=2.61.0** | (visibleState:Record\<string,bool\>)=>void | None |

### TabPane

| Property  | Description                                | Type          | Default Value |
| --------- | ------------------------------------------ | ------------- | ------------- |
| className | class name                                 | string        | None          |
| disabled  | Whether the tab bar is disabled            | boolean       | None          |
| icon      | Tab bar icon                               | ReactNode     | None          |
| itemKey   | corresponding to `activeKey`               | string        | None          |
| style     | style object                               | CSSProperties | None          |
| tab       | Tab page bar display text                  | ReactNode     | None          |
| closable  | whether user can close the tab **>=2.1.0** | boolean       | false         |

## Accessibility

### ARIA

-   About role
    -   TabBar has a role of `tablist`
    -   Tab in TabBar has a role of `tab`
    -   TabPane has a role of `tabpanel`
-   aria-orientation: Indicates TabBar's orientation, can be `vertical` or `horizontal`. When tabPosition is `left`,aria-orientation will be `vertical`, when tabPosition is `top`, aria-orientation will be `horizontal`.
-   aria-disabled: When TabPane is disabled, the related Tab's aria-disabled will be set to true.
-   aria-selected: Indicates whether the Tab is selected.
-   aria-controls: Indicates the TabPane controlled by the Tab
-   aria-labelledby: Indicates the element labels the TabPane

### Keyboard and Focus

WAI-ARIA: https://www.w3.org/WAI/ARIA/apg/patterns/tabpanel/

-   Tabs can be given focus, except for disabled tabs
-   Keyboard users can use the `Tab` key to move the focus to the tab panel of the selected tab element
-   Use `left and right arrows` to toggle options when focus is on a tab element in a horizontal tab list
-   Use `up and down arrows` to toggle options when focus is on a tab element in a vertical tab list
-   When the focus is on an inactive tab element in the tab list, the `Space` or `Enter` keys can be used to activate the tab
-   When keyboard users want to focus directly on the last tab element in the tab list:
    -   Mac users: `fn` + `right arrow`
    -   Windows users: `End`
-   When keyboard users want to focus directly on the first tab element in the tab list:
    -   Mac users: `fn` + `left arrow`
    -   Windows users: `Home`
-   When a tab is allowed to be deleted:
    -   Users can use `Delete` keys to delete tab
    -   After deletion, the focus is transferred to the next element of the deleted tab element; if the deleted element has no subsequent element, it is transferred to the previous element

## Content Guidelines

-   Label copy needs to explain the label content accurately and clearly
-   Use short, easily distinguishable labels
-   try to stay within one word

## Design Token

<DesignToken/>

## FAQ

-   **Why typography with ellipses in Tabs doesn't work?**

    Because when Tabs renders TabPane, the default is to render display: none. At this point these components cannot get the correct width or height values. It is recommended to enable lazyRender in or disable keepDOM.

-   **Why are the height or width values ​​wrong when using components such as Collapse/Collapsible/Resizable Table in Tabs?**

    The reason is the same as above. In addition, if the collapse does not need animation, you can also turn off the animation effect by setting motion={false}. There is no need to get the height of the component at this point。
