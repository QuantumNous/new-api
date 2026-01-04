---
localeCode: zh-CN
order: 56
category: 导航类
title:  Navigation 导航
icon: doc-navigation
width: 650px
dir: column
brief: 为页面和功能提供导航的菜单列表。
---


## 代码演示

### 如何引入

```jsx import
import { Nav } from '@douyinfe/semi-ui';
```

### 基本使用

通过传递 `items` 参数，你能够快速得到一个导航栏。

每个导航项目包括：

-   `itemKey`：导航项目的唯一标识（必须）
-   `text`：导航文案
-   `icon`：导航图标，你可以从 `@douyinfe/semi-icons`、`@douyinfe/semi-icons-lab` 中自由选择你喜欢的图标，详情可查阅 [Icon 组件文档](/zh-CN/basic/icon)

参数含义详见 [Nav.Item](#Nav.Item) 或 [Nav.Sub](#Nav.Sub)

开发者可能会经常定义 Logo 区域和收起按钮区域，Navigation 则提供了这样的容器方便开发者快速定义导航头部和底部，你仅需按要求传入 `header` 或 `footer` 即可。

对于 `footer`，semi-ui 额外封装了一个收起功能按钮，开发者可以通过传递 `collapseButton = true` 开启此功能，不过该参数仅在 `mode = "vertical"` （垂直导航）生效。

参数详见 [Nav.Header](#Nav.Header) 和 [Nav.Footer](#Nav.Footer)。

```jsx live=true width=78%
import React from 'react';
import { Nav } from '@douyinfe/semi-ui';
import { IconSemiLogo } from '@douyinfe/semi-icons';
import { IconDescriptions, IconIntro, IconTree, IconAvatar, IconTreeSelect, IconTabs } from '@douyinfe/semi-icons-lab';

class NavApp extends React.Component {
    render() {
        return (
            <Nav
                bodyStyle={{ height: 320 }}
                items={[
                    { itemKey: 'user', text: '用户管理', icon: <IconAvatar /> },
                    { itemKey: 'union', text: '活动管理', icon: <IconDescriptions /> },
                    {
                        text: '任务平台',
                        icon: <IconTree />,
                        itemKey: 'job',
                        items: ['任务管理', '用户任务查询'],
                    },
                ]}
                header={{
                    logo: <IconSemiLogo style={{ height: '36px', fontSize: 36 }} />,
                    text: 'Semi 运营后台'
                }}
                footer={{
                    collapseButton: true,
                }}
                onSelect={data => console.log('trigger onSelect: ', data)}
                onClick={data => console.log('trigger onClick: ', data)}
            />
        );
    }
}

```

### 导航样式定义

Navigation 目前提供了个两个参数用于定义导航样式：`style` 和 `bodyStyle`，其中 `style` 用于定义导航组件最外层的样式，而 `bodyStyle` 用于定义导航列表的样式。（导航头部和导航底部则都接受各自的 `style` 参数）。

例如你需要一个中间列表可以滚动，导航头部和底部固定的导航组件，可以这么使用：

```jsx live=true width=78%
import React from 'react';
import { Nav } from '@douyinfe/semi-ui';
import { IconSemiLogo } from '@douyinfe/semi-icons';
import { IconTreeSelect, IconForm, IconTree, IconBanner, IconBadge, IconNotification,IconSteps, IconTree, IconTabs, IconNavigation } from '@douyinfe/semi-icons-lab';

class NavApp extends React.Component {
    render() {
        return (
            <Nav
                style={{ height: 520 }}
                bodyStyle={{ height: 300 }}
                items={[
                    { itemKey: 'user', text: '用户管理', icon: <IconBadge /> },
                    { itemKey: '2', text: '订单管理', icon: <IconBanner /> },
                    { itemKey: '3', text: '资源管理', icon: <IconTreeSelect /> },
                    {
                        text: '任务平台',
                        icon: <IconForm />,
                        itemKey: '4',
                        items: ['任务管理', '用户任务查询'],
                    },
                    { itemKey: '5', text: '推送通知', icon: <IconNotification /> },
                    { itemKey: '6', text: '任务', icon: <IconSteps /> },
                    { itemKey: '7', text: '活动管理', icon: <IconTree /> },
                    { itemKey: '8', text: '内容工具', icon: <IconTabs /> },
                    { itemKey: '9', text: '快捷导航', icon: <IconNavigation /> },
                ]}
                onSelect={key => console.log(key)}
                header={{
                    logo: <IconSemiLogo style={{ height: '36px', fontSize: 36 }} />,
                    text: 'Semi 运营后台'
                }}
                footer={{
                    collapseButton: true,
                }}
            />
        );
    }
}

```

### JSX 写法

可以使用 JSX 写法定义导航头部、导航项以及导航底部。使用 JSX写法时，在 Nav 的 children 层级，你除了可以使用 Nav.Header、Nav.Item、Nav.Sub、Nav.Footer外，你也可以置入其他自定义的 ReactNode 元素

```jsx live=true width=78%
import React from 'react';
import { Nav } from '@douyinfe/semi-ui';
import { IconStar, IconUser, IconUserGroup, IconSemiLogo } from '@douyinfe/semi-icons';
import { IconDescriptions, IconForm, IconTree, IconBanner, IconBadge } from '@douyinfe/semi-icons-lab';

class NavApp extends React.Component {
    render() {
        return (
            <Nav
                bodyStyle={{ height: 300 }}
                defaultOpenKeys={['user', 'union']}
                onSelect={data => console.log('trigger onSelect: ', data)}
                onClick={data => console.log('trigger onClick: ', data)}
            >
                <Nav.Header logo={<IconSemiLogo style={{ height: '36px', fontSize: 36 }} />} text={'Semi 运营后台'} />
                <Nav.Item itemKey={'union'} text={'活动管理'} icon={<IconForm />} />
                <Nav.Sub itemKey={'user'} text="用户管理" icon={<IconBadge />}>
                    <Nav.Item itemKey={'active'} text={'活跃用户'} />
                    <Nav.Item itemKey={'negative'} text={'非活跃用户'} />
                </Nav.Sub>
                <Nav.Sub itemKey={'union-management'} text="任务管理" icon={<IconTree />}>
                    <Nav.Item itemKey={'notice'} text={'任务设置'} />
                    <Nav.Item itemKey={'query'} text={'任务查询'} />
                    <Nav.Item itemKey={'info'} text={'信息录入'} />
                </Nav.Sub>
                <Nav.Footer collapseButton={true} />
            </Nav>
        );
    }
}

```

###  配合 react-router 等路由组件

为了在使用 react-router 等路由组件时，能将 NavItem 包裹在路由组件提供的 Link 或者 NavLink 中来让用户点击 NavItem 时候触发路由组件的点击事件， 我们需要自定义渲染。

使用 renderWrapper 在每个导航项外包裹自定义导航组件 [查看此 CodeSandBox](https://codesandbox.io/s/semi-navigation-with-react-router-9kk9dm?file=/src/App.js)

```jsx
import { Link } from "react-router-dom";
import React from 'react';
import { Nav } from '@douyinfe/semi-ui';

() => {
    return (
        <Nav
            renderWrapper={({ itemElement, isSubNav, isInSubNav, props }) => {
                const routerMap = {
                    Home: "/",
                    About: "/about",
                    Dashboard: "/dashboard",
                    "Nothing Here": "/nothing-here"
                };
                return (
                    <Link
                        style={{ textDecoration: "none" }}
                        to={routerMap[props.itemKey]}
                    >
                        {itemElement}
                    </Link>
                );
            }}
            items={[
                { itemKey: "Home", text: "Home" },
                { itemKey: "About", text: "About" },
                {
                    text: "Sub",
                    itemKey: "Sub",
                    items: ["Dashboard", "Nothing Here"]
                }
            ]}
        ></Nav>
    );
};
```



### 垂直与水平布局

Navigation 目前提供两种方向的导航：

-   垂直布局（默认） `mode = "vertical"`
-   水平布局 `mode = "horizontal"`


特别注意的是，有一些功能（参数）仅在 `mode = "vertical"` 时有效：

-   `isCollapsed` （导航收起到侧边）
-   `defaultOpenKeys` | `openKeys` （指定默认的以及受控的展开子导航项 key 数组，这个参数仅在 `mode = "vertical"` 且 `isCollapsed = false` 有效）
-   `Footer` 组件的 `collapseButton` 收起侧边栏功能按钮

#### 垂直布局

```jsx live=true width=78%
import React from 'react';
import { Nav } from '@douyinfe/semi-ui';
import { IconSemiLogo } from '@douyinfe/semi-icons';
import { IconTreeSelect, IconForm, IconTree, IconBanner, IconBadge, IconNotification,IconSteps, IconTree, IconTabs, IconNavigation } from '@douyinfe/semi-icons-lab';


class NavApp extends React.Component {
    render() {
        return (
            <div style={{ width: '100%' }}>
                <Nav
                    bodyStyle={{ height: 300 }}
                    items={[
                        { itemKey: 'user', text: '用户管理', icon: <IconBadge /> },
                        { itemKey: 'union', text: '活动管理', icon: <IconTreeSelect/> },
                        {
                            itemKey: 'union-management',
                            text: '任务管理',
                            icon: <IconForm />,
                            items: ['任务设置', '任务查询', '信息录入']
                        },
                        {
                            text: '公告管理',
                            icon: <IconBanner />,
                            itemKey: 'job',
                            items: ['推送管理', '已推送查询'],
                        },
                    ]}
                    onSelect={key => console.log(key)}
                    header={{
                        logo: <IconSemiLogo style={{ height: '36px', fontSize: 36 }} />,
                        text: 'Semi 运营后台'
                    }}
                    footer={{
                        collapseButton: true,
                    }}
                />
            </div>
        );
    }
}
```

#### 水平布局

```jsx live=true dir="column"
import React from 'react';
import { Nav, Avatar, Dropdown } from '@douyinfe/semi-ui';
import { IconStar, IconUser, IconUserGroup, IconSetting, IconEdit, IconSemiLogo } from '@douyinfe/semi-icons';
import { IconTreeSelect, IconForm, IconBreadcrumb, IconBanner, IconBadge, IconNotification, IconSteps, IconTree, IconTabs, IconNavigation } from '@douyinfe/semi-icons-lab';


class NavApp extends React.Component {
    render() {
        return (
            <div style={{ width: '100%' }}>
                <Nav
                    mode={'horizontal'}
                    items={[
                        { itemKey: 'user', text: '用户管理', icon: <IconBadge /> },
                        { itemKey: 'union', text: '活动管理', icon: <IconTreeSelect /> },
                        {
                            itemKey: 'approve-management',
                            text: '审批管理',
                            icon: <IconBreadcrumb />,
                            items: [
                                '入驻审核',
                                {
                                    itemKey: 'operation-management',
                                    text: '运营管理',
                                    items: [
                                        '人员管理',
                                        '人员变更'
                                    ]
                                }
                            ]
                        },
                        {
                            text: '任务平台',
                            icon: <IconSteps />,
                            itemKey: 'job',
                            items: ['任务管理', '用户任务查询'],
                        },
                    ]}
                    onSelect={key => console.log(key)}
                    header={{
                        logo: <IconSemiLogo style={{ height: '36px', fontSize: 36 }} />,
                        text: 'Semi 运营后台'
                    }}
                    footer={
                        <Dropdown
                            position="bottomRight"
                            render={
                                <Dropdown.Menu>
                                    <Dropdown.Item>详情</Dropdown.Item>
                                    <Dropdown.Item>退出</Dropdown.Item>
                                </Dropdown.Menu>
                            }
                        >
                            <Avatar size="small" color='light-blue' style={{ margin: 4 }}>BD</Avatar>
                            <span>Bytedancer</span>
                        </Dropdown>
                    }
                />
            </div>
        );
    }
}
```

#### 水平加垂直

一般的平台设计会采取水平加垂直导航的模式，这里有一个比较常见的例子。

```jsx live=true dir="column"
import React from 'react';
import { Nav, Avatar, Dropdown, Select, Button, Layout, Breadcrumb, Skeleton } from '@douyinfe/semi-ui';
import { IconStar, IconLanguage, IconSemiLogo, IconBytedanceLogo, IconBell, IconHelpCircle } from '@douyinfe/semi-icons';
import { IconTreeSelect, IconForm, IconBreadcrumb, IconBanner, IconBadge, IconNotification, IconSteps, IconTree, IconTabs, IconNavigation } from '@douyinfe/semi-icons-lab';

() => {
    const { Header, Footer, Sider, Content } = Layout;

    const TopHeader = () => (
        <Header style={{ backgroundColor: 'var(--semi-color-bg-1)' }}>
            <div>
                <Nav
                    mode={'horizontal'}
                    items={[
                        { itemKey: 'user', text: '用户管理', icon: <IconBadge /> },
                        { itemKey: 'union', text: '活动管理', icon: <IconTreeSelect /> },
                        {
                            itemKey: 'approve-management',
                            text: '审批管理',
                            icon: <IconBreadcrumb />,
                            items: [
                                '入驻审核',
                                {
                                    itemKey: 'operation-management',
                                    text: '运营管理',
                                    items: [
                                        '人员管理',
                                        '人员变更'
                                    ]
                                }
                            ]
                        },
                        {
                            text: '任务平台',
                            icon: <IconSteps />,
                            itemKey: 'job',
                            items: ['任务管理', '用户任务查询'],
                        },
                    ]}
                    onSelect={key => console.log(key)}
                    header={{
                        logo: <IconSemiLogo style={{ height: '36px', fontSize: 36 }} />,
                        text: 'Semi 运营后台'
                    }}
                    footer={
                        <Dropdown
                            position="bottomRight"
                            render={
                                <Dropdown.Menu>
                                    <Dropdown.Item>详情</Dropdown.Item>
                                    <Dropdown.Item>退出</Dropdown.Item>
                                </Dropdown.Menu>
                            }
                        >
                            <Avatar size="small" color='light-blue' style={{ margin: 4 }}>BD</Avatar>
                            <span>Bytedancer</span>
                        </Dropdown>
                    }
                />
            </div>
        </Header>
    );

    const LeftNav = () => (
        <Nav
            style={{ maxWidth: 220, height: '100%' }}
            defaultSelectedKeys={['Home']}
            items={[
                {
                    itemKey: 'approve-management',
                    text: '审批管理',
                    icon: <IconBreadcrumb />,
                    items: [
                        '入驻审核',
                        {
                            itemKey: 'operation-management',
                            text: '运营管理',
                            items: [
                                '人员管理',
                                '人员变更'
                            ]
                        }
                    ]
                },
                {
                    text: '任务平台',
                    icon: <IconSteps />,
                    itemKey: 'job',
                    items: ['任务管理', '用户任务查询'],
                },
                { itemKey: 'user', text: '用户管理', icon: <IconBadge /> },
                { itemKey: 'union', text: '活动管理', icon: <IconTreeSelect /> },
            ]}
            footer={{
                collapseButton: true,
            }}
        />
    );

    const FooterContent = () => (
        <>
            <span
                style={{
                    display: 'flex',
                    alignItems: 'center',
                }}
            >
                <IconBytedanceLogo size="large" style={{ marginRight: '8px' }} />
                <span>Copyright © {new Date().getFullYear()} ByteDance. All Rights Reserved. </span>
            </span>
            <span>
                <span style={{ marginRight: '24px' }}>平台客服</span>
                <span>反馈建议</span>
            </span>
        </>
    );
    return (
        <Layout style={{ border: '1px solid var(--semi-color-border)' }}>
            <TopHeader />
            <Layout>
                <Sider style={{ backgroundColor: 'var(--semi-color-bg-1)' }}>
                    <LeftNav />
                </Sider>
                <Content
                    style={{
                        padding: '24px',
                        backgroundColor: 'var(--semi-color-bg-0)',
                    }}
                >
                    <Breadcrumb
                        style={{
                            marginBottom: '24px',
                        }}
                        routes={['首页', '当这个页面标题很长时需要省略', '上一页', '详情页']}
                    />
                    <div
                        style={{
                            borderRadius: '10px',
                            border: '1px solid var(--semi-color-border)',
                            height: '376px',
                            padding: '32px',
                        }}
                    >
                        <Skeleton placeholder={<Skeleton.Paragraph rows={2} />} loading={true}>
                            <p>Hi, Bytedance dance dance.</p>
                            <p>Hi, Bytedance dance dance.</p>
                        </Skeleton>
                    </div>
                </Content>
            </Layout>
            <Footer
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '20px',
                    color: 'var(--semi-color-text-2)',
                    backgroundColor: 'rgba(var(--semi-grey-0), 1)',
                }}
            >
                <FooterContent />
            </Footer>
        </Layout>
    );
};



```

### 展开收起箭头位置

可通过 `toggleIconPosition` 改变 NavSub 展开收起箭头的位置，默认为 'right' 右侧展示，可改为 'left'

```jsx live=true width=78%
import React from 'react';
import { Nav } from '@douyinfe/semi-ui';
import { IconUser, IconStar, IconSetting, IconSemiLogo } from '@douyinfe/semi-icons';
import { IconForm, IconBadge, IconBanner, IconAvatar, IconTree, IconTabs } from '@douyinfe/semi-icons-lab';

class NavApp extends React.Component {
    render() {
        return (
            <Nav
                toggleIconPosition={'left'}
                defaultOpenKeys={['job']}
                bodyStyle={{ height: 300 }}
                items={[
                    { itemKey: 'user', text: '用户管理', icon: <IconBadge /> },
                    { itemKey: 'union', text: '活动管理', icon: <IconBanner /> },
                    {
                        text: '任务平台',
                        icon: <IconForm />,
                        itemKey: 'job',
                        items: ['任务管理', '用户任务查询'],
                    },
                ]}
                onSelect={key => console.log(key)}
                header={{
                    logo: <IconSemiLogo style={{ height: '36px', fontSize: 36 }} />,
                    text: 'Semi 运营后台'
                }}
                footer={{
                    collapseButton: true,
                }}
            />
        );
    }
}
```

### 导航缩进
默认导航缩进目前仅对第一级导航有效果。
如果你希望对多级导航，按层级缩进，请先将 `limitIndent` 设置为 false (只在竖直方向生效)
- 当以 Jsx 方式用 Nav.Item 传入导航项时，请手动给 Nav.Item 传入 `level` props。
- 以 items 方式传入导航项时，无需关心 level

```jsx live=true width=78%
import React from 'react';
import { Nav } from '@douyinfe/semi-ui';
import { IconUser, IconStar, IconSetting, IconSemiLogo } from '@douyinfe/semi-icons';
import { IconForm, IconBadge, IconBanner, IconAvatar, IconTree, IconTabs } from '@douyinfe/semi-icons-lab';

class NavApp extends React.Component {
    render() {
        return (
            <Nav
                limitIndent={false}
                defaultOpenKeys={['job', 'mission1']}
                bodyStyle={{ height: 300 }}
                items={[
                    { itemKey: 'user', text: '用户管理', icon: <IconBadge /> },
                    {
                        text: '任务平台',
                        icon: <IconBanner />,
                        itemKey: 'job',
                        items: ['任务管理', {
                            text: '任务1',
                            icon: <IconForm />,
                            itemKey: 'mission1',
                            items: ['任务2',
                                {
                                    text: '任务3拆解',
                                    icon: <IconTabs />,
                                    itemKey: 'mission3',
                                    items: ['子任务1', '子任务2'],
                                }
                            ],
                        }],
                    },
                ]}
                onSelect={key => console.log(key)}
                header={{
                    logo: <IconSemiLogo style={{ height: '36px', fontSize: 36 }} />,
                    text: 'Semi 运营后台'
                }}
                footer={{
                    collapseButton: true,
                }}
            />
        );
    }
}

```


### 非受控属性

包括：

-   `defaultSelectedKeys`（默认被选中的导航项 `key` 数组）
-   `defaultOpenKeys`（默认展开的导航项 `key` 数组，仅 `mode = "vertical"` 且 `isCollapsed` | `defaultIsCollapsed = false` 的情况下有效）
-   `defaultIsCollapsed`（侧边栏默认是否收起，仅 `mode = "vertical"` 时有效）

```jsx live=true width=78%
import React from 'react';
import { Nav } from '@douyinfe/semi-ui';
import { IconSemiLogo } from '@douyinfe/semi-icons';
import { IconForm, IconBadge, IconBanner, IconAvatar, IconTree, IconTabs } from '@douyinfe/semi-icons-lab';

class NavApp extends React.Component {
    render() {
        return (
            <Nav
                defaultOpenKeys={['job']}
                defaultSelectedKeys={['信息录入']}
                defaultIsCollapsed={true}
                bodyStyle={{ height: 300 }}
                items={[
                    { itemKey: 'user', text: '用户管理', icon: <IconBadge /> },
                    { itemKey: 'union', text: '活动管理', icon: <IconBanner /> },
                    {
                        itemKey: 'union-management',
                        text: '任务管理',
                        icon: <IconForm />,
                        items: ['公告设置', '任务查询', '信息录入']
                    },
                    {
                        text: '任务平台',
                        icon: <IconTree />,
                        itemKey: 'job',
                        items: ['任务管理', '用户任务查询'],
                    },
                ]}
                header={{
                    logo: <IconSemiLogo style={{ height: '36px', fontSize: 36 }} />,
                    text: 'Semi 运营后台'
                }}
                footer={{
                    collapseButton: true
                }}
            />
        );
    }
}

```

### 受控属性

Navigation 组件提供了几个受控属性，配合各种回调，可以很轻松地控制导航。

目前受控的属性为：

-   `isCollapsed`（侧边栏是否收起，仅 `mode =" vertical"` 时生效）
-   `selectedKeys`（当前选中的导航项 `key` 数组）
-   `openKeys` （当前展开的导航项数组，仅 `mode = "vertical"` 且 `isCollapsed = false` 有效）

对应的回调为：

-   `onCollapseChange(isCollapsed: boolean): void`
-   `onSelect({ itemKey: string, selectedKeys: string[], domEvent: MouseEvent, isOpen: boolean }): void`
-   `onOpenChange({ itemKey: string, openKeys: string[], domEvent: MouseEvent, isOpen: boolean }): void`

```jsx live=true width=78%
import React, { useMemo, useState } from 'react';
import { Nav } from '@douyinfe/semi-ui';
import { IconSemiLogo } from '@douyinfe/semi-icons';
import { IconForm, IconBadge, IconBanner, IconAvatar, IconTree, IconTabs } from '@douyinfe/semi-icons-lab';

function NavApp (props = {}) {
    const [openKeys, setOpenKeys] = useState(['union-management', 'job']);
    const [selectedKeys, setSelectedKeys] = useState(['公告设置']);
    const [isCollapsed, setIsCollapsed] = useState(true);

    const onSelect = data => {
        console.log('trigger onSelect: ', data);
        setSelectedKeys([...data.selectedKeys]);
    };
    const onOpenChange = data => {
        console.log('trigger onOpenChange: ', data);
        setOpenKeys([...data.openKeys]);
    };

    const onCollapseChange = isCollapsed => {
        setIsCollapsed(isCollapsed);
    };

    const items = useMemo(() => [
        { itemKey: 'user', text: '用户管理', icon: <IconBadge /> },
        { itemKey: 'union', text: '活动管理', icon: <IconBanner /> },
        {
            itemKey: 'union-management',
            text: '任务管理',
            icon: <IconForm />,
            items: ['公告设置', '任务查询', '信息录入']
        },
        {
            text: '任务平台',
            icon: <IconTree />,
            itemKey: 'job',
            items: ['任务管理', '用户任务查询'],
        },
    ], []);

    return (
        <Nav
            isCollapsed={isCollapsed}
            openKeys={openKeys}
            selectedKeys={selectedKeys}
            bodyStyle={{ height: 300 }}
            items={items}
            header={{
                logo: <IconSemiLogo style={{ height: '36px', fontSize: 36 }} />,
                text: 'Semi 运营后台'
            }}
            footer={{
                collapseButton: true
            }}
            onCollapseChange={onCollapseChange}
            onOpenChange={onOpenChange}
            onSelect={onSelect}
        />
    );
}
```

## API 参考

### Nav

| 属性                | 描述                                                                                                                                        | 类型                                                                                                                                                                  | 默认值     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| bodyStyle           | 导航项列表的自定义样式                                                                                                                      | CSSProperties                                                                                                                                                         |            |
| className           | 最外层元素的样式名                                                                                                                          | string                                                                                                                                                                |            |
| defaultIsCollapsed  | 默认是否处于收起状态，仅 `mode = "vertical"` 时有效                                                                                         | boolean                                                                                                                                                               | false      |
| defaultOpenKeys     | 初始打开的子导航 `itemKey` 数组，仅 `mode = "vertical"` 且侧边栏处于展开状态时有效                                                          | string[]                                                                                                                                                              | []         |
| defaultSelectedKeys | 初始选中的导航项 `itemKey` 数组                                                                                                             | string[]                                                                                                                                                              | []         |
| subDropdownProps | 用于控制 `horizontal` 或者 `vertical && isCollapsed` 下 nav.sub 中的 dropdown 参数(v >= 2.69)                                                                                                             | DropdownProps                                                                                                                                                              |          |
| expandIcon          | 默认下拉箭头Icon, v>=2.36                                                                                                                   | ReactNode                                                                                                                                                             |            |
| footer              | 底部区域配置对象或元素，详见 [Nav.Footer](#Nav.Footer)                                                                                      | object\|ReactNode                                                                                                                                                     |            |
| getPopupContainer   | 垂直 Nav 折叠或 水平 Nav中 Dropdown 的 getPopupContainer 配置，可指定弹出层容器 这会改变浮层 DOM 树位置，但不会改变视图渲染位置。 v>=2.24.0 | Function                                                                                                                                                              |            |
| header              | 头部区域配置对象或元素，详见 [Nav.Header](#Nav.Header)                                                                                      | object\|ReactNode                                                                                                                                                     |            |
| isCollapsed         | 是否处于收起状态的受控属性，仅 `mode = "vertical"` 时有效                                                                                   | boolean                                                                                                                                                               |            |
| items               | 导航项目列表，每一项可以继续带有 items 属性。如果为 string 数组，则会取每一项作为 text 和 itemKey                                           | object\| string[]\| [Item](#Nav.Item)[] \| [Sub](#Nav.Sub)[]                                                                                                          |            |
| limitIndent         | 解除缩进限制，可使用 level 自定义导航项缩进，水平模式只能为true                                                                             | boolean                                                                                                                                                               | true       |
| mode                | 导航类型，目前支持横向与竖直，可选值：`vertical`或`horizontal`                                                                              | string                                                                                                                                                                | `vertical` |
| openKeys            | 受控的打开的子导航 `itemKey` 数组，配合 `onOpenChange` 回调控制子导航项展开，仅 `mode = "vertical"` 且侧边栏处于展开状态时有效              | string[]                                                                                                                                                              |            |
| prefixCls           | 类名前缀                                                                                                                                    | string                                                                                                                                                                | `semi`     |
| renderWrapper       | 自定义导航项外层组件，v>=2.24.0                                                                                                             | <ApiType detail='(data:{ itemElement:ReactElement, isSubNav:boolean, isInSubNav:boolean, props:SubNavProps\| ItemProps }) => ReactNode'>(data) => ReactNode</ApiType> |            |
| selectedKeys        | 受控的导航项 `itemKey` 数组，配合 `onSelect` 回调控制导航项选择                                                                             | string[]                                                                                                                                                              |            |
| style               | 最外层元素的自定义样式                                                                                                                      | CSSProperties                                                                                                                                                         |            |
| subNavCloseDelay    | 子导航浮层关闭的延迟。collapse 为 true 或 mode 为 "horizontal" 时有效，单位为 ms                                                            | number                                                                                                                                                                | 100        |
| subNavMotion        | 子导航折叠动画                                                                                                                              | boolean                                                                                                                                                               | true       |
| subNavOpenDelay     | 子导航浮层显示的延迟。collapse 为 true 或 mode 为 "horizontal" 时有效，单位为 ms                                                            | number                                                                                                                                                                | 0          |
| toggleIconPosition  | 带有子导航项的的父级导航项箭头位置，可选 `left`或 `right`                                                                                   | string                                                                                                                                                                | 'right'    |
| tooltipHideDelay    | tooltip 隐藏的延迟，collapse 为 true 时有效，单位为 ms                                                                                      | number                                                                                                                                                                | 100        |
| tooltipShowDelay    | tooltip 显示的延迟，collapse 为 true 时有效，单位为 ms                                                                                      | number                                                                                                                                                                | 0          |
| onClick             | 点击任意导航项时触发                                                                                                                        | <ApiType detail='({ itemKey: string, domEvent: MouseEvent, isOpen: boolean }) => void'>(itemKey, event, isOpen) => void</ApiType>                                     | () => {}   |
| onCollapseChange    | 收起状态变化时的回调                                                                                                                        | <ApiType detail='(isCollapsed: boolean) => void'>(isCollapsed)=> void </ApiType>                                                                                      | () => {}   |
| onOpenChange        | 切换某个子导航项目显隐状态时触发                                                                                                            | <ApiType detail='({ itemKey: string, openKeys: string[], domEvent: MouseEvent, isOpen: boolean }) => void'> ({itemKey, openKeys, event, isOpen})=>{}</ApiType>        | () => {}   |
| onSelect            | 第一次选中某个可选中导航项目时触发                                                                                                          | <ApiType detail='({ itemKey: string, selectedKeys: string[], selectedItems: Item[], domEvent: MouseEvent, isOpen: boolean }) => void'>(onSelectProps)=>{}</ApiType>   | () => {}   |

### Nav.Item

| 属性         | 描述                                                          | 类型                                                                                                                                   | 默认值   |
| ------------ | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| disabled     | 是否禁用                                                      | boolean                                                                                                                                | false    |
| icon         | 导航项目图标                                                  | ReactNode                                                                                                                              |          |
| indent       | 如果 icon 为空，是否保留其占位，仅对一级导航生效              | boolean                                                                                                                                | false    |
| itemKey      | 导航项目唯一 key                                              | string                                                                                                                                 | ""       |
| level        | 当前项所在嵌套层级，limitIndent 为 true时，用于自定义缩进位置 | number                                                                                                                                 |          |
| link         | 导航项 href 链接，传入时导航项整体会包裹一个 a 标签           | string                                                                                                                                 | -        |
| linkOptions  | 透传给 a 标签的参数                                           | object                                                                                                                                 | -        |
| text         | 导航项目文案或元素                                            | string\|ReactNode                                                                                                                      | ""       |
| onClick      | 点击任意导航项时触发                                          | <ApiType detail='({ itemKey: string, domEvent: MouseEvent, isOpen: boolean }) => void'>({itemKey, domEvent, isOpen}) => void</ApiType> | () => {} |
| onMouseEnter | mouse enter 时触发                                            | function(e) => {}                                                                                                                      | () => {} |
| onMouseLeave | mouse leave 时触发                                            | function(e) => {}                                                                                                                      | () => {} |

### Nav.Sub

| 属性          | 描述                                                          | 类型              | 默认值   |
| ------------- | ------------------------------------------------------------- | ----------------- | -------- |
| disabled      | 是否禁用                                                      | boolean           | false    |  |
| dropdownProps | 弹出层 `dropdown` 参数配置 (v >= 2.69)                        | DropdownProps     |          |  |
| dropdownStyle | 弹出层的 style                                                | CSSProperties     |          |  |
| icon          | 导航项目图标                                                  | ReactNode         |          |
| indent        | 如果 icon 为空，是否保留其占位，仅对一级导航生效              | boolean           | false    |
| isCollapsed   | 是否处于收起状态的受控属性，仅 `mode = "vertical"`            | boolean           | false    |
| isOpen        | 是否打开                                                      | boolean           | false    |
| itemKey       | 导航项目唯一 key                                              | string            | -        |
| level         | 当前项所在嵌套层级，limitIndent 为 true时，用于自定义缩进位置 | number            | 0        |  |
| maxHeight     | 最大高度                                                      | number            | 999      |
| text          | 导航项目文案或组件                                            | string\|ReactNode | ""       |
| onMouseEnter  | mouse enter 时触发                                            | function(e) => {} | () => {} |
| onMouseLeave  | mouse leave 时触发                                            | function(e) => {} | () => {} |

### Nav.Header

| 属性        | 描述                                                | 类型          | 默认值 |
| ----------- | --------------------------------------------------- | ------------- | ------ |
| children    | 子元素                                              | ReactNode     |        |
| className   | 最外层样式名                                        | string        |        |
| link        | 导航项 href 链接，传入时导航项整体会包裹一个 a 标签 | string        | -      |
| linkOptions | 透传给 a 标签的参数                                 | object        | -      |
| logo        | Logo                                                | ReactNode     |        |
| style       | 最外层样式                                          | CSSProperties |        |
| text        | Logo 文案                                           | ReactNode     |        |

### Nav.Footer

| 属性           | 描述                                                                                     | 类型                             | 默认值 |
| -------------- | ---------------------------------------------------------------------------------------- | -------------------------------- | ------ |
| children       | 子元素                                                                                   | ReactNode                        |        |
| className      | 最外层样式名                                                                             | string                           |        |
| collapseButton | 是否展示底部“收起侧边栏”按钮，mode="vertical" 且 Footer 组件的 children 参数为空才有效果 | boolean\|ReactNode               | false  |
| collapseText   | “收起”按钮的文案                                                                         | (collapsed:boolean) => ReactNode |        |
| style          | 最外层样式                                                                               | CSSProperties                    |        |
| onClick        | 点击事件回调                                                                             | (event) => void                  |        |

## Accessibility
- ### 键盘和焦点
- Navigation 内的每个可点击 item 都可以被聚焦，相互之间使用 `Tab` 及 `Shift  + Tab` 切换焦点，并且可以通过 `Enter` 键激活每个链接
- 当某个 item 可被打开弹层时
  - 打开弹层方式为 hover ：该 item 被聚焦时，弹层打开。键盘用户可以通过下箭头将焦点移动到弹层上，`Esc` 键可以将焦点返回到 item 上
  - 打开弹层的方式为 click ：该 item 被聚焦时，点击 Enter 键，打开弹层。键盘用户可以通过下箭头将焦点移动到弹层上，`Esc` 键可以将焦点返回到 item 上
  - 键盘交互暂未完整支持嵌套场景

## 文案规范

- 导航栏菜单使用句子大小写格式
- 尽量精简

| ✅ 推荐用法    | ❌ 不推荐用法  |
| ------------- | ------------- |
| Appeal center | Appeal Center |


## 设计变量
<DesignToken/>

<!-- ## 相关物料
```material
2, 43, 312
``` -->
## 相关物料
<semi-material-list code="2, 312"></semi-material-list>

## FAQ

-   **导航动画丢失？**  
    在使用函数式组件时，应该用 useState 或者 useMemo 包裹一下 items，原因是 items 直接传一个数组会触发组件重新渲染。

-   **当子菜单高度超过999px，部分导航消失？**
    请查看 [此 issue](https://github.com/DouyinFE/semi-design/issues/563)
