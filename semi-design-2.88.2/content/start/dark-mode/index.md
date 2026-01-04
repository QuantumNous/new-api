---
category: 开始
title:  Dark Mode 暗色模式
icon: doc-darkmode
localeCode: zh-CN
order: 6
---


## 能力介绍

大多数情况下，深色模式是浅色模式的补充。默认选用值，更多取决于用户的审美选择或业务场景，用户可以根据自己的需要选择使用哪一个模式。

🤩 Semi 的默认主题或任意通过 [Semi DSM](/dsm) 配置的定制主题都自带了亮色模式与暗色模式，可以方便地进行切换。  
🌒 Semi 也支持在页面的局部范围使用亮/暗色模式。

<Compare dark='https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/dsm/dark.png' light='https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/dsm/light.png
'>
</Compare>

## 推荐设置
Semi 会自动在 body 元素上挂载全局色盘，我们内置了一些常用的 CSS Token，详细的 Token 详情可查阅 [设计变量](/zh-CN/basic/tokens)  
我们推荐你在 body 上配置 `color`、`background-color`, 你的业务组件可从 body 自动继承获得默认的背景色、文本颜色，自适应亮/暗色切换

```css
// css
body {
    color: var(--semi-color-text-0);
    background-color: var( --semi-color-bg-0);
}
```

## 如何切换
Semi 暗色模式的切换是通过给 `body` 添加属性 `[theme-mode='dark']` 来实现的（我们在 body 下同时挂载了两套色盘）。你可以使用任何你喜欢的方式来进行切换。比如：
```jsx
const body = document.body;
if (body.hasAttribute('theme-mode')) {
    body.removeAttribute('theme-mode');
} else {
    body.setAttribute('theme-mode', 'dark');
}
```

这里也有一个🌰：
```jsx live=true
import React from 'react';
import { Button } from '@douyinfe/semi-ui';

function Demo() {
    const switchMode = () => {
        const body = document.body;
        if (body.hasAttribute('theme-mode')) {
            body.removeAttribute('theme-mode');
            // 以下这行代码，window.setMode仅用于当通过本Demo切换时，通知Semi官网Header记录更新当前模式（只用于演示）。在您的代码里无需存在。
            window.setMode('light');
        } else {
            body.setAttribute('theme-mode', 'dark');
            window.setMode('dark');
        }
    };

    return (
        <Button
            onClick={switchMode}
        >
            Switch Mode
        </Button>
    );
}
```

## 和系统主题保持一致

如果你希望页面的亮色/暗色模式能自动和系统主题保持一致，可以参考 [prefers-color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme) 属性。该属性目前处于实验阶段，请留意浏览器兼容性 (Chrome >= 76, Safari >= 12.1) 及未来可能发生的改变。

macOS 下的系统主题可以通过 `系统偏好设置 -> 通用 -> 外观` 来配置。

由于我们不建议直接修改 npm 主题包的内容，你可以通过 JS 的方式监听该属性的变化，这里也有一个🌰：
```jsx
const mql = window.matchMedia('(prefers-color-scheme: dark)');

function matchMode(e) {
    const body = document.body;
    if (e.matches) {
        if (!body.hasAttribute('theme-mode')) {
            body.setAttribute('theme-mode', 'dark');
        }
    } else {
        if (body.hasAttribute('theme-mode')) {
            body.removeAttribute('theme-mode');
        }
    }
}

mql.addListener(matchMode);
```

## 局部暗色/亮色模式

Semi 2.0 原生支持局部暗色/亮色模式。使用时，在顶级元素上添加 `.semi-always-dark` 或 `.semi-always-light` 类，这个类下的组件会使用对应模式的颜色变量。

<Notice>
    注意：由于弹出层默认是插入到 body 中，局部暗色/亮色对弹出层元素不生效。若你希望对弹出层也生效，应当使用 getPopupContainer 将弹出层插入节点置于你挂载 `.semi-always-dark` 或 `.semi-always-light`类名的元素内部
</Notice>

```jsx live=true dir="column" hideInDSM
import React from 'react';
import { Layout, Nav, Button, Breadcrumb, Avatar, Steps, Pagination, Row, Badge, Tag, Rating, Tooltip, Timeline, Popover } from '@douyinfe/semi-ui';
import { IconSemiLogo, IconCamera, IconBell, IconHelpCircle, IconBytedanceLogo, IconHome, IconHistogram, IconLive, IconSetting, IconEdit, IconList } from '@douyinfe/semi-icons';

() => {
    const { Header, Footer, Sider, Content } = Layout;
    const [mode, setMode] = useState('semi-always-dark');

    const switchMode = () => {
        const newMode = mode === 'semi-always-dark' ? 'semi-always-light' : 'semi-always-dark';
        setMode(newMode);
    };

    const rowStyle = { margin: '16px 10px' };
    const badgeStyle = {
        width: '42px',
        height: '42px',
        borderRadius: '4px',
        display: 'inline-block',
    };
    const tagStyle = { marginRight: 8, marginBottom: 8 };

    return (
        <>
            <Button
                onClick={switchMode}
                style={{ marginBottom: 4 }}
            >
                Switch Content Mode
            </Button>
            <Layout style={{ border: '1px solid var(--semi-color-border)' }}>
                <Header style={{ backgroundColor: 'var(--semi-color-bg-1)' }}>
                    <div>
                        <Nav mode="horizontal" defaultSelectedKeys={['Home']}>
                            <Nav.Header>
                                <IconSemiLogo style={{ width: '96px', height: '36px', fontSize: 36 }} />
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
                        className={mode}
                        style={{
                            padding: '24px',
                            backgroundColor: 'var(--semi-color-bg-1)',
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
                                height: '700px',
                                padding: '32px'
                            }}
                        >
                            <Row style={rowStyle}>
                                <div id='popup-layer'></div>
                                <Nav
                                    mode={'horizontal'}
                                    getPopupContainer={() => document.querySelector('#popup-layer')}
                                    items={[
                                        { itemKey: 'user', text: 'Option1', icon: <IconEdit /> },
                                        { itemKey: 'union', text: 'Option2', icon: <IconCamera /> },
                                        {
                                            itemKey: 'approve-management',
                                            text: 'Group3',
                                            icon: <IconList />,
                                            items: [
                                                '3-1',
                                                '3-2'
                                            ]
                                        },
                                    ]}
                                />
                                <br /><br />
                                <Pagination total={80} showSizeChanger></Pagination>
                                <br />
                                <Steps current={1}>
                                    <Steps.Step title="Finished" description="This is a description." />
                                    <Steps.Step title="In Progress" description="This is a description." />
                                    <Steps.Step title="Waiting" description="This is a description." />
                                </Steps>
                                <br />
                                <Steps current={1} status="error">
                                    <Steps.Step title="Finished" description="This is a description" />
                                    <Steps.Step title="In Process" description="This is a description" />
                                    <Steps.Step title="Waiting" description="This is a description" />
                                </Steps>
                            </Row>
                            <Row style={rowStyle}>
                                <div style={{ display: 'flex' }}>
                                    <div style={{ padding: 8 }}>
                                        <Badge count={5} theme='solid' >
                                            <Avatar color='blue' shape='square' style={badgeStyle}>XZ</Avatar>
                                        </Badge>
                                    </div>
                                    <div style={{ padding: 8 }}>
                                        <Badge count={5} theme='light' >
                                            <Avatar color='cyan' shape='square' style={badgeStyle}>YB</Avatar>
                                        </Badge>
                                    </div>
                                    <div style={{ padding: 8 }}>
                                        <Badge count={5} theme='inverted'>
                                            <Avatar color='indigo' shape='square' style={badgeStyle}>LX</Avatar>
                                        </Badge>
                                    </div>
                                    <div style={{ padding: 8 }}>
                                        <Badge dot theme='solid' >
                                            <Avatar color='light-blue' shape='square' style={badgeStyle}>YZ</Avatar>
                                        </Badge>
                                    </div>
                                    <div style={{ padding: 8 }}>
                                        <Badge dot theme='light' >
                                            <Avatar color='teal' shape='square' style={badgeStyle}>HW</Avatar>
                                        </Badge>
                                    </div>
                                    <div style={{ padding: '8px', borderRadius: '4px', backgroundColor: 'var(--semi-color-fill-0)' }}>
                                        <Badge dot theme='inverted'>
                                            <Avatar color='green' shape='square' style={badgeStyle}>XM</Avatar>
                                        </Badge>
                                    </div>
                                </div>
                                <br />
                                <div>
                                    <Tag color='grey' style={tagStyle}> grey tag </Tag>
                                    <Tag color='blue' style={tagStyle}> blue tag </Tag>
                                    <Tag color='blue' type='ghost' style={tagStyle}> ghost tag </Tag>
                                    <Tag color='blue' type='solid' style={tagStyle}> solid tag </Tag>
                                    <Tag color='red' style={tagStyle}> red tag </Tag>
                                    <Tag color='green' style={tagStyle}> green tag </Tag>
                                    <Tag color='orange' style={tagStyle}> orange tag </Tag>
                                    <Tag color='teal' style={tagStyle}> teal tag </Tag>
                                    <Tag color='violet' style={tagStyle}> violet tag </Tag>
                                    <Tag color='white' style={tagStyle}> white tag </Tag>
                                </div>
                                <br />
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <Popover content={'hi semi-design'} style={{ padding: 8 }}><Tag style={{ marginRight: 8 }}>I am Popover</Tag></Popover>
                                    <Tooltip content={'hi semi-design'}>
                                        <Tag style={{ marginRight: 8 }}>I am Tooltip</Tag>
                                    </Tooltip>
                                    <Rating defaultValue={3} size='small' style={{ marginRight: 8 }} />
                                </div>
                                <br />
                                <Timeline>
                                    <Timeline.Item time='2019-07-14 10:35' type='ongoing'>审核中</Timeline.Item>
                                    <Timeline.Item time='2019-06-13 16:17' type='success'>发布成功</Timeline.Item>
                                    <Timeline.Item time='2019-05-14 18:34' type='error'>审核失败</Timeline.Item>
                                </Timeline>
                            </Row>
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
                        <span>Copyright © 2019 ByteDance. All Rights Reserved. </span>
                    </span>
                    <span>
                        <span style={{ marginRight: '24px' }}>平台客服</span>
                        <span>反馈建议</span>
                    </span>
                </Footer>
            </Layout>
        </>
    );
};

```
