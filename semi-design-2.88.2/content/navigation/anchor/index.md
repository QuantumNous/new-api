---
localeCode: zh-CN
order: 53
category: 导航类
title:  Anchor 锚点
icon: doc-anchor
brief: 创建超链接导航栏。
---


## 代码演示

### 如何引入

```jsx import
import { Anchor } from '@douyinfe/semi-ui';
```

### 基本示例
使用 Link 可以创建锚点，点击它会跳转到指定位置。

```jsx live=true
import React from 'react';
import { Anchor } from '@douyinfe/semi-ui';

() => (
    <Anchor>
        <Anchor.Link href="#基本示例" title="基本示例" />
        <Anchor.Link href="#组件" title="组件" />
        <Anchor.Link href="#设计语言" title="设计语言" />
        <Anchor.Link href="#物料平台" title="物料平台" />
        <Anchor.Link href="#主题商店" title="主题商店" />
    </Anchor>  
);
```

### 综合使用

你可以搭配 `getContainer`，`targetOffset`，`style`，`offsetTop` 完成一个拆箱即用的超链接导航栏。

-   滚动容器：你可以通过 `getContainer` 设置滚动内容的容器，默认值为 `window` 。

-   距离顶部的距离：可以通过设置 `targetOffset` 设置文档滚动结束时，锚点距离容器顶部的距离。**v>=1.9**

-   自定义定位方式：Anchor 的默认定位方式为 `relative`，你可以通过 `style` 对象自定义它的定位方式。

-   偏移距离：`offsetTop` 可以在滚动内容距离容器顶部达到指定偏移量时触发当前 Link 切换。

```jsx
import React from 'react';
import { Anchor } from '@douyinfe/semi-ui';

() => {
    const getContainer = () => {
        return document.querySelector('window');
    };
    return (
        <div>
            <span>请看右侧固定的 Anchor </span>
            <Anchor
                getContainer={getContainer}
                offsetTop={100}
                targetOffset={100} // v>=1.9
                style={{ position: 'fixed', right: '20px', top: '100px', width: '200px', zIndex: 3 }} >
                <Anchor.Link href="#基本示例" title="我是固定的 Anchor" />
                <Anchor.Link href="#综合使用" title="综合使用" />
                <Anchor.Link href="#尺寸" title="尺寸" />
                <Anchor.Link href="#滑轨主题" title="滑轨主题" />
                <Anchor.Link href="#动态展示" title="动态展示" />
                <Anchor.Link href="#显示工具提示" title="显示工具提示" />
                <Anchor.Link href="#工具提示位置" title="工具提示位置" />
                <Anchor.Link href="#API参考" title="API参考">
                    <Anchor.Link href="#Anchor" title="Anchor" />
                    <Anchor.Link href="#Anchor.Link" title="Anchor.Link" />
                </Anchor.Link>
            </Anchor>
        </div>
    );
};
```

### 尺寸

Anchor 设置 `size` 可以控制锚点的尺寸。

```jsx live=true
import React from 'react';
import { Anchor } from '@douyinfe/semi-ui';

() => (
    <Anchor size={'default'}>
        <Anchor.Link href="#组件" title="组件" />
        <Anchor.Link href="#设计语言" title="设计语言" />
        <Anchor.Link href="#物料平台" title="物料平台" />
        <Anchor.Link href="#主题商店" title="主题商店" />
    </Anchor>
);
```

```jsx live=true
import React from 'react';
import { Anchor } from '@douyinfe/semi-ui';

() => (
    <Anchor size={'small'}>
        <Anchor.Link href="#组件" title="组件" />
        <Anchor.Link href="#设计语言" title="设计语言" />
        <Anchor.Link href="#物料平台" title="物料平台" />
        <Anchor.Link href="#主题商店" title="主题商店" />
    </Anchor>
);
```

### 滑轨主题

Anchor 设置 `railTheme` 可以控制滑轨的主题色。默认值为 `primary`。

```jsx live=true
import React from 'react';
import { Anchor } from '@douyinfe/semi-ui';

() => {
    const getContainer = () => {
        return document.querySelector('window');
    };
    return (
        <div>
            <Anchor
                railTheme={'primary'}
                getContainer={getContainer}
                targetOffset={60}
                offsetTop={100}
            >
                <Anchor.Link href="#尺寸" title="尺寸" />
                <Anchor.Link href="#滑轨主题" title="滑轨主题" />
                <Anchor.Link href="#设计语言" title="设计语言" />
                <Anchor.Link href="#物料平台" title="物料平台" />
                <Anchor.Link href="#主题商店" title="主题商店" />
            </Anchor>
        </div>
    );
};
```

```jsx live=true
import React from 'react';
import { Anchor } from '@douyinfe/semi-ui';

() => {
    const getContainer = () => {
        return document.querySelector('window');
    };
    return (
        <div>
            <Anchor
                railTheme={'tertiary'}
                getContainer={getContainer}
                targetOffset={60}
                offsetTop={100}
            >
                <Anchor.Link href="#尺寸" title="尺寸" />
                <Anchor.Link href="#滑轨主题" title="滑轨主题" />
                <Anchor.Link href="#设计语言" title="设计语言" />
                <Anchor.Link href="#物料平台" title="物料平台" />
                <Anchor.Link href="#主题商店" title="主题商店" />
            </Anchor>
        </div>
    );
};
```

```jsx live=true
import React from 'react';
import { Anchor } from '@douyinfe/semi-ui';

() => {
    const getContainer = () => {
        return document.querySelector('window');
    };
    return (
        <div>
            <Anchor
                railTheme={'muted'}
                getContainer={getContainer}
                targetOffset={60}
                offsetTop={100}
            >
                <Anchor.Link href="#尺寸" title="尺寸" />
                <Anchor.Link href="#滑轨主题" title="滑轨主题" />
                <Anchor.Link href="#设计语言" title="设计语言" />
                <Anchor.Link href="#物料平台" title="物料平台" />
                <Anchor.Link href="#主题商店" title="主题商店" />
            </Anchor>
        </div>
    );
};
```

### 动态展示

Anchor 设置 `autoCollapse` 可以动态展示下一级锚点。默认值为 `false`。

```jsx live=true
import React from 'react';
import { Anchor } from '@douyinfe/semi-ui';

() => {
    const getContainer = () => {
        return document.querySelector('window');
    };
    return (
        <div>
            <Anchor
                autoCollapse={true}
                getContainer={getContainer}
                targetOffset={60}
                offsetTop={100}>
                <Anchor.Link href="#动态展示" title="1. 动态展示">
                    <Anchor.Link href="#组件" title="1.1 组件">
                        <Anchor.Link href="#头像" title="1.1.1 Avatar" />
                        <Anchor.Link href="#按钮" title="1.1.2 Button" />
                        <Anchor.Link href="#图标" title="1.1.3 Icon" />
                    </Anchor.Link>
                    <Anchor.Link href="#物料" title="1.2 物料" />
                    <Anchor.Link href="#主题商店" title="1.3 主题商店" />
                </Anchor.Link>
                <Anchor.Link href="#设计语言" title="2. 设计语言" />
            </Anchor>
        </div>
    );
};
```

```jsx live=true
import React from 'react';
import { Anchor } from '@douyinfe/semi-ui';

() => {
    const getContainer = () => {
        return document.querySelector('window');
    };
    return (
        <div>
            <Anchor
                autoCollapse={false}
                getContainer={getContainer}
                targetOffset={60}
                offsetTop={100}>
                <Anchor.Link href="#动态展示" title="1. 动态展示">
                    <Anchor.Link href="#组件" title="1.1 组件">
                        <Anchor.Link href="#头像" title="1.1.1 Avatar" />
                        <Anchor.Link href="#按钮" title="1.1.2 Button" />
                        <Anchor.Link href="#图标" title="1.1.3 Icon" />
                    </Anchor.Link>
                    <Anchor.Link href="#物料" title="1.2 物料" />
                    <Anchor.Link href="#主题商店" title="1.3 主题商店" />
                </Anchor.Link>
                <Anchor.Link href="#设计语言" title="2. 设计语言" />
            </Anchor>
        </div>
    );
};
```

### 显示工具提示

Anchor 设置 `showTooltip` 可以在 Link 超出最大宽度时显示 Link 的文字内容。默认值为 `false`, 更多使用参考 API 说明。

```jsx live=true
import React from 'react';
import { Anchor } from '@douyinfe/semi-ui';

() => {
    const getContainer = () => {
        return document.querySelector('window');
    };
    return (
        <div>
            <Anchor
                showTooltip={true}
                getContainer={getContainer}
                targetOffset={60}
                offsetTop={100}
            >
                <Anchor.Link href="#显示工具提示" title="工具提示是一个有用的工具，它可以在文字缩略时展示全部内容。" />
                <Anchor.Link href="#组件" title="组件" />
                <Anchor.Link href="#设计语言" title="设计语言" />
                <Anchor.Link href="#物料平台" title="物料平台" />
                <Anchor.Link href="#主题商店" title="主题商店" />
            </Anchor>
        </div>
    );
};
```

### 工具提示位置

Anchor 设置 `position` 可以设置Tooltip的显示位置。它仅在 `showTooltip` 为 `true` 时起作用。

```jsx live=true
import React from 'react';
import { Anchor } from '@douyinfe/semi-ui';

() => {
    const getContainer = () => {
        return document.querySelector('window');
    };
    return (
        <div>
            <Anchor
                showTooltip={true}
                position={'right'}
                getContainer={getContainer}
                targetOffset={60}
                offsetTop={100}
            >
                <Anchor.Link href="#工具提示位置" title="工具提示是一个有用的工具，它可以在文字缩略时展示全部内容。" />
                <Anchor.Link href="#组件" title="组件" />
                <Anchor.Link href="#设计语言" title="设计语言" />
                <Anchor.Link href="#物料平台" title="物料平台" />
                <Anchor.Link href="#主题商店" title="主题商店" />
            </Anchor>
        </div>
    );
};
```

## API 参考

### Anchor

| 属性          | 说明                                             | 类型                                | 默认值    | 版本   |
| ------------- | ------------------------------------------------ | ----------------------------------- | --------- | - |
| autoCollapse  | 滚动时动态显示下一级锚点                         | boolean                             | false     |        |
| className     | 类名                                             | string                              | -         |        |
| defaultAnchor | 默认高亮锚点                                     | string                              | -         | 1.20.0 |
| getContainer  | 指定滚动的容器                                   | () => HTMLElement                   | window    |        |
| maxHeight     | 组件的 max-height，超出时显示滚动条              | string \| number                    | `750px`   |        |
| maxWidth      | 组件的 max-width，超出时显示...                  | string \| number                    | `200px`   |        |
| offsetTop     | 滚动内容距离容器顶部达到指定偏移量时触发         | number                              | 0         |        |
| onChange      | 改变锚点的回调函数                               | (currentLink, previousLink) => void | -         |        |
| onClick       | 点击锚点回调函数                                 | (event, currentLink) => void        | -         |        |
| position      | Tooltip 显示位置，可选值同 Tooltip 组件 position | string                              | -         |        |
| railTheme     | 滑轨主题，可选值：`primary`，`tertiary`，`muted` | string                              | `primary` |        |
| scrollMotion  | 是否开启滚动动画                                 | boolean                             | false     |        |
| showTooltip   | 文字缩略时是否显示 Tooltip 及相关配置, type，浮层内容承载的组件，支持 Tooltip（默认） \| Popover；opts，其他需要透传给浮层组件的属性, object 形式设置自 2.36.0 版本提供   | boolean \| {type: 'tooltip'\|'popover', opts: object}  | false     |        |
| size          | 锚点尺寸，可选值： `small`，`default`            | string                              | `default` |        |
| style         | 样式对象                                         | object                              | -         |        |
| targetOffset  | 锚点滚动时距离顶部偏移量                         | number                              | 0         | 1.9.0  |

### Anchor.Link

| 属性      | 说明                 | 类型              | 默认值 |   版本     |
| --------- | -------------------- | ----------------- | ------ | ------ |
| className | 类名                 | string            | -      |        |
| disabled  | 禁用，不响应点击跳转 | boolean           | false  | 1.20.0 |
| href      | 跳转的链接           | string            | -      |        |
| style     | 样式对象             | object            | -      |        |
| title     | 文字内容             | string\|ReactNode | -      |        |

## 文案规范
- 按句子大小写书写
- 保持简洁，避免换行

## 设计变量
<DesignToken/>


## FAQ

1. **为何我的 Link 没有高亮和滑动跟随？**  
    检查下点击锚点是否可以滚动到指定位置：
    - 不可以，说明 href 有问题，检查文档中是否存在该 id；
    - 可以，可能是滚动容器设置不正确，确保文档内容被包裹在滚动容器内。滚动容器默认为 window，如果你的容器是 .my-container 的 div，则应该将滚动容器设置为该 div。
    
    ```text
    import React from 'react';
    import { Anchor } from '@douyinfe/semi-ui';

    function() {
        // 此容器不是 Anchor 组件的容器，是文档内容的容器，因为要根据文档容器去计算当前是哪个 id 在容器上方
        const getContainer = () => {
            return document.querySelector('.my-container');
        }
        return (
            <Anchor
                /* 其他属性 */
                getContainer={getContainer}
                >
                /* Links */
            </Anchor>
        )
    }
    ```
