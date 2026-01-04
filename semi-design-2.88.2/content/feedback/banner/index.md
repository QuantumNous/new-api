---
localeCode: zh-CN
order: 86
category: 反馈类
title:  Banner 通知横幅
icon: doc-banner
dir: column
brief: 横幅通常用于标识全页的状态或通知等。它通常是常驻的，需要用户主动将其关闭。
---


## 代码演示

### 如何引入

```jsx import
import { Banner } from '@douyinfe/semi-ui';
```

### 基本用法

```jsx live=true dir="column"
import React, { useState } from 'react';
import { Banner, Layout, Button } from '@douyinfe/semi-ui';

() => {
    const [visible, setVisible] = useState(false);
    const changeVisible = () => {
        setVisible(!visible);
    };
    const { Header, Footer, Content } = Layout;

    const commonStyle = {
        height: 64,
        lineHeight: '64px',
        background: 'var(--semi-color-fill-0)'
    };

    const banner = (
        <Banner 
            onClose={changeVisible}
            description="Semi D2C 现已支持 Figma DevMode, 安装插件，随时查阅图层对应的前端代码"
        />
    );
    return (
        <>
            <Layout className='components-layout-demo banner-basic'>
                <Header style={commonStyle}>Header</Header>
                {visible? banner : null}
                <Content style={{ height: 300, lineHeight: '300px' }}>Content</Content>
                <Footer style={commonStyle}>Footer</Footer>
            </Layout>
            <Button
                onClick={changeVisible}
                style={{
                    display: 'block',
                    width: '120px',
                    margin: '0 auto'
                }}
            >
                { visible ? 'Hide Banner' : 'Show Banner' }
            </Button>
        </>
    );
};
```

### 不同类型

支持4种类型：`info`、`warning`、`danger`、`success`。默认为 `info`。

```jsx live=true dir="column"
import React from 'react';
import { Banner } from '@douyinfe/semi-ui';

() => (
    <>
        <Banner 
            type="info"
            description="Semi D2C 现已支持 Figma DevMode, 安装插件，随时查阅图层对应的前端代码"
        />
        <br/>
        <Banner 
            type="warning"
            description="当前使用 Figma UI Kit 为旧版，可能无法支持完整的 Design to code 能力"
        />
        <br/>
        <Banner 
            type="danger"
            description="当前使用 API 已过期，请尽快升级"
        />
        <br/>
        <Banner 
            type="success"
            description="Semi DSM, Make Semi Design to Any Design"
        />
    </>
);
```


### 非全屏模式
可以设置  `fullMode={false}` 使用非全屏模式的 banner 样式。
通过 `bordered` 属性可以设置边框。

```jsx live=true dir="column"
import React from 'react';
import { Banner, Typography } from '@douyinfe/semi-ui';

function Demo() {
    const { Text } = Typography;
  
    return (
        <div style={{ width: 640 }} className="components-banner-demo">
            <Banner fullMode={false} type="info" bordered icon={null} closeIcon={null}
                title={<div style={{ fontWeight: 600, fontSize: '14px', lineHeight: '20px' }}>不知道 AppKey？</div>}
                description={<div>你可先联系对应的研发同学，确认是否已在 <Text link={{ href: 'https://semi.design/' }}>应用云平台</Text> 申请了应用，并填写对应的信息。</div>}
            /><br/>
            <Banner fullMode={false} type="warning" bordered icon={null} closeIcon={null}
                title={<div style={{ fontWeight: 600, fontSize: '14px', lineHeight: '20px' }}>不知道 AppKey？</div>}
                description={<div>你可先联系对应的研发同学，确认是否已在 <Text link={{ href: 'https://semi.design/' }}>应用云平台</Text> 申请了应用，并填写对应的信息。</div>}
            /><br/>
            <Banner fullMode={false} type="danger" bordered icon={null} closeIcon={null}
                title={<div style={{ fontWeight: 600, fontSize: '14px', lineHeight: '20px' }}>不知道 AppKey？</div>}
                description={<div>你可先联系对应的研发同学，确认是否已在 <Text link={{ href: 'https://semi.design/' }}>应用云平台</Text> 申请了应用，并填写对应的信息。</div>}
            /><br/>
            <Banner fullMode={false} type="success" bordered icon={null} closeIcon={null}
                title={<div style={{ fontWeight: 600, fontSize: '14px', lineHeight: '20px' }}>不知道 AppKey？</div>}
                description={<div>你可先联系对应的研发同学，确认是否已在 <Text link={{ href: 'https://semi.design/' }}>应用云平台</Text> 申请了应用，并填写对应的信息。</div>}
            />
        </div>
    );
}
```

```
.components-banner-demo {
    .semi-banner-info.semi-banner-bordered {
        border: 1px solid var(--semi-color-primary-disabled);
    }
    .semi-banner-warning.semi-banner-bordered {
        border: 1px solid var(--semi-color-warning-light-active);
    }
    .semi-banner-danger.semi-banner-bordered {
        border: 1px solid var(--semi-color-danger-light-active);
    }
    .semi-banner-success.semi-banner-bordered {
        border: 1px solid var(--semi-color-success-light-active);
    }
}
```

### 自定义内容
可以通过 children 自定义其他渲染内容。
```jsx live=true dir="column"
import React from 'react';
import { Banner } from '@douyinfe/semi-ui';

() => (
    <div style={{ width: 500, padding: 20, border: '1px solid var(--semi-color-border)' }}>
        <Banner
            fullMode={false}
            title="Title"
            type="warning"
            bordered
            description="Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat"
        >
            <div className="semi-modal-footer">
                <button className="semi-button semi-button-tertiary semi-button-light" type="button">No, thanks.</button>
                <button className="semi-button semi-button-warning" type="button">Sounds great!</button>
            </div>
        </Banner>
        <br/>
    </div>
);
```

## API参考

| 属性  | 说明        | 类型            | 默认值 | 版本 | 
|-------|-------------|-----------------|--------| --- | 
| bordered | 是否展示边框，仅在非全屏模式下有效 | boolean | false | 1.0 |
| className | 类名 | string | - | - |
| closeIcon | 自定义关闭icon，为 null 时不显示关闭按钮 | string\| ReactNode | - | 1.0 |
| description | 描述内容 | ReactNode | - | 1.0 |
| fullMode| 是否为全屏模式 | boolean | true | 1.0 |
| icon | 自定义 icon，为 null 时不显示 icon | string\| ReactNode | - | 1.0 |
| onClose | 关闭时的回调函数 | function | - | - |
| style | 样式名 | object | - | - |
| title | 标题 | ReactNode | - | 1.0 |
| type | 类型，支持 `info`, `success`, `danger`, `warning` | string | `info` | - |

## Accessibility

### ARIA

- 组件的 `role` 为 'alert'
- 关闭按钮的 `aria-label` 为 'Close'

### 键盘和焦点

- Banner 的关闭按钮可以使用 `Tab` 键聚焦，按钮聚焦后，敲击 `Enter` 键或 `Space` 键可以关闭 banner

## 文案规范
- 全屏 Banner
  - 尽量保持内容一行展示完全
  - 使用正确的标点符号，句子内使用逗号，句子间使用句号
- 非全屏 Banner
  - 标题
    - 使用精简的语言进行说明
    - 标题上尽量避免使用逗号，句号等标点符号，有且只有是疑问句的时候，支持使用问号结尾
  - 正文
    - 在信息传递完整的前提下，尽可能地将正文压缩至 1 -2 句话
    - 对标题进行详尽地描述或者解释，而不是对标题的重复说明
    - 使用正确的标点符号，句子内使用逗号，句子间使用句号

## 设计变量
<DesignToken/>