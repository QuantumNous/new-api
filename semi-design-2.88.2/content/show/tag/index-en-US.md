---
localeCode: en-US
order: 81
category: Show
title: Tag
subTitle: Tag
icon: doc-tag
brief: Tag component is used to display a collection of concise information for rapid identification and grouping.
---

## Demos

### How to import

```jsx import
import { Tag } from '@douyinfe/semi-ui';
```

### Basic usage

To use this tag, just wrap the content with the `<Tag>` tag.  
It can be turned into a closable label by adding the `closable` property.  
At this time, clicking x to close will trigger the onClose event, and blocking the default event in onClose can make it still show and not hide after clicking

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

### Size

Supports two sizes: `large` and `small` (default).

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

### Shape

Supports two Shape: `square`（default）、`circle`。

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

### Color

Tag supports 16 colors including whites from Semi's palette: `amber`, `blue`, `cyan`, `green`, `grey`, `indigo`, `light-blue`, `light-green`, `lime`, `orange`, `pink`, `purple`, `red`, `teal`, `violet`, `yellow`, `white`. You can also customize color through `style`.

```jsx live=true
import React from 'react';
import { Tag, Space } from '@douyinfe/semi-ui';

() => {
    return (
        <Space wrap>
            {
                ['amber', 'blue', 'cyan', 'green', 'grey', 'indigo',  
                    'light-blue', 'light-green', 'lime', 'orange', 'pink',  
                    'purple', 'red', 'teal', 'violet', 'yellow', 'white'
                ].map(item => (<Tag color={item} key={item}> {item} </Tag>))
            }
        </Space>
    );
};
```

### AI style - colorful labels

Set `colorful` to `true` to get colorful labels.

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

### Type

Tag supports three different types, including: `light`(default), `ghost`, `solid`.

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

### Avatar Tag

You can get a avatar tag with `avatarSrc` property. `avatarShape` can change the shape of avatar tag including `square`(default) and `circle`.

```jsx live=true
import React from 'react';
import { Tag, Space } from '@douyinfe/semi-ui';

function Demo() {
    const src =
        'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/dy.png';
    return (
        <Space vertical align='start'>
            <Tag avatarSrc={src}>Peter Behrens</Tag>
            <Tag avatarSrc={src} size="large">
                Peter Behrens
            </Tag>
            <Tag avatarSrc={src} size="large" closable={true}>
                Peter Behrens
            </Tag>
            <Tag avatarSrc={src} avatarShape="circle">
                Peter Behrens
            </Tag>
            <Tag avatarSrc={src} avatarShape="circle" size="large">
                Peter Behrens
            </Tag>
            <Tag avatarSrc={src} avatarShape="circle" size="large" closable={true}>
                Peter Behrens
            </Tag>
        </Space>
    );
}
```

### Invisible

You can use `visible` property to control whether the tag is visible.

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

### TagGroup

You can pass in configs for tags through `tagList` to create a TagGroup. The `maxTagCount` can be used to cap the number of list and will be displayed as `+N` when the limit is exceeded.  
Set the `showPopover` property to control whether the remaining content is displayed by Popover when hover to + N Tag

```jsx live=true
import React from 'react';
import { TagGroup } from '@douyinfe/semi-ui';

() => {
    const tagList = [
        { color: 'white', children: 'Abc' },
        { color: 'white', children: 'Hotsoon' },
        { color: 'white', children: 'Toutiao' },
        { color: 'white', children: 'Vigo' },
        { color: 'white', children: 'Pipixia' },
    ];
    const src =
        'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/dy.png';
    const tagList2 = [
        { color: 'white', children: 'Abcd', avatarSrc: src },
        { color: 'white', children: 'Hotsoon', avatarSrc: src },
        { color: 'white', children: 'Toutiao', avatarSrc: src },
        { color: 'white', children: 'Vigo', avatarSrc: src },
        { color: 'white', children: 'Pipixia', avatarSrc: src },
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
                <TagGroup
                    maxTagCount={3}
                    style={tagGroupStyle}
                    tagList={tagList}
                    size="large"
                />
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

If the tags in the TagGroup can be deleted, the user needs to process the `tagList` passed to the TagGroup in `onTagClose`

```jsx live=true
import React, { useState } from 'react';
import { TagGroup } from '@douyinfe/semi-ui';

() => {
    const defaultList = [
        { tagKey: '1', color: 'light-blue', children: 'Douyin', closable: true, },
        { tagKey: '3', color: 'amber', children: 'Jianying', closable: true, },
        { tagKey: '3', color: 'violet', children: 'Faceu', closable: true, },
        { tagKey: '4', color: 'white', children: 'Lark', closable: true, },
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
}
```

## API Reference

### Tag

| Properties | Instructions | type | Default | Version |
| --- | --- | --- | --- | --- |
| avatarShape | Shape of avatar tag, one of `square` and `circle` | string | `square` | 1.6.0 |
| avatarSrc | Source address of avatar tag | string | - | 1.6.0 |
| className | Class name | string |  |  |
| closable | Toggle whether the tag can be closed | boolean | false |  |
| color | Color of tags, one of `amber`、 `blue`、 `cyan`、 `green`、 `grey`、 `indigo`、 `light-blue`、 `light-green`、 `lime`、 `orange`、 `pink`、 `purple`、 `red`、 `teal`、 `violet`、 `yellow`、 `white` | string | `grey` |  |
| colorful | Colorful labels | boolean | false | 2.86.0|
| gradient | Whether it is a gradient color, it needs to take effect when colorful is true | boolean | false | 2.86.0|
| prefixIcon | prefix icon | ReactNode | | 2.44.0 |
| suffixIcon | suffix icon | ReactNode | | 2.44.0 |
| shape | Shape of tag, one of `square`、 `circle` | string | `square` | 2.20.0 |
| size | Size, one of `small`, `large` | string | `small` |  |
| style | Inline style | object |  |  |
| type | Style type, one of `ghost`, `solid`, `light` | string | `light` |  |
| visible | Toggle the visibility of the tag | boolean | true |  |
| tagKey  | The key required by React, as the unique identifier of each tag, does not allow repetition | string | number | |
| onClick | Callback function when clicking the tag | (e: MouseEvent) => void | - |  |
| onClose | Callback function when the tag is closed | (tagChildren: ReactNode, e: MouseEvent, tagKey: string \| number ) => void | - | e is available in v1.18, tagKey is available in v2.18.0 |

### TagGroup

| Properties | Instructions | type | Default | Version |
| --- | --- | --- | -- | --- |
| avatarShape | Shape of avatar tag, one of `square` and `circle` | string | `square` | 1.6.0 |
| className | Class name | string |  |  |
| maxTagCount | Cap number to display, shown as + N when exceeded | number |  |  |
| popoverProps | Popover configuration properties, you can control the popup props like `direction`, `zIndex`, `trigger`, refer to [Popover](/en-US/components/popover#API) | PopoverProps | {} |  |
| showPopover | When hover to + N, whether to display the remaining content through Popover | boolean | false |  |
| size | Size, one of `small`, `large` | string | `small` |  |
| style | Inline style | CSSProperties |  |  |
| tagList | Label Group data | (TagProps)[] |  |  |
| onTagClose | The callback function when deleting the Tag in the TagGroup | (tagChildren: ReactNode, e: MouseEvent, tagKey: string \| number ) => void | - |  2.18.0 |

## Accessibility

### ARIA

- `aria-label` is used to indicate the role of `Tag`, for deleteable or clickable `Tag` , we recommend using this attribute

### Keyboard and Focus

- If the current `Tag` is interactive, then this `Tag` can be focused. Such as:
   - When the `onClick` attribute is used, the keyboard user can activate this `Tag` with the `Enter` keys
   - When the `closable` property is `true`, keyboard users can delete this `Tag` by pressing the `Delete` key
   - When a `Tag` is focused, keyboard users can use the `Esc` key to defocus the currently focused `Tag`
   

## Content Guidelines
- Due to limited space, label text should be as short as possible
- avoid line breaks
- use sentence case

## Design Tokens

<DesignToken/>

<!-- ## Related Material

```material
53
``` -->
