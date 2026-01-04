---
localeCode: zh-CN
order: 36
category: 输入类
title: Checkbox 复选框
icon: doc-checkbox
brief: 复选框允许用户选中多个选项
---


## 使用场景

- 勾选框可以让用户在两种相反的状态、行为或取值之间选择;
- 适用于在列表中选择单个或多个选项，开启或关闭某个选项

## 代码演示

### 如何引入

```jsx import
import { Checkbox, CheckboxGroup } from '@douyinfe/semi-ui';
```

### 基本用法

Checkbox单个使用，可以通过`defaultChecked`、`checked`属性控制是否勾选。  
当传入`checked`时，为受控使用。  

```jsx live=true
import React from 'react';
import { Checkbox } from '@douyinfe/semi-ui';

() => (
    <Checkbox onChange={e => console.log(e)} aria-label="Checkbox 示例">Semi Design</Checkbox>
);
```

```jsx live=true
import React from 'react';
import { Checkbox } from '@douyinfe/semi-ui';

() => (
    <Checkbox defaultChecked onChange={e => console.log(e)} aria-label="Checkbox 示例">Semi Design</Checkbox>
);
```

带辅助文本的checkbox。通过`extra`传入辅助文本。辅助文本会更长一些，甚至还可能换行。

```jsx live=true
import React from 'react';
import { Checkbox } from '@douyinfe/semi-ui';

() => (
    <>
        <Checkbox aria-label="Checkbox 示例" extra='Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统'>
            Semi Design
        </Checkbox>
        <br/>
        <Checkbox aria-label="Checkbox 示例" extra='Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统' style={{ width: 400 }}>
            Semi Design
        </Checkbox>
    </>
);
```

### 禁用

通过设置 `disabled` 属性，禁用 Checkbox

```jsx live=true
import React from 'react';
import { Checkbox } from '@douyinfe/semi-ui';

() => (
    <div>
        <Checkbox defaultChecked={false} disabled aria-label="Checkbox 示例">Unchecked Disabled</Checkbox>
        <br />
        <Checkbox defaultChecked disabled aria-label="Checkbox 示例">Checked Disabled</Checkbox>
    </div>
);
```

### JSX方式声明Checkbox组

通过在CheckboxGroup内部放置 Checkbox元素，可以声明Checkbox组  
使用Checkbox组，你可以更便捷地通过CheckboxGroup的`defaultValue`、`value`属性去控制一组Checkbox的选中与否
此时Checkbox不需要再声明`defaultChecked`、`checked`属性

```jsx live=true
import React from 'react';
import { CheckboxGroup, Checkbox } from '@douyinfe/semi-ui';

() => (
    <CheckboxGroup style={{ width: '100%' }} defaultValue={['A', 'B']} aria-label="CheckboxGroup 示例">
        <Checkbox value="A">A</Checkbox>
        <Checkbox value="B">B</Checkbox>
        <Checkbox value="C">C</Checkbox>
        <Checkbox value="D">D</Checkbox>
        <Checkbox value="E">E</Checkbox>
    </CheckboxGroup>
);
```


### 数组方式声明 Checkbox 组

也可以将数组通过 `options` 属性直接传入 CheckboxGroup，直接生成 Checkbox 组

```jsx live=true
import React from 'react';
import { CheckboxGroup } from '@douyinfe/semi-ui';

() => {
    function onChange(checkedValues) {
        console.log('checked = ', checkedValues);
    }

    const plainOptions = ['抖音', '火山', '皮皮虾'];
    const options = [
        { label: '追求极致', value: '1', extra: '不断提高要求，延迟满足感，在更大范围里找最优解' },
        { label: '务实敢为', value: '2', extra: '直接体验，深入事实；不自嗨，注重效果；能突破有担当，打破定式；尝试多种可能，快速迭代' },
        { label: '开放谦逊', value: '3', extra: '内心阳光，信任伙伴；乐于助人和求助，合作成大事;格局大，上个台阶想问题；对外敏锐谦虚，ego小，听得进意见' },
        { label: '坦诚清晰', value: '4', extra: '敢当面表达真实想法；能承认错误，不装不爱面子；实事求是，暴露问题，反对“向上管理”；准确、简洁、直接，有条理有重点' }
    ];
    const optionsWithDisabled = [
        { label: 'Photography', value: 'Photography' },
        { label: 'Movies', value: 'Movies' },
        { label: 'Running', value: 'Running', disabled: false },
    ];
    return (
        <div>
            <CheckboxGroup options={plainOptions} defaultValue={['抖音']} onChange={onChange} aria-label="CheckboxGroup 示例" />
            <br/><br/>
            <CheckboxGroup options={options} defaultValue={[]} onChange={onChange} aria-label="CheckboxGroup 示例" />
            <br/><br/>
            <CheckboxGroup
                options={optionsWithDisabled}
                disabled
                defaultValue={['Photography']}
                onChange={onChange}
                aria-label="Checkbox 示例"
            />
        </div>
    );
};
```


### 水平排列

通过设置 `direction` 为 `horizontal` 或者 `vertical` 可以调整 CheckboxGroup 内的布局

```jsx live=true
import React from 'react';
import { CheckboxGroup } from '@douyinfe/semi-ui';

() => {
    const options = [
        { label: '抖音', value: 'abc' },
        { label: '火山', value: 'hotsoon' },
        { label: '皮皮虾', value: 'pipixia' },
        { label: '今日头条', value: 'toutiao' }
    ];
    return (
        <CheckboxGroup options={options} direction='horizontal' aria-label="CheckboxGroup 示例" />
    );
};
```


### 受控

联动 checkbox。

```jsx live=true hideInDSM
import React from 'react';
import { Checkbox, Button } from '@douyinfe/semi-ui';

class App extends React.Component {

    constructor() {
        super();
        this.state = {
            checked: true,
            disabled: false,
        };
        this.toggleChecked = this.toggleChecked.bind(this);
        this.toggleDisable = this.toggleDisable.bind(this);
        this.onChange = this.onChange.bind(this);
    }

    toggleChecked () {
        this.setState({ checked: !this.state.checked });
    };

    toggleDisable () {
        this.setState({ disabled: !this.state.disabled });
    };

    onChange (e) {
        console.log('checked = ', e.target.checked);
        this.setState({
            checked: e.target.checked,
        });
    };

    render() {
        const label = `${this.state.checked ? 'Checked' : 'Unchecked'} ${
            this.state.disabled ? 'Disabled' : 'Enabled'
        }`;
        return (
            <div>
                <p style={{ marginBottom: '20px' }}>
                    <Checkbox
                        checked={this.state.checked}
                        disabled={this.state.disabled}
                        onChange={this.onChange}
                        aria-label="Checkbox 示例"
                    >
                        {label}
                    </Checkbox>
                </p>
                <p>
                    <Button type="primary" size="small" onClick={this.toggleChecked}>
                        {!this.state.checked ? 'Check' : 'Uncheck'}
                    </Button>
                    <Button
                        style={{ marginLeft: '10px' }}
                        type="primary"
                        size="small"
                        onClick={this.toggleDisable}
                    >
                        {!this.state.disabled ? 'Disable' : 'Enable'}
                    </Button>
                </p>
            </div>
        );
    }
}

```

### 全选

在实现全选效果时，你可能会用到 `indeterminate` 属性。

```jsx live=true
import React, { useState } from 'react';
import { Checkbox, CheckboxGroup } from '@douyinfe/semi-ui';

() => {
    const plainOptions = ['Photography', 'Movies', 'Running'];
    const [checkedList, setCheckedList] = useState(['Photography', 'Running']);
    const [indeterminate, setIndeterminate] = useState(true);
    const [checkAll, setCheckall] = useState(false);
    const onChange = (checkedList) => {
        setCheckedList(checkedList);
        setIndeterminate(!!checkedList.length && checkedList.length < plainOptions.length);
        setCheckall(checkedList.length === plainOptions.length);
    };
    const onCheckAllChange = (e) => {
        console.log(e);
        setCheckedList(e.target.checked ? plainOptions : []);
        setIndeterminate(false);
        setCheckall(e.target.checked);
    };

    return (
        <div>
            <div style={{ paddingBottom: 8, borderBottom: '1px solid var(--semi-color-border)' }}>
                <Checkbox
                    indeterminate={indeterminate}
                    onChange={onCheckAllChange}
                    checked={checkAll}
                    aria-label="Checkbox 示例"
                >
                    Check all
                </Checkbox>
            </div>
            <CheckboxGroup
                style={{ marginTop: 6 }}
                options={plainOptions}
                value={checkedList}
                onChange={onChange}
                aria-label="CheckboxGroup 示例"
            />
        </div>
    );
};
```

### 卡片样式

version: >=1.30.0

可以给 CheckboxGroup 设置 `type='card'`，实现带有背景的卡片样式。

```jsx live=true dir="column"
import React from 'react';
import { CheckboxGroup, Checkbox } from '@douyinfe/semi-ui';

() => (
    <CheckboxGroup type='card' defaultValue={['1', '3']} direction='vertical' aria-label="CheckboxGroup 示例">
        <Checkbox value={'1'} disabled extra='Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统' style={{ width: 280 }}>
            单选框标题
        </Checkbox>
        <Checkbox value={'2'} disabled extra='Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统' style={{ width: 280 }}>
            单选框标题
        </Checkbox>
        <Checkbox value={'3'} extra='Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统' style={{ width: 280 }}>
            单选框标题
        </Checkbox>
        <Checkbox value={'4'} extra='Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统' style={{ width: 280 }}>
            单选框标题
        </Checkbox>
    </CheckboxGroup>
);
```
### 无 checkbox 的纯卡片样式

version: >=1.30.0

可以给 CheckboxGroup 设置 `type='pureCard'`，实现带有背景且无 checkbox 的纯卡片样式。

```jsx live=true dir="column"
import React from 'react';
import { CheckboxGroup, Checkbox } from '@douyinfe/semi-ui';

() => (
    <CheckboxGroup type='pureCard' defaultValue={['1', '3']} direction='vertical' aria-label="CheckboxGroup 示例">
        <Checkbox value={'1'} disabled extra='Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统' style={{ width: 280 }}>
            单选框标题
        </Checkbox>
        <Checkbox value={'2'} disabled extra='Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统' style={{ width: 280 }}>
            单选框标题
        </Checkbox>
        <Checkbox value={'3'} extra='Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统' style={{ width: 280 }}>
            单选框标题
        </Checkbox>
        <Checkbox value={'4'} extra='Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统' style={{ width: 280 }}>
            单选框标题
        </Checkbox>
    </CheckboxGroup>
);
```

### 配合grid布局

Checkbox.Group 内嵌 Checkbox 并与 Grid 组件一起使用，可以实现灵活的布局。

```jsx live=true hideInDSM
import React from 'react';
import { Checkbox, CheckboxGroup, Row, Col } from '@douyinfe/semi-ui';

() => (
    <CheckboxGroup style={{ width: '100%' }} aria-label="CheckboxGroup 示例">
        <Row>
            <Col span={8}>
                <Checkbox value="A">A</Checkbox>
            </Col>
            <Col span={8}>
                <Checkbox value="B">B</Checkbox>
            </Col>
            <Col span={8}>
                <Checkbox value="C">C</Checkbox>
            </Col>
            <Col span={8}>
                <Checkbox value="D">D</Checkbox>
            </Col>
            <Col span={8}>
                <Checkbox value="E">E</Checkbox>
            </Col>
        </Row>
    </CheckboxGroup>
);
```

## API参考

### Checkbox

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| addonId | addon 节点 id，aria-labelledby 指向这个 id，若无设置会随机生成一个 id <br/>**v2.11.0 后提供**                                 | string            |       |
| aria-label | 定义 Checkbox 的作用 | string | - |
| checked | 指定当前Checkbox是否选中（在Group中使用时无效） | boolean | false |
| type |设置checkbox 的样式类型，可选值为: `default`、`card`、`pureCard`<br/>**v2.18.0 后提供** |string|`default`|
| defaultChecked | 初始是否选中（在Group中使用时无效） | boolean | false |
| disabled | 失效状态 | boolean | false |
| extra | 副文本<br/>__v0.25.0后提供__ | ReactNode | - |
| extraId        | 副文本的 id，aria-describedby 指向这个 id，若无设置会随机生成一个 id <br/>**v2.11.0 后提供**                     | ReactNode         | -      |
| value | 该checkbox在CheckboxGroup中代表的value | any | - |
| indeterminate | 设置 indeterminate 状态，只负责样式控制 | boolean | false |
| preventScroll | 指示浏览器是否应滚动文档以显示新聚焦的元素，作用于组件内的 focus 方法 | boolean |  |  |
| onChange | 变化时回调函数 | function(e:Event) | - |

### Checkbox Group

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| defaultValue | 组内默认选中的选项，会与Checkbox的value值做匹配 | any\[] | \[] |
| direction | 组内checkbox布局，可选水平```horizontal```或```vertical``` | string | `vertical` |
| disabled | 整组失效 | boolean | false |
| name | CheckboxGroup 下所有 `input[type="checkbox"]` 的 `name` 属性 | string | - |
| options | 指定可选项 | any\[] | \[] |
| type |设置所有 checkbox 的样式类型，可选值为: `default`、`card`、`pureCard` <br/>**v1.30.0 后提供**|string|`default`|
| value | 指定选中的选项 | any\[] | \[] |
| onChange | 变化时回调函数 | function(checkedValue) | - |

### 方法

#### Checkbox

| 名称 | 描述 |
| --- | --- |
| blur() | 移除焦点 |
| focus() | 获取焦点 |

## Accessibility

### ARIA
- Checkbox 的 role 为 `checkbox`，CheckboxGroup 的 role 为 `list`，它的直接子元素为 `listitem`
- `aria-label`：单独使用 Checkbox 时，如果 Children 没有文本，建议传入 `aria-label` prop，用一句话描述 Checkbox 的作用，这会让屏幕阅读器读出这个标签的内容。如果你使用的是 Form.Checkbox，可以使用 Form 提供的 label 而无需传入 `aria-label`
- `aria-labelledby` 指向 `addon` 节点，用于解释当前 Checkbox 的作用
- `aria-describedby` 指向 `extra` 节点，用于补充解释当前 Checkbox 的作用
- `aria-disabled` 表示当前的禁用状态，与 `disabled` prop 的值保持一致
- `aria-checked` 表示当前的选中状态

### 键盘和焦点
- Checkbox 可被获取焦点，键盘用户可以使用 Tab 及 Shift  + Tab 切换焦点。
- 当前获取的焦点为 Checkbox 时，可以通过 Space 切换选中和未选状态。
- Checkbox 的点击区域大于框本身，包含了框后的文案；带辅助文本的 checkbox，辅助文本也包含在点击区域内。
- 禁用的 Checkbox 不可获取焦点。

## 文案规范


<div style={{ border: '1px solid var(--semi-color-border)', padding: 10, marginBottom: 24 }}>
    <p style={{ fontWeight: 600, fontSize: 16  }}>Checkbox Content Demo</p>
    <CheckboxGroup options={[
        { label: 'Call', value: 'abc' },
        { label: 'IM', value: 'c' },
        { label: 'Ticket', value: 'd' },
        { label: 'Offline', value: 'e' },
        { label: 'Buzz', value: 'f' }
    ]} direction='horizontal' aria-label="CheckboxGroup 示例" style={{ marginTop: 10 }}/>
</div>

- 首字母大写
- 不使用标点符号

| ✅ 推荐用法 | ❌ 不推荐用法 |   
| --- | --- | 
| Call | call |
| Call | Call; |

## 设计变量
<DesignToken/>

<!-- ## 相关物料
```material
45, 64, 73, 89, 123
``` -->
## 相关物料
<semi-material-list code="123"></semi-material-list>