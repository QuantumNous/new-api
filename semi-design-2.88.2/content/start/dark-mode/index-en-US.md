---
category: Getting Started
title:  Dark Mode
subTitle: Dark Mode
icon: doc-darkmode
localeCode: en-US
order: 6
---

## Dark mode

🤩  Semi's default theme or custom themes configured through [Semi DSM](/dsm) come with both light and dark modes, which can be easily switched.   
🌒 Semi also supports the use of dark mode in a partial area of the page.  

<Compare dark='https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/dsm/dark.png' light='https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/dsm/light.png
'>
</Compare>

## Recommended settings
Semi will automatically mount the global color palette on the body element. We have built in some commonly used CSS Tokens. For detailed Token details, please refer to [Design Variables](/en-US/basic/tokens)
We recommend that you configure `color` and `background-color` on the body, your business components can automatically inherit the default background color and text color from the body, and adaptive light/dark color switching

````css
// css
body {
     color: var(--semi-color-text-0);
     background-color: var( --semi-color-bg-0);
}
````

## How to switch
To use Dark Mode, you could simply add `[theme-mode='dark']` to `body` in any way you prefer. Here is a quick idea:
```jsx
const body = document.body;
if (body.hasAttribute('theme-mode')) {
    body.removeAttribute('theme-mode');
} else {
    body.setAttribute('theme-mode', 'dark');
}
```

For instance:
```jsx live=true
import React from 'react';
import { Button } from '@douyinfe/semi-ui';

function Demo() {
    const switchMode = () => {
        const body = document.body;
        if (body.hasAttribute('theme-mode')) {
            body.removeAttribute('theme-mode');
            // Notify our site to update current mode
            window.setMode('light');
        } else {
            body.setAttribute('theme-mode', 'dark');
            // Notify our site to update current mode
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

## Keep Consistency with System Theme

If you want the mode of the site to change with the system setting, you may find this property  [Prefers-color-scheme
](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme) helpful. Please pay attention that this property is experimental. It asks for browser compatibility (Chrome >= 76, Safari >= 12.1) and you may expect behavior to change in the future.

To change system setting in macOS, go to System Preferences -> General -> Appearance

Since we do not recommend modifying the content of the npm theme package directly, you could add a listener for this property using js. Here is another example:
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

## Block Dark/Light Mode

Semi 2.0 natively supports block dark/bright color mode, and you can add `.semi-always-dark` or `.semi-always-light` to areas that require block dark or bright colors as needed.

> Note: this is not work for pop-up layers or components

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
                    <div >
                        <Nav mode='horizontal' defaultSelectedKeys={['Home']}>
                            <Nav.Header>
                                <IconSemiLogo style={{ fontSize: 36 }} />
                            </Nav.Header>
                            <span
                                style={{
                                    color: 'var(--semi-color-text-2)'
                                }}
                            >
                                <span
                                    style={{
                                        marginRight: '24px',
                                        color: 'var(--semi-color-text-0)',
                                        fontWeight: '600',
                                    }}>Semi Design</span>
                                <span style={{ marginRight: '24px' }}>Semi Theme</span>
                                <span>Semi Blocks</span>
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
                                <Avatar color='orange' size='small'>YJ</Avatar>
                            </Nav.Footer>
                        </Nav>
                    </div>
                </Header>
                <Layout >
                    <Sider style={{ backgroundColor: 'var(--semi-color-bg-1)' }}>
                        <Nav
                            style={{ maxWidth: 220, height: '100%' }}
                            defaultSelectedKeys={['Home']}
                            items={[
                                { itemKey: 'Home', text: 'Home', icon: <IconHome size="large" /> },
                                { itemKey: 'Histogram', text: 'Histogram', icon: <IconHistogram size="large" /> },
                                { itemKey: 'Live', text: 'Live', icon: <IconLive size="large" /> },
                                { itemKey: 'Setting', text: 'Setting', icon: <IconSetting size="large" /> },
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
                            backgroundColor: 'var(--semi-color-bg-1)'
                        }}
                    >
                        <Breadcrumb
                            style={{
                                marginBottom: '24px'
                            }}
                            routes={['Home', 'Page Section', 'Detail']}
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
                        <span style={{ marginRight: '24px' }}>Customer Service</span>
                        <span>Feedback</span>
                    </span>
                </Footer>
            </Layout>
        </>
    );
};
```