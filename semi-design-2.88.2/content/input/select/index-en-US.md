---
localeCode: en-US
order: 45
category: Input
title: Select
subTitle: Select
icon: doc-select
width: 60%
brief: The user can select one or more options from a set of options through the Select selector and present the final selection result
---

## Demos

### How to import

```jsx import
import { Select } from '@douyinfe/semi-ui';
const Option = Select.Option;
```

### Basic Usage

Each Option tag must declare the `value` attribute, and the Option `children` content will be rendered to the drop-down list

```jsx live=true
import React from 'react';
import { Select } from '@douyinfe/semi-ui';

() => (
    <>
        <Select defaultValue="douyin" style={{ width: 120 }}>
            <Select.Option value="douyin">Douyin</Select.Option>
            <Select.Option value="capcut">Capcut</Select.Option>
        </Select>
        <br />
        <br />
        <Select placeholder="Select line of business" style={{ width: 120 }}>
            <Select.Option value="douyin">Douyin</Select.Option>
            <Select.Option value="capcut">Capcut</Select.Option>
        </Select>
    </>
);
```

### Pass Option as an array

You can pass an array of objects directly through `optionList`. Each object must contain the value / label attribute.

```jsx live=true
import React from 'react';
import { Select } from '@douyinfe/semi-ui';

() => {
    const list = [
        { value: 'douyin', label: 'Douyin' },
        { value: 'capcut', label: 'Capcut' },
        { value: 'coze', label: 'Coze' },
        { value: 'toutiao', label: 'TooBuzz' },
    ];
    return <Select placeholder="Business line" style={{ width: 180 }} optionList={list}></Select>;
};
```

### Multi-choice
Since v2.28, the selector will have its own maxHeight 270, and the content can be viewed by scrolling vertically after it exceeds.

Configuration `multiple` properties that can support multi-selection

Configuration `maxTagCount`. You can limit the number of options displayed, and the excess will be displayed in the form of + N

Configure `ellipsisTrigger` (>= v2.28.0) to do adaptive processing on the overflow part of the tag. When the width is insufficient, the last tag content will be truncated. After enabling this function, there will be a certain performance loss, and it is not recommended to use it in large form scenarios

Configure `expandRestTagsOnClick` (>= v2.28.0) to display all remaining tags by clicking when `maxTagCount` is set

Use `showRestTagsPopover` (>= v2.22.0) to set whether hover +N displays Popover after exceeding `maxTagCount`, the default is `false`. Also, popovers can be configured in the `restTagsPopoverProps` property

Configuration `max` Properties can limit the maximum number of options and cannot be selected beyond the maximum limit, while triggering`On Exceed`callback

```jsx live=true
import React from 'react';
import { Select } from '@douyinfe/semi-ui';

() => (
    <>
        <Select multiple style={{ width: '320px' }} defaultValue={['douyin', 'coze']}>
            <Select.Option value="douyin">Douyin</Select.Option>
            <Select.Option value="coze">Coze</Select.Option>
            <Select.Option value="capcut">Capcut</Select.Option>
            <Select.Option value="xigua">BuzzVideo</Select.Option>
        </Select>
        <br />
        <br />
        <Select
            multiple
            maxTagCount={2}
            showRestTagsPopover={true}
            restTagsPopoverProps={{ position: 'top' }}
            style={{ width: '320px' }}
            defaultValue={['douyin', 'coze', 'capcut']}
        >
            <Select.Option value="douyin">Semi</Select.Option>
            <Select.Option value="coze">Coze</Select.Option>
            <Select.Option value="capcut">Capcut</Select.Option>
            <Select.Option value="xigua">BuzzVideo</Select.Option>
        </Select>

        <br />
        <br />
        <Select
            multiple
            style={{ width: '320px' }}
            defaultValue={['douyin']}
            max={2}
            onExceed={() => Toast.warning('Only two options are allowed')}
        >
            <Select.Option value="douyin">Semi</Select.Option>
            <Select.Option value="coze">Coze</Select.Option>
            <Select.Option value="capcut">Capcut</Select.Option>
            <Select.Option value="xigua">BuzzVideo</Select.Option>
        </Select>
        <br />
        <br />
        <Select
            multiple
            maxTagCount={2}
            showRestTagsPopover={true}
            restTagsPopoverProps={{ position: 'top' }}
            style={{ width: '220px' }}
            defaultValue={['xigua', 'coze', 'capcut', 'douyin']}
            ellipsisTrigger
            expandRestTagsOnClick
        >
            <Select.Option value="douyin">Semi</Select.Option>
            <Select.Option value="coze">Coze</Select.Option>
            <Select.Option value="capcut">Capcut</Select.Option>
            <Select.Option value="xigua">BuzzVideo</Select.Option>
        </Select>
    </>
);
```

### With Group

Grouping Option with `OptGroup`(Only supports the declaration of children through jsx, and does not support pass in through optionList)

```jsx live=true
import React from 'react';
import { Select } from '@douyinfe/semi-ui';

() => (
    <Select placeholder="" style={{ width: 180 }} filter>
        <Select.OptGroup label="Asia">
            <Select.Option value="a-1">China</Select.Option>
            <Select.Option value="a-2">Korea</Select.Option>
        </Select.OptGroup>
        <Select.OptGroup label="Europe">
            <Select.Option value="b-1">Germany</Select.Option>
            <Select.Option value="b-2">France</Select.Option>
        </Select.OptGroup>
        <Select.OptGroup label="South America">
            <Select.Option value="c-1">Peru</Select.Option>
        </Select.OptGroup>
    </Select>
);
```

```jsx live=true
import React from 'react';
import { Select } from '@douyinfe/semi-ui';

() => {
    const data = [
        {
            label: 'Asia',
            children: [
                { value: 'a-1', label: 'China' },
                { value: 'a-2', label: 'Korea' },
            ],
        },
        {
            label: 'Europe',
            children: [
                { value: 'b-1', label: 'Germany' },
                { value: 'b-2', label: 'France' },
            ],
        },
        {
            label: 'South America',
            children: [{ value: 'c-1', label: 'Peru' }],
        },
    ];
    return (
        <Select placeholder="" style={{ width: 180 }} filter>
            {data.map((group, index) => (
                <Select.OptGroup label={group.label} key={`${index}-${group.label}`}>
                    {group.children.map((option, index2) => (
                        <Select.Option value={option.value} key={`${index2}-${group.label}`}>
                            {option.label}
                        </Select.Option>
                    ))}
                </Select.OptGroup>
            ))}
        </Select>
    );
};
```

### Different sizes

Size: small / default / large

```jsx live=true
import React from 'react';
import { Select } from '@douyinfe/semi-ui';

() => (
    <>
        <Select placeholder="Business line" style={{ width: '200px' }} size="small">
            <Select.Option value="douyin">Douyin</Select.Option>
        </Select>
        <br />
        <br />
        <Select placeholder="Business line" style={{ width: '200px' }}>
            <Select.Option value="douyin">Douyin</Select.Option>
        </Select>
        <br />
        <br />
        <Select placeholder="Business line" style={{ width: '200px' }} size="large">
            <Select.Option value="douyin">Douyin</Select.Option>
        </Select>
    </>
);
```

### Different validate status

validateStatus: default / warning / error

```jsx live=true
import React from 'react';
import { Select } from '@douyinfe/semi-ui';

() => (
    <>
        <Select style={{ width: '180px' }} defaultValue='Capcut'>
            <Select.Option value="Capcut">Capcut</Select.Option>
        </Select>
        <br />
        <br />
        <Select style={{ width: '180px' }} validateStatus="warning" defaultValue='Capcut'>
            <Select.Option value="Capcut">Capcut</Select.Option>
        </Select>
        <br />
        <br />
        <Select style={{ width: '180px' }} validateStatus="error" defaultValue='Capcut'>
            <Select.Option value="Capcut">Capcut</Select.Option>
        </Select>
    </>
);
```

### Configure Prefix, Suffix, Clear Button

-   You can pass the selection box prefix through `prefix`, the selection box suffix through `suffix`, for text or React Node  
    The left and right padding is automatically brought when the content passed in by prefix and reactix is text or Icon. If it is a custom ReactNode, the left and right padding is 0.
-   Whether to show the clear button is displayed by `showClear`
-   Whether to show the right drop-down arrow is displayed by `showArrow`

```jsx live=true
import React from 'react';
import { Select } from '@douyinfe/semi-ui';
import { IconVigoLogo, IconGift } from '@douyinfe/semi-icons';

() => (
    <>
        <Select style={{ width: '320px' }} defaultValue={'douyin'} prefix={<IconVigoLogo />} showClear={true}>
            <Select.Option value="douyin">Douyin</Select.Option>
            <Select.Option value="capcut">Capcut</Select.Option>
            <Select.Option value="coze">Coze</Select.Option>
            <Select.Option value="xigua">BuzzVideo</Select.Option>
        </Select>
        <br />
        <br />
        <Select
            style={{ width: '320px' }}
            defaultValue={'capcut'}
            prefix={<IconVigoLogo />}
            suffix={<IconGift />}
            showArrow={false}
        >
            <Select.Option value="douyin">Douyin</Select.Option>
            <Select.Option value="capcut">Capcut</Select.Option>
            <Select.Option value="coze">Coze</Select.Option>
            <Select.Option value="xigua">BuzzVideo</Select.Option>
        </Select>
    </>
);
```

### Additional items

We have reserved two slots at the bottom of the pop-up layer, which you can use when you need to add a custom node to the pop-up layer.  
Use`innerTopSlot` or `outerTopSlot` to pass the custom node, which will be rendered at the top of the pop-up layer. Use`innerBottomSlot` or `outerBottomSlot` instead at the bottom.

-   `innerTopSlot` and `innerBottomSlot` will be rendered inside the Option List

-   `outerTopSlot` and `outerBottomSlot` will be rendered to level with the option List

```jsx live=true
import React from 'react';
import { Select } from '@douyinfe/semi-ui';
import { IconClock } from '@douyinfe/semi-icons';

() => {
    let selectStyle = { width: 180, margin: 20 };
    let innerSlotStyle = {
        backgroundColor: '#FFF',
        height: '40px',
        color: '#0077FA',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        cursor: 'pointer',
    };
    let innerSlotNode = <div style={innerSlotStyle}>No suitable product?</div>;
    let outSlotStyle = {
        backgroundColor: 'whitesmoke',
        height: '29px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        cursor: 'pointer',
    };
    let outSlotNode = (
        <div style={outSlotStyle}>
            <IconClock></IconClock>
            <span style={{ color: 'rgba(28, 31, 35, 0.55)' }}>More recently viewed pages</span>
        </div>
    );

    return (
        <div>
            <p>outerBottomSlot:</p>
            <Select
                style={selectStyle}
                dropdownStyle={{ width: 180 }}
                maxHeight={213}
                defaultOpen
                autoAdjustOverflow={false}
                position="bottom"
                outerBottomSlot={outSlotNode}
            >
                <Select.Option value="douyin">Douyin</Select.Option>
                <Select.Option value="capcut">Capcut</Select.Option>
                <Select.Option value="coze">Coze</Select.Option>
                <Select.Option value="xigua">BuzzVideo</Select.Option>
            </Select>
            <p>innerBottomSlot:</p>
            <Select style={selectStyle} dropdownStyle={{ width: 180 }} innerBottomSlot={innerSlotNode} >
                <Select.Option value="douyin">Douyin</Select.Option>
                <Select.Option value="capcut">Capcut</Select.Option>
                <Select.Option value="coze">Coze</Select.Option>
                <Select.Option value="xigua">BuzzVideo</Select.Option>
            </Select>
        </div>
    );
};
```

Using outerTopSlot to insert content

```jsx live=true
import React from 'react';
import { Select } from '@douyinfe/semi-ui';

() => {
    const list = {
        component: [
            { value: 'select', label: 'Select' },
            { value: 'tabs', label: 'Tabs' },
            { value: 'avatar', label: 'Avatar' },
            { value: 'button', label: 'Button' },
        ],
        design: [
            { value: 'color', label: 'Color' },
            { value: 'dark', label: 'Dark Mode' },
            { value: 'icon', label: 'Icon' },
            { value: 'font', label: 'Topography' },
        ],
        feedback: [
            { value: 'faq', label: 'FAQ' },
            { value: 'join', label: 'Join Chat Group' },
            { value: 'hornbill', label: 'Hornbill' },
        ],
    };

    const [key, setKey] = useState('component');
    const [value, setValue] = useState({ value: 'faq', label: 'FAQ' });
    const handleTabClick = itemKey => {
        setKey(itemKey);
    };

    const tabStyle = {
        cursor: 'pointer',
        marginRight: 12,
        paddingBottom: 4,
    };
    const tabActiveStyle = {
        ...tabStyle,
        borderBottom: '1px solid var(--semi-color-primary)',
        fontWeight: 700,
    };
    const tabWrapper = {
        display: 'flex',
        paddingTop: 8,
        paddingLeft: 32,
        paddingRight: 32,
        borderBottom: '0.5px solid var(--semi-color-border)',
    };
    const tabOptions = [
        { itemKey: 'component', label: 'Compoonent' },
        { itemKey: 'design', label: 'Design' },
        { itemKey: 'feedback', label: 'Feedback' },
    ];

    const outerTopSlotNode = (
        <div style={tabWrapper}>
            {tabOptions.map((item, index) => {
                style = item.itemKey === key ? tabActiveStyle : tabStyle;
                return (
                    <div style={style} key={item.itemKey} onClick={() => handleTabClick(item.itemKey)}>
                        {item.label}
                    </div>
                );
            })}
        </div>
    );
    return (
        <Select
            defaultOpen
            autoAdjustOverflow={false}
            value={value}
            onChangeWithObject
            onChange={obj => setValue(obj)}
            style={{ width: 200 }}
            outerTopSlot={outerTopSlotNode}
            optionList={list[key]}
        />
    );
};
```

### Controlled component

When `value` is passed, Select is a controlled component, and the value selected is entirely determined by `value`.

```jsx live=true
import React from 'react';
import { Select } from '@douyinfe/semi-ui';

() => {
    let [value, setValue] = useState('xigua');
    return (
        <>
            <Select value={value} style={{ width: '300px' }} onChange={setValue} placeholder="Controlled Component">
                <Select.Option value="douyin">Douyin</Select.Option>
                <Select.Option value="capcut">Capcut</Select.Option>
                <Select.Option value="xigua">BuzzVideo</Select.Option>
            </Select>
        </>
    );
};
```

### Linkage Select

If it is a complex linkage with a hierarchical relationship, it is recommended to use Cascader components directly

```jsx live=true
import React from 'react';
import { Select } from '@douyinfe/semi-ui';

class Link extends React.Component {
    get continents() {
        return ['Asia', 'Europe'];
    }
    get maps() {
        return {
            Asia: ['China', 'Korea'],
            Europe: ['United Kingdom', 'France', 'Germany'],
        };
    }
    constructor() {
        super();
        this.state = {
            continents: this.continents,
            maps: this.maps,
            countrys: this.maps[this.continents[0]],
            country: this.maps[this.continents[0]][0],
        };
        this.continentsChange = this.continentsChange.bind(this);
        this.countryChange = this.countryChange.bind(this);
    }

    continentsChange(newContinents) {
        const { maps } = this.state;
        this.setState({ countrys: maps[newContinents], country: maps[newContinents][0] });
    }

    countryChange(country) {
        this.setState({ country });
    }

    render() {
        const { continents, countrys, country } = this.state;
        return (
            <React.Fragment>
                <Select
                    style={{ width: '150px', margin: '10px' }}
                    onChange={this.continentsChange}
                    defaultValue={continents[0]}
                >
                    {continents.map(pro => (
                        <Select.Option value={pro} key={pro}>
                            {pro}
                        </Select.Option>
                    ))}
                </Select>
                <Select style={{ width: '150px', margin: '10px' }} value={country} onChange={this.countryChange}>
                    {countrys.map(c => (
                        <Select.Option value={c} key={c}>
                            {c}
                        </Select.Option>
                    ))}
                </Select>
            </React.Fragment>
        );
    }
}
```

### Search

You can turn on the search capability by setting `filter` to true.  
The default search strategy will include comparison of the input value with the label value of option

By default, the search keywords will be cleared automatically after multiple selection is selected. If you want to keep it, you can turn off the default behavior by setting `autoClearSearchValue` to false (provided after v2.3)

```jsx live=true
import React from 'react';
import { Select } from '@douyinfe/semi-ui';

() => (
    <>
        <Select filter style={{ width: 180 }} placeholder="Searchable Select">
            <Select.Option value="app1">Douyin</Select.Option>
            <Select.Option value="app2">Coze</Select.Option>
            <Select.Option value="app3">Capcut</Select.Option>
            <Select.Option value="app4">BuzzVideo</Select.Option>
        </Select>
        <br />
        <br />
        <Select
            filter
            multiple
            style={{ width: 350 }}
            placeholder="Searchable Multiple Select"
            autoClearSearchValue={false}
        >
            <Select.Option value="semi-0">Semi-0</Select.Option>
            <Select.Option value="semi-1">Semi-1</Select.Option>
            <Select.Option value="semi-2">Semi-2</Select.Option>
            <Select.Option value="semi-3">Semi-3</Select.Option>
            <Select.Option value="semi-4">Semi-4</Select.Option>
        </Select>
    </>
);
```


### Search position
The default search input is displayed on the Select Trigger. You can specify different positions through `searchPosition`, and you can choose `dropdown` or `trigger`. Available after `v2.61.0`  
If you want to customize the placeholder of the Input search box in the dropdown, you can control it through `searchPlaceholder`  
If the `searchPosition` is `trigger`, when `showClear=true`, clicking the clear button of the input will clear the selected items and the search text in the input at the same time   
If the `searchPosition` is `dropdown`, when `showClear=true`, clicking the clear button of the trigger will clear the selected items,  clicking the clear button in the dropdown input will clear search text  


```jsx live=true
import React from 'react';
import { Select } from '@douyinfe/semi-ui';

() => (
    <>
        <Select
            filter
            searchPosition='dropdown'
            style={{ width: 200 }}
            defaultValue={'ulikecam'}
        >
            <Select.Option value="douyin">Douyin</Select.Option>
            <Select.Option value="ulikecam">UlikeCam</Select.Option>
            <Select.Option value="jianying">Capcut</Select.Option>
            <Select.Option value="xigua">XiguaVideo</Select.Option>
        </Select>
        <br />
        <br />
        <Select
            filter
            searchPosition='dropdown'
            multiple
            style={{ width: 300 }}
            defaultValue={['semi-1']}
            autoClearSearchValue={false}
        >
            <Select.Option value="semi-0">Semi-0</Select.Option>
            <Select.Option value="semi-1">Semi-1</Select.Option>
            <Select.Option value="semi-2">Semi-2</Select.Option>
            <Select.Option value="semi-3">Semi-3</Select.Option>
            <Select.Option value="semi-4">Semi-4</Select.Option>
        </Select>
    </>
);

```

### Remote search

A multi-select example with remote search, request debounce, loading status.

-   Use `filter` turn on the search capability.
-   Use `remote` to disabled local filter
-   Dynamic Update `optionList` after `onSearch` callback
-   Update `loading` when fetching data / finish
-   Use controlled value attribute

```jsx live=true
import React from 'react';
import { debounce } from 'lodash-es';
import { Select } from '@douyinfe/semi-ui';

() => {
    const [loading, setLoading] = useState(false);
    const optionList = [
        { value: 'dsm', label: 'Semi DSM', type: 1 },
        { value: 'd2c', label: 'Semi DesignToCode', type: 2 },
        { value: 'c2d', label: 'Semi CodeToDesign', type: 3 },
        { value: 'plugin', label: 'Semi Plugin', type: 4 },
    ];
    const [list, setList] = useState(optionList);
    const [value, setValue] = useState('');

    const handleMultipleChange = newValue => {
        setValue(newValue);
    };

    const handleSearch = inputValue => {
        setLoading(true);
        let result = [];
        if (inputValue) {
            let length = Math.ceil(Math.random() * 100);
            result = Array.from({ length }, (v, i) => {
                return { value: inputValue + i, label: `Relative: ${inputValue}${i}`, type: i + 1 };
            });
            setTimeout(() => {
                setLoading(false);
                setList(result);
            }, 1000);
        } else {
            setLoading(false);
        }
    };

    return (
        <Select
            style={{ width: 300 }}
            filter
            remote
            onChangeWithObject
            multiple
            value={value}
            onSearch={debounce(handleSearch, 1000)}
            optionList={list}
            loading={loading}
            onChange={handleMultipleChange}
            emptyContent={null}
        ></Select>
    );
};
```

### Custom search strategy

By default, the user's search input will be compared with the option's label value as a string include.  
You can set `filter` as a custom function to customize your filter strategy.

```jsx live=true
import React from 'react';
import { Select } from '@douyinfe/semi-ui';

() => {
    function search(sugInput, option) {
        // Search for both label and value
        let label = option.label.toUpperCase();
        let value = option.value.toUpperCase();
        let sug = sugInput.toUpperCase();
        return label.includes(sug) || value.includes(sug);
    }
    return (
        <Select filter={search} style={{ width: '180px' }} placeholder="try hello or douyin">
            <Select.Option value="hello">Douyin</Select.Option>
            <Select.Option value="bytedance">UlikeCam</Select.Option>
            <Select.Option value="semi">BuzzVideo</Select.Option>
        </Select>
    );
};
```

### Custom selection rendering

By default, the content of `option.label` or `option.children` will be backfilled into the selection box when the option is selected.  
But you can customize the rendering of the selection box through the `renderSelectedItem` function

-   Select: `renderSelectedItem(optionNode: object) => content: ReactNode`
-   Multiple Select: `renderSelectedItem(optionNode: object, { index: number, onClose: function }) => { isRenderInTag: boolean, content: ReactNode }`
    -   When `isRenderInTag` is true, content will automatically wrapped in `Tag` rendering (with background color and close button)
    -   When `isRenderInTag` is false, it renders the returned content directly

```jsx live=true
import React from 'react';
import { Select, Avatar, Tag } from '@douyinfe/semi-ui';

() => {
    const list = [
        {
            name: 'Keman Xia',
            email: 'xiakeman@example.com',
            avatar:
                'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/bag.jpeg',
        },
        {
            name: 'Yue Shen',
            email: 'shenyue@example.com',
            avatar:
                'https://sf6-cdn-tos.douyinstatic.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/bf8647bffab13c38772c9ff94bf91a9d.jpg',
        },
        {
            name: 'Chenyi Qu',
            email: 'quchenyi@example.com',
            avatar:
                'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/Viamaker.png',
        },
        {
            name: 'Jiamao Wen',
            email: 'wenjiamao@example.com',
            avatar:
                'https://sf6-cdn-tos.douyinstatic.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/6fbafc2d-e3e6-4cff-a1e2-17709c680624.png',
        },
    ];

    const renderSelectedItem = optionNode => (
        <div key={optionNode.email} style={{ display: 'flex', alignItems: 'center' }}>
            <Avatar src={optionNode.avatar} size="small">
                {optionNode.abbr}
            </Avatar>
            <span style={{ marginLeft: 8 }}>{optionNode.email}</span>
        </div>
    );

    // avatarSrc & avatarShape are supported after 1.6.0-beta
    const renderMultipleWithCustomTag = (optionNode, { onClose }) => {
        const content = (
            <Tag
                avatarSrc={optionNode.avatar}
                avatarShape="circle"
                closable={true}
                onClose={onClose}
                size="large"
                key={optionNode.name}
            >
                {optionNode.name}
            </Tag>
        );
        return {
            isRenderInTag: false,
            content,
        };
    };

    const renderMultipleWithCustomTag2 = (optionNode, { onClose }) => {
        const content = (
            <Tag
                avatarSrc={optionNode.avatar}
                avatarShape="square"
                closable={true}
                onClose={onClose}
                size="large"
                key={optionNode.name}
            >
                {optionNode.name}
            </Tag>
        );
        return {
            isRenderInTag: false,
            content,
        };
    };

    const renderCustomOption = (item, index) => {
        const optionStyle = {
            display: 'flex',
            paddingLeft: 24,
            paddingTop: 10,
            paddingBottom: 10,
        };
        return (
            <Select.Option value={item.name} style={optionStyle} showTick={true} {...item} key={item.email}>
                <Avatar size="small" src={item.avatar} />
                <div style={{ marginLeft: 8 }}>
                    <div style={{ fontSize: 14 }}>{item.name}</div>
                    <div
                        style={{ color: 'var(--color-text-2)', fontSize: 12, lineHeight: '16px', fontWeight: 'normal' }}
                    >
                        {item.email}
                    </div>
                </div>
            </Select.Option>
        );
    };

    return (
        <>
            <Select
                placeholder="Please select..."
                style={{ width: 280, height: 40 }}
                onChange={v => console.log(v)}
                defaultValue={'Keman Xia'}
                renderSelectedItem={renderSelectedItem}
            >
                {list.map((item, index) => renderCustomOption(item, index))}
            </Select>
            <Select
                placeholder="Please select..."
                maxTagCount={2}
                style={{ width: 280, marginTop: 20 }}
                onChange={v => console.log(v)}
                defaultValue={['Keman Xia', 'Yue Shen']}
                multiple
                renderSelectedItem={renderMultipleWithCustomTag}
            >
                {list.map((item, index) => renderCustomOption(item, index))}
            </Select>
            <Select
                placeholder="Please select..."
                maxTagCount={2}
                style={{ width: 280, marginTop: 20 }}
                onChange={v => console.log(v)}
                defaultValue={['Keman Xia', 'Yue Shen']}
                multiple
                renderSelectedItem={renderMultipleWithCustomTag2}
            >
                {list.map((item, index) => renderCustomOption(item, index))}
            </Select>
        </>
    );
};
```

### Custom pop-up layer style

You can control the style of the pop-up layer through `dropdownClassName`, `dropdownStyle`  
For example, when you customize the width of the pop-up layer, you can pass the width through `drowndownStyle`

```jsx live=true
import React from 'react';
import { Select } from '@douyinfe/semi-ui';

() => (
    <Select style={{ width: 180 }} dropdownStyle={{ width: 250 }} dropdownClassName="test">
        <Select.Option value="douyin">Douyin</Select.Option>
        <Select.Option value="coze">Coze</Select.Option>
        <Select.Option value="capcut">Capcut</Select.Option>
        <Select.Option value="xigua">BuzzVideo</Select.Option>
    </Select>
);
```

### Dynamic Modification Options

If you need to update Options dynamically, you should use controlled value

```jsx live=true
import React from 'react';
import { Select, Button } from '@douyinfe/semi-ui';

() => {
    let [options, setOptions] = useState([1, 2, 3, 4]);
    function add() {
        let length = Math.ceil(Math.random() * 10);
        let newOptions = Array.from({ length }, (v, i) => i + 1);
        setOptions(newOptions);
    }
    return (
        <>
            <Select style={{ width: '180px' }} value={4}>
                {options.map(option => (
                    <Select.Option value={option} key={option}>
                        {option}
                    </Select.Option>
                ))}
            </Select>
            <br />
            <br />
            <Button onClick={add}>ChangeOptions Dynamic</Button>
        </>
    );
};
```

### Get all attribute of selected option

By default, through `onChange` uou can only get value attribute of selected option.  
If you need to take other attributes of the selected option, you can use `onChangeWithObject` Properties  
At this time, the argument of `onChange` will be object, containing various attributes of selected option, eg: `onChange({ value, label, ...rest })`  
Note that when onChange With Object is set to true,`defaultValue`/`Value`it should also be object and must have `value` key

```jsx live=true
import React from 'react';
import { Select, TextArea } from '@douyinfe/semi-ui';

() => {
    const list = [
        { value: 'douyin', label: 'Douyin', type: 1 },
        { value: 'capcut', label: 'Capcut', type: 2 },
        { value: 'xigua', label: 'BuzzVideo', type: 3 },
    ];
    const [cbValue, setCbValue] = useState();
    const [multipleCbValue, setMultipleCbValue] = useState();

    const onChange = value => {
        setCbValue(value);
        console.log(value);
    };

    const onMultipleChange = value => {
        setMultipleCbValue(value);
        console.log(value);
    };

    return (
        <div>
            <div>
                <Select
                    style={{ width: 150 }}
                    onChangeWithObject
                    optionList={list}
                    defaultValue={list[0]}
                    onChange={onChange}
                ></Select>
                <h4>onChang callback:</h4>
                <TextArea style={{ width: 320, marginBottom: 48 }} autosize value={JSON.stringify(cbValue)} rows={2} />
            </div>
            <div>
                <Select
                    style={{ width: 320 }}
                    onChangeWithObject
                    multiple
                    optionList={list}
                    onChange={onMultipleChange}
                    placeholder="Multiple Select"
                ></Select>
                <h4>onChange callback:</h4>
                <TextArea style={{ width: 320 }} autosize value={JSON.stringify(multipleCbValue)} />
            </div>
        </div>
    );
};
```

### Create entries

You can create and select entries that do not exist in the options by setting `allowCreate=true` You can customize the content display when creating the label through renderCreateItem (by returning ReactNode, note that you need to customize the style) In addition, can be used with the `defaultActiveFirstOption` property to automatically select the first item. When you enter directly and press Enter, you can immediately create an Option

<Notice title='Notice'>
  When allowCreate is enabled, it will no longer respond to updates to Children or optionList
</Notice>

```jsx live=true
import React from 'react';
import { Select } from '@douyinfe/semi-ui';

() => {
    const optionList = [
        { value: 'douyin', label: 'Douyin' },
        { value: 'capcut', label: 'Capcut' },
        { value: 'xigua', label: 'BuzzVideo' },
    ];
    return (
        <>
            <Select
                style={{ width: 400 }}
                optionList={optionList}
                allowCreate={true}
                multiple={true}
                filter={true}
                onChange={v => console.log(v)}
                defaultActiveFirstOption
            ></Select>
            <br />
            <br />
            <Select
                style={{ width: 400 }}
                optionList={optionList}
                allowCreate={true}
                multiple={true}
                filter={true}
                renderCreateItem={input => <div style={{ padding: 10 }}>Create Item：{input}</div>}
                onChange={v => console.log(v)}
                defaultActiveFirstOption
            ></Select>
        </>
    );
};
```

### Virtualize

Turn on list virtualization when passing in `virtualize` to optimize performance when there are a large number of Option nodes virtualize is an object containing the following values:

-   height: Option list height value, default 270 （before v2.20.8 was 300）
-   width: Option list width value, default 100%
-   itemSize: The height of each line of Option, must be passed

```jsx live=true hideInDSM
import React from 'react';
import { Select } from '@douyinfe/semi-ui';

class VirtualizeDemo extends React.Component {
    constructor(props) {
        super(props);
        let newOptions = Array.from({ length: 3000 }, (v, i) => ({ label: `option-${i}`, value: i }));
        this.state = {
            optionList: newOptions,
        };
    }

    render() {
        let { groups, optionList } = this.state;
        let virtualize = {
            height: 270,
            width: '100%',
            itemSize: 36, // px
        };
        return (
            <>
                <Select
                    placeholder="3000 options"
                    style={{ width: 260 }}
                    filter
                    onSearch={this.handleSearch}
                    virtualize={virtualize}
                    optionList={optionList}
                ></Select>
            </>
        );
    }
}
```

### Custom Trigger

If the default layout style of the selection box does not meet your needs, you can use `triggerRender` to customize the display of the selection box

The parameters of triggerRender are as follows

```typescript
interface TriggerRenderProps {
  value: array<object> // All currently selected options
  inputValue: string; // The input value of the current input box
  onSearch: (inputValue: string) => void; // The function used to update the value of the input box. You should call this function when the value of the Input component you customize in triggerRender is updated to synchronize the state to the Select internal. props.filter needs to be true, support after v2.32
  onClear: () => void; // Function to clear the value
  onRemove: (option: object) => void; // support after v2.32
  disabled: boolean; // Whether to disable Select
  placeholder: string; // Select placeholder
  componentProps: //All props passed to Select by users
}
```

```jsx live=true
import React, { useState } from 'react';
import { Select, Tag } from '@douyinfe/semi-ui';
import { IconAppCenter, IconChevronDown } from '@douyinfe/semi-icons';

() => {
    const [valList, setValList] = useState(['douyin', 'ulikecam']);
    const list = [
        { value: 'douyin', label: 'Douyin' },
        { value: 'ulikecam', label: 'UlikeCam' },
        { value: 'jianying', label: 'Capcut' },
        { value: 'doubao', label: 'Cici' },
    ];
    const triggerRender = ({ value }) => {
        return (
            <div
                style={{
                    minWidth: '112',
                    backgroundColor: 'var(--semi-color-primary-light-default)',
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    paddingLeft: 12,
                    borderRadius: 3,
                    color: 'var(--semi-color-primary)',
                }}
            >
                <div
                    style={{
                        fontWeight: 600,
                        flexShrink: 0,
                        fontSize: 14,
                    }}
                >
                    AppName
                </div>
                <div
                    style={{
                        margin: 4,
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                        flexGrow: 1,
                        overflow: 'hidden',
                    }}
                >
                    {value.map(item => item.label).join(' , ')}
                </div>
                <IconAppCenter style={{ marginRight: 8, flexShrink: 0 }} />
            </div>
        );
    };

    const triggerRender2 = ({ value, ...rest }) => {
        return (
            <div
                style={{
                    margin: 4,
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    flexGrow: 1,
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                }}
            >
                <Tag size='large' color='cyan' shape='circle' suffixIcon={<IconChevronDown />}>
                    {value.map(item => item.label).join(' / ')}
                </Tag>
            </div>
        );
    };

    return (
        <div>
            <h4>Different Background Trigger</h4>
            <Select
                value={valList}
                triggerRender={triggerRender}
                optionList={list}
                onChange={value => setValList(value)}
                multiple
                filter
                searchPosition='dropdown'
                style={{ width: 240 }}
            ></Select>
            <br />
            <br />
            <h4>Use circle Tag as trigger</h4>
            <Select
                value={valList}
                onChange={value => setValList(value)}
                triggerRender={triggerRender2}
                optionList={list}
                filter
                multiple
                searchPosition='dropdown'
                style={{ width: 240, marginTop: 20, outline: 0 }}
            ></Select>
        </div>
    );
};
```


The following is a more complex example: Reusing the drag-and-sort capability of TagInput and adding sorting to Select through triggerRender.

```jsx live=true
import React, { useState } from 'react';
import { Select, TagInput } from '@douyinfe/semi-ui';

() => {
    const [valList, setValList] = useState(['douyin', 'ulikecam']);
    const [inputVal, setInputVal] = useState('');
    const list = [
        { value: 'douyin', label: 'Douyin' },
        { value: 'ulikecam', label: 'UlikeCam' },
        { value: 'jianying', label: 'Capcut' },
        { value: 'doubao', label: 'Cici' },
    ];
     
    const handleSort = (currentLabels) => {
        const newValue = currentLabels.map(item => list.find((i) => i.label === item).value)
        setValList(newValue);
    };

    const triggerRender = ({ value, onSearch, onClear }) => {
        return (
            <div onKeyDown={e=>e.stopPropagation()}>
                <TagInput
                    draggable
                    allowDuplicates={false}
                    value={value.map(item => item.label)}
                    inputValue={inputVal}
                    onInputChange={(word) => {
                        onSearch(word);
                        setInputVal(word);
                    }}
                    onChange={handleSort}
                    onClear={() => onClear()}
                    showClear
                />
            </div>
        );
    }; 
  
    return (
        <>
            <h4>Select that can reorder selected options by dragging</h4>
            <Select
                value={valList}
                triggerRender={triggerRender}
                optionList={list}
                onChange={value => setValList(value)}
                multiple
                filter
                style={{ width: 240 }}
            ></Select>
        </>
    );
};
```

### Custom Option Render

-   Simple customization: Pass the label property of Option or children into ReactNode, you can control the rendering of the candidates, and the content will automatically bring styles such as padding, background color, etc.
-   Complete customization: By passing in `renderOptionItem`, you can completely take over the rendering of the candidates in the list, and get the relevant state values from the callback input parameters. Achieve a higher degree of freedom of structural rendering  
    Notice:
    1. The style passed in by props needs to be consumed on wrapper dom, otherwise it will not be able to be used normally in virtualization scenarios
    2. The styles of selected, focused, disabled, etc. state need to be added by yourself, and you can get the relative boolean value from props
    3. `onMouseEnter`、`className` needs to be bound on the wrapper dom, otherwise the display will be problematic when the upper and lower keyboards are operated
    4. If your custom item is Select.Option, you need to pass renderProps.onClick transparently to the onSelect prop of Option

```jsx live=true
import React from 'react';
import { Select, Checkbox } from '@douyinfe/semi-ui';

() => {
    const renderOptionItem = renderProps => {
        const {
            disabled,
            selected,
            label,
            value,
            focused,
            className,
            style,
            onMouseEnter,
            onClick,
            empty,
            emptyContent,
            ...rest
        } = renderProps;
        const optionCls = classNames({
            ['custom-option-render']: true,
            ['custom-option-render-focused']: focused,
            ['custom-option-render-disabled']: disabled,
            ['custom-option-render-selected']: selected,
            className,
        });
        // Notice：
        // 1. The style passed in by props needs to be consumed on wrapper dom, otherwise it will not be able to be used normally in virtualization scenarios
        // 2. The styles of selected (selected), focused (focused), disabled (disabled) and other states need to be added by yourself, you can get the relative boolean value from props
        // 3.onMouseEnter needs to be bound on the wrapper dom, otherwise the display will be problematic when the upper and lower keyboards are operated

        return (
            <div style={style} className={optionCls} onClick={() => onClick()} onMouseEnter={e => onMouseEnter()}>
                <Checkbox checked={selected} />
                <div className="option-right">{label}</div>
            </div>
        );
    };

    const optionList = [
        { value: 'douyin', label: 'Semi', otherKey: 0 },
        { value: 'capcut', label: 'Capcut', disabled: true, otherKey: 1 },
        { value: 'cam', label: 'UlikeCam', otherKey: 2 },
        { value: 'buzz', label: 'Buzz', otherKey: 3 },
    ];

    return (
        <>
            <Select
                filter
                defaultOpen
                defaultValue="douyin"
                dropdownClassName="components-select-demo-renderOptionItem"
                optionList={optionList}
                style={{ width: 180 }}
                renderOptionItem={renderOptionItem}
            />
            <br />
            <br />
            <Select
                filter
                placeholder="multiple"
                multiple
                dropdownClassName="components-select-demo-renderOptionItem"
                optionList={optionList}
                style={{ width: 320, marginTop: 180 }}
                renderOptionItem={renderOptionItem}
            />
        </>
    );
};
```

```scss
.components-select-demo-renderOptionItem {
    .custom-option-render {
        display: flex;
        font-size: 14px;
        line-height: 20px;
        word-break: break-all;
        padding-left: 12px;
        padding-right: 12px;
        padding-top: 8px;
        padding-bottom: 8px;
        color: var(--semi-color-text-0);
        position: relative;
        display: flex;
        align-items: center;
        cursor: pointer;
        box-sizing: border-box;
        .option-right {
            margin-left: 8px;
            display: inline-flex;
            align-items: center;
        }
        &:active {
            background-color: var(--semi-color-fill-1);
        }
        &-focused {
            background-color: var(--semi-color-fill-0);
        }
        &-selected {
            //font-weight: 700;
        }
        &-disabled {
            color: var(--semi-color-disabled-text);
            cursor: not-allowed;
        }
        &:first-of-type {
            margin-top: 4px;
        }
        &:last-of-type {
            margin-bottom: 4px;
        }
    }
}
```

## API reference

### Select Props

| Properties | Instructions                                                                                                                                                                                                                                                                                                                                                       | Type | Default | version |
| --- |--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------| --- | --- | --- |
| allowCreate | Whether to allow the user to create new entries. Needs to be used with `filter`. When allowCreate is enabled, it will no longer respond to updates to children or optionList                                                                                                                                                                                       | boolean | false |
| arrowIcon | Customize the right drop-down arrow Icon, when the showClear switch is turned on and there is currently a selected value, hover will give priority to the clear icon                                                                                                                                                                                               | ReactNode |  | |
| autoAdjustOverflow | Whether the pop-up layer automatically adjusts the direction when it is obscured (only vertical direction is supported for the time being, and the inserted parent is body)                                                                                                                                                                                        | boolean | true |
| autoClearSearchValue | After selecting the option, whether to automatically clear the search keywords, it will take effect when mutilple and filter are both enabled                                                                                                                                                                                                                      | boolean | true | 2.3.0|
| autoFocus | Whether automatically focus when component mount                                                                                                                                                                                                                                                                                                                   | boolean | false |
| borderless        | borderless mode  >=2.33.0                                                                                                                                                                                                                                                                                                                                          | boolean                         |           |
| className | The CSS class name of the wrapper element                                                                                                                                                                                                                                                                                                                          | string |  |
| clearIcon    | Can be used to customize the clear button, valid when showClear is true                                                                                                                                                                                                                                                                                            | ReactNode                       |   | 2.25.0 |
| clickToHide | When expanded, click on the selection box to automatically put away the drop-down list                                                                                                                                                                                                                                                                             | boolean | false |
| defaultValue | Originally selected value when component mount                                                                                                                                                                                                                                                                                                                     | string\|number\|array |  |
| defaultOpen | Whether show dropdown when component mounted                                                                                                                                                                                                                                                                                                                       | boolean | false |
| defaultActiveFirstOption | Whether to highlight the first option by default (press Enter to select directly)                                                                                                                                                                                                                                                                                  | boolean | true |
| disabled | Whether disabled component                                                                                                                                                                                                                                                                                                                                         | boolean | false |
| dropdownClassName | ClassName of the pop-up layer                                                                                                                                                                                                                                                                                                                                      | string |  |
| dropdownMatchSelectWidth | Is the minimum width of the drop-down menu equal to Select                                                                                                                                                                                                                                                                                                         | boolean | true |
| dropdownMargin | Popup layer calculates the size of the safe area when the current direction overflows, used in scenes covered by fixed elements, more detail refer to [issue#549](https://github.com/DouyinFE/semi-design/issues/549), same as Tooltip margin                                                                                                                      | object\|number |  | 2.25.0 |
| dropdownStyle | The inline style of the pop-up layer                                                                                                                                                                                                                                                                                                                               | object |  |
| emptyContent | Content displayed when there is no result. When set to null, the drop-down list will not be displayed                                                                                                                                                                                                                                                              | string | ReactNode |  |
| ellipsisTrigger | When maxTagCount exists and is multi-select, whether to perform adaptive processing on the overflow part of the tag(When the width is insufficient, the last tag content is truncated). After enabling this function, there will be a certain performance loss, and it is not recommended to use it in large form scenarios                                        | boolean   | false       | 2.28.0 | 
| expandRestTagsOnClick | When maxTagCount exists and is multi-selected, select whether to expand redundant Tags when the panel is open                                                                                                                                                                                                                                                      | boolean                          | false       | 2.28.0 | 
| filter | Whether searchable or not, the default is false. When `true` is passed, it means turn on search ability, default filtering policy is whether the label matches search input<br/>When the input type is function, the function arguments are searchInput, option. It should return true when the option meets the filtering conditions, otherwise it returns false. | false | boolean\|function |  |
| getPopupContainer | Specifies the parent DOM, and the popup layer will be rendered to the DOM, you need to set 'position: relative`    This will change the DOM tree position, but not the view's rendering position.                                                                                                                                                                                                                                                  | function(): HTMLElement | () => document.body |
| inputProps | When filter is true, the additional configuration parameters of the input, please refer to the Input component for specific configurable properties (note: please do not pass in `value`, `ref`, `onChange`, `onFocus`, otherwise it will override Select related callbacks and affect component behavior)                                                         | object | | 2.2.0|
| innerTopSlot | Render at the top of the pop-up layer, custom slot inside the optionList                                                                                                                                                                                                                                                                                           | ReactNode |  |
| innerBottomSlot | Render at the bottom of the pop-up layer, custom slot inside the optionList                                                                                                                                                                                                                                                                                        | ReactNode |  |
| loading | Does the drop-down list show the loading animation                                                                                                                                                                                                                                                                                                                 | boolean | false |
| max | Maximum number of choices, effective only in multi-selection mode                                                                                                                                                                                                                                                                                                  | number |  |
| maxTagCount | In multi-selection mode, when the option is beyond maxTag Count, the subsequent option is rendered in the form of + N                                                                                                                                                                                                                                              | number |  |
| maxHeight | Maximum height of `optionList` in the pop-up layer                                                                                                                                                                                                                                                                                                                 | string \| number | 270 |
| multiple | Whether allow multiple selection                                                                                                                                                                                                                                                                                                                                   | boolean | false |
| outerBottomSlot | Rendered at the bottom of the popup layer, custom slot level with optionList                                                                                                                                                                                                                                                                                       | ReactNode |  |
| outerTopSlot | Rendered at the top of the pop-up layer, custom slot level with optionList                                                                                                                                                                                                                                                                                         | ReactNode | | |
| optionList | You can pass Option through this property, make sure that each element in the array has `label`, `value` properties                                                                                                                                                                                                                                                | Array (\[{value, label}\]) |  |
| placeholder | placeholder                                                                                                                                                                                                                                                                                                                                                        | ReactNode |  |
| position | Pop-up layer position, refer to [Popover·API reference·position](/en-US/show/popover#API%20Reference)                                                                                                                                                                                                                                                              | string | 'bottomLeft' |
| prefix | An input helper rendered before                                                                                                                                                                                                                                                                                                                                    | ReactNode |  |
| preventScroll | Indicates whether the browser should scroll the document to display the newly focused element, acting on the focus method inside the component, excluding the component passed in by the user                                                                                                                                                                      | boolean |  |  |
| remote | Whether to turn on remote search, when remote is true, the input content will not be locally filtered and matched                                                                                                                                                                                                                                                  | boolean | false |
| renderCreateItem | When allowCreate is true, you can customize the rendering of the creation label                                                                                                                                                                                                                                                                                    | function(inputValue: string) | InputValue => 'Create' + InputValue |
| renderSelectedItem | Customize the rendering of selected tabs in the selection box                                                                                                                                                                                                                                                                                                      | function(option) |  |
| restTagsPopoverProps | The configuration properties of the [Popover](/en-US/show/popover#API%20Reference)                                                                                                                                                                                                                                                                                 | PopoverProps | {} | 2.22.0 |
| size | Size, optional value `default` / `small` / `large`   
| searchPosition | When the filter is turned on, the search box is in the trigger by default. You can set it to 'dropdown' to put the search box at the top of the popup list.  | string | 'trigger' | 2.61.0
| showArrow | Whether to show arrow icon                                                                                                                                                                                                                                                                                                                                         | boolean | true |
| showClear | Whether to show the clear button                                                                                                                                                                                                                                                                                                                                   | boolean | false |
| showRestTagsPopover | When the number of tags exceeds maxTagCount and hover reaches +N, whether to display the remaining content through Popover                                                                                                                                                                                                                                         | boolean | false | 2.22.0 |
| spacing | Spacing between popup layer and trigger                                                                                                                                                                                                                                                                                                                            | number | 4 |
| stopPropagation | Whether to prevent click events on the popup layer from bubbling                                                                                                                                                                                                                                                                                                   | boolean | true |  |
| style | Inline Style                                                                                                                                                                                                                                                                                                                                                       | object |  |
| suffix | An input helper rendered after                                                                                                                                                                                                                                                                                                                                     | ReactNode |  |
| triggerRender | Custom DOM of trigger                                                                                                                                                                                                                                                                                                                                              | function |  |
| virtualize | List virtualization, used to optimize performance in the case of a large number of nodes, composed of height, width, and itemSize                                                                                                                                                                                                                                  | object |  |  |
| validateStatus | Verification result, optional `warning`, `error`, `default` (only affect the style background color)                                                                                                                                                                                                                                                               | string | 'default' |
| value | The currently selected value is passed as a controlled component, used in conjunction with `onchange`                                                                                                                                                                                                                                                              | string\|number\|array |  |
| zIndex | Popup layer z-index                                                                                                                                                                                                                                                                                                                                                | number | 1030 |
| onBlur | Callback when blur                                                                                                                                                                                                                                                                                                                                                 | function(event) |  |
| onChange | Callback function when selected option                                                                                                                                                                                                                                                                                                                             | function (value) |  |
| onChangeWithObject | Whether to use the other properties of the selected option as a callback. When set to true, the entry type of onchange changes from string to object: {value, label,...rest}                                                                                                                                                                                       | boolean | false |
| onClear | Callback when click clear icon                                                                                                                                                                                                                                                                                                                                     | function |  |
| onCreate | Allow Create is true and provides after the callback when creating the standby option                                                                                                                                                                                                                                                                              | function |  |
| onDeselect | Callback when selected cancel                                                                                                                                                                                                                                                                                                                                      | function (value, option) |  |
| onDropdownVisibleChange | A callback when the drop-down menu expands / collapsed                                                                                                                                                                                                                                                                                                             | function(visible: boolean) |  |
| onExceed | Callback invoked when the number of attempts to select exceeds the max limit, effective only at multi-selection                                                                                                                                                                                                                                                    | function |  |
| onFocus | Callback when focus select                                                                                                                                                                                                                                                                                                                                         | function(event) |  |
| onSearch | The callback function when the content of the input box changes. The second parameter is available after v2.31                                                                                                                                                                                                                                                     | function(sugInput: string, e: ReactEvent) |  |
| onSelect | Callback when selected                                                                                                                                                                                                                                                                                                                                             | function (value, option) |  |

### Option Props

> **The label of different Option must be unique** . Value allows repetition

| Properties | Instructions | Type | Default |
| --- | --- | --- | --- |
| className | The CSS class name of the wrapper element | string |  |
| disabled | Disabled | boolean | false |
| label | Text displayed. Prioritize the label when rendering, take the child, value if not, and downgrade in turn | string\|ReactNode |  |
| showTick | Whether to show the Icon of tick when option selected | boolean | true |
| style | Inline Style | object |  |
| value | Property value | string\|number |  |

### OptGroup Props

| Properties | Instructions       | Type      | 
| ---------- | ------------------ | --------- | 
| className  | The CSS class name | string    | 
| label      | Text displayed.    | ReactNode | 
| style      | Inline Style       | object    | 

## Methods
Some internal methods provided by Select can be accessed through ref:

| Method      | Instructions                    | Version |
| ----------- | ------------------------------- | ------- |
| close       | Manually close dropdown list    |  |
| clearInput  | Manually clear value of input   |  |
| deselectAll | Manually clear selected options |  |
| focus       | Manually focus select           |  |
| open        | Manually open dropdown list     |  |
| selectAll   | Manually select all options     |  |
| search(value: string, event: event)  | You can call this method through ref to search, and the search value will be set to Input          | v2.35.0 |

## Accessibility

### ARIA

-   The role of the Select trigger is combobox, the role of the popup layer is listbox, and the role of the option is option
-   Select trigger has aria-haspopup, aria-expanded, and aria-controls properties, indicating the relationship between trigger and popup layer
-   When multiple selections are made, listbox aria-multiselectable is true, indicating that multiple selections are currently available
-   aria-selected is true when Option is selected; aria-disabled is true when Option is disabled
-   The attribute aria-activedescendant ensures that the currently selected option is recognized when the narration is spoken(for more information, please refer to [Managing Focus in Composites Using aria-activedescendant](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/#kbd_focus_activedescendant))

### Keyboard and Focus

**Select without Filter:**

-   After Select is focused, keyboard users can open the dropdown menu with the `Up Arrow` or `Down Arrow` or `Enter` keys and automatically focus on the first option in the dropdown menu (`defaultActiveFirstOption` defaults to true)
-   When the dropdown menu is open:
    -   Use `Esc` key or `Tab` key to close the menu
    -   Use `Up Arrow` or `Down Arrow` to toggle options
    -   The focused option can be selected with the Enter key and the panel is collapsed
-   When the focus is on the dropdown menu and the user uses an `innerBottomSlot` or `outerBottomSlot` attribute with a custom slot with an interactive element:
    -   You can use the `Tab` key to switch to these interactive elements
    -   When the focus is on the first interactive element of the custom slot, use `Shift` + `Tab` to return the focus to the Select box

**Select with Filter function:**

-   When Select is focused, keyboard users can open dropdown menus with `Up Arrow` or `Down Arrow` or `Enter` keys. At this point, the focus is still on the Select box, the user can enter content, and can also use the `up arrow` or `down arrow` to switch options
-   When the dropdown menu is open: the keyboard interaction is the same as Select without the Filter function
-   When the focus is on the Select box, and the user uses an `innerBottomSlot` or `outerBottomSlot` property with a custom slot with an interactive element:
    -   You can use the `Tab` key to switch to these interactive elements
    -   When the focus is on the first interactive element of the custom slot, use `Shift` + `Tab` to return the focus to the Select box

## Content Guidelines

-   Selector trigger
    -   Describe in 1-3 words the input that the user needs to make
    -   Use statement writing conventions (first letter uppercase, rest lowercase)
    -   Avoid punctuation and prepositions ("the", "an", "a")
    -   Labels need to be independent statements. Don't let the label be the first half of the statement and the option the second half of the statement.
    -   Use descriptive sentences, not indicative ones. Help text is available under the select box if the option needs more explanation.
-   Selector options
    -   If there is no default option, use "Select" as placeholder copy
    -   Options should be in alphabetical order or other logical order to make it easier for users to find options
    -   Use statement writing conventions (first letter uppercase, rest lowercase), avoid commas and semicolons at the end of sentences
    -   Clearly articulate the purpose of the choice indicated by the option

## Design Tokens

<DesignToken/>

## Related Material
<semi-material-list code="3, 4, 58, 62, 696"></semi-material-list>

## FAQ

-   **Searchable Select, using remote data to dynamically update the `optionList`, why sometimes there is no data before the asynchronous request is completed?？**  
     Please check whether `remote={true}` is set. If remote is not set, the input value of the input box will be compared with the current optionList by default. If there is no match, no data will be displayed.  
     You can turn off matching filtering on the current local data by setting remote to true.

-   **Use jsx to declare Option, label is the content after i18n, fail to re-render after switching locale** When the children jsx method declares Options, because it is ReactNode, it is impossible to use deepEqual to compare whether the content is updated (excessive performance consumption), so the key of children ReactNode will be collected. When the key is unchanged, it is considered that Options have not occurred. Changes will not go through the process of re-collecting data. You can also use locale as part of the Option key.  
    The problem can also be solved by using `optionList` to pass in. Because the key is relatively limited for the object form, isEqual is used inside Select to determine whether there is a change

-   **Use jsx to declare Option, and fail to re-render after dynamically switching the disabled attribute**  
    The reason is the same as above, you can set a different key value for Option again, or use optionList to declare candidate options

-   **Will Select automatically limit the width of the drop-down menu?**  
    MinWidth will be given, but width will not be written dead. If necessary, you can add it yourself through dropdownStyle.

-   **After setting allowCreate, dynamically updating optionList or children does not take effect**

    allowCreate is mainly used for locally created scenarios. When this item is turned on, it is equivalent to forcibly taking over optionList/children, and will no longer respond to external updates to these two types of values. Otherwise, how the currently created options are combined with the latest props.optionList, and whether the strategy is overwritten or merged depends largely on the business scenario logic, and it is inappropriate to force presets by the component layer.

-   **Why Semi's Select requires that the label must be unique, but not the value?**

        First of all, we must need a unique identifier to make a selection judgment. For almost all UI libraries, when using Select.Option, the minimum requirements will only require the two values of label and value to be passed in, instead of requiring a separate key (too cumbersome). Semi continues this setting.
        So why is label instead of value in semi's select?
        The label of the option is what the user perceives. From an interactive point of view, if there are two options that are exactly the same on the display, to the user’s perception, they look the same and cannot be distinguished, but the selected effects are different (for example, one value is 0, the other As 1), it is unreasonable. (Users' first reaction is often repeated, and there may be a bug)

    Unique label and repeated value are more common in daily use. For example, a selector that selects the company id based on the app name, value is the company id corresponding to the app, and label is the name of the app. We don't recommend showing the user a duplicate label option, but if you're sure you need to, you can bypass this restriction when you pass a ReactNode type to the label.

-   **Why is the blur event not fired after a radio selection option?**

    Before V2.17.0, after Select radio is selected, the blur event of Select will be triggered. After V2.17.0, Select has added A11y support, which will not trigger Select's blur event. In single-selection selection, the Select floating layer is closed, and the focus is still on the trigger (at this time, the Select floating layer can be opened again by pressing the Enter key) No matter single selection or multiple selection, press Esc, only the Select floating layer is closed, and the trigger keeps the focus (the Select floating layer can be opened again by pressing the Enter key at this time)
