---
localeCode: en-US
order: 48
category: Input
title: TagInput
subTitle: TagInput
icon: doc-tagInput
brief: Taginput is a input component that can add content as a tag.
---

## Demos

### How to import

```jsx import
import { TagInput } from '@douyinfe/semi-ui';
```
### Basic Usage

After pressing the Enter key, the input will add value as a tag. If the tag content is an empty string or pure space, it will be filtered.

```jsx live=true
import React from 'react';
import { TagInput } from '@douyinfe/semi-ui';

() => (
    <TagInput
        defaultValue={['Semi', 'Hotsoon', 'Pipixia']}
        placeholder='Please enter...'
        onChange={v => console.log(v)}
    />
);
```

### Batch Add

You can use `separator` to set the separator to achieve batch input, and its default value is a comma. After version 1.29.0, multiple separators are supported in string[] format.

```jsx live=true
import React from 'react';
import { TagInput } from '@douyinfe/semi-ui';

() => (
    <>
        <TagInput 
            separator='-' 
            placeholder='Use `-` for batch input'
            onChange={v => console.log(v)}
        />
        <br/><br/>
        <TagInput 
            separator={['-', '/', '|', '++']}
            placeholder='Support multiple separators for batch input'
            onChange={v => console.log(v)}
        />
    </>
);
```

### Batch Remove

You can also use `showClear` to set whether to support one-click deletion of all tags and input.

```jsx live=true
import React from 'react';
import { TagInput } from '@douyinfe/semi-ui';

() => (
    <TagInput 
        showClear 
        defaultValue={['Semi', 'Hotsoon']} 
        placeholder='Please enter...'
        onChange={v => console.log(v)}
    />
);
```

### Disabled

```jsx live=true
import React from 'react';
import { TagInput } from '@douyinfe/semi-ui';

() => (
    <TagInput 
        disabled 
        showClear 
        defaultValue={['Semi', 'Hotsoon', 'Pipixia']} 
        placeholder='Please enter...'
    />
);
```

### Size

Use `size` to set the size of the TagInput, optional: `small`, `default`, `large`.

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

### Different validate status

validateStatus: `default`, `warning`, `error`.


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

### Prefix / Suffix

You can pass the input box prefix through `prefix`, the input box suffix through `suffix`, for text or React Node.  
The left and right padding is automatically brought when the content passed in by prefix and reactix is text or Icon. If it is a custom ReactNode, the left and right padding is 0.If necessary, you can set it in the ReactNode you passed in.

```jsx live=true
import React from 'react';
import { TagInput } from '@douyinfe/semi-ui';
import { IconVigoLogo, IconGift } from '@douyinfe/semi-icons';

() => (
    <>
        <TagInput prefix={<IconVigoLogo />} showClear/>
        <br/><br/>
        <TagInput prefix="Prefix" showClear/>
        <br/><br/>
        <TagInput suffix={<IconGift />}/>
        <br/><br/>
        <TagInput suffix="Suffix" showClear/>
    </>
);
``` 

### Allow Duplicates

You can use `allowDuplicates` to set whether to allow the creation of the same tag.

```jsx live=true
import React from 'react';
import { TagInput } from '@douyinfe/semi-ui';

() => (
    <TagInput
        allowDuplicates={false}
        defaultValue={['Semi', 'Hotsoon', 'Pipixia']} 
        placeholder='Please enter...'
        onChange={v => console.log(v)}
    />
);
```

### Autocomplete

You can use `addOnBlur` to set whether the current input value is automatically created as a tag when the blur event is triggered.

```jsx live=true
import React from 'react';
import { TagInput } from '@douyinfe/semi-ui';

() => (
    <TagInput
        addOnBlur={true}
        defaultValue={['Semi', 'Hotsoon', 'Pipixia']} 
        placeholder='Please enter...'
        onChange={v => console.log(v)}
    />
);
```

### Limits

You can use `max` to limit the number of tags. The `onExceed()` callback will be invoked when the limit is exceeded.

You can use `maxLength` to limit the maximum length of a single tag, and the `onInputExceed()` callback will be invoked when this value is exceeded.

```jsx live=true
import React from 'react';
import { TagInput } from '@douyinfe/semi-ui';

() => (
    <>
        <TagInput 
            max={3} 
            placeholder='max = 3' 
            onChange={v => console.log(v)}
            onExceed={v => {
                Toast.warning('Exceeds max');
                console.log(v);
            }}
        />
        <TagInput 
            maxLength={5} 
            placeholder='maxLength = 5'  
            style={{ marginTop: 12 }}
            onChange={v => console.log(v)}
            onInputExceed={v => {
                Toast.warning('Exceeds maxLength');
                console.log(v);
            }} 
        />
    </>
);
```

### Limit the number of tags displayed

You can use `maxTagCount` to limit the number of tags displayed, and the excess will be displayed as +N. You can use `showRestTagsPopover` to set whether hover +N displays Popover after `maxTagCount` is exceeded, and you can configure Popover in the `restTagsPopoverProps` property.

```jsx live=true
import React from 'react';
import { TagInput } from '@douyinfe/semi-ui';

() => (
    <TagInput 
        maxTagCount={2}
        showRestTagsPopover={true}
        restTagsPopoverProps={{ position: 'top' }}
        defaultValue={['Semi', 'Hotsoon', 'Pipixia']} 
    />
);
```

### Controlled Tag

You can use `value` to set tags, and use `onChange` to achieve control of the tags.

```jsx live=true
import React from 'react';
import { TagInput } from '@douyinfe/semi-ui';

class TagInputDemo extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            value: ['abc']
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

### Controlled Input

You can use `inputValue` to set input box, and use `onInputChange` to control the input content.

```jsx live=true
import React from 'react';
import { TagInput } from '@douyinfe/semi-ui';

class TagInputDemo extends React.Component {
    constructor(props) {
        super(props);
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

### Callback

```jsx live=true
import React from 'react';
import { TagInput } from '@douyinfe/semi-ui';

() => (
    <TagInput 
        defaultValue={['Semi', 'Hotsoon', 'Pipixia']} 
        showClear 
        onFocus={e =>{console.log(`onFocus`);}} 
        onBlur={e=>{console.log(`onBlur`);}} 
        onChange={tag=>{console.log(`onChange ：${tag}`);}} 
        onAdd={tag=>{console.log(`onAdd ：${tag}`);}} 
        onRemove={(v, i)=>{console.log(`onRemove ：${v}, index：${i}`);}} 
        onInputChange={(input, e)=>{console.log(`onInputChange ：${input}`);}} 
    />
);
```

### Focus Management

You can use the `blur()` and `focus()` methods to manage the focus.

```jsx live=true
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
                <TagInput defaultValue={['Semi', 'Hotsoon']} ref={this.ref} />
                <Button style={{ marginTop: 10 }} onClick={this.handleTagInputFocus}>
                    focus
                </Button>
            </>
        );
    }
}
```

### Custom TagInput rendering

You can use `renderTagItem` to customize tag rendering. `renderTagItem(value: string, index: number, onClose: function ) => React.ReactNode` The third parameter `onClose` is available since version 2.23.0.

```jsx live=true
import React from 'react';
import { TagInput, Avatar } from '@douyinfe/semi-ui';
import { IconClose } from '@douyinfe/semi-ui-icons';

class CustomRender extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            value: ['xiakeman']
        };
        this.list = [
            { "name": "xiakeman", "avatar": "https://sf6-cdn-tos.douyinstatic.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/avatarDemo.jpeg" },
            { "name": "shenyue", "avatar": "https://sf6-cdn-tos.douyinstatic.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/bf8647bffab13c38772c9ff94bf91a9d.jpg" },
            { "name": "quchenyi", "avatar": "https://sf6-cdn-tos.douyinstatic.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/dbf7351bb779433d17c4f50478cf42f7.jpg" },
            { "name": "wenjiamao", "avatar": "https://sf6-cdn-tos.douyinstatic.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/7abf810ff060ac3387bd027ead92c4e0.jpg" },
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
                onChange={value=>this.setState({ value })}
                renderTagItem={(value, index, onClose) => this.renderTagItem(value, index, onClose)}
            />
        );
    }
}
```

### Drag to sort

Set `draggable` to true to enable drag and drop sorting. Supported since v2.17.0. Adding the same Tag is not allowed under drag and drop sorting, 
so you need to set `allowDuplicates` to false. After the drag function is enabled, click TagInput, and the Tag can be dragged. Click anywhere 
outside the TagInput, the Tag cannot be dragged.

```jsx live=true
import React from 'react';
import { TagInput } from '@douyinfe/semi-ui';

() => (
    <TagInput
        draggable
        allowDuplicates={false}
        defaultValue={['Semi', 'Hotsoon', 'Pipixia']}
        placeholder='please enter...'
        onChange={v => console.log(v)}
    />
);
```

## API Reference

|Properties    |Instructions                                     |Type                                                            |Default  |Version |
|--------------|-------------------------------------------------|----------------------------------------------------------------|----------|--------|
|addOnBlur     |Whether to automatically create the current input value into a tag when the blur event is triggered |boolean       | false    |1.20.0|
|allowDuplicates|Allows adding the same tag multiple times       |boolean                                                          | true    |1.20.0|
|autoFocus     |Set whether to automatically focus during initial rendering |boolean                                                          | false    |1.29.0|
|className     |Class name                                       |string                                                           | -        |1.19.0|
|defaultValue  |Default tag value                                |string[]                                                         | -         |1.19.0|
|disabled      |Read-only, disable interaction                   |boolean                                                          |false     |1.19.0|
|inputValue    |Controlled input value                          |string                                                          | -         |1.19.0|
|maxLength     |Maximum length of a tag                          |number                                                           | -        |1.19.0|
|max           |Maximum number of tags allowed                   |number                                                           | -        |1.21.0|
|maxTagCount   |The maximum number of tags to be displayed, if exceeded, they will be displayed in the form of +N |number        | -        |1.21.0|
|showRestTagsPopover |When maxTagCount is exceeded and hover reaches +N, whether to display the remaining content through Popover  |boolean     | true     |1.21.0|
|restTagsPopoverProps |The configuration properties of the popover     |PopoverProps     | {}        |1.21.0|
|showContentTooltip |When the tag is too long and truncated, when hovering the tag, whether to display all contents through Tooltip.If passed in as object: type，type of component to show tooltip, one of Tooltip, Popover; opts, properties that will be passed directly to the component     |boolean\|{type: 'tooltip'\|'popover', opts: object}    | true        |1.21.0|
|placeholder   |Content to be appear by default                  |string                                                           | -         |1.19.0|
|prefix        |Prefix                                           |ReactNode                                                        |-          |1.19.0|
| preventScroll | Indicates whether the browser should scroll the document to display the newly focused element, acting on the focus method inside the component, excluding the component passed in by the user | boolean |  |  |
|renderTagItem |Customize the rendering of items, The parameter onClose is available in version 2.23.0  |<ApiType detail='(value: string, index: number, onClose: function) => React.ReactNode'>(params) => React.ReactNode</ApiType> | -        |1.19.0|
|separator     |Customize the separator                          |string\|string[]                                                 |,          |1.19.0,string[] is supported since 1.29.0|
|showClear     |Whether to show the clear button                 |boolean                                                          |false      |1.19.0|
|size          |Size, one of `small`、`large`、`default`          |string                                                           |`default` |1.19.0|
|style         |Inline style                                     |React.CSSProperties                                               | -        |1.19.0|
|suffix        |Suffix                                            |ReactNode                                                        |-         |1.19.0|
|validateStatus|Validate status for styling only, one of  `default`、`warning`、`error`|string                                       |`default` |1.19.0|
|value         |Controlled tag value                              |string[] \| undefined                                                         | -        |1.19.0|
|draggable     |Set whether to drag and drop                      |boolean                         |false      |2.17.0| 
|expandRestTagsOnClick| Without dragging，whether to expand redundant tags after TagInput is clicked     |boolean                          |true       |2.17.0| 
|onAdd         |Callback invoked when tags are added             |(addedValue: string[]) => void                                   | -        |1.19.0|
|onBlur        |Callback invoked when input loses focus          |(e:React.MouseEvent) => void                  | -        |1.19.0|
|onChange      |Callback invoked when tags changes               |(value:string[]) => void                                         | -        |1.19.0|
|onExceed      |Callback invoked when max is exceeded    |(value:string[]) => void                                         | -        |1.19.0|
|onFocus       |Callback invoked when input gets focus           |(e:React.MouseEvent) => void                  | -        |1.19.0|
|onInputChange |Callback invoked when input changes              |(value:string,e: React.KeyboardEvent) => void)| -        |1.19.0|
|onInputExceed |Callback invoked when maxLength is exceeded      |(value:string) => void                                           | -        |1.19.0|
|onKeyDown    |Callback invoked when keydown                     |(e: React.KeyboardEvent) => void          | -        |2.1.0|
|onRemove      |Callback invoked when tags are removed           |(removedValue: string, idx: number) => void                                 | -        |1.19.0|

## Methods
Some internal methods provided by TagInput can be accessed through ref:

|Name   |Description |Version |
|-------|------------|--------|
|blur() |Remove focus|1.19.0|
|focus()|Get focus   |1.19.0|

## Accessibility

### ARIA

- TagInput supports the input of `aria-label` to indicate the function of the TagInput;
- TagInput will set `aria-disabled` and `aria-invalid` according to disabled and validateStatus props;
- Both the input box and the clear button of TagInput have `aria-label` to indicate the function of the element.

## Design Tokens
<DesignToken/>

<!-- ## Related Material

```material
192,176
``` -->
