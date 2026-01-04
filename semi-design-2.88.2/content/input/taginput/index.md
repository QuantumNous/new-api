---
localeCode: zh-CN
order: 48
category: 输入类
title: TagInput 标签输入框
icon: doc-tagInput
brief: 标签输入框能够将输入的内容生成标签。
---

## 代码演示

### 如何引入

```jsx import
import { TagInput } from '@douyinfe/semi-ui';
```
### 基本演示

敲击回车键后，输入内容将成为标签。标签内容如果为空串或者纯空格时，则会被过滤。

```jsx live=true
import React from 'react';
import { TagInput } from '@douyinfe/semi-ui';

() => (
    <TagInput
        defaultValue={['抖音', '火山', '西瓜视频']}
        placeholder='请输入...'
        onChange={v => console.log(v)}
    />
);
```

### 批量添加

可以使用 `separator` 设置分隔符，来实现批量输入，它的默认值为英文逗号。1.29.0 版本后支持多个分隔符以 string[] 格式传入。

```jsx live=true
import React from 'react';
import { TagInput } from '@douyinfe/semi-ui';

() => (
    <>
        <TagInput 
            separator='-' 
            placeholder='使用 - 进行批量输入'
            onChange={v => console.log(v)}
        />
        <br/><br/>
        <TagInput 
            separator={['-', '/', '|', '++']}
            placeholder='支持多个分隔符进行批量输入'
            onChange={v => console.log(v)}
        />
    </>
);
```

### 批量删除

可使用 `showClear` 设置是否支持一键删除所有标签和输入框内容。

```jsx live=true
import React from 'react';
import { TagInput } from '@douyinfe/semi-ui';

() => (
    <TagInput 
        showClear 
        defaultValue={['抖音', '火山']} 
        placeholder='请输入...'
        onChange={v => console.log(v)}
    />
);
```

### 禁用

```jsx live=true
import React from 'react';
import { TagInput } from '@douyinfe/semi-ui';

() => (
    <TagInput 
        disabled 
        showClear 
        defaultValue={['抖音', '火山', '西瓜视频']} 
        placeholder='请输入...'
    />
);
```

### 尺寸大小

通过 `size` 控制标签输入框的大小尺寸，可选: `small` 、 `default` 、 `large`。

```jsx live=true
import React from 'react';
import { TagInput } from '@douyinfe/semi-ui';

() => (
    <>
        <TagInput size='small' placeholder='small'/>
        <br/><br/>
        <TagInput placeholder='default'/>
        <br/><br/>
        <TagInput size='large' placeholder='large'/>
    </>
);
```

### 不同校验状态样式

可以使用 `validateStatus` 设置不同校验状态的样式，它仅影响背景颜色等样式表现，可选值: `default` 、 `warning` 、 `error`。

```jsx live=true
import React from 'react';
import { TagInput } from '@douyinfe/semi-ui';

() => (
    <>
        <TagInput placeholder='default'/>
        <br/><br/>
        <TagInput placeholder='warning' validateStatus='warning'/>
        <br/><br/>
        <TagInput placeholder='error' validateStatus='error'/>
    </>
);
``` 

### 前缀 / 后缀

可以通过 `prefix` 传入输入框前缀，通过 `suffix` 传入输入框后缀，可以为文本或者 ReactNode。  
当 `prefix`、`suffix` 传入的内容为 string 或者 Icon 时，会自动带上左右间隔；若为自定义 ReactNode，则左右间隔为 0，如需可以在你传入的 ReactNode中自行设置。  

```jsx live=true
import React from 'react';
import { TagInput } from '@douyinfe/semi-ui';
import { IconVigoLogo, IconGift } from '@douyinfe/semi-icons';

() => (
    <>
        <TagInput prefix={<IconVigoLogo />} />
        <br/><br/>
        <TagInput prefix="Prefix" />
        <br/><br/>
        <TagInput suffix={<IconGift />} />
        <br/><br/>
        <TagInput suffix="Suffix" />
    </>
);
``` 

### 失焦后自动创建标签

可使用 `addOnBlur`，设置是否在 blur 事件触发时，将当前 input 的值自动创建成 tag。

```jsx live=true
import React from 'react';
import { TagInput } from '@douyinfe/semi-ui';

() => (
    <TagInput
        defaultValue={['抖音', '火山', '西瓜视频']}
        addOnBlur={true}
        placeholder='请输入...'
        onChange={v => console.log(v)}
    />
);
```

### 过滤重复标签

可使用 `allowDuplicates`，设置是否允许创建相同 tag，默认为 true。

```jsx live=true
import React from 'react';
import { TagInput } from '@douyinfe/semi-ui';

() => (
    <TagInput
        defaultValue={['抖音', '火山', '西瓜视频']}
        allowDuplicates={false}
        placeholder='请输入...'
        onChange={v => console.log(v)}
    />
);
```

### 输入限制

可使用 `max` 限制输入的标签数量，超出后将不允许再输入，并且触发 `onExceed()` 回调。

可使用 `maxLength` 限制单个标签的最大长度，超出后将不允许再输入，并且触发 `onInputExceed()` 回调。

```jsx live=true
import React from 'react';
import { TagInput } from '@douyinfe/semi-ui';

() => (
    <>
        <TagInput 
            max={3} 
            placeholder='最多输入3条标签..' 
            onChange={v => console.log(v)}
            onExceed={v => {
                Toast.warning('超过 max');
                console.log(v);
            }}
        />
        <TagInput 
            maxLength={5} 
            placeholder='单个标签长度不超过5...'  
            style={{ marginTop: 12 }}
            onChange={v => console.log(v)}
            onInputExceed={v => {
                Toast.warning('超过 maxLength');
                console.log(v);
            }} 
        />
    </>
);
```

### 限制标签展示数量

利用 `maxTagCount` 可以限制展示的标签数量，超出部分将以 +N 的方式展示。使用 `showRestTagsPopover` 可以设置在超出 `maxTagCount` 后，hover +N 是否显示 `Popover`，并且可以在 `restTagsPopoverProps` 属性中配置 `Popover`。 

```jsx live=true
import React from 'react';
import { TagInput } from '@douyinfe/semi-ui';

() => (
    <TagInput 
        maxTagCount={2}
        showRestTagsPopover={true}
        restTagsPopoverProps={{ position: 'top' }}
        defaultValue={['抖音', '火山', '西瓜视频']}
        onChange={v => console.log(v)}
    />
);
```

### 标签受控

可使用 `value` 设置标签内容，并配合 `onChange` 实现标签内容受控。

```jsx live=true hideInDSM
import React from 'react';
import { TagInput } from '@douyinfe/semi-ui';

class TagInputDemo extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            value: ['抖音']
        };
    }
    onChange(value) {
        this.setState({ value });
    }
    
    render() {
        return (
            <TagInput
                value={this.state.value}
                onChange={value => {this.onChange(value);}}
            />
        );
    }
}
```

### 输入受控

可使用 `inputValue` 设置输入框内容，并配合 `onInputChange` 实现输入内容受控。

```jsx live=true hideInDSM
import React from 'react';
import { TagInput } from '@douyinfe/semi-ui';

class TagInputDemo extends React.Component {
    constructor() {
        super();
        this.state = {
            value: 'abc'
        };
    }
    handleInputChange(value, event) {
        this.setState({ value });
    }
    render() {
        return (
            <TagInput
                inputValue={this.state.value}
                onInputChange={(v, e) => this.handleInputChange(v, e)}
            />
        );
    }
}
```

### 回调

```jsx live=true
import React from 'react';
import { TagInput } from '@douyinfe/semi-ui';

() => (
    <TagInput 
        defaultValue={['抖音']} 
        placeholder='请输入...'
        showClear 
        onFocus={e => {console.log(`onFocus`);}} 
        onBlur={e => {console.log(`onBlur`);}} 
        onChange={tag => {console.log(`onChange,当前标签数组：${tag}`);}} 
        onAdd={tag => {console.log(`onAdd，新增：${tag}`);}} 
        onRemove={(v, i) => {console.log(`onRemove，移除：${v}, 序号：${i}`);}} 
        onInputChange={(input, e) => {console.log(`onInputChange，当前输入内容：${input}`);}} 
    />
);
```

### 焦点管理

可以使用 `blur()` 和 `focus()` 方法对焦点进行管理。

```jsx live=true hideInDSM
import React from 'react';
import { TagInput, Button } from '@douyinfe/semi-ui';

class TagInputDemo extends React.Component {
    constructor(props) {
        super(props);
        this.ref = React.createRef();
        this.handleTagInputFocus=this.handleTagInputFocus.bind(this);
    }

    handleTagInputFocus(){
        this.ref.current.focus();
    }

    render() {
        return (
            <>
                <TagInput defaultValue={['抖音', '火山']} ref={this.ref} />
                <Button style={{ marginTop: 10 }} onClick={this.handleTagInputFocus}>
                    点击按钮聚焦
                </Button>
            </>
        );
    }
}
```

### 自定义标签渲染

可以使用 `renderTagItem` 自定义标签渲染。 `renderTagItem(value: string, index: number, onClose: function ) => React.ReactNode` 第三个参数 `onClose` 于 2.23.0 版本开始提供。

```jsx live=true
import React from 'react';
import { TagInput, Avatar } from '@douyinfe/semi-ui';
import { IconClose } from '@douyinfe/semi-ui-icons';

class CustomRender extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            value: ['夏可漫']
        };
        this.list = [
            { "name": "夏可漫", "avatar": "https://sf6-cdn-tos.douyinstatic.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/avatarDemo.jpeg" },
            { "name": "申悦", "avatar": "https://sf6-cdn-tos.douyinstatic.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/bf8647bffab13c38772c9ff94bf91a9d.jpg" },
            { "name": "曲晨一", "avatar": "https://sf6-cdn-tos.douyinstatic.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/dbf7351bb779433d17c4f50478cf42f7.jpg" },
            { "name": "文嘉茂", "avatar": "https://sf6-cdn-tos.douyinstatic.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/7abf810ff060ac3387bd027ead92c4e0.jpg" },
        ];
        this.mapList = new Map(this.list.map( item => [item.name, item]));
    }

    renderTagItem(value, index, onClose) {
        const data = this.mapList.get(value);
        return (
            <div 
                key={index} 
                style={{ display: 'flex', alignItems: 'center', fontSize: 14, marginRight: 10 }}
            >
                <Avatar 
                    alt='avatar'
                    src={data?data.avatar:'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/dy.png'} 
                    size="extra-small" 
                />
                <span style={{ marginLeft: 8 }}>
                    {`${value}@semi.com`}
                </span>
                <IconClose onClick={onClose} />
            </div>
        );
    }

    render() {
        const { value } = this.state;
        return (
            <TagInput 
                value={value} 
                onChange={value => this.setState({ value })}
                renderTagItem={(value, index, onClose) => this.renderTagItem(value, index, onClose)}
            />
        );
    }
}
```

### 拖拽排序

将 `draggable`设为 true，开启拖拽排序功能。v2.17.0 后支持。拖拽排序下不允许添加相同 Tag， 因此需要将 `allowDuplicates` 设置为 false。
拖拽功能开启后，点击 TagInput，Tag 可拖拽。点击 TagInput 外任意区域，Tag 不可拖拽。

```jsx live=true
import React from 'react';
import { TagInput } from '@douyinfe/semi-ui';

() => (
    <TagInput
        draggable
        allowDuplicates={false}
        defaultValue={['抖音', '火山', '西瓜视频']}
        placeholder='请输入...'
        onChange={v => console.log(v)}
    />
);
```


## API 参考

|属性          |说明                                             |类型                            |默认值    |版本      |
|-------------|-------------------------------------------------|-------------------------------|----------|--------|
|addOnBlur    |是否在 blur 事件触发时，将当前 input 的值自动创建成 tag |boolean                        | false   |1.20.0|
|allowDuplicates|是否允许添加相同 tag                             |boolean                         | true    |1.20.0|
|autoFocus    |初始渲染时是否自动 focus                            |boolean                         | false    |1.29.0|
|className    |样式类名                                          |string                         | -        |1.19.0|
|defaultValue |初始标签                                          |string[]                        | -       |1.19.0|
|disabled     |是否禁用                                          |boolean                        |false     |1.19.0|
|inputValue   |当前输入框，配合 onInputChange 实现受控              |string                         | -        |1.19.0|
|maxLength    |单个标签的最大长度                                  |number                         | -        |1.19.0|
|max          |允许标签的最大数量                                  |number                         | -        |1.21.0|
|maxTagCount  |标签的最大展示数量，超出后将以 +N 形式展示              |number                         | -        |1.21.0|
|showRestTagsPopover  |当超过 maxTagCount，hover 到 +N 时，是否通过 Popover 显示剩余内容  |boolean     | true     |1.21.0|
|restTagsPopoverProps |Popover 的配置属性，可以控制弹出方向、zIndex、trigger等，具体参考[Popover](/zh-CN/show/popover#API_参考)           |PopoverProps     | {}        |1.21.0|
|showContentTooltip   |当标签长度过长发生截断时，hover 标签的时候，是否通过 Tooltip 显示全部内容, 支持 Tooltip\|Popover；opts，其他需要透传给浮层组件的属性    |boolean\|{type: 'tooltip'\|'popover', opts: object}    | true        |1.21.0|
|placeholder  |占位默认值                                         |string                         | -         |1.19.0|
|prefix       |前缀标签                                           |ReactNode                      |-          |1.19.0|
| preventScroll | 指示浏览器是否应滚动文档以显示新聚焦的元素，作用于组件内的 focus 方法 | boolean |  |  |
|renderTagItem|自定义标签渲染, 参数 onClose 于版本2.23.0版本提供     | <ApiType detail='(value: string, index: number, onClose: function) => React.ReactNode'>(params) => React.ReactNode</ApiType> | -  |1.19.0|
|separator    |设置批量输入时的分隔符                               |string\|string[]                         |,    |1.19.0, string[]是从1.29.0开始支持|
|showClear    |是否支持一键删除所有标签和输入内容                     |boolean                        |false      |1.19.0|
|size         |设置输入框尺寸,可选: `small`、`large`、`default`     |string                          |`default` |1.19.0|
|style        |内联样式                                          |React.CSSProperties                         | -        |1.19.0|
|suffix       |后缀标签                                           |ReactNode                      |-         |1.19.0|
|validateStatus|设置校验状态样式,可选: `default`、`warning`、`error` |string                          |`default` |1.19.0|
|value        |当前标签，配合 onChange 实现受控                     |string[] \| undefined                       | -        |1.19.0|
|draggable    |设置是否可拖拽                                      |boolean                         |false      |2.17.0| 
|expandRestTagsOnClick| 在不可拖拽的情况下，在 TagInput 被点击后是否展开多余的 Tag        |boolean                          |true       |2.17.0| 
|onAdd        |添加标签时的回调                                     |(addedValue: string[]) => void     | -        |1.19.0|
|onBlur       |输入框失去焦点时的回调           |(e:React.MouseEvent) => void                 | -        |1.19.0|
|onChange     |标签变化时的回调                                     |(value:string[]) => void | -        |1.19.0|
|onExceed     |超过 max 时的回调                           |(value:string[]) => void        | -        |1.19.0|
|onFocus      |输入框获取焦点时的回调                                |(e:React.MouseEvent) => void               | -        |1.19.0|
|onInputChange|输入框内容变化时的回调                                |(value:string,e: React.KeyboardEvent) => void)  | -        |1.19.0|
|onInputExceed|超过 maxLength 时的回调                             |(value:string) => void          | -        |1.19.0|
|onKeyDown    |keydown 回调                             |(e: React.KeyboardEvent) => void          | -        |2.1.0|
|onRemove     |移除标签时的回调                                     |(removedValue: string, idx: number) => void     | -        |1.19.0|

## Methods

绑定在组件实例上的方法，可以通过 ref 调用实现某些特殊交互

|名称    |描述   |版本     |
|-------|------|---------|
|blur() |移出焦点|1.19.0|
|focus()|获取焦点|1.19.0|

## Accessibility

### ARIA

- TagInput 支持传入 `aria-label` 来表示该 TagInput 作用；
- TagInput 会依据 disabled 及 validateStatus props 来分别设置 `aria-disabled`、`aria-invalid`；
- TagInput 的输入框和清空按钮均具有 `aria-label` 来表明元素作用。

## 设计变量
<DesignToken/>

<!-- ## 相关物料

```material
192,176
``` -->
