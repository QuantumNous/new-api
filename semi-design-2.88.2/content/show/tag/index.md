---
localeCode: zh-CN
order: 81
category: 展示类
title: Tag 标签
icon: doc-tag
brief: 标签是图形化标记界面上的元素的组件，达到快速识别、分组的目的。
---

## 代码演示

### 如何引入

```jsx import
import { Tag, TagGroup } from '@douyinfe/semi-ui';
```

### 基本用法

基本标签用法，将内容使用 `<Tag>` 标签包裹即可。  
可以通过添加 `closable` 属性将其变为可关闭标签，此时点击 x 关闭会触发 onClose 事件，在 onClose 中阻止默认事件可以使其点击后依然显示不隐藏

```jsx live=true
import React from 'react';
import { Tag, Space } from '@douyinfe/semi-ui';

() => (
    <div>
        <Space>
            <Tag> default tag </Tag>
            <Tag closable> Closable Tag </Tag>
            <Tag closable onClose={(value, e) => e.preventDefault()}>
                Closable Tag, Prevent Default
            </Tag>
        </Space>
    </div>
);
```

### 尺寸

默认定义了两种尺寸：大、小（默认）。

```jsx live=true
import React from 'react';
import { Tag, Space } from '@douyinfe/semi-ui';

() => (
    <Space>
        <Tag size="small" color='light-blue'> small tag </Tag>
        <Tag size="large" color='cyan'> large tag </Tag>
    </Space>
);
```

### 形状

默认定义了两种形状：`square`（默认）、`circle`。

```jsx live=true
import React from 'react';
import { Tag, Space } from '@douyinfe/semi-ui';

() => (
    <Space>
        <Tag size="small" shape='circle' color='amber'> small circle tag </Tag>
        <Tag size="large" shape='circle' color='violet'> large circle tag </Tag>
    </Space>
);
```

### 配置图标

v2.44 后支持通过配置 prefixIcon、suffixIcon， 可以在 children 内容前后添加 Icon 图标。

```jsx live=true
import React from 'react';
import { Tag, Space } from '@douyinfe/semi-ui';
import { IconGithubLogo, IconSemiLogo } from '@douyinfe/semi-icons';

() => (
    <Space>
        <Tag
            color='light-blue'
            prefixIcon={<IconGithubLogo />}
            size='large'
            shape='circle'
        >
            Semi Design
        </Tag>
        <Tag
            color='cyan'
            size='large'
            shape='circle'
            suffixIcon={<IconSemiLogo />}
        >
            D2C: figma to code in one click</Tag>
    </Space>
);

```

### 颜色

标签支持默认色板的 16 种颜色和白色，包括：`amber`、 `blue`、 `cyan`、 `green`、 `grey`、 `indigo`、 `light-blue`、 `light-green`、 `lime`、 `orange`、 `pink`、 `purple`、 `red`、 `teal`、 `violet`、 `yellow`、 `white`，也可以通过 style 来自定义颜色样式。

```jsx live=true
import React from 'react';
import { Tag, Space } from '@douyinfe/semi-ui';

() => (
    <Space wrap>
        {
            ['amber', 'blue', 'cyan', 'green', 'grey', 'indigo',  
                'light-blue', 'light-green', 'lime', 'orange', 'pink',  
                'purple', 'red', 'teal', 'violet', 'yellow', 'white'
            ].map(item => (<Tag color={item} key={item}> {item} </Tag>))
        }
    </Space>
);
```

### AI 风格 - 多彩标签

设置 `colorful` 为 `true` 即可获得多彩的标签。<strong>注意: </strong> 多彩标签的字重和非多彩标签字重不同。

多彩标签可通过 `gradient` 区分是否为渐变色。



```jsx live=true direction
import React from 'react';
import { Tag } from '@douyinfe/semi-ui';
import { IconAIFilledLevel1, IconAIFilledLevel3 } from '@douyin/semi-icons';

() => (
    <div style={{ display: 'flex', flexDirection: 'column', rowGap: 30 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gridGap: '10px', width: 'fit-content' }}>
            <Tag colorful prefixIcon={<IconAIFilledLevel1 size="small"/>} type="solid" shape='circle' gradient>AI</Tag>
            <Tag colorful prefixIcon={<IconAIFilledLevel3 size="small" />} type="light" shape='circle' gradient>AI</Tag>
            <Tag colorful prefixIcon={<IconAIFilledLevel3 size="small"/>} type="ghost" shape='circle' gradient >AI</Tag>
            <Tag colorful prefixIcon={<IconAIFilledLevel1 size="small"/>} type="solid" shape='circle' >AI</Tag>
            <Tag colorful prefixIcon={<IconAIFilledLevel1 size="small" />} type="light" shape='circle'>AI</Tag>
            <Tag colorful prefixIcon={<IconAIFilledLevel1 size="small"/>} type="ghost" shape='circle'>AI</Tag>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gridGap: '10px', width: 'fit-content' }}>
            <Tag colorful prefixIcon={<IconAIFilledLevel1 size="small"/>} type="solid" gradient>AI</Tag>
            <Tag colorful prefixIcon={<IconAIFilledLevel3 size="small" />} type="light" gradient>AI</Tag>
            <Tag colorful prefixIcon={<IconAIFilledLevel3 size="small"/>} type="ghost" gradient >AI</Tag>
            <Tag colorful prefixIcon={<IconAIFilledLevel1 size="small"/>} type="solid" >AI</Tag>
            <Tag colorful prefixIcon={<IconAIFilledLevel1 size="small" />} type="light" >AI</Tag>
            <Tag colorful prefixIcon={<IconAIFilledLevel1 size="small"/>} type="ghost" >AI</Tag>
        </div>
    </div>
);
```

### 样式类型

标签支持三种样式类型，包括浅色底色 `light`，白色底色 `ghost`，深色底色 `solid`；默认值为 `light`。通过 type 配置

```jsx live=true
import React from 'react';
import { Tag, Space } from '@douyinfe/semi-ui';
import { IconGithubLogo, IconSemiLogo } from '@douyinfe/semi-icons';

() => (
    <Space wrap>
        <Tag
            color='light-blue'
            prefixIcon={<IconGithubLogo />}
            size='large'
            shape='circle'
            type='light'
        >
            Semi Design Light Tag
        </Tag>
        <Tag
            color='cyan'
            size='large'
            shape='circle'
            suffixIcon={<IconSemiLogo />}
            type='light'
        >
            D2C: figma to code in one click</Tag>
        <Tag
            color='light-blue'
            prefixIcon={<IconGithubLogo />}
            size='large'
            shape='circle'
            type='ghost'
        >
            Semi Design Ghost Tag
        </Tag>
        <Tag
            color='cyan'
            size='large'
            shape='circle'
            type='ghost'
            suffixIcon={<IconSemiLogo />}
        >
            D2C: figma to code in one click</Tag>
        <Tag
            color='light-blue'
            prefixIcon={<IconGithubLogo />}
            size='large'
            shape='circle'
            type='solid'
        >
            Semi Design Solid Tag
        </Tag>
        <Tag
            color='cyan'
            size='large'
            shape='circle'
            type='solid'
            suffixIcon={<IconSemiLogo />}
        >
            D2C: figma to code in one click</Tag>
    </Space>
);
```

### 头像标签

设置 `avatarSrc` 可以生成头像标签。结合 `avatarShape` 可以调整头像标签的形状，支持 `square` 和 `circle`。

```jsx live=true
import React from 'react';
import { Tag, Space } from '@douyinfe/semi-ui';

function Demo() {
    const src = 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/dy.png';
    return (
        <Space vertical align="start">
            <Tag avatarSrc={src}>焦锐志</Tag>
            <Tag avatarSrc={src} size="large">
                焦锐志
            </Tag>
            <Tag avatarSrc={src} size="large" closable={true}>
                焦锐志
            </Tag>
            <Tag avatarSrc={src} avatarShape="circle">
                焦锐志
            </Tag>
            <Tag avatarSrc={src} avatarShape="circle" size="large">
                焦锐志
            </Tag>
            <Tag avatarSrc={src} avatarShape="circle" size="large" closable={true}>
                焦锐志
            </Tag>
        </Space>
    );
}
```

### 不可见的

通过 visible 属性控制标签是否可见。

```jsx live=true
import React, { useState } from 'react';
import { Tag, Button, RadioGroup, Radio } from '@douyinfe/semi-ui';

() => {
    const [visible, setVisible] = useState(false);
    const toggleVisible = () => {
        setVisible(!visible);
    };
    return (
        <div>
            <RadioGroup type='button' defaultValue={0} onChange={e => toggleVisible(e.target.value)}>
                <Radio value={1}>Show</Radio>
                <Radio value={0}>Hide</Radio>
            </RadioGroup>
            <div style={{ marginTop: 10 }}>
                <Tag visible={visible} size='large' color='light-blue'>Invisible tag </Tag>
            </div>
        </div>
    );
};

```

### TagGroup 使用

在 TagGroup 内通过 `tagList` 传入 tags 配置，并且设置 `maxTagCount` 属性, 超出数量限制后，会显示为 +N  
通过设置 `showPopover` 属性，来控制 hover 到 +N Tag 时，是否通过 Popover 显示剩余内容

```jsx live=true
import React from 'react';
import { TagGroup } from '@douyinfe/semi-ui';

() => {
    const tagList = [
        { color: 'light-blue', children: '抖音' },
        { color: 'cyan', children: '火山' },
        { color: 'violet', children: '剪映' },
        { color: 'white', children: '醒图' },
    ];
    const src = 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/dy.png';
    const tagList2 = [
        { color: 'white', children: 'Douyin', avatarSrc: src },
        { color: 'white', children: 'Hotsoon', avatarSrc: src },
        { color: 'white', children: 'Capcut', avatarSrc: src },
        { color: 'white', children: 'Xingtu', avatarSrc: src },
    ];
    const divStyle = {
        backgroundColor: 'var(--semi-color-fill-0)',
        height: 35,
        width: 300,
        display: 'flex',
        alignItems: 'center',
        padding: '0 10px',
        marginBottom: 30,
    };
    const tagGroupStyle = {
        display: 'flex',
        alignItems: 'center',
        width: 350,
    };
    return (
        <>
            <div style={divStyle}>
                <TagGroup maxTagCount={3} style={tagGroupStyle} tagList={tagList} size="large" />
            </div>
            <div style={divStyle}>
                <TagGroup
                    maxTagCount={2}
                    style={tagGroupStyle}
                    tagList={tagList2}
                    size="large"
                    avatarShape="circle"
                    showPopover
                />
            </div>
        </>
    );
};
```

如果 TagGroup 中的标签可删除，用户需要在 `onTagClose` 中处理传递给 TagGroup 的 `tagList`。

```jsx live=true
import React, { useState } from 'react';
import { TagGroup } from '@douyinfe/semi-ui';

() => {
    const defaultList = [
        { tagKey: '1', color: 'light-blue', children: '抖音', closable: true, },
        { tagKey: '3', color: 'cyan', children: '剪映', closable: true, },
        { tagKey: '2', color: 'violet', children: '醒图', closable: true, },
        { tagKey: '4', color: 'teal', children: '轻颜相机', closable: true, },
        { tagKey: '5', color: 'white', children: '飞书', closable: true, },
    ];

    const [tagList, setTagList] = useState(defaultList);

    const tagListClick = (value, e, tagKey) => {
        const newTagList = [...tagList];
        const closeTagIndex = newTagList.findIndex(t => t.tagKey === tagKey);
        newTagList.splice(closeTagIndex, 1);
        setTagList(newTagList);
    };

    return (
        <div style={ {
            backgroundColor: 'var(--semi-color-fill-0)',
            height: 35,
            width: 300,
            display: 'flex',
            alignItems: 'center',
            padding: '0 10px',
            marginBottom: 30,
        }}>
            <TagGroup
                maxTagCount={3}
                showPopover
                style={ {
                    display: 'flex',
                    alignItems: 'center',
                    width: 350,
                }}
                tagList={tagList}
                size='large'
                onTagClose={tagListClick}
            />
        </div>
    );
};
```

## API参考

### Tag

| 属性  | 说明        | 类型   | 默认值 | 版本 |
|-------|-------------|-----------------|--------|--------|
| avatarShape | 头像 Tag 形状，可选 `square` 和 `circle` | string |  `square`   | 1.6.0|
| avatarSrc | 头像的资源地址 | string |  -   | 1.6.0 |
| className | 类名 | string |     | |
| closable | 标签是否可以关闭 | boolean  |  false   | |
| color  | 标签的颜色，可选 `amber`、 `blue`、 `cyan`、 `green`、 `grey`、 `indigo`、 `light-blue`、 `light-green`、 `lime`、 `orange`、 `pink`、 `purple`、 `red`、 `teal`、 `violet`、 `yellow`、 `white` | string  | `grey`| |
| colorful | 多彩标签 | boolean | false | 2.86.0|
| gradient | 是否为渐变色，需在 colorful 为 true 时生效 | boolean | false | 2.86.0|
| prefixIcon | 前缀图标 | ReactNode | | 2.44.0 |
| suffixIcon | 后缀图标 | ReactNod e | | 2.44.0 |
| shape | 标签的形状，可选 `square`、 `circle` | string | `square` | 2.20.0 |
| size | 标签的尺寸，可选 `small`、 `large` | string | `small` | |
| style | 样式 | CSSProperties |     | |
| type  | 标签的样式类型，可选 `ghost`、 `solid`、 `light` | string  | `light`     | |
| visible | 标签是否可见 | boolean | true    | |
| tagKey  | React 需要的 key，作为每个标签的唯一标识，不允许重复 | string | number | |
| onClick | 单击标签时的回调函数 | (e: MouseEvent) => void | 无   | |
| onClose | 关闭标签时的回调函数 | (tagChildren: ReactNode, e: MouseEvent, tagKey: string \| number ) => void | 无    | e 于 v1.18 版本提供, tagKey 于 v2.18.0 提供 |

### TagGroup

| 属性  | 说明        | 类型   | 默认值 | 版本 |
|-------|-------------|--------------|----|--------|
| avatarShape | 头像 Tag 形状，可选 `square` 和 `circle` | string |  `square` | 1.6.0 |
| className | 类名 | string |    | |
| maxTagCount | 最大数量限制，超出后显示为 +N | number |    | |
| popoverProps | popover 的配置属性，可以控制 direction, zIndex, trigger 等，具体参考 [Popover](/zh-CN/show/popover#API_参考) | PopoverProps | {} | |
| showPopover | hover 到 +N 时，是否通过 Popover 显示剩余内容 | boolean | false | |
| size | 标签的尺寸，可选 `small`、 `large` | string | `small` | |
| style | 样式 | CSSProperties |    | |
| tagList | 标签组  | (TagProps)[] |     | |
| onTagClose | 删除TagGroup中的Tag时候的回调函数 | (tagChildren: ReactNode, e: MouseEvent, tagKey: string \| number ) => void | - |  2.18.0 |

## Accessibility

### ARIA

-   `aria-label` 用于表示 `Tag` 的作用，对于可删除或者可点击的 `Tag` ，我们推荐使用此属性

### 键盘和焦点

- 如果当前 `Tag` 可交互，那么这个 `Tag` 可被聚焦到。如：
  - 使用了 `onClick` 属性时，键盘用户可以通过 `Enter` 键激活此 `Tag`
  - `closable` 属性为 `true` 时，键盘用户可以通过 `Delete` 键删除此 `Tag`
  - `Tag` 被聚焦时，键盘用户可以通过 `Esc` 键使当前聚焦 `Tag` 失焦

## 文案规范
- 由于空间有限，标签文本应尽可能简短
- 避免换行
- 使用句子大小写；


## 设计变量

<DesignToken/>

<!-- ## 相关物料
```material
53
``` -->
