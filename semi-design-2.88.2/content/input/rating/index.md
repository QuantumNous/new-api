---
localeCode: zh-CN
order: 44
category: 输入类
title:  Rating 评分
icon: doc-rating
brief: 展示评分的组件
---


## 代码演示

### 如何引入

```jsx import
import { Rating } from '@douyinfe/semi-ui';
```
### 基本用法

最简单的用法，支持两种尺寸 `default`， `small`。  

支持传入 number 类型自定义尺寸。具体可以参考[自定义](#自定义)

```jsx live=true
import React from 'react';
import { Rating } from '@douyinfe/semi-ui';

() => (
    <div>
        <Rating defaultValue={5}/>
        <br/>
        <br/>
        <Rating size='small' defaultValue={5}/>
    </div>
);
```

### 半星

通过设置 `allowHalf` 属性可以支持选择半星。 `allowHalf` 属性支持**展示**除0.5以外的小数。

```jsx live=true
import React from 'react';
import { Rating } from '@douyinfe/semi-ui';

() => (
    <div>
        <Rating allowHalf defaultValue={3.5}/>
        <br/>
        <Rating allowHalf defaultValue={3.65} disabled/>
    </div>
);
```

### 只读
通过设置 `disabled` 属性将无法进行交互。
```jsx live=true
import React from 'react';
import { Rating } from '@douyinfe/semi-ui';

() => (
    <Rating disabled defaultValue={3} />
);
```

### 点击清除
通过设置 `allowClear` 属性允许再次点击时清除数值，默认为 `true`。
```jsx live=true
import React from 'react';
import { Rating } from '@douyinfe/semi-ui';

() => (
    <div>
        <span>允许再次点击清除</span>
        <br/>
        <Rating allowClear={true} defaultValue={3}/>
        <br/>
        <br/>
        <span>禁止再次点击清除</span>
        <br/>
        <Rating allowClear={false} defaultValue={3}/>
    </div>
);
```

### 文案展现

给评分组件加上文案展示。

```jsx live=true
import React, { useState } from 'react';
import { Rating } from '@douyinfe/semi-ui';

() => {
    const [value, setValue] = useState(0);
    const change = (val) => setValue(val);
    const desc = ['terrible', 'bad', 'normal', 'good', 'wonderful'];
    return (
        <div>
            <span>How was the help you received: 
                {value ? <span>{desc[value - 1]}</span> : ''}
            </span>
            <br/>
            <Rating tooltips={desc} onChange={change} value={value} />
        </div>
    );
};
```

### 自定义

自定义评分字符、个数及尺寸。  
自定义尺寸需要配合自定义的字符才能生效。

```jsx live=true
import React from 'react';
import { Rating } from '@douyinfe/semi-ui';
import { IconLikeHeart } from '@douyinfe/semi-icons';

() => (
    <div>
        <Rating style={{ color: 'red' }} character={(<IconLikeHeart size="extra-large" />)} defaultValue={3}/>
        <br/>
        <br/>
        <Rating style={{ color: 'red' }} size={48} allowHalf character={(<IconLikeHeart style={{ fontSize: 48 }} />)} defaultValue={3}/>
        <br/>
        <br/>
        <Rating character={'赞'} size={18} defaultValue={3}/>
        <br/>
        <br/>
        <Rating count={10} defaultValue={6}/>
    </div>
);
```

## API参考

| 属性  | 说明        | 类型            | 默认值 |
|-------|-------------|-----------------|--------|
| allowClear | 是否允许再次点击后清除 | boolean | true |
| allowHalf | 是否允许半选 | boolean | false |
| autoFocus | 自动获取焦点 | boolean | false |
| character | 自定义字符 | ReactNode | `<IconStar size="extra-large"/>` |
| className | 自定义样式类名 | string | - |
| count | star 总数 | number | 5 |
| defaultValue | 默认值 | number | 0 |
| disabled | 只读，无法进行交互 | boolean | false |
| preventScroll | 指示浏览器是否应滚动文档以显示新聚焦的元素，作用于组件内的 focus 方法 | boolean |  |  |
| size | 尺寸， `default`， `small`，**v >= 0.35.0** 后支持传入 number 类型自定义尺寸 | string \| number | `default` |
| style | 自定义样式对象 | object | - |
| tooltips | 自定义每项的提示信息 | string[] | - |
| value | 当前受控值 | number | - |
| onBlur | 失去焦点时的回调 | function() | - |
| onChange | 选择时的回调 | function(value: number) | - |
| onFocus | 获取焦点时的回调 | function() | - |
| onHoverChange | 鼠标经过时数值变化的回调 | function(value: number) | - |
| onKeyDown | 按键回调 | function(e: event) | - |

## Accessibility

### ARIA
- Rating 具有 `aria-checked` 表示当前是否选中，`aria-posinset` 表示在列表的位置，`aria-setsize` 表示列表的长度。
- Semi 支持自定义 Rating 的语义:
  - 可以使用 `aria-label` 来定制 Rating 的语义化；
  - 若用户传入的 `character` 类型为 string，将使用这个 string 来做 Rating 的语义化；
  - `aria-label`的优先级高于string的`character`。

### 键盘和焦点
- Rating 的初始焦点设置：
  - 若 Rating 有选择项时，初始焦点应当设置为最后一个选择项时（如：有 3颗🌟被点亮，则初始焦点设置在第三颗被点亮的🌟上）；
  - 若 Rating 没有选择项时，初始焦点应当为整个 Rating。
- 一个 Rating 组上，可以通过 `右箭头` 或 `上箭头` 选中当前焦点的下一个焦点项，`左箭头` 或 `下箭头` 选中当前焦点的上一个焦点项；
  - 用户设置了 `allowHalf` 属性，按方向键只选中或取消选中半颗星；
- `disabled`的 Rating 无法被获取到焦点。

## 设计变量
<DesignToken/>