---
localeCode: zh-CN
order: 54
category: 导航类
title: BackTop 回到顶部
icon: doc-backtop
---

## 代码演示

### 如何引入

```jsx import
import { BackTop } from '@douyinfe/semi-ui';
```

### 基本用法

BackTop 预设了基本的返回按钮，可以直接调用。

```jsx live=true
import React from 'react';
import { BackTop } from '@douyinfe/semi-ui';

class Demo extends React.Component {
    render() {
        return (
            <div>
                <span>Scroll down to see the bottom-right gray button.</span>
                <BackTop />
            </div>
        );
    }
}
```

### 自定义样式

BackTop 预设了默认样式，包括：距离底部 50px，距离右侧 100px，`box-sizing` 为 `border-box`，内容水平居中。样式可以覆盖。

```jsx live=true
import React from 'react';
import { BackTop } from '@douyinfe/semi-ui';
import { IconArrowUp } from '@douyinfe/semi-icons';

class Custom extends React.Component {
    render() {
        const style = {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 30,
            width: 30,
            borderRadius: '100%',
            backgroundColor: '#0077fa',
            color: '#fff',
            bottom: 100,
        };

        return (
            <div>
                <span>
                    Scroll down to see the bottom-right <span style={{ color: '#0077fa' }}>blue circular</span> button.
                </span>
                <BackTop style={style}>
                    <IconArrowUp />
                </BackTop>
            </div>
        );
    }
}
```

## API 参考

| 属性             | 说明                                                | 类型     | 默认值       |
| ---------------- | --------------------------------------------------- | -------- | ------------ |
| className        | 类名                                                | string   | -            |
| duration         | 滚动到顶部的时间                                    | number   | 450          |
| style            | 样式名                                              | CSSProperties   | -            |
| target           | 返回值为需要监听其滚动事件的元素对应 DOM 元素的函数 | () => any | () => window |
| visibilityHeight | 出现 BackTop 需要达到的滚动高度                     | number   | 400          |
| onClick          | 点击事件的回调函数                                  | (e: MouseEvent) => void | -            |

## 设计变量
<DesignToken/>