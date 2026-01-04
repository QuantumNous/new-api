---
localeCode: zh-CN
order: 45
category: 输入类
title: Select 选择器
icon: doc-select
width: 60%
brief: 用户可以通过 Select 选择器从一个选项集合中去选中一个或多个选项，并呈现最终选择结果
---

## 代码演示

### 如何引入

```jsx import
import { Select } from '@douyinfe/semi-ui';
const Option = Select.Option;
```

<Notice title='注意'>
Select的直接子元素必须为 Option 或者 OptGroup，不允许为其他Element
</Notice>

### 基本使用

每个 Option 标签都必须声明 value 属性，Option 的 children 或 label 将会被渲染至下拉列表中

```jsx live=true
import React from 'react';
import { Select } from '@douyinfe/semi-ui';

() => (
    <>
        <Select defaultValue="douyin" style={{ width: 120 }}>
            <Select.Option value="douyin">抖音</Select.Option>
            <Select.Option value="ulikecam">轻颜相机</Select.Option>
            <Select.Option value="jianying" disabled>
                剪映
            </Select.Option>
            <Select.Option value="xigua">西瓜视频</Select.Option>
        </Select>
        <br />
        <br />
        <Select defaultValue="douyin" disabled style={{ width: 120 }}>
            <Select.Option value="douyin">抖音</Select.Option>
            <Select.Option value="ulikecam">轻颜相机</Select.Option>
        </Select>
        <br />
        <br />
        <Select placeholder="请选择业务线" style={{ width: 120 }}>
            <Select.Option value="douyin">抖音</Select.Option>
            <Select.Option value="ulikecam">轻颜相机</Select.Option>
            <Select.Option value="jianying" disabled>
                剪映
            </Select.Option>
            <Select.Option value="xigua">西瓜视频</Select.Option>
        </Select>
    </>
);
```

### 以数组形式传入 Option

可以直接通过`optionList`传入一个对象数组，每个对象必须包含 value/label 属性（当然其他属性也可以通过此方式传入）

```jsx live=true
import React from 'react';
import { Select } from '@douyinfe/semi-ui';

() => {
    const list = [
        { value: 'douyin', label: '抖音', otherKey: 0 },
        { value: 'ulikecam', label: '轻颜相机', disabled: true, otherKey: 1 },
        { value: 'jianying', label: '剪映', otherKey: 2 },
        { value: 'toutiao', label: '今日头条', otherKey: 3 },
    ];
    return <Select placeholder="请选择业务线" style={{ width: 180 }} optionList={list}></Select>;
};
```

### 多选
自 v2.28后，select 的选择器会自带 maxHeight 270，内容超出后可以通过垂直滚动查看。

配置`multiple`属性，可以支持多选

配置 `maxTagCount` 可以限制已选项展示的数量，超出部分将以+N 的方式展示

配置 `ellipsisTrigger` (>= v2.28.0) 对溢出部分的 tag 做自适应处理，当宽度不足时，最后一个tag内容作截断处理。开启该功能后会有一定性能损耗，不推荐在大表单场景下使用

配置 `expandRestTagsOnClick` (>= v2.28.0) 可以在设置 `maxTagCount` 情况下通过点击展示全剩余的tag

使用 `showRestTagsPopover` (>= v2.22.0) 可以设置在超出 `maxTagCount` 后，hover +N 是否显示 Popover，默认为 `false`。并且，还可以在 `restTagsPopoverProps` 属性中配置 Popover。

配置 `max` 属性可限制最大可选的数量，超出最大限制数量后无法选中，同时会触发`onExceed`回调

```jsx live=true
import React from 'react';
import { Select } from '@douyinfe/semi-ui';

() => (
    <>
        <Select multiple style={{ width: '320px' }} defaultValue={['douyin', 'ulikecam']}>
            <Select.Option value="douyin">抖音</Select.Option>
            <Select.Option value="ulikecam">轻颜相机</Select.Option>
            <Select.Option value="jianying">剪映</Select.Option>
            <Select.Option value="xigua">西瓜视频</Select.Option>
        </Select>
        <br />
        <br />
        <Select
            multiple
            maxTagCount={2}
            showRestTagsPopover={true}
            restTagsPopoverProps={{ position: 'top' }}
            style={{ width: '320px' }}
            defaultValue={['douyin', 'ulikecam', 'jianying']}
        >
            <Select.Option value="douyin">抖音</Select.Option>
            <Select.Option value="ulikecam">轻颜相机</Select.Option>
            <Select.Option value="jianying">剪映</Select.Option>
            <Select.Option value="xigua">西瓜视频</Select.Option>
        </Select>
        
        <br />
        <br />
        <Select
            multiple
            style={{ width: '320px' }}
            defaultValue={['douyin']}
            max={2}
            onExceed={() => Toast.warning('最多只允许选择两项')}
        >
            <Select.Option value="douyin">抖音</Select.Option>
            <Select.Option value="ulikecam">轻颜相机</Select.Option>
            <Select.Option value="jianying">剪映</Select.Option>
            <Select.Option value="xigua">西瓜视频</Select.Option>
        </Select>
        <br />
        <br />
        <Select
            multiple
            maxTagCount={2}
            showRestTagsPopover={true}
            restTagsPopoverProps={{ position: 'top' }}
            style={{ width: '220px' }}
            defaultValue={['xigua', 'ulikecam', 'jianying', 'douyin']}
            ellipsisTrigger
            expandRestTagsOnClick
        >
            <Select.Option value="douyin">抖音</Select.Option>
            <Select.Option value="ulikecam">轻颜相机</Select.Option>
            <Select.Option value="jianying">剪映</Select.Option>
            <Select.Option value="xigua">西瓜视频</Select.Option>
        </Select>
    </>
);
```

### 分组

分组功能 v0.31.0 后提供  
用 OptGroup 进行分组（分组功能仅支持通过 jsx 方式声明 children 使用，不支持 optionList 方式传入）

<Notice title='注意'>
  1. OptGroup必须为Select的直接子元素，不允许有Fragment或DIV等其他元素阻隔 <br/>
  2. 若Select的children需要动态更新，OptGroup上的key也需要进行更新，否则Select无法识别  
</Notice>

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

### 不同尺寸

通过 Size 控制选择器的大小尺寸: `small` / `default` / `large`

```jsx live=true
import React from 'react';
import { Select } from '@douyinfe/semi-ui';

() => (
    <>
        <Select placeholder="请选择业务线" style={{ width: '180px' }} size="small">
            <Select.Option value="ulikecam">轻颜相机</Select.Option>
        </Select>
        <br />
        <br />
        <Select placeholder="请选择业务线" style={{ width: '180px' }}>
            <Select.Option value="ulikecam">轻颜相机</Select.Option>
        </Select>
        <br />
        <br />
        <Select placeholder="请选择业务线" style={{ width: '180px' }} size="large">
            <Select.Option value="ulikecam">轻颜相机</Select.Option>
        </Select>
    </>
);
```

### 不同校验状态样式

validateStatus: default / warning / error  
仅影响背景颜色等样式表现

```jsx live=true
import React from 'react';
import { Select } from '@douyinfe/semi-ui';

() => (
    <>
        <Select style={{ width: '180px' }}>
            <Select.Option value="ulikecam">轻颜相机</Select.Option>
        </Select>
        <br />
        <br />
        <Select style={{ width: '180px' }} validateStatus="warning">
            <Select.Option value="ulikecam">轻颜相机</Select.Option>
        </Select>
        <br />
        <br />
        <Select style={{ width: '180px' }} validateStatus="error">
            <Select.Option value="ulikecam">轻颜相机</Select.Option>
        </Select>
    </>
);
```

### 配置前缀、后缀、清除按钮

-   可以通过`prefix`传入选择框前缀，通过`suffix`传入选择框后缀，可以为文本或者 ReactNode  
    当 prefix、suffix 传入的内容为文本或者 Icon 时，会自动带上左右间隔，若为自定义 ReactNode，则左右间隔为 0
-   通过`showClear`控制清除按钮是否展示
-   通过`showArrow`控制右侧下拉箭头是否展示

```jsx live=true
import React from 'react';
import { Select } from '@douyinfe/semi-ui';
import { IconVigoLogo, IconGift } from '@douyinfe/semi-icons';

() => (
    <>
        <Select style={{ width: '320px' }} defaultValue={'ulikecam'} prefix={<IconVigoLogo />} showClear={true}>
            <Select.Option value="douyin">抖音</Select.Option>
            <Select.Option value="ulikecam">轻颜相机</Select.Option>
            <Select.Option value="jianying">剪映</Select.Option>
            <Select.Option value="xigua">西瓜视频</Select.Option>
        </Select>
        <br />
        <br />
        <Select
            style={{ width: '320px' }}
            defaultValue={'ulikecam'}
            prefix={<IconVigoLogo />}
            suffix={<IconGift />}
            showArrow={false}
        >
            <Select.Option value="douyin">抖音</Select.Option>
            <Select.Option value="ulikecam">轻颜相机</Select.Option>
            <Select.Option value="jianying">剪映</Select.Option>
            <Select.Option value="xigua">西瓜视频</Select.Option>
        </Select>
    </>
);
```

### 在顶部/底部渲染附加项

我们在弹出层顶部、底部分别预留了插槽，当你需要在弹出层中添加自定义 node 时  
可以通过`innerBottomSlot`或者`outerBottomSlot`传入，自定义 node 将会被渲染在弹出层底部；可以通过`innerTopSlot`或者`outerTopSlot`传入，自定义 node 将会被渲染在弹出层顶部。

-   `innerTopSlot` 和 `innerBottomSlot`将会被渲染在 optionList 内部，当滚动到 optionList 顶部/底部时展现
-   `outerTopSlot` 和 `outerBottomSlot`将会被渲染为与 optionList 平级，无论 optionList 是否滚动，都会始终展现

```jsx live=true
import React from 'react';
import { Select } from '@douyinfe/semi-ui';

() => {
    let innerSlotStyle = {
        backgroundColor: 'var(--color-white)',
        height: '36px',
        display: 'flex',
        alignItems: 'center',
        cursor: 'pointer',
        paddingLeft: 32,
        borderTop: '1px solid var(--semi-color-border)',
        borderRadius: '0 0 6px 6px',
        color: 'var(--semi-color-link)',
    };
    let innerSlotNode = <div style={innerSlotStyle}>点击加载更多</div>;
    let outSlotStyle = {
        backgroundColor: 'var(--semi-color-fill-0)',
        height: '36px',
        display: 'flex',
        paddingLeft: 32,
        color: 'var(--semi-color-link)',
        alignItems: 'center',
        cursor: 'pointer',
        borderTop: '1px solid var(--semi-color-border)',
        borderRadius: '0 0 6px 6px',
    };
    let outSlotNode = (
        <div style={outSlotStyle}>
            <span style={{ color: 'var(--semi-color-link)' }}>未找到应用?</span>
        </div>
    );

    return (
        <div>
            <p>outerBottomSlot:</p>
            <Select
                style={{ width: 300 }}
                dropdownStyle={{ width: 180 }}
                maxHeight={150}
                outerBottomSlot={outSlotNode}
                placeholder="自定义外侧底部slot，始终显示"
                defaultOpen
                autoAdjustOverflow={false}
                position="bottom"
            >
                <Select.Option value="douyin">抖音</Select.Option>
                <Select.Option value="ulikecam">轻颜相机</Select.Option>
                <Select.Option value="jianying">剪映</Select.Option>
                <Select.Option value="duoshan">多闪</Select.Option>
                <Select.Option value="xigua">西瓜视频</Select.Option>
            </Select>
            <p style={{ marginTop: 200 }}>innerBottomSlot:</p>
            <Select
                style={{ width: 300 }}
                dropdownStyle={{ width: 180 }}
                maxHeight={150}
                innerBottomSlot={innerSlotNode}
                placeholder="自定义内侧底部slot，滚动至底部显示"
            >
                <Select.Option value="douyin">抖音</Select.Option>
                <Select.Option value="ulikecam">轻颜相机</Select.Option>
                <Select.Option value="jianying">剪映</Select.Option>
                <Select.Option value="duoshan">多闪</Select.Option>
                <Select.Option value="xigua">西瓜视频</Select.Option>
            </Select>
        </div>
    );
};
```

通过 outerTopSlot 将内容插入顶部插槽

```jsx live=true
import React from 'react';
import { Select } from '@douyinfe/semi-ui';

() => {
    const list = {
        component: [
            { value: 'select', label: '选择器' },
            { value: 'tabs', label: '标签' },
            { value: 'avatar', label: '头像' },
            { value: 'button', label: '按钮' },
        ],
        design: [
            { value: 'color', label: '颜色' },
            { value: 'dark', label: '暗色模式' },
            { value: 'icon', label: '图标' },
            { value: 'font', label: '字体' },
        ],
        feedback: [
            { value: 'faq', label: '常见问题' },
            { value: 'join', label: '加入用户群' },
            { value: 'hornbill', label: '犀鸟反馈问题' },
        ],
    };

    const [key, setKey] = useState('component');
    const [value, setValue] = useState({ value: 'faq', label: '常见问题' });
    const handleTdouyinlick = itemKey => {
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
        borderBottom: '0.5px solid var(--semi-color-border)',
    };
    const tabOptions = [
        { itemKey: 'component', label: '组件' },
        { itemKey: 'design', label: '设计' },
        { itemKey: 'feedback', label: '反馈' },
    ];

    const outerTopSlotNode = (
        <div style={tabWrapper}>
            {tabOptions.map((item, index) => {
                style = item.itemKey === key ? tabActiveStyle : tabStyle;
                return (
                    <div style={style} key={item.itemKey} onClick={() => handleTdouyinlick(item.itemKey)}>
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

### 受控组件

传入 value 时 Select 为受控组件，所选中的值完全由 value 决定。

```jsx live=true hideInDSM
import React, { useState } from 'react';
import { Select } from '@douyinfe/semi-ui';

() => {
    let [value, setValue] = useState('xigua');
    return (
        <>
            <Select value={value} style={{ width: '300px' }} onChange={setValue} placeholder="受控的Select">
                <Select.Option value="douyin">抖音</Select.Option>
                <Select.Option value="ulikecam">轻颜相机</Select.Option>
                <Select.Option value="jianying">剪映</Select.Option>
                <Select.Option value="xigua">西瓜视频</Select.Option>
            </Select>
        </>
    );
};
```

### 动态修改 Options

如果需要动态更新 Options，应该使用受控的 value

```jsx live=true hideInDSM
import React, { useState } from 'react';
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
            <Select style={{ width: '180px' }} placeholder="请选择" value={4}>
                {options.map(option => (
                    <Select.Option value={option} key={option}>
                        {option}
                    </Select.Option>
                ))}
            </Select>
            <br />
            <br />
            <Button onClick={add}>changeOptions Dynamic</Button>
        </>
    );
};
```

### 联动

使用受控 value，实现不同 Select 之间的联动。如果是带有层级关系的复杂联动建议直接使用`Cascader`组件

```jsx live=true hideInDSM
import React from 'react';
import { Select } from '@douyinfe/semi-ui';

class Link extends React.Component {
    get provinces() {
        return ['四川', '广东'];
    }
    get maps() {
        return {
            四川: ['成都', '都江堰'],
            广东: ['广州', '深圳', '东莞'],
        };
    }
    constructor() {
        super();
        this.state = {
            provinces: this.provinces,
            maps: this.maps,
            citys: this.maps[this.provinces[0]],
            city: this.maps[this.provinces[0]][0],
        };
        this.provinceChange = this.provinceChange.bind(this);
        this.cityChange = this.cityChange.bind(this);
    }

    provinceChange(newProvince) {
        const { maps } = this.state;
        this.setState({ citys: maps[newProvince], city: maps[newProvince][0] });
    }
    cityChange(city) {
        this.setState({ city });
    }
    render() {
        const { provinces, citys, city } = this.state;
        return (
            <React.Fragment>
                <Select
                    style={{ width: '150px', margin: '10px' }}
                    onChange={this.provinceChange}
                    defaultValue={provinces[0]}
                >
                    {provinces.map(pro => (
                        <Select.Option value={pro} key={pro}>
                            {pro}
                        </Select.Option>
                    ))}
                </Select>
                <Select style={{ width: '150px', margin: '10px' }} value={city} onChange={this.cityChange}>
                    {citys.map(c => (
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

### 开启搜索

将 `filter` 置为 true，开启搜索能力。默认搜索策略将为 input 输入值与 option 的 label 值进行 include 对比  
默认情况下，多选选中后会自动清空搜索关键字。若你希望保留，可以通过 autoClearSearchValue 设为 false 关闭默认行为（v2.3 后提供）

```jsx live=true hideInDSM
import React from 'react';
import { Select } from '@douyinfe/semi-ui';

() => (
    <>
        <Select filter style={{ width: 180 }} placeholder="带搜索功能的单选">
            <Select.Option value="douyin">抖音</Select.Option>
            <Select.Option value="ulikecam">轻颜相机</Select.Option>
            <Select.Option value="jianying">剪映</Select.Option>
            <Select.Option value="xigua">西瓜视频</Select.Option>
        </Select>
        <br />
        <br />
        <Select filter multiple style={{ width: 300 }} placeholder="带搜索功能的多选" autoClearSearchValue={false}>
            <Select.Option value="semi-0">Semi-0</Select.Option>
            <Select.Option value="semi-1">Semi-1</Select.Option>
            <Select.Option value="semi-2">Semi-2</Select.Option>
            <Select.Option value="semi-3">Semi-3</Select.Option>
            <Select.Option value="semi-4">Semi-4</Select.Option>
        </Select>
    </>
);
```

### 搜索框位置
默认搜索框展示于 Select 的 Trigger 触发器上。通过 `searchPosition` 可以指定不同的位置，可选 `dropdown`、`trigger`。 在 v2.61.0后提供
若希望定制位于 dropdown 中的 Input 搜索框的 placeholder，可以通过 `searchPlaceholder` 控制  
若 `searchPosition` 值为 `trigger`，当showClear=true 时，点击Trigger区域的清空按钮，将同时清空已选项以及搜索框中的文本  
若 `searchPosition` 值为 `dropdown`，当showClear=true 时，点击Trigger区域清空按钮，仅清空已选项。点击搜索框中的清空按钮，仅清空搜索文本  

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
            placeholder='我的搜索框在下拉菜单中'
            searchPlaceholder="带搜索功能的单选"
        >
            <Select.Option value="douyin">抖音</Select.Option>
            <Select.Option value="ulikecam">轻颜相机</Select.Option>
            <Select.Option value="jianying">剪映</Select.Option>
            <Select.Option value="xigua">西瓜视频</Select.Option>
        </Select>
        <br />
        <br />
        <Select
            filter
            searchPosition='dropdown'
            multiple
            style={{ width: 300 }}
            defaultValue={['semi-1']}
            placeholder='我的搜索框在下拉菜单中'
            searchPlaceholder="带搜索功能的多选"
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

### 远程搜索

带有远程搜索，防抖请求，加载状态的多选示例  
通过`filter`开启搜索能力  
将`remote`设置为 true 关闭对当前数据的筛选过滤
通过动态更新`optionList`更新下拉菜单中的备选项  
使用受控的 value 属性

```jsx live=true
import React from 'react';
import { debounce } from 'lodash-es';
import { Select } from '@douyinfe/semi-ui';

() => {
    const [loading, setLoading] = useState(false);
    const optionList = [
        { value: 'douyin', label: '抖音', type: 1 },
        { value: 'xingtu', label: '醒图', type: 2 },
        { value: 'jianying', label: '剪映', type: 3 },
        { value: 'toutiao', label: '今日头条', type: 4 },
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
                return { value: inputValue + i, label: `相近业务 ${inputValue}${i}`, type: i + 1 };
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

### 自定义搜索逻辑

可以将 `filter` 置为自定义函数，定制你想要的搜索策略  
如下例子，选项 label 值都是大写，默认的检索策略是字符串 include 对比，会区分大小写。  
通过传入自定义 `filter` 函数，检索时输入小写字母也能搜到相应内容。

```jsx live=true hideInDSM
import React from 'react';
import { Select } from '@douyinfe/semi-ui';

() => {
    function searchLabel(sugInput, option) {
        let label = option.label.toUpperCase();
        let sug = sugInput.toUpperCase();
        return label.includes(sug);
    }
    return (
        <Select filter={searchLabel} style={{ width: '180px' }} placeholder="try douyin">
            <Select.Option value="douyin">douyin</Select.Option>
            <Select.Option value="ulikecam">HOTSOON</Select.Option>
            <Select.Option value="jianying">PIPIXIA</Select.Option>
            <Select.Option value="xigua">XIGUA</Select.Option>
        </Select>
    );
};
```

### 自定义已选项标签渲染

默认情况下，选中选项后会将 option.label 或 option.children 的内容回填到选择框中  
但你可以通过 `renderSelectedItem` 自定义选择框中已选项标签的渲染结构

-   单选时 `renderSelectedItem(optionNode:object) => content:ReactNode`
-   多选时 `renderSelectedItem(optionNode:object, { index:number, onClose:function }) => { isRenderInTag:bool, content:ReactNode }`
    -   isRenderInTag 为 true 时，会自动将 content 包裹在 Tag 中渲染（带有背景色以及关闭按钮）
    -   isRenderInTag 为 false 时，将直接渲染返回的 content

```jsx live=true
import React from 'react';
import { Select, Avatar, Tag } from '@douyinfe/semi-ui';

() => {
    const list = [
        {
            name: '夏可漫',
            email: 'xiakeman@example.com',
            avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/dy.png',
        },
        {
            name: '申悦',
            email: 'shenyue@example.com',
            avatar:
                'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/bag.jpeg',
        },
        {
            name: '曲晨一',
            email: 'quchenyi@example.com',
            avatar:
                'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/Viamaker.png',
        },
        {
            name: '文嘉茂',
            email: 'wenjiamao@example.com',
            avatar:
                'https://sf6-cdn-tos.douyinstatic.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/6fbafc2d-e3e6-4cff-a1e2-17709c680624.png',
        },
    ];

    const renderSelectedItem = optionNode => (
        <div style={{ display: 'flex', alignItems: 'center' }}>
            <Avatar src={optionNode.avatar} size="small">
                {optionNode.abbr}
            </Avatar>
            <span style={{ marginLeft: 8 }}>{optionNode.email}</span>
        </div>
    );

    // avatarSrc & avatarShape are supported after 1.6.0-beta
    const renderMultipleWithCustomTag = (optionNode, { onClose }) => {
        const content = (
            <Tag avatarSrc={optionNode.avatar} avatarShape="circle" closable={true} onClose={onClose} size="large">
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
            <Tag avatarSrc={optionNode.avatar} avatarShape="square" closable={true} onClose={onClose} size="large">
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
                placeholder="请选择"
                style={{ width: 280, height: 40 }}
                onChange={v => console.log(v)}
                defaultValue={'申悦'}
                renderSelectedItem={renderSelectedItem}
            >
                {list.map((item, index) => renderCustomOption(item, index))}
            </Select>
            <Select
                placeholder="请选择"
                maxTagCount={2}
                style={{ width: 280, marginTop: 20 }}
                onChange={v => console.log(v)}
                defaultValue={['申悦', '曲晨一']}
                multiple
                renderSelectedItem={renderMultipleWithCustomTag}
            >
                {list.map((item, index) => renderCustomOption(item, index))}
            </Select>
            <Select
                placeholder="请选择"
                maxTagCount={2}
                style={{ width: 280, marginTop: 20 }}
                onChange={v => console.log(v)}
                defaultValue={['申悦', '曲晨一']}
                multiple
                renderSelectedItem={renderMultipleWithCustomTag2}
            >
                {list.map((item, index) => renderCustomOption(item, index))}
            </Select>
        </>
    );
};
```

### 自定义弹出层样式

你可以通过 dropdownClassName、dropdownStyle 控制弹出层的样式  
例如当自定义弹出层的宽度时，可以通过 dropdownStyle 传入 width

```jsx live=true hideInDSM
import React from 'react';
import { Select } from '@douyinfe/semi-ui';

() => (
    <Select
        placeholder="自定义弹出层样式的"
        style={{ width: 180 }}
        dropdownStyle={{ width: 250 }}
        dropdownClassName="test"
    >
        <Select.Option value="douyin">抖音</Select.Option>
        <Select.Option value="ulikecam">轻颜相机</Select.Option>
        <Select.Option value="jianying">剪映</Select.Option>
        <Select.Option value="xigua">西瓜视频</Select.Option>
    </Select>
);
```

### 获取选项的其他属性

默认情况下`onChange`只能拿到 value，如果需要拿选中节点的其他属性，可以使用`onChangeWithObject`属性  
此时`onChange`函数的入参将会是 object，包含 option 的各种属性，例如 `onChange({ value, label, ...rest })`

<Notice title='注意'>
  当 onChangeWithObject 置为 true 时，`defaultValue`/`Value`也应为 object，且须带有`value`、`label` key
</Notice>

```jsx live=true hideInDSM
import React from 'react';
import { Select, TextArea } from '@douyinfe/semi-ui';

() => {
    const list = [
        { value: 'douyin', label: '抖音', type: 1 },
        { value: 'ulikecam', label: '轻颜相机', type: 2 },
        { value: 'jianying', label: '剪映', type: 3 },
        { value: 'toutiao', label: '今日头条', type: 4 },
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
                    placeholder="单选"
                    defaultValue={list[0]}
                    onChange={onChange}
                ></Select>
                <h4>onChange回调:</h4>
                <TextArea style={{ width: 320, marginBottom: 48 }} autosize value={JSON.stringify(cbValue)} rows={2} />
            </div>
            <div>
                <Select
                    style={{ width: 320 }}
                    onChangeWithObject
                    multiple
                    optionList={list}
                    onChange={onMultipleChange}
                    placeholder="多选"
                ></Select>
                <h4>onChange回调:</h4>
                <TextArea style={{ width: 320 }} autosize value={JSON.stringify(multipleCbValue)} />
            </div>
        </div>
    );
};
```

### 创建条目

设置`allowCreate`，可以创建并选中选项中不存在的条目  
允许通过 `renderCreateItem` 自定义创建标签时的内容显示（通过返回 ReactNode，注意你需要自定义样式），该函数默认值为 (input, isFocus, style) => '创建' + input  
可以配合`defaultActiveFirstOption`属性使用，自动选中第一项，当输入完内容直接回车时，可立即创建

<Notice title='注意'>
  当开启allowCreate后，不会再响应对Children或者optionList的更新
</Notice>

```jsx live=true
import React from 'react';
import { Select } from '@douyinfe/semi-ui';

() => {
    const optionList = [
        { value: 'douyin', label: '抖音' },
        { value: 'ulikecam', label: '轻颜相机' },
        { value: 'jianying', label: '剪映' },
        { value: 'toutiao', label: '今日头条' },
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
                placeholder="With renderCreateItem"
                renderCreateItem={(input, isFocus, style) => (<div style={{ padding: 10, ...style }}>Create Item：{input}</div>)}
                onChange={v => console.log(v)}
                defaultActiveFirstOption
            ></Select>
        </>
    );
};
```

### 虚拟化

传入`virtualize`时开启列表虚拟化，用于大量 Option 节点的情况优化性能  
virtualize 是一个包含下列值的对象：

-   height: Option 列表高度值，默认 270 (v2.20.8 前为 300)
-   width: Option 列表宽度值，默认 100%
-   itemSize: 每行 Option 的高度，必传

<Notice title='注意事项'>
    Semi Select virtualize 功能是基于 react-window 的封装，虚拟化列表默认会被包裹在 `will-change: transform` 的 div 内部。
    在某些浏览器（例如 Chrome），某些特定的屏幕尺寸下，屏幕物理像素尺寸与浏览器处理的像素无法对齐时，会自动开启抗锯齿。从而导致虚拟列表中的文本字体可能会在特定场景下存在模糊的情况。
    will-change 对于复杂元素的渲染会有性能改善，所以我们默认不会对 react-window的样式进行覆盖。如果你希望关闭这个效果，可以通过自行覆盖 CSS，将 will-change 设置为 unset 解决
</Notice>

```css
.semi-select-option-list > div {
    will-change: unset !important; // 由于 react-window自带样式是内联的，所以这里用 important 覆盖
}
```

```jsx live=true hideInDSM
import React from 'react';
import { Select } from '@douyinfe/semi-ui';

() => {
    const newOptions = Array.from({ length: 3000 }, (v, i) => ({ label: `option-${i}`, value: i }));
    let virtualize = {
        height: 270,
        width: '100%',
        itemSize: 36, // px
    };
    return (
        <Select
            placeholder="拥有3k个Option的Select"
            style={{ width: 260 }}
            filter
            virtualize={virtualize}
            optionList={newOptions}
        ></Select>
    );
};
```

### 自定义触发器

如果 Select 默认的触发器样式满足不了你的需求，可以用`triggerRender`自定义选择框的展示  
如果想保留搜索筛选能力，又不希望自己渲染 Input 相关的结构，可以同时通过 searchPosition='dropdown'，将默认的搜索框置于下拉列表中

triggerRender 入参如下

```typescript
interface TriggerRenderProps {
  value: array<object> // 当前所有已选中的options
  inputValue: string; // 当前input框的输入值
  onSearch: (inputValue: string) => void; // 用于更新 input框值的函数，当你在triggerRender自定义的Input组件值更新时你应该调用该函数，用于向Select内部同步状态。注意 filter 需同时设为true, v2.32 提供
  onRemove: (option: object) => void; // 用于移除单个已选项，option至少需带有 label、value 两项，v2.32提供
  onClear: () => void; // 用于清空值的函数
  disabled: boolean; // 是否禁用Select
  placeholder: string; // Select的placeholder
  componentProps: object // 所有用户传给Select的props
}
```

```jsx live=true
import React, { useState } from 'react';
import { Select, Tag } from '@douyinfe/semi-ui';
import { IconAppCenter, IconChevronDown } from '@douyinfe/semi-icons';

() => {
    const [valList, setValList] = useState(['douyin', 'ulikecam']);
    const list = [
        { value: 'douyin', label: '抖音' },
        { value: 'ulikecam', label: '轻颜相机' },
        { value: 'jianying', label: '剪映' },
        { value: 'toutiao', label: '今日头条' },
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
                    业务线
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
            <h4>不同背景色的触发器</h4>
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
            <h4>使用 circle Tag 作为触发器</h4>
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

下例是更复杂的例子：复用了 TagInput 拖拽排序能力，通过 triggerRender 为 Select 增加排序

```jsx live=true
import React, { useState } from 'react';
import { Select, TagInput } from '@douyinfe/semi-ui';

() => {
    const [valList, setValList] = useState(['douyin', 'ulikecam']);
    const [inputVal, setInputVal] = useState('');
    const list = [
        { value: 'douyin', label: '抖音' },
        { value: 'ulikecam', label: '轻颜相机' },
        { value: 'jianying', label: '剪映' },
        { value: 'toutiao', label: '今日头条' },
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
            <h4>可对已选项拖拽重新排序的 Select </h4>
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

### 自定义候选项渲染

-   简单的自定义：通过 Option 的 label 属性或者 children 传入 ReactNode，你可以控制候选项的渲染，此时内容会自动带上内边距、背景色等样式
-   完全自定义：通过传入`renderOptionItem`，你可以完全接管列表中候选项的渲染，并且从回调入参中，获取到相关的状态值。实现更高自由度的结构渲染  
    注意事项：
    1. props 传入的 style 需在 wrapper dom 上进行消费，否则在虚拟化场景下会无法正常使用
    2. props 传入的 className、onMouseEnter 需在 wrapper dom 上进行消费，否则上下键盘操作时显示会有问题
    3. 选中(selected)、聚焦(focused)、禁用(disabled)等状态的样式需自行加上，你可以从 props 中获取到相对的 boolean 值
    4. 如果你的自定义 item 为 Select.Option，需要将 renderProps.onClick 透传给 Option 的 onSelect prop

```jsx live=true
import React from 'react';
import { Select, Checkbox, Highlight } from '@douyinfe/semi-ui';

() => {
    const [inputValue, setInputValue] = useState('');
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
            className
        });
        const searchWords = [inputValue];

        // Notice：
        // 1.props传入的style需在wrapper dom上进行消费，否则在虚拟化场景下会无法正常使用
        // 2.选中(selected)、聚焦(focused)、禁用(disabled)等状态的样式需自行加上，你可以从props中获取到相对的boolean值
        // 3.onMouseEnter、className需在wrapper dom上绑定，否则上下键盘操作时显示会有问题
        
        return (
            <div style={style} className={optionCls} onClick={() => onClick()} onMouseEnter={e => onMouseEnter()}>
                <Checkbox checked={selected} />
                <div className="option-right">
                    <Highlight sourceString={label} searchWords={searchWords} />
                </div>
            </div>
        );
    };

    const optionList = [
        { value: 'douyin', label: '抖音', otherKey: 0 },
        { value: 'ulikecam', label: '轻颜相机', disabled: true, otherKey: 1 },
        { value: 'jianying', label: '剪映', otherKey: 2 },
        { value: 'toutiao', label: '今日头条', otherKey: 3 },
    ];

    return (
        <>
            <Select
                filter
                placeholder="单选"
                onSearch={(v) => setInputValue(v)}
                dropdownClassName="components-select-demo-renderOptionItem"
                optionList={optionList}
                style={{ width: 180 }}
                renderOptionItem={renderOptionItem}
            />
            <br />
            <br />
            <Select
                filter
                placeholder="多选"
                multiple
                onSearch={(v) => setInputValue(v)}
                dropdownClassName="components-select-demo-renderOptionItem"
                optionList={optionList}
                style={{ width: 320 }}
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

## API 参考

### Select Props

| 属性 | 说明                                                                                                                                    | 类型 | 默认值 | 版本 |
| --- |---------------------------------------------------------------------------------------------------------------------------------------| --- | --- | --- |
| allowCreate | 是否允许用户创建新条目，需配合 filter 使用。该项为true时不再响应 optionList的变更                                                                                  | boolean | false |
| arrowIcon | 自定义右侧下拉箭头 Icon，当 showClear 开关打开且当前有选中值时，hover 会优先显示 clear icon                                                                        | ReactNode |  |  |
| autoAdjustOverflow | 浮层被遮挡时是否自动调整方向（暂时仅支持竖直方向，且插入的父级为 body）                                                                                                | boolean | true |
| autoClearSearchValue | 选中选项后，是否自动清空搜索关键字，当 mutilple、filter 都开启时生效                                                                                            | boolean | true | 2.3.0 |
| autoFocus | 初始渲染时是否自动 focus                                                                                                                       | boolean | false |
| borderless        | 无边框模式  >=2.33.0                                                                                                                       | boolean                         |           |
| className | 类名                                                                                                                                    | string |  |
| clearIcon | 可用于自定义清除按钮, showClear为true时有效                                                                                                         | ReactNode |   | 2.25.0
| clickToHide | 已展开时，点击选择框是否自动收起下拉列表                                                                                                                  | boolean | false |
| defaultValue | 初始选中的值                                                                                                                                | string\|number\|array |  |
| defaultOpen | 是否默认展开下拉列表                                                                                                                            | boolean | false |
| disabled | 是否禁用                                                                                                                                  | boolean | false |
| defaultActiveFirstOption | 是否默认高亮第一个选项（按回车可直接选中） <br/>**v2.17.0 之后默认值从 false 变为 true**                                                                           | boolean | true |
| dropdownClassName | 弹出层的 className                                                                                                                        | string |  |
| dropdownMatchSelectWidth | 下拉菜单最小宽度是否等于 Select                                                                                                                   | boolean | true |
| dropdownStyle | 弹出层的样式                                                                                                                                | object |  |
| dropdownMargin | 弹出层计算溢出时的增加的冗余值，详见[issue#549](https://github.com/DouyinFE/semi-design/issues/549)，作用同 Tooltip margin                                  | object\|number |  | 2.25.0 |
| emptyContent | 无结果时展示的内容。设为 null 时，下拉列表将不展示                                                                                                          | string\|ReactNode |  |
| ellipsisTrigger | 当 maxTagCount 存在且为多选时，是否对溢出部分的 tag 做自适应处理(当宽度不足时，最后一个tag内容作截断处理)。开启该功能后会有一定性能损耗，不推荐在大表单场景下使用                                          | boolean   | false       | 2.28.0 | 
| expandRestTagsOnClick | 当maxTagCount存在且为多选时，select 在面板打开状态下是否展开多余的 Tag                                                                                        | boolean   | false       | 2.28.0 | 
| filter | 是否可搜索，默认为 false。传入 true 时，代表开启搜索并采用默认过滤策略（label 是否与 sugInput 匹配），传入值为函数时，会接收 sugInput, option 两个参数，当 option 符合筛选条件应返回 true，否则返回 false | boolean \|function(sugInput, option) | false |
| getPopupContainer | 指定父级 DOM，弹层将会渲染至该 DOM 中，自定义需要设置 `position: relative` 这会改变浮层 DOM 树位置，但不会改变视图渲染位置。                                                      | function():HTMLElement | () => document.body |
| inputProps | filter 为 true 时, input 输入框的额外配置参数，具体可配置属性请参考 Input 组件（注意：请不要传入 value、ref、onChange、onFocus，否则会覆盖 Select 相关回调，影响组件行为）                   | object |  | 2.2.0 |
| innerTopSlot | 渲染在弹出层顶部，在 optionList 内部的自定义 slot                                                                                                     | ReactNode |  |
| innerBottomSlot | 渲染在弹出层底部，在 optionList 内部的自定义 slot                                                                                                     | ReactNode |  |
| loading | 下拉列表是否展示加载动画                                                                                                                          | boolean | false |
| maxTagCount | 多选模式下，已选项超出 maxTagCount 时，后续选项会被渲染成+N 的形式                                                                                             | number |  |
| max | 最多可选几项，仅在多选模式下生效                                                                                                                      | number |  |
| maxHeight | 下拉菜单中 `optionList` 的最大高度                                                                                                              | string\|number | 270 |
| multiple | 是否多选                                                                                                                                  | boolean | false |
| outerTopSlot | 渲染在弹出层顶部，与 optionList 平级的自定义 slot                                                                                                     | ReactNode |  |
| outerBottomSlot | 渲染在弹出层底部，与 optionList 平级的自定义 slot                                                                                                     | ReactNode |  |
| optionList | 可以通过该属性传入 Option,请确保数组内每个元素都具备 label、value 属性                                                                                         | array(\[{value, label}\]) |  |
| placeholder | 选择框默认文字                                                                                                                               | ReactNode |  |
| position | 菜单展开的位置，可选项同 Tooltip position                                                                                                         | string | 'bottomLeft' |
| prefix | 选择框的前缀标签                                                                                                                              | ReactNode |  |
| preventScroll | 指示浏览器是否应滚动文档以显示新聚焦的元素，作用于组件内的 focus 方法                                                                                                | boolean |  |  |
| renderCreateItem | allowCreate 为 true 时，可自定义创建标签的渲染。与虚拟化结合使用时，必须将第三个参数style传入自定义DOM中消费(v2.44.1后提供)                                                                                                | function(inputValue:string, isFocus: boolean, style: object) | inputValue => '创建' + inputValue |
| renderSelectedItem | 通过 renderSelectedItem 自定义选择框中已选项标签的渲染                                                                                                 | function(option) |  |
| renderOptionItem | 通过 renderOptionItem 完全自定义下拉列表中候选项的渲染                                                                                                  | function(props) 入参详见 Demo |  |
| restTagsPopoverProps | Popover 的配置属性，可以控制 position、zIndex、trigger 等，具体参考[Popover](/zh-CN/show/popover#API%20%E5%8F%82%E8%80%83)                              | PopoverProps | {} | 2.22.0 |
| remote | 是否开启远程搜索，当 remote 为 true 时，input 内容改变后不会进行本地筛选匹配                                                                                      | boolean | false |
| searchPosition | filter开启时，搜索框的位置，默认在 trigger中，可以通过设为 'dropdown' 将搜索框置于下拉列表顶部。搭配 triggerRender 使用可以实现更高自由度的交互   | string | 'trigger' | 2.61.0
| size | 大小，可选值 `default`/`small`/`large`                                                                                                      | string | 'default' |
| style | 样式                                                                                                                                    | object |  |
| stopPropagation | 是否阻止浮层上的点击事件冒泡                                                                                                                        | boolean | true |  |
| suffix | 选择框的后缀标签                                                                                                                              | ReactNode |  |
| showClear | 是否展示清除按钮                                                                                                                              | boolean | false |
| showArrow | 是否展示下拉箭头                                                                                                                              | boolean | true |
| showRestTagsPopover | 当超过 maxTagCount，hover 到 +N 时，是否通过 Popover 显示剩余内容                                                                                      | boolean | false | 2.22.0 |
| spacing | 浮层与选择器的距离                                                                                                                             | number | 4 |
| triggerRender | 自定义触发器渲染                                                                                                                              | function |  |
| value | 当前选中的的值,传入该值时将作为受控组件，配合 `onChange` 使用                                                                                                 | string\|number\|array |  |
| validateStatus | 校验结果，可选`warning`、`error`、 `default`（只影响样式背景色）                                                                                         | string | 'default' |
| virtualize | 列表虚拟化，用于大量节点的情况优化性能表现，由 height, width, itemSize 组成                                                                                    | object |  |
| zIndex | 弹层的 zIndex                                                                                                                            | number | 1030 |
| onBlur | 失去焦点时的回调                                                                                                                              | function(event) |  |
| onChange | 变化时回调函数                                                                                                                               | function(value:string\|number\|array) |  |
| onCreate | allowCreate 为 true，创建备选项时的回调                                                                                                          | function(option) |  |
| onClear | 清除按钮的回调                                                                                                                               | function |  |
| onChangeWithObject | 是否将选中项 option 的其他属性作为回调。设为 true 时，onChange 的入参类型会从 string 变为 object: { value, label, ...rest }                                        | boolean | false |
| onDropdownVisibleChange | 下拉菜单展开/收起时的回调                                                                                                                         | function(visible:boolean) |  |
| onListScroll | 候选项列表滚动时的回调                                                                                                                           | function(e) |  |
| onSearch | input 输入框内容发生改变时回调函数，第二个参数于 v2.31 后提供                                                                                                 | function(sugInput:string, e: ReactEvent) |  |
| onSelect | 被选中时的回调                                                                                                                               | function(value, option) |  |
| onDeselect | 取消选中时的回调，仅在多选时有效                                                                                                                      | function(value, option) |  |
| onExceed | 当试图选择数超出 max 限制时的回调，仅在多选时生效 <br/> 入参在 v1.16.0 后提供                                                                                     | function(option) |  |
| onFocus | 获得焦点时的回调                                                                                                                              | function(event) |  |

### Option Props

---

> **不同 Option 的 label 必须唯一，不允许重复**

| 属性      | 说明                                                               | 类型              | 默认值 |
| --------- | ------------------------------------------------------------------ | ----------------- | ------ |
| className | 样式类名                                                           | string            |        |
| disabled  | 是否禁用                                                           | boolean           | false  |
| label     | 展示的文本。渲染时优先取 label，若无则取 children、value，依次降级 | string\|ReactNode |        |
| showTick  | 被选中时，展示 √ 的 Icon                                           | boolean           | true   |
| style     | 样式                                                               | object            |        |
| value     | 属性值                                                             | string\|number    |        |

### OptGroup Props

---

| 属性      | 说明       | 类型      | 
| --------- | ---------- | --------- | 
| className | 样式类名   | string    | 
| label     | 展示的文本 | ReactNode |
| style     | 样式       | object    |

## Methods

绑定在组件实例上的方法，可以通过 ref 调用实现某些特殊交互

| 方法        | 说明                                | 版本    |
| ----------- | ----------------------------------- | ------- |
| close       | 调用时可以手动关闭下拉列表          |  |
| open        | 调用时可以手动展开下拉列表          |  |
| focus       | 调用时可以手动聚焦                  |  |
| clearInput  | 调用时可以手动清空 input 搜索框的值 | |
| deselectAll | 调用时可以手动清空所有已选项        |  |
| selectAll   | 调用时可以选中所有 Option           |  |
| search(value: string, event: event)| 可通过 ref 调用该方法进行搜索，该搜索值会被置给 Input   | v2.35.0 |

## Accessibility

### ARIA

-   Select trigger 的 role 为 combobox，弹出层的 role 为 listbox，可选项的 role 为 option
-   Select trigger 具有 aria-haspopup、aria-expanded、aria-controls 属性，表示 trigger 与弹出层的关系
-   多选时，listbox aria-multiselectable 为 true，表示当前可以多选
-   Option 选中时，aria-selected 为 true；当 Option 禁用时，aria-disabled 为 true
-   属性 aria-activedescendant 能够保证在朗读旁白时识别到当前的选择的 option(更多用法请参考[Managing Focus in Composites Using aria-activedescendant](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/#kbd_focus_activedescendant))

### 键盘和焦点

**不带 Filter 功能的 Select：**

-   Select 聚焦后，键盘用户可以通过 `上箭头` 或 `下箭头` 或 `Enter` 键打开下拉菜单，并将焦点自动聚焦到下拉菜单中的第一个选项上（`defaultActiveFirstOption` 默认为 true）
-   当下拉菜单打开时：
    -   使用 `Esc` 键或 `Tab` 键可以关闭菜单
    -   使用 `上箭头` 或 `下箭头` 可以切换选项
    -   被聚焦的选项可以通过 Enter 键选中，并收起面板
-   当焦点在下拉菜单中，且用户使用的 `innerBottomSlot` 或 `outerBottomSlot` 属性的自定义 slot 中含有可交互元素时：
    -   可以使用 `Tab` 键切换到这些可交互元素上
    -   当焦点在自定义 slot 的首个可交互元素上时，使用 `Shift` + `Tab` ，焦点回到 Select 框上

**带 Filter 功能的 Select：**

-   Select 聚焦后，键盘用户可以通过 `上箭头` 或 `下箭头` 或 `Enter` 键打开下拉菜单。此时焦点仍然处于 Select 框，用户可以输入内容，同时也能使用 `上箭头` 或 `下箭头` 切换选项
-   当下拉菜单打开时：键盘交互与不带 Filter 功能的 Select 一致
-   当焦点在 Select 框上，且用户使用的 `innerBottomSlot` 或 `outerBottomSlot` 属性的自定义 slot 中含有可交互元素时：
    -   可以使用 `Tab` 键切换到这些可交互元素上
    -   当焦点在自定义 slot 的首个可交互元素上时，使用 `Shift` + `Tab` ，焦点回到 Select 框上

## 文案规范

-   选择器标签
    -   用 1-3 个词描述需要用户所做的输入
    -   使用语句书写规范（首字母大写，其余小写）
    -   避免使用标点符号和介词（“the”, “an”, “a”）
    -   标签需是独立语句。不要让标签是前半句语句，选项是后半句语句。
    -   使用描述性语句，而不是指示性语句。如果选项需要更多解释，可以在选择框下使用帮助文本。
-   选择器选项
    -   如果没有默认选项，就使用“Select”做占位文案
    -   选项要按首字母顺序或者其他有逻辑的排列顺序，使用户更好地找到选项
    -   使用语句书写规范（首字母大写，其余小写），避免在句尾使用逗号和分号
    -   清晰表达出选项所表示的选择目的

## 设计变量

<DesignToken/>

## FAQ

-   **为什么 Semi 的 Select 要求 label 必须唯一，而不是 value 必须唯一?**

    -   首先，我们一定需要一个唯一标识符用来做选中的判断。几乎所有 UI 库，对 Select.Option 使用时，最低要求都只会要求传入 label、value 两个值，而不会再单独要求传入一个 key（过于繁琐）。Semi 延续了这个设定
    -   那么为什么在 Semi 中 用 label 而不是 value 呢？
        -   以 value 还是 label 作为唯一判断符，**本质上是 用户直觉 vs 研发直觉 的取舍**。以 value 为唯一判断比较符合工程师直觉，但站在用户视角来看，他们能看到的只有 label，对 value 基本上是无感知的。
        -   label 是用户唯一能感知的内容。从交互的角度而言，如果出现两个或多个展示上一模一样的选项，对用户而言，他们看上去是一样的，无法进行区分。用户第一反应往往是重复了，这个系统是不是出 bug 了。其次如果两个 option 展示上一模一样，但选中的作用又不一样（例如一个 value 为 0，另一个为 1，他们的处理逻辑完全不同）的话，也会让用户非常困惑。在现实生活的线下实体表单里，基本不可能出现两个一模一样的选项。
        -   假如我们以 value 作为判断符，以下例子，用户点击了 A 进行选中，实际上却看到 A、B、C 都被同时选中了。同样也会非常困惑，第一反应也往往是系统出 bug 了。
            ```
              <Select placeholder='choose your color'>
                  <Option label='A' value='color' />
                  <Option label='B' value='color' />
                  <Option label='C' value='color' />
              </Select>
            ```
        -   label 唯一、value 重复，在日常使用中会更为常见。例如，一个根据 app 名称选择公司 id 的选择器，value 是 app 对应的公司 id，label 是 app 的名称。
            ```
              <Select placeholder='choose company by app'>
                <Option label='vigo' value='bytedance' />
                <Option label='douyin' value='bytedance' />
              </Select>
            ```
    -   分组情况下，重复 label 并不会造成用户困惑为什么仍要求 label 必须唯一？
        -   选择面板打开情况下，确实不会造成用户使用上的困惑，但是选择面板收起后，重复 label 属于哪个分组对用户而言仍具有迷惑性。
    -   我的数据里确实就有多个 label 一样的选项，无法避免。这个交互能绕过吗？
        -   可以。我们不推荐向用户展示重复的 label option，但如果你确定你需要这么做，当你往 label 传入 ReactNode 类型时，可以绕过这个限制。

-   **可搜索的 Select，使用远程数据动态更新`optionList`，为什么在异步请求完成之前有时候会出现暂无数据？**  
     请检查是否设置了`remote={true}`，不设置 remote 的情况下，默认会将 input 框输入值与当前的 optionList 进行一次对比筛选，如果无匹配时，就会显示暂无数据。  
     可以通过设置 remote 为 true 关闭对本地当前数据的匹配筛选。

-   **使用 jsx 方式声明 Option，label 为 i18n 后的内容，切换 locale 后未能重新渲染**

    -   children jsx 方式声明 Options 时，由于是 ReactNode，不可能用 deepEqual 来做对比判断内容是否有更新（性能消耗过大），所以会收集 children ReactNode 的 key，当 key 不变时，就认为 Options 都没有发生变化，不会走重新收集数据的流程。你可以将 locale 也作为 Option key 的一部分。
    -   使用 optionList 方式传入，也可以解决问题。因为对于 object 形式传入，key 相对有限，Select 内部会使用 isEqual 来判断是否发生变化

-   **使用 jsx 方式声明 Option，动态切换 disabled 属性后未能重新渲染**

    -   原因同上，你可以重新给 Option 设定不同的 key 值，或者使用 optionList 方式声明候选项

-   **Select 会自动限制下拉菜单的宽度吗？**

    -   会给 minWidth，但不会写死 width。如果有需要的话，可以自己通过 dropdownStyle 来添加。

-   **设置 allowCreate 后，动态更新 optionList 或者 children 不生效**
    -   allowCreate 主要用于本地创建的场景，开启该项后，相当于强接管了 optionList / children，不会再响应外部对这两类值的更新。
-   **为什么单选选择选项后没有触发 blur 事件？**
    -   在 V2.17.0 前，Select 单选选择后，会触发 Select 的 blur 事件。
    -   在 V2.17.0 后，Select 增加了 A11y 支持，不会触发 Select 的 blur 事件。
        -   单选选择中，Select 浮层关闭，依然保持焦点在 trigger（此时可以通过 Enter 回车键再次打开 Select 浮层）
        -   无论单选或多选，按下 Esc，仅 Select 浮层关闭，trigger 保持焦点（此时可以通过 Enter 回车键再次打开 Select 浮层）

<!-- ## 相关物料

```material
3,4,44,54,58,62,72
``` -->
## 相关物料
<semi-material-list code="3, 4, 58, 62, 696"></semi-material-list>
