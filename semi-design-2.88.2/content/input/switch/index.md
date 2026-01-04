---
localeCode: zh-CN
order: 47
category: 输入类
title: Switch 开关
icon: doc-switch
width: 60%
brief: 开关是用于切换两种互斥状态的交互形式
---

## 代码演示

### 如何引入

```jsx import
import { Switch } from '@douyinfe/semi-ui';
```

### 基本

你可以通过 `onChange` 监听状态变化，通过 `defaultChecked` 或受控的 `checked` 制定选中状态。  
通过 `aria-label` 描述该 Switch 开关的具体作用

```jsx live=true
import React from 'react';
import { Switch } from '@douyinfe/semi-ui';

() => (
    <div>
        <Switch onChange={(v, e) => console.log(v)} aria-label="a switch for demo"></Switch>
        <br />
        <Switch defaultChecked={true} onChange={(v, e) => console.log(v)} aria-label="a switch for semi demo"></Switch>
    </div>
);
```

### 尺寸

你可以通过 size 指定尺寸

```jsx live=true
import React from 'react';
import { Switch } from '@douyinfe/semi-ui';

() => (
    <div>
        <Space style={{ marginBottom: 10, display: 'block' }}>
            <Switch size="small" aria-label="a switch for demo"></Switch>
            <Switch defaultChecked={true} size="small" aria-label="a switch for demo"></Switch>
            <Switch size="small" loading aria-label="a switch for demo" />
            <Switch size="small" loading defaultChecked={true} aria-label="a switch for demo" />
        </Space>
        <Space style={{ marginBottom: 10, display: 'block' }}>
            <Switch></Switch>
            <Switch defaultChecked={true} aria-label="a switch for demo"></Switch>
            <Switch loading aria-label="a switch for demo" />
            <Switch loading defaultChecked={true} aria-label="a switch for demo" />
        </Space>
        <Space>
            <Switch size="large"></Switch>
            <Switch defaultChecked={true} size="large"></Switch>
            <Switch size="large" loading />
            <Switch size="large" loading defaultChecked={true} />
        </Space>
    </div>
);
```

### 不可用

```jsx live=true
import React from 'react';
import { Switch } from '@douyinfe/semi-ui';

() => (
    <div>
        <Switch disabled aria-label="a switch for demo"></Switch>
        <br />
        <Switch disabled checked={true} aria-label="a switch for demo"></Switch>
    </div>
);
```

### 带文本

可以通过 `checkedText` 与 `uncheckedText` 设置开关时的文本  
注意：此项功能在最小的开关(即 size='small'时)无效

```jsx live=true
import React from 'react';
import { Switch } from '@douyinfe/semi-ui';

() => (
    <div>
        <Switch checkedText="开" uncheckedText="关" />
        <Switch checkedText="｜" uncheckedText="〇" style={{ marginLeft: 5 }} />
        <br />
        <br />
        <Switch defaultChecked checkedText="开" uncheckedText="关" />
        <Switch defaultChecked checkedText="｜" uncheckedText="〇" style={{ marginLeft: 5 }} />
        <br />
        <br />
        <Switch checkedText="开" uncheckedText="关" size="large" />
        <Switch checkedText="｜" uncheckedText="〇" size="large" style={{ marginLeft: 5 }} />
        <br />
        <br />
        <Switch defaultChecked checkedText="开" uncheckedText="关" size="large" />
        <Switch defaultChecked checkedText="｜" uncheckedText="〇" size="large" style={{ marginLeft: 5 }} />
    </div>
);
```

相比于通过 checkedText 与 uncheckedText 设置内嵌的文本，我们更推荐将文本说明放置在 Switch 外部

```jsx live=true
import React, { useState } from 'react';
import { Switch, Typography } from '@douyinfe/semi-ui';

() => {
    const [open, setOpen] = useState();
    const { Title } = Typography;
    return (
        <div style={{ display: 'flex', alignItems: 'center' }}>
            <Title heading={6} style={{ margin: 8 }}>
                {open ? '已开启' : '已关闭'}
            </Title>
            <Switch checked={open} onChange={setOpen} aria-label="a switch for demo" />
        </div>
    );
};
```

### 受控组件

组件是否选中完全取决于传入的 checked 值，配合 onChange 回调函数使用

```jsx live=true hideInDSM
import React from 'react';
import { Switch } from '@douyinfe/semi-ui';

() => {
    const [checked, setChecked] = useState(true);

    const onChange = checked => {
        setChecked(checked);
    };

    return <Switch checked={checked} aria-label="a switch for demo" onChange={onChange} />;
};
```

### 加载中

version: >= 1.29.0

可以通过设置 loading="true" 开启加载中状态。

```jsx live=true
import React from 'react';
import { Switch } from '@douyinfe/semi-ui';

() => (
    <div>
        <Switch loading />
        <br />
        <Switch loading defaultChecked={true} />
    </div>
);
```

## API 参考

| 属性 | 说明 | 类型 | 默认值 | 版本 |
| --- | --- | --- | --- | --- |
| aria-label | [aria-label](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Techniques/Using_the_aria-label_attribute)属性，用来给当前元素加上的标签描述, 提升可访问性 | string |  | 2.2.0 |
| aria-labelledby | [aria-labelledby](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Techniques/Using_the_aria-labelledby_attribute)属性，表明某些元素的 id 是某一对象的标签。它被用来确定控件或控件组与它们标签之间的联系, 提升可访问性 | string |  | 2.2.0 |
| className | 类名 | string |  |
| checked | 指示当前是否选中,配合 onChange 使用 | boolean | false |  |
| checkedText | 打开时展示的内容, size 为 small 时无效 | ReactNode |  |  |
| defaultChecked | 初始是否选中 | boolean | false |  |
| disabled | 是否禁用 | boolean | false |  |
| loading | 设置加载状态 | boolean | false | 1.29.0 |
| onChange | 变化时回调函数 | function(checked:boolean) |  |  |
| onMouseEnter | 鼠标移入时回调 | function() |  |  |
| onMouseLeave | 鼠标移出时回调 | function() |  |  |
| size | 尺寸,可选值`large`,`default`,`small` | string | 'default' |  |
| style | 内联样式 | object |  |  |
| uncheckedText | 关闭时展示的内容, size 为 small 时无效 | ReactNode |  |  |

## Accessibility

### ARIA

-   Switch 具有 `switch` role，当 checked 为 true 时，`aria-checked` 将被自动设置为 true，反之亦然
-   作为表单控件应该带有 Label，当你使用 Form.Switch 时会自动被带上
-   如果你单独使用 Switch，建议使用 `aria-label` 描述当前标签作用

### 键盘和焦点

-   键盘用户可以使用 `Tab` 及 `Shift + Tab` 切换焦点
-   聚焦时可以通过 `Space` 键切换开启或关闭状态

## 文案规范
- 开关描述
  - 首字母大写，不需要标点符号
  - 间接明了地说明该设置的开启或关闭状态
  - 如果需要，解释给用户开启和关闭状态所代表的情况
## 设计变量

<DesignToken/>
