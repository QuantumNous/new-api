---
localeCode: zh-CN
order: 70
category: 展示类
title: Empty 空状态
icon: doc-empty
dir: column
brief: 空状态时的展示占位图。
---

## 代码演示

### 如何引入

```jsx import
import { Empty } from '@douyinfe/semi-ui';
```

### 基本用法

通过 `image` 设置占位图片，可以从 `@douyinfe/semi-illustrations` 中手动引入对应的插画（插画默认宽高是200x200），也可以传入自定义的插画。目前拥有的插画可以查看[占位图插画](#占位图插画_建设中_)。

**v>=1.13.0** 之后增加一系列暗色模式的插画，并支持通过 `darkModeImage` 传入暗色模式下需要使用的插画，以更好地适配暗色模式。

```jsx live=true dir="column"
import React from 'react';
import { Empty } from '@douyinfe/semi-ui';
import { IllustrationConstruction, IllustrationConstructionDark } from '@douyinfe/semi-illustrations';

() => (
    <Empty
        image={<IllustrationConstruction style={{ width: 150, height: 150 }} />}
        darkModeImage={<IllustrationConstructionDark style={{ width: 150, height: 150 }} />}
        title={'功能建设中'}
        description="当前功能暂未开放，敬请期待。"
    />
);
```

### 自定义

通过 `children` 可以实现自定义的描述内容。

```jsx live=true dir="column"
import React from 'react';
import { Empty, Button } from '@douyinfe/semi-ui';
import { IllustrationNoContent, IllustrationNoContentDark } from '@douyinfe/semi-illustrations';

() => (
    <Empty
        image={<IllustrationNoContent style={{ width: 150, height: 150 }} />}
        darkModeImage={<IllustrationNoContentDark style={{ width: 150, height: 150 }} />}
        title="空状态标题"
        description="开始创建你的第一个仪表盘吧！"
    >
        <div>
            <Button style={{ padding: '6px 24px', marginRight: 12 }} type="primary">
                二级按钮
            </Button>
            <Button style={{ padding: '6px 24px' }} theme="solid" type="primary">
                一级按钮
            </Button>
        </div>
    </Empty>
);
```

也可以不使用图片。

```jsx live=true dir="column"
import React from 'react';
import { Empty, Typography } from '@douyinfe/semi-ui';

() => (
    <Empty
        title="暂未找到匹配的筛选结果"
        description={
            <span>
                <Typography.Text>试试 </Typography.Text>
                <Typography.Text link>重置筛选条件</Typography.Text>
            </span>
        }
    />
);
```

### 不同布局

支持 2 种类型的布局：`vertical`、`horizontal`。默认为 `vertical`。

```jsx live=true dir="column"
import React from 'react';
import { Empty, Button } from '@douyinfe/semi-ui';
import { IllustrationSuccess, IllustrationSuccessDark } from '@douyinfe/semi-illustrations';

() => (
    <Empty
        title={'创建成功'}
        image={<IllustrationSuccess style={{ width: 150, height: 150 }} />}
        darkModeImage={<IllustrationSuccessDark style={{ width: 150, height: 150 }} />}
        layout="horizontal"
        description="这是一段很长的描述文本，当文本过长的时候推荐使用这种布局形式。这是一段很长的描述文本，当文本过长的时候推荐使用这种布局形式。这是一段很长的描述文本，当文本过长的时候推荐使用这种布局形式。"
        style={{ width: 800, margin: '0 auto' }}
    >
        <Button type="primary" theme="solid" style={{ padding: '6px 24px' }}>
            开始操作
        </Button>
    </Empty>
);
```

### 占位图插画(建设中)

目前 `@douyinfe/semi-illustrations` 中支持以下插画。

```jsx live=true dir="column"
import React from 'react';
import { Empty } from '@douyinfe/semi-ui';
import { IllustrationConstruction, IllustrationSuccess, IllustrationFailure, IllustrationNoAccess, IllustrationNoContent, IllustrationNotFound, IllustrationNoResult } from '@douyinfe/semi-illustrations';

/* 以下为 1.13.0 版本后提供 */
import { IllustrationIdle, IllustrationIdleDark, IllustrationConstructionDark, IllustrationSuccessDark, IllustrationFailureDark, IllustrationNoAccessDark, IllustrationNoContentDark, IllustrationNotFoundDark, IllustrationNoResultDark } from '@douyinfe/semi-illustrations';

() => {
    const emptyStyle = {
        padding: 30,
    };
    return (
        <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            <Empty
                image={<IllustrationSuccess style={{ width: 150, height: 150 }} />}
                darkModeImage={<IllustrationSuccessDark style={{ width: 150, height: 150 }} />}
                description={'创建成功'}
                style={emptyStyle}
            />
            <Empty
                image={<IllustrationFailure style={{ width: 150, height: 150 }} />}
                darkModeImage={<IllustrationFailureDark style={{ width: 150, height: 150 }} />}
                description={'加载失败'}
                style={emptyStyle}
            />
            <Empty
                image={<IllustrationNoAccess style={{ width: 150, height: 150 }} />}
                darkModeImage={<IllustrationNoAccessDark style={{ width: 150, height: 150 }} />}
                description={'没有权限'}
                style={emptyStyle}
            />
            <Empty
                image={<IllustrationNoContent style={{ width: 150, height: 150 }} />}
                darkModeImage={<IllustrationNoContentDark style={{ width: 150, height: 150 }} />}
                description={'暂无内容，请添加'}
                style={emptyStyle}
            />
            <Empty
                image={<IllustrationNotFound style={{ width: 150, height: 150 }} />}
                darkModeImage={<IllustrationNotFoundDark style={{ width: 150, height: 150 }} />}
                description={'页面404'}
                style={emptyStyle}
            />
            <Empty
                image={<IllustrationNoResult style={{ width: 150, height: 150 }} />}
                darkModeImage={<IllustrationNoResultDark style={{ width: 150, height: 150 }} />}
                description={'搜索无结果'}
                style={emptyStyle}
            />
            <Empty
                image={<IllustrationConstruction style={{ width: 150, height: 150 }} />}
                darkModeImage={<IllustrationConstructionDark style={{ width: 150, height: 150 }} />}
                description={'建设中'}
                style={emptyStyle}
            />
            <Empty
                image={<IllustrationIdle style={{ width: 150, height: 150 }} />}
                darkModeImage={<IllustrationIdleDark style={{ width: 150, height: 150 }} />}
                description={'神游四方'}
                style={emptyStyle}
            />
        </div>
    );
};
```

## API 参考

| 属性 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| className | 类名 | string | - |
| darkModeImage | 暗色模式开启后的占位图，响应 document.body 的 theme-mode 属性变化 | ReactNode | - |
| description | 内容描述 | ReactNode | - |
| image | 占位图 | ReactNode \| { id?: string; viewBox?: string; url?: string;} | - |
| imageStyle | 占位图样式 | CSSProperties | - |
| layout | 布局方式，支持 `vertical`, `horizontal` | string | `vertical` |
| style | 样式名 | CSSProperties | - |
| title | 标题 | ReactNode | - |

## Accessibility

### ARIA

- Empty 插图的 aria-hidden 为 true

## 文案规范
- 标题
  - 标题应该简洁易懂
- 正文
  - 可以展示展示空状态的具体原因，也可以展示后续的操作行为去帮助用户消除空状态
  - 不要重复标题上的内容
  - 尽量保持正文在 1-2 句话内
- 动作按钮
  - 按钮文案需要足够清晰和容易理解
  - 使用 动词 + 名词 的格式
## 设计变量

<DesignToken/>

## FAQ
