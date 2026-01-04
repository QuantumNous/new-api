---
localeCode: zh-CN
order: 22
category: 基础 
title: FloatButton 悬浮按钮
icon: doc-floatButton
brief: 悬浮按钮是可以悬浮在页面上的可操作按钮
showNew: true
---

## 代码演示

### 如何引入

FloatButton 自 2.85.0 支持。

```jsx import
import { FloatButton } from '@douyinfe/semi-ui';
```

### 基本用法

```jsx live=true
import React from 'react';
import { FloatButton } from '@douyinfe/semi-ui';
import { IconAIEditLevel1 } from '@douyinfe/semi-icons';

() => {
    const onClick = () => {
        console.log('float button clicked');
    };

    return (<>
        <span>基本使用：页面右下第三列 1 </span>
        <FloatButton icon={<IconAIEditLevel1 />} style={{ bottom: '270px' }} onClick={onClick}/>
    </>
    );
};
```

### 尺寸

支持三种尺寸：默认，小，大。

```jsx live=true
import React from 'react';
import { FloatButton } from '@douyinfe/semi-ui';
import { IconAIEditLevel1 } from '@douyinfe/semi-icons';

() => {
    const onClick = () => {
        console.log('float button clicked');
    };
    return (<>
        <span>大尺寸：页面右下第三列 2</span>
        <FloatButton size="large" icon={<IconAIEditLevel1 />} style={{ bottom: '200px' }} onClick={onClick}/>
    </>);
};
```

### 形状

默认定义了两种形状：square（默认）、circle。

```jsx live=true
import React from 'react';
import { FloatButton } from '@douyinfe/semi-ui';
import { IconAIEditLevel1 } from '@douyinfe/semi-icons';

() => {
    const onClick = () => {
        console.log('float button clicked');
    };
    return (<>
        <span>方形：页面右下第三列 3</span>
        <FloatButton shape="square" icon={<IconAIEditLevel1 />} style={{ bottom: '150px' }} onClick={onClick}/>
    </>);
};
```

### 点击跳转

可通过 `href` 设置跳转地址, `target` 指定目标网页应该在哪个窗口或框架中打开。

```jsx live=true
import React from 'react';
import { FloatButton } from '@douyinfe/semi-ui';
import { IconAIEditLevel1 } from '@douyinfe/semi-icons';

() => {
    const onClick = () => {
        console.log('float button clicked');
    };
    return (<>
        <span>点击跳转：页面右下第三列 4</span>
        <FloatButton
            icon={<IconAIEditLevel1 />} 
            style={{ bottom: '100px' }} 
            href={'https://semi.design'}
            target={'_blank'}
        />
    </>);
};
```

### AI 风格 - 多彩悬浮按钮

可设置 `colorful` 为 true，展示多彩的悬浮按钮。

```jsx live=true
import React from 'react';
import { FloatButton } from '@douyinfe/semi-ui';
import { IconAIEditLevel1 } from '@douyinfe/semi-icons';

() => {
    const onClick = () => {
        console.log('float button clicked');
    };
    return (<>
        <span>多彩按钮：页面右下第一列</span>
        <FloatButton
            colorful
            icon={<IconAIEditLevel1 />} 
            style={{ bottom: '110px', insetInlineEnd: '150px' }} 
            href={'https://semi.design'}
            target={'_blank'}
        />
    </>);
};
```

### 带徽章的

```jsx live=true
import React from 'react';
import { FloatButton } from '@douyinfe/semi-ui';
import { IconAIEditLevel1 } from '@douyinfe/semi-icons';

() => {
    return (<>
        <span>带徽章：页面右下第二列</span>
        <FloatButton
            disabled
            icon={<IconAIEditLevel1 />}  
            badge={{ dot: true, type: 'danger' }} 
            style={{ bottom: 270, insetInlineEnd: '100px' }} 
        />
        <FloatButton
            badge={{ count: 1000, overflowCount: 999 }} 
            size={"large"}
            icon={<IconAIEditLevel1 />}  
            style={{ bottom: 210, insetInlineEnd: 100 }} 
        />
        <FloatButton 
            icon={<IconAIEditLevel1 />}  
            badge={{ dot: true }} 
            colorful 
            style={{ bottom: 170, insetInlineEnd: 100 }} 
        />
        <FloatButton 
            icon={<IconAIEditLevel1 />}  
            colorful
            size="large"
            badge={{ count: 'VIP', type: "danger" }}
            style={{ bottom: 110, insetInlineEnd: 100 }} 
        />
    </>);
};
```

### 悬浮按钮组

可通过  `items` 传入子项

```jsx live=true
import React from 'react';
import { FloatButtonGroup } from '@douyinfe/semi-ui';
import { IconAIEditLevel1, IconAIStrokedLevel3, IconSearchStroked, IconHelpCircleStroked } from '@douyinfe/semi-icons';

() => {
    return (<>
        <span>The last row at the bottom right of the page</span>
        <FloatButtonGroup 
            style={{
                insetInlineEnd: 24,
                bottom: 50,
            }}
            items={[
                {
                    icon: <IconAIStrokedLevel3 />,
                    content: "编辑"
                },
                {
                    icon: <IconSearchStroked />,
                    content: "搜索"
                },
                {
                    icon: <IconHelpCircleStroked />,
                    content: "帮助"
                }
            ]}
        />
    </>);
};
```

## API参考

### FloatButton

| 属性 | 说明 | 类型 | 默认值 |
|-----|-----|------|-------|
| badge | 徽章参数 | [BadgeProps](/zh-CN/show/badge#API%E5%8F%82%E8%80%83) | - |
| colorful | 多彩悬浮按钮 | boolean | false |
| className | 样式类名 |  string | - |
| disabled | 禁用状态 | boolean | false|
| href | 点击跳转的链接, 同 [href](https://developer.mozilla.org/zh-CN/docs/Web/API/Location/href) | string | - |
| icon | 显示图标 | ReactNode | - |
| onClick | 点击回调函数 | string | - |
| shape | 样式，支持 round、 square | string | round |
| size | 尺寸，支持 default、small、large | string | default |
| style | 样式 | CSSProperties  | - |
| target | 指定在何处显示链接的 URL, 同 [target](https://developer.mozilla.org/zh-CN/docs/Web/HTML/Reference/Elements/a#target) | string | - |

### FloatButtonGroupItem

在 FloatButtonProps 基础上增加以下参数

| 属性 | 说明 | 类型 | 默认值 |
|-----|-----|------|-------|
| content | 文本内容 | String | - |

### FloatButtonGroup

| 属性 | 说明 | 类型 | 默认值 |
|-----|-----|------|-------|
| className | 样式类名 |  string | - |
| disabled | 禁用状态 | boolean | false|
| items | 单个子项的信息 | FloatButtonGroupItem | - |
| style | 样式 | CSSProperties  | - |
