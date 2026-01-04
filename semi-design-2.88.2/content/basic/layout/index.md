---
localeCode: zh-CN
order: 18
category: 基础
title: Layout 布局
icon: doc-layout
dir: column
brief: 用于快捷划分页面整体布局
---

## 概述

-   `Layout`：布局容器，其下可嵌套 `Header` `Sider` `Content` `Footer` 或 `Layout` 本身，可以放在任何父容器中。
-   `Header`：顶部布局，其下可嵌套任何元素，只能放在 `Layout` 中。
-   `Sider`：侧边栏，其下可嵌套任何元素，只能放在 `Layout` 中。
-   `Content`：内容部分，其下可嵌套任何元素，只能放在 `Layout` 中。
-   `Footer`：底部布局，其下可嵌套任何元素，只能放在 `Layout` 中。

<Notice title='注意事项'>
1、布局组件采用 Flex 布局实现，无法在非现代浏览器中工作  <br/>
2、Layout 组件仅会帮你实现布局，但不会附带背景色、文本色、宽高度等样式。你可以根据自己实际需求传入 style 或给定特定 className 另行编写css实现
</Notice>


## 代码演示

### 如何引入

```jsx import
import { Layout } from '@douyinfe/semi-ui';
```

### 三行布局

```jsx live=true dir="column" hideInDSM
import React from 'react';
import { Layout } from '@douyinfe/semi-ui';

() => {
    const { Header, Footer, Content } = Layout;

    const commonStyle = {
        height: 64,
        lineHeight: '64px',
        background: 'var(--semi-color-fill-0)'
    };

    return (
        <Layout className="components-layout-demo">
            <Header style={commonStyle}>Header</Header>
            <Content style={{ height: 300, lineHeight: '300px' }}>Content</Content>
            <Footer style={commonStyle}>Footer</Footer>
        </Layout>
    );
};
```

### 左侧边栏布局

```jsx live=true dir="column" hideInDSM
import React from 'react';
import { Layout } from '@douyinfe/semi-ui';

() => {
    const { Header, Footer, Sider, Content } = Layout;
    const commonStyle = {
        height: 64,
        lineHeight: '64px',
        background: 'var(--semi-color-fill-0)'
    };
    return (
        <Layout className="components-layout-demo">
            <Header style={commonStyle}>Header</Header>
            <Layout>
                <Sider style={{ width: '120px', background: 'var(--semi-color-fill-2)' }}>Sider</Sider>
                <Content style={{ height: 300, lineHeight: '300px' }}>Content</Content>
            </Layout>
            <Footer style={commonStyle}>Footer</Footer>
        </Layout>
    );
};
```

### 右侧边栏布局

```jsx live=true dir="column" hideInDSM
import React from 'react';
import { Layout } from '@douyinfe/semi-ui';

() => {
    const { Header, Footer, Sider, Content } = Layout;
    const commonStyle = {
        height: 64,
        lineHeight: '64px',
        background: 'var(--semi-color-fill-0)'
    };
    return (
        <Layout className="components-layout-demo">
            <Header style={commonStyle}>Header</Header>
            <Layout>
                <Content style={{ height: 300, lineHeight: '300px' }}>Content</Content>
                <Sider style={{ width: '120px', background: 'var(--semi-color-fill-2)' }}>Sider</Sider>
            </Layout>
            <Footer style={commonStyle}>Footer</Footer>
        </Layout>
    );
};
```

### 侧边栏布局

```jsx live=true dir="column" hideInDSM
import React from 'react';
import { Layout } from '@douyinfe/semi-ui';

() => {
    const { Header, Footer, Sider, Content } = Layout;
    const commonStyle = {
        height: 64,
        lineHeight: '64px',
        background: 'var(--semi-color-fill-0)'
    };
    return (
        <Layout className="components-layout-demo">
            <Sider style={{ width: '120px', background: 'var(--semi-color-fill-2)' }}>Sider</Sider>
            <Layout>
                <Header style={commonStyle}>Header</Header>
                <Content style={{ height: 300, lineHeight: '300px' }}>Content</Content>
                <Footer style={commonStyle}>Footer</Footer>
            </Layout>
        </Layout>
    );
};
```

### 响应式布局

侧边栏预设了六个响应尺寸：`xs`、`sm`、`md`、`lg`、`xl`、`xxl`。可以通过设置 `breakpoint` 属性设置断点，通过 `onBreakpoint` 调用回调函数。

```jsx live=true dir="column" hideInDSM
import React from 'react';
import { Layout } from '@douyinfe/semi-ui';

() => {
    const onbreakpoint = (screen, bool) => {
        console.log(screen, bool);
    };
    const commonStyle = {
        height: 64,
        lineHeight: '64px',
        background: 'var(--semi-color-fill-0)'
    };
    const { Header, Footer, Sider, Content } = Layout;
    return (
        <Layout className="components-layout-demo">
            <Header style={commonStyle}>Header</Header>
            <Layout>
                <Sider
                    style={{ width: '120px', background: 'var(--semi-color-fill-2)' }}
                    breakpoint={['md']}
                    onBreakpoint={onbreakpoint}
                >
                    Sider
                </Sider>
                <Content style={{ height: 300, lineHeight: '300px' }}>Content</Content>
            </Layout>
            <Footer style={commonStyle}>Footer</Footer>
        </Layout>
    );
};
```

## 布局示例

### 顶部导航布局

```jsx live=true dir="column" hideInDSM
import React from 'react';
import { Layout, Nav, Button, Breadcrumb, Skeleton, Avatar } from '@douyinfe/semi-ui';
import { IconSemiLogo, IconBell, IconHelpCircle, IconBytedanceLogo, IconHome, IconLive, IconSetting } from '@douyinfe/semi-icons';

() => {
    const { Header, Footer, Content } = Layout;
    return (
        <Layout style={{ border: '1px solid var(--semi-color-border)' }}>
            <Header style={{ backgroundColor: 'var(--semi-color-bg-1)' }}>
                <div>
                    <Nav mode="horizontal" defaultSelectedKeys={['Home']}>
                        <Nav.Header>
                            <IconSemiLogo style={{ fontSize: 36 }} />
                        </Nav.Header>
                        <Nav.Item itemKey="Home" text="首页" icon={<IconHome size="large" />} />
                        <Nav.Item itemKey="Live" text="直播" icon={<IconLive size="large" />} />
                        <Nav.Item itemKey="Setting" text="设置" icon={<IconSetting size="large" />} />
                        <Nav.Footer>
                            <Button
                                theme="borderless"
                                icon={<IconBell size="large" />}
                                style={{
                                    color: 'var(--semi-color-text-2)',
                                    marginRight: '12px',
                                }}
                            />
                            <Button
                                theme="borderless"
                                icon={<IconHelpCircle size="large" />}
                                style={{
                                    color: 'var(--semi-color-text-2)',
                                    marginRight: '12px',
                                }}
                            />
                            <Avatar color="orange" size="small">
                                YJ
                            </Avatar>
                        </Nav.Footer>
                    </Nav>
                </div>
            </Header>
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
            <Footer
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '20px',
                    color: 'var(--semi-color-text-2)',
                    backgroundColor: 'rgba(var(--semi-grey-0), 1)',
                }}
            >
                <span
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                    }}
                >
                    <IconBytedanceLogo size="large" style={{ marginRight: '8px' }} />
                    <span>Copyright © 2023 ByteDance. All Rights Reserved. </span>
                </span>
                <span>
                    <span style={{ marginRight: '24px' }}>平台客服</span>
                    <span>反馈建议</span>
                </span>
            </Footer>
        </Layout>
    );
};
```

### 顶部导航-侧边布局

```jsx live=true dir="column" hideInDSM
import React from 'react';
import { Layout, Nav, Button, Breadcrumb, Skeleton, Avatar } from '@douyinfe/semi-ui';
import { IconSemiLogo, IconBell, IconHelpCircle, IconBytedanceLogo, IconHome, IconHistogram, IconLive, IconSetting } from '@douyinfe/semi-icons';

() => {
    const { Header, Footer, Sider, Content } = Layout;
    return (
        <Layout style={{ border: '1px solid var(--semi-color-border)' }}>
            <Header style={{ backgroundColor: 'var(--semi-color-bg-1)' }}>
                <div>
                    <Nav mode="horizontal" defaultSelectedKeys={['Home']}>
                        <Nav.Header>
                            <IconSemiLogo style={{ height: '36px', fontSize: 36 }} />
                        </Nav.Header>
                        <span
                            style={{
                                color: 'var(--semi-color-text-2)',
                            }}
                        >
                            <span
                                style={{
                                    marginRight: '24px',
                                    color: 'var(--semi-color-text-0)',
                                    fontWeight: '600',
                                }}
                            >
                                模版推荐
                            </span>
                            <span style={{ marginRight: '24px' }}>所有模版</span>
                            <span>我的模版</span>
                        </span>
                        <Nav.Footer>
                            <Button
                                theme="borderless"
                                icon={<IconBell size="large" />}
                                style={{
                                    color: 'var(--semi-color-text-2)',
                                    marginRight: '12px',
                                }}
                            />
                            <Button
                                theme="borderless"
                                icon={<IconHelpCircle size="large" />}
                                style={{
                                    color: 'var(--semi-color-text-2)',
                                    marginRight: '12px',
                                }}
                            />
                            <Avatar color="orange" size="small">
                                YJ
                            </Avatar>
                        </Nav.Footer>
                    </Nav>
                </div>
            </Header>
            <Layout>
                <Sider style={{ backgroundColor: 'var(--semi-color-bg-1)' }}>
                    <Nav
                        style={{ maxWidth: 220, height: '100%' }}
                        defaultSelectedKeys={['Home']}
                        items={[
                            { itemKey: 'Home', text: '首页', icon: <IconHome size="large" /> },
                            { itemKey: 'Histogram', text: '基础数据', icon: <IconHistogram size="large" /> },
                            { itemKey: 'Live', text: '测试功能', icon: <IconLive size="large" /> },
                            { itemKey: 'Setting', text: '设置', icon: <IconSetting size="large" /> },
                        ]}
                        footer={{
                            collapseButton: true,
                        }}
                    />
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
                <span
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                    }}
                >
                    <IconBytedanceLogo size="large" style={{ marginRight: '8px' }} />
                    <span>Copyright © 2023 ByteDance. All Rights Reserved. </span>
                </span>
                <span>
                    <span style={{ marginRight: '24px' }}>平台客服</span>
                    <span>反馈建议</span>
                </span>
            </Footer>
        </Layout>
    );
};
```

### 侧边导航

```jsx live=true dir="column" hideInDSM
import React from 'react';
import { Layout, Nav, Button, Breadcrumb, Skeleton, Avatar } from '@douyinfe/semi-ui';
import { IconBell, IconHelpCircle, IconBytedanceLogo, IconHome, IconHistogram, IconLive, IconSetting, IconSemiLogo } from '@douyinfe/semi-icons';

() => {
    const { Header, Footer, Sider, Content } = Layout;
    return (
        <Layout style={{ border: '1px solid var(--semi-color-border)' }}>
            <Sider style={{ backgroundColor: 'var(--semi-color-bg-1)' }}>
                <Nav
                    defaultSelectedKeys={['Home']}
                    style={{ maxWidth: 220, height: '100%' }}
                    items={[
                        { itemKey: 'Home', text: '首页', icon: <IconHome size="large" /> },
                        { itemKey: 'Histogram', text: '基础数据', icon: <IconHistogram size="large" /> },
                        { itemKey: 'Live', text: '测试功能', icon: <IconLive size="large" /> },
                        { itemKey: 'Setting', text: '设置', icon: <IconSetting size="large" /> },
                    ]}
                    header={{
                        logo: <IconSemiLogo style={{ fontSize: 36 }} />,
                        text: 'Semi Design',
                    }}
                    footer={{
                        collapseButton: true,
                    }}
                />
            </Sider>
            <Layout>
                <Header style={{ backgroundColor: 'var(--semi-color-bg-1)' }}>
                    <Nav
                        mode="horizontal"
                        footer={
                            <>
                                <Button
                                    theme="borderless"
                                    icon={<IconBell size="large" />}
                                    style={{
                                        color: 'var(--semi-color-text-2)',
                                        marginRight: '12px',
                                    }}
                                />
                                <Button
                                    theme="borderless"
                                    icon={<IconHelpCircle size="large" />}
                                    style={{
                                        color: 'var(--semi-color-text-2)',
                                        marginRight: '12px',
                                    }}
                                />
                                <Avatar color="orange" size="small">
                                    YJ
                                </Avatar>
                            </>
                        }
                    ></Nav>
                </Header>
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
                <Footer
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '20px',
                        color: 'var(--semi-color-text-2)',
                        backgroundColor: 'rgba(var(--semi-grey-0), 1)',
                    }}
                >
                    <span
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                        }}
                    >
                        <IconBytedanceLogo size="large" style={{ marginRight: '8px' }} />
                        <span>Copyright © 2019 ByteDance. All Rights Reserved. </span>
                    </span>
                    <span>
                        <span style={{ marginRight: '24px' }}>平台客服</span>
                        <span>反馈建议</span>
                    </span>
                </Footer>
            </Layout>
        </Layout>
    );
};
```

## API 参考

### Layout

> `Layout.Header` `Layout.Footer` `Layout.Content` API 与 `Layout` 相同

| 属性      | 说明                                                               | 类型    | 默认值 |
| --------- | ------------------------------------------------------------------ | ------- | ------ |
| className | 类名                                                               | string  | -      |
| hasSider  | 表示子元素里有 Sider，一般不用指定。可用于服务端渲染时避免样式闪动 | boolean | -      |
| style     | 样式                                                               | CSSProperties  | -      |
| aria-label | [aria-label](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Techniques/Using_the_aria-label_attribute) 属性，用来给当前元素加上的标签描述, 提升可访问性 >=2.3.0 | string | - |
| role | [role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles) 属性, 提升可访问性 >=2.3.0 | string | - |

### Layout.Sider

| 属性 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| breakpoint | 触发响应式布局的断点，可选值'xs', 'sm', 'md', 'lg', 'xl', 'xxl' | string[] | - |
| className | 类名 | string | - |
| style | 样式 | CSSProperties | - |
| onBreakpoint | 触发响应式布局断点时的回调 | (screen: string, broken: bool) => void | - |
| aria-label | [aria-label](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Techniques/Using_the_aria-label_attribute)属性，用来给当前元素加上的标签描述, 提升可访问性 >=2.3.0 | string | - |
| role | [role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles)属性, 提升可访问性 >=2.3.0  | string | - |

### responsive map

```text
{
    xs: '(max-width: 575px)',
    sm: '(min-width: 576px)',
    md: '(min-width: 768px)',
    lg: '(min-width: 992px)',
    xl: '(min-width: 1200px)',
    xxl: '(min-width: 1600px)',
};
```

## Accessibility

### ARIA

- Sider 可传入 aria-label props，描述该 Sider 作用。
- Header Content Main Footer 可传入 role aria-label 描述对应元素作用。

<!-- ## 相关物料

```material
2, 43
``` -->

## 相关物料
<semi-material-list code="2"></semi-material-list>