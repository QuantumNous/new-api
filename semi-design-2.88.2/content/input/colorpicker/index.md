---
localeCode: zh-CN
order: 37
category: 输入类
title: ColorPicker 颜色选择器
icon: doc-colorPlatteNew
brief: 快速便捷地选择颜色，并提供滴管工具取色
---



## 代码演示

### 如何引入

ColorPicker 从 v2.64.0 开始支持

```jsx import
import { ColorPicker } from '@douyinfe/semi-ui';
```


### 基本用法

#### 放在弹层

```jsx live=true
import React from 'react';
import { ColorPicker, Button } from '@douyinfe/semi-ui';
function Demo() {
    return <div>
        <ColorPicker alpha={true} onChange={value=>{console.log(value);}} usePopover={true}/>
        <br/>
        <div>自定义 trigger</div>
        <ColorPicker alpha={true} onChange={value=>{console.log(value);}} usePopover={true}>
            <Button> Trigger </Button>
        </ColorPicker>
    </div>;
}

```

#### 正常展示
```jsx live=true
import React from 'react';
import { ColorPicker } from '@douyinfe/semi-ui';
function Demo() {
    return <ColorPicker alpha={true} onChange={value=>{console.log(value);}}/>;
}

```

### 滴管取色器

使用 `eyeDropper={true}` 开启滴管功能，支持从浏览器内或外部软件屏幕取色。

<Notice title='注意事项'>
开启此功能需要当前网页部署在 HTTPS 或 localhost 域名等安全 context 下，否则无效果。需用户浏览器版本 Chromium > 95
</Notice>


```jsx live=true
import React from 'react';
import { ColorPicker } from '@douyinfe/semi-ui';
function Demo() {
    return <ColorPicker alpha={true} eyeDropper={true} onChange={value=>{console.log(value);}}/>;
}

```

### 默认值
在进行各种颜色表示格式之间相互转换时，部分格式之间存在理论误差，因此 onChange 返回给你的值是同时包含了 hsva hex rgba 三种格式的色值的对象。

你传入的 defaultValue(非受控) 和 value(受控) 也应当是同样包含三种格式的对象。

我们在组件类上提供了静态工具函数 `colorStringToValue`，用于将常见颜色字符串转换为该对象，支持 rgb(57,197,187) #39c5bb hsv(176,71,77) 等字符串直接传入。

```jsx live=true
import { ColorPicker } from '@douyinfe/semi-ui';
import React from 'react';

function Demo() {
    return <div>
        <ColorPicker 
            defaultValue={ColorPicker.colorStringToValue("rgb(57,197,187)")}
            onChange={(value)=>{
                console.log(value);
            }} className={""} alpha={true}/>
    </div>;

}

```

### 受控

通过传入 value 来受控使用

```jsx live=true
import { ColorPicker } from '@douyinfe/semi-ui';
import React from 'react';
function Demo() {
    const [value, setValue] = useState(ColorPicker.colorStringToValue("#39c5bb"));
    return <div>
        <ColorPicker
            value={value}
            onChange={(value)=>{
                setValue(value);
            }}
            alpha={true}
        />
    </div>;

}

```


### 顶部和底部渲染额外元素

使用 `topSlot` 和 `bottomSlot` 在顶部和底部渲染额外元素

```jsx live=true
import React from 'react';
import { ColorPicker } from '@douyinfe/semi-ui';
function Demo() {
    return <ColorPicker
        topSlot={<div> TopSlot</div>}
        bottomSlot={<div>Bottom Slot</div>}
        alpha={true}
        onChange={value=>{console.log(value);}}
    />;
}

```

### API 参考

| 参数            | 说明         | 类型            | 默认值  |
|---------------|------------|---------------|------|
| onChange | 用户选中颜色的回调 | (value)=>void | - |
| alpha         | 是否开启透明度选择  | boolean       | true |
| bottomSlot | 底部渲染额外元素 | ReactNode | - |
| className | 类名 | string | - |
| defaultFormat | 默认手动输入时的格式 | rgba hex hsva | hex  |
| defaultValue  | 默认值        | Object        | -    |
| eyeDropper    | 是否开启滴管拾色器  | boolean       | true |
| height | 高度 | number | 280 |
| style | 样式 | CSSProperties | - | 
| topSlot | 顶部渲染额外元素 | ReactNode | - |
| width         | 宽度         | number        | 280  |
| usePopover | 是否放入Popover渲染 | boolean | false |
| popoverProps | 放入 Popover 时，Popover 传入的 props | Popover Props | - |

