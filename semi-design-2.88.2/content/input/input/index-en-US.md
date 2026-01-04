---
localeCode: en-US
order: 40
category: Input
title:  Input
subTitle: Input
icon: doc-input
width: 60%
brief: Input is a basic component for users to enter and edit text.
---


## Demos

### How to import

```jsx import 
import { Input } from '@douyinfe/semi-ui';
```

### Basic Usage

```jsx live=true
import React from 'react';
import { Input } from '@douyinfe/semi-ui';

() => (
    <Input defaultValue='hi'></Input>
);
```

### Size

Support three sizes: `large`, `default`, and `small`.

```jsx live=true
import React from 'react';
import { Input } from '@douyinfe/semi-ui';

() => (
    <>
        <Input placeholder='large' size='large'></Input>
        <br/><br/>
        <Input placeholder='default'></Input>
        <br/><br/>
        <Input placeholder='small' size='small'></Input>
    </>
);
```

### Disabled

```jsx live=true
import React from 'react';
import { Input } from '@douyinfe/semi-ui';

() => (
    <>
        <Input defaultValue='enabled input'></Input>
        <br/>
        <br/>
        <Input disabled defaultValue='disbaled input'></Input>
    </>
);
```

### Prefix/Suffix

When the content of `prefix` and `suffix` is text or Semi Icon, the left and right margin will be automatically added. If it is a custom ReactNode, the left and right margin will be 0

```jsx live=true
import React from 'react';
import { Input, Typography } from '@douyinfe/semi-ui';
import { IconSearch } from '@douyinfe/semi-icons';

() => (
    <>
        <Input prefix={<IconSearch />} showClear></Input>
        <br/><br/>
        <Input prefix="Prefix" showClear></Input>
        <br/><br/>
        <Input suffix={<IconSearch />} showClear></Input>
        <br/><br/>
        <Input suffix={<Typography.Text strong type='secondary' style={{ marginRight: 8 }}>Suffix</Typography.Text>} showClear></Input>
    </>
);
```

### Addon

When the content of `addonBefore` and `addonAfter` is text or Semi Icon, the left and right margin will be automatically added. If it is a custom ReactNode, the left and right margin will be 0.

```jsx live=true
import React from 'react';
import { Input } from '@douyinfe/semi-ui';
() => (
    <Input addonBefore="http://" addonAfter=".com" />
);
```

### Clear Icon

Use `showClear` to allow clear current value when clicking on clear icon.

```jsx live=true
import React from 'react';
import { Input } from '@douyinfe/semi-ui';

() => (
    <Input showClear defaultValue='click to clear'></Input>
);
```

### Password Mode

Hide the content of input

```jsx live=true
import React from 'react';
import { Input } from '@douyinfe/semi-ui';

() => (
    <Input mode="password" defaultValue="123456"></Input>
);
```

### Validation

You can set different `validateStatus` to provide style feedback to the user.

```jsx live=true
import React from 'react';
import { Input } from '@douyinfe/semi-ui';
() => (
    <>
        <Input defaultValue='ies' validateStatus='warning'></Input>
        <br/><br/>
        <Input defaultValue='ies' validateStatus='error'></Input>
        <br/><br/>
        <Input defaultValue='ies'></Input>
    </>
);
```

### Controlled Component

You can use `value` along with `onChange` property if you want to use Input as a controlled component.

```jsx live=true
import React from 'react';
import { Input } from '@douyinfe/semi-ui';

class InputDemo extends React.Component {
    constructor() {
        super();
        this.state = {
            value: 'controlInput',
            value2: 'input'
        };
        this.onChange = this.onChange.bind(this);
    }
    onChange(value, e) {
        console.log(value);
        this.setState({ value });
    }
    render() {
        return (
            <>
                <Input
                    value={this.state.value}
                    onChange={this.onChange}>
                </Input>
            </>
        );
    }
}
```

### InputGroup

You could put multiple text field input into `<InputGroup>` and set `size`, `disabled` to the entire group. Supported fields include: `Input`， `InputNumber`， `Select`， `AutoComplete`、`TreeSelect`、`Cascader`、`DatePicker`

<Notice type="primary" title="Notice">
  <div>InputGroup does not recommend inserting non-supported elements. Form.InputGroup will perform error aggregation on supported elements without customizing the elements for processing.</div>
</Notice>

```jsx live=true
import React from 'react';
import { Input, InputGroup, InputNumber, Select, AutoComplete, DatePicker } from '@douyinfe/semi-ui';

() => (
    <div>
        <InputGroup>
            <Input placeholder="Name" style={{ width: 100 }} />
            <InputNumber placeholder="Score" style={{ width: 140 }} />
        </InputGroup>
        <br/><br/><br/>
        <InputGroup size={'small'}>
            <Select style={{ width: '100px' }} defaultValue='home'>
                <Select.Option value='home'>Home</Select.Option>
                <Select.Option value='work'>Work</Select.Option>
            </Select>
            <AutoComplete
                data={['Beijing Haidian']}
                placeholder='Address: '
                style={{ width: 180 }}
            >
            </AutoComplete>
        </InputGroup>
        <br/><br/><br/>
        <InputGroup size={'small'}>
            <Select style={{ width: '100px' }} defaultValue='signup'>
                <Select.Option value='signup'>Sign Up</Select.Option>
                <Select.Option value='signin'>Sign In</Select.Option>
            </Select>
            <Input placeholder="Email" style={{ width: 180 }} />
        </InputGroup>
        <br/><br/><br/>
        <InputGroup size={'small'}>
            <Input placeholder="Name" style={{ width: 100 }} />
            <DatePicker placeholder="Birthday" />
        </InputGroup>
    </div>
);
```

```jsx live=true
import React from 'react';
import { Input, InputGroup, Select, Cascader, TreeSelect } from '@douyinfe/semi-ui';
() => {
    const treeData = [
        {
            label: 'Asia',
            value: 'Asia',
            key: '0',
            children: [
                {
                    label: 'China',
                    value: 'China',
                    key: '0-0',
                    children: [
                        { label: 'Beijing', value: 'Beijing', key: '0-0-0' },
                        { label: 'Shanghai', value: 'Shanghai', key: '0-0-1' },
                    ],
                },
            ],
        },
        { label: 'North America', value: 'North America', key: '1' }
    ];
    return (
        <>
            <InputGroup>
                <Select style={{ width: 100 }} defaultValue='from'>
                    <Select.Option value='from'>From: </Select.Option>
                    <Select.Option value='to'>To: </Select.Option>
                </Select>
                <TreeSelect
                    style={{ width: 220 }}
                    treeData={treeData}
                    placeholder="Please select"
                />
            </InputGroup>
            <br/><br/>

            <InputGroup>
                <Select style={{ width: 100 }} defaultValue='from'>
                    <Select.Option value='from'>From: </Select.Option>
                    <Select.Option value='to'>To: </Select.Option>
                </Select>
                <Cascader
                    style={{ width: 220 }}
                    treeData={treeData}
                    placeholder="Please select"
                />
            </InputGroup>
        </>
    );
};

```

### TextArea

Used for multi-line text. You can set `maxCount` to restrict text entering and display text count. Since 1.30.0, `showClear` is supported.

```jsx live=true
import React from 'react';
import { TextArea } from '@douyinfe/semi-ui';

() => (
    <div>
        <TextArea />
        <br/><br/>
        <TextArea maxCount={100} showClear/>
    </div>
);
```

### Line break by Shift + Enter
By default, in a TextArea, both `Enter` and `Shift` + `Enter` can achieve line breaks.
Through appropriate event listening and disabling the default behavior, you can achieve disabling line breaks with Enter and only allowing line breaks with Shift + Enter.

```jsx live=true
import React from 'react';
import { TextArea, HotKeys } from '@douyinfe/semi-ui';

() => {
    const [text, setText] = useState('');

    const handleKeyDown = (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
        }
    };

    const handleChange = (value, event) => {
        setText(event.target.value);
    };

    return (
        <>  
            <p style={{ display: 'flex' }}>
                Use
                <HotKeys
                    hotKeys={['shift', 'enter']}
                    style={{ marginBottom: 12, marginLeft: 4, marginRight: 4 }}
                />
                break line
            </p>
            <TextArea
                value={text}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
            />
        </>
    );
};
```

### Autosize TextArea

You can set `autosize` to allow TextArea resizing height with content.

```jsx live=true
import React from 'react';
import { TextArea } from '@douyinfe/semi-ui';
() => (
    <div>
        <TextArea autosize rows={1} />
        <br/><br/>
        <TextArea autosize maxCount={100} />
    </div>
);
```

### Custom calculated character string length

By setting the getValueLength property, you can customize the length of the character string. With maxLength and minLength, you can support emoji length to calculate according to the visible length.


What is done inside Semi when getValueLength is passed in:

- maxLength: maxLength is not passed directly to the native input. If the input length exceeds the maximum limit, the legal length character entered last time is used.
- minLength: dynamically switch the length of minLength, emoji is calculated according to a length.
- maxCount: compare the values obtained using getValueLength with maxCount

```jsx live=true
import React from 'react';
import { Input, Typography, Form, Button, TextArea } from '@douyinfe/semi-ui';
import GraphemeSplitter from 'grapheme-splitter';

() => {
    const [value, setValue] = useState();
    function getValueLength(str) {
        if (typeof str === 'string') {
            const splitter = new GraphemeSplitter();
            return splitter.countGraphemes(str);
        } else {
            return 0;
        }
    }

    function getTextAreaStrLength(str) {
        const filteredStr = str.replace(/\s/g, '');
        return filteredStr.length;
    }

    return (
        <div>
            <h4>maxLength=10</h4>
            <div>
                <Typography.Text>Please input following emoji</Typography.Text>
                <div><Typography.Text copyable>💖</Typography.Text></div>
                <div><Typography.Text copyable>👨‍👩‍👧‍👦</Typography.Text></div>
            </div>
            <Input maxLength={10} getValueLength={getValueLength} onChange={setValue} style={{ width: 200, marginTop: 12, marginBottom: 12 }} />
            {
                value && (
                    <div>
                        <div><Typography.Text type="tertiary">{`getValueLength=${getValueLength(value)}`}</Typography.Text></div>
                        <div><Typography.Text type="tertiary">{`length=${value.length}`}</Typography.Text></div>
                    </div>
                )
            }
            <br/><br/>
            <h4>Form.Input + minLength=4</h4>
            <Form layout="horizontal">
                <Form.Input noLabel field="username" minLength={4} getValueLength={getValueLength} style={{ width: 200 }} />
                <Button type="primary" htmlType="submit">Submit</Button>
            </Form>
            <h4>maxCount=10</h4>
            <TextArea defaultValue="semi design" rows={2} maxCount={10} getValueLength={getTextAreaStrLength} style={{ width: 200 }} />
        </div>
    );
};
```

Answers to some questions:

> Why not just import the `grapheme-splitter` package? The uncompressed size of this package is 200+ kB, which is a bit too large for users who do not need to calculate emoji according to the visible length. Therefore, Semi chose to use the length calculation function as an argument for users to pass in

> Why not modify maxLength dynamically? Modify maxLength dynamically after the input operation is completed, calculate the remaining character length that can be entered. If the maxLength is set to 1, you want to enter a '💖' with a length of 2, but due to the limitation of input maxLength, you can't enter it at all here, and you can't update maxLength.


## API Reference

### Input

> Other attributes are same with html `<input>`

| Property          | Instructions                                                                                                                                                                                  | type                            | Default   |
|-------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------|-----------|
| aria-describedby  | Set the aria-describedby property                                                                                                                                                             | string                          | -         |
| aria-errormessage | Set the aria-errormessage property                                                                                                                                                            | string                          | -         |
| aria-invalid      | Set aria-invalid property                                                                                                                                                                     | string                          | -         |
| aria-label        | Set aria-label properties                                                                                                                                                                     | string                          | -         |
| aria-labelledby   | Set aria-labelledby properties                                                                                                                                                                | string                          | -         |
| aria-required     | Set aria-required properties                                                                                                                                                                  | string                          | -         |
| addonAfter        | Addon after input box                                                                                                                                                                         | ReactNode                       |           |
| addonBefore       | Addon before input box                                                                                                                                                                        | ReactNode                       |           |
| borderless        | borderless mode  >=2.33.0                                                                                                                                                                     | boolean                         |           |
| className         | Class name                                                                                                                                                                                    | string                          |           |
| clearIcon         | Can be used to customize the clear button, valid when showClear is true  **>=2.25**                                                                                                           | ReactNode                       |           |
| defaultValue      | Default value                                                                                                                                                                                 | ReactText                       |           |
| disabled          | Toggle whether to disable input                                                                                                                                                               | boolean                         | false     |
| getValueLength    | Custom calculated character string length                                                                                                                                                     | (value: string) => number       |           |
| hideSuffix        | Toggle whether to hide suffix if clear icon is shown，by default the two icon are side by side                                                                                                 | boolean                         | false     |
| mode              | mode of input，optional: `password` **>= v1.3.0**                                                                                                                                              | string                          |           |
| prefix            | Prefix                                                                                                                                                                                        | ReactNode                       |           |
| preventScroll | Indicates whether the browser should scroll the document to display the newly focused element, acting on the focus method inside the component, excluding the component passed in by the user | boolean |  |  |
| showClear         | Show clear button **>=1.0.0**                                                                                                                                                                 | boolean                         | false     |
| size              | Size, one of `large`, `default`, `small`                                                                                                                                                      | string                          | `default` |
| style             | Inline style                                                                                                                                                                                  | CSSProperties                   |           |
| suffix            | Suffix                                                                                                                                                                                        | ReactNode                       |           |
| type              | Input type attribute, same with html `<input>`                                                                                                                                                | string                          | text      |
| validateStatus    | Validate status for styling only, one of `default`, `error`, `warning`                                                                                                                        | string                          | `default` |
| value             | Current value of input box                                                                                                                                                                    | ReactText                       |           |
| onBlur            | Callback invoked when input loses focus                                                                                                                                                       | function(e:event)               |           |
| onChange          | Callback invoked when input value changes                                                                                                                                                     | function(value:string, e:event) |           |
| onClear           | Callback invoked when clicking clear icon                                                                                                                                                     | function(e:event)               |           |
| onEnterPress      | Callback invoked when pressing enter（keypress）                                                                                                                                                | function(e:event)               |           |
| onFocus           | Callback invoked when input gets focus                                                                                                                                                        | function(e:event)               |           |
| onKeyDown         | Callback invoked when keydown                                                                                                                                                                 | function(e:event)               |           |
| onKeyPress        | Callback invoked when keypress                                                                                                                                                                | function(e:event)               |           |
| onKeyUp           | Callback invoked when keyup                                                                                                                                                                   | function(e:event)               |           |
| onCompositionStart           | Callback invoked when compositionstart                                       | function(e:event)               |           |
| onCompositionEnd           | Callback invoked when compositionend                                        | function(e:event)               |           |
| onCompositionUpdate           |Callback invoked when compositionupdate                                      | function(e:event)               |           |
### TextArea

> Other attributes are same with html `<textarea>`

| Property          | Instructions                                                                                                           | Type                            | Default |
|-------------------|------------------------------------------------------------------------------------------------------------------------|---------------------------------|---------|
| aria-describedby  | Set the aria-describedby property                                                                                      | string                          | -       |
| aria-errormessage | Set the aria-errormessage property                                                                                     | string                          | -       |
| aria-invalid      | Set aria-invalid property                                                                                              | string                          | -       |
| aria-label        | Set aria-label properties                                                                                              | string                          | -       |
| aria-labelledby   | Set aria-labelledby properties                                                                                         | string                          | -       |
| aria-required     | Set aria-required properties                                                                                           | string                          | -       |
| autosize          | Toggle whether to allow autosize when content height changes, can config max and min rows by object value`{minRows?: number, maxRows?: number}`<br />**object param support from v2.45.0**                                                           | boolean                         | false   |
| borderless        | borderless mode  >=2.33.0                                                                                                                                                                     | boolean                         |           |
| className         | Class name                                                                                                             | string                          | -       |
| cols              | The visible width of the text control, in average character widths. If it is specified, it must be a positive integer. | number                          | -       |
| disabled          | Disabled                                                                                                               | boolean                         | false   |
| getValueLength    | Custom calculated character string length                                                                              | (value: string) => number       |         |
| maxCount          | The maximum number of characters and display count                                                                     | number                          | -       |
| placeholder       | Content to be appear by default                                                                                        | string                          | -       |
| preventScroll | Indicates whether the browser should scroll the document to display the newly focused element, acting on the focus method inside the component, excluding the component passed in by the user | boolean |  |  |
| readonly          | Read-only, not editable                                                                                                | boolean                         | false   |
| rows              | The number of visible text lines for the control.                                                                      | number                          | 4       |
| showClear         | Display the clear button when the input box has content and hover or focus **>=1.30.0**                                                                                         | boolean                         | false   |
| style             | Inline style                                                                                                           | CSSProperties                   | -       |
| onBlur            | Callback invoked when input loses focus                                                                                | (e:event) => void               | -       |
| onChange          | Callback invoked when input value changes                                                                              | (value:string, e:event) => void |         |
| onClear           | Callback invoked when clicking clear icon  **>=1.30.0**                                                                | (e:event) => void               |         |
| onEnterPress      | Callback invoked when pressing enter                                                                                   | (e:event) => void               | -       |
| onFocus           | Callback invoked when input gets focus                                                                                 | (e:event) => void               | -       |
| onKeyDown         | Callback invoked when keydown, html event                                                                              | (e:event) => void               | -       |
| onKeyPress        | Callback invoked when keypress, html event                                                                             | (e:event) => void               | -       |
| onKeyUp           | Callback invoked when keyup, html event                                                                                | (e:event) => void               | -       |
| onResize          | Callback invoked when height changes in autosize mode **v>=0.37.0**                                                    | ({ height:number }) => void     | -       |
| onCompositionStart           | Callback invoked when compositionstart **>=2.85.0** | function(e:event)               |           |
| onCompositionEnd           | Callback invoked when compositionend **>=2.85.0** | function(e:event)               |           |
| onCompositionUpdate           | Callback invoked when compositionupdate **>=2.85.0**  | function(e:event)               |           |

### InputGroup

Common attributes will be set to the child elements of InputGroup, such as disabled, onFocus, etc. If you set onFocus, onBlur or disabled on the child, it will override the corresponding property value of InputGroup.


| Property      | Instructions                                | Type                                                          | Default |
|---------------|--------------------------------------------|---------------------------------------------------------------|---------------|
| className     | class name of the group                    | string                                                        | -             |
| disabled      | disabled                                   | boolean                                                       | -             |
| label         | Label property of InputGroup               | [LabelProps](https://semi.design/en-US/input/form#Form.Label) | -             |
| labelPosition | label position, optional top or left       | string                                                        | -             |
| size          | input box size, large, default, small      | string                                                        | 'default'     |
| style         | styles for the group                       | CSSProperties                                                 | -             |
| onBlur        | Callback when input box loses focus        | (e:event) => void                                             | -             |
| onFocus       | The callback when the input box is focused | (e:event) => void                                             | -             |

## Methods

Some internal methods provided by Input can be accessed through ref:

| Name    | Description  |
|---------|--------------|
| blur()  | Remove focus |
| focus() | Get focus    |

## Accessibility

### ARIA

- When validateStatus is error, the aria-invalid of the input box is true
- When used in Form, field label is Input's aria-label

### Keyboard and focus

- Input can be focused, keyboard users can use Tab and Shift + Tab to switch focus
- The password button can be focused and activated with Enter or Space key after focusing

## Design Tokens
<DesignToken/>

<!-- ## Related Material
```material
44, 46
``` -->

## Related Material
<semi-material-list code="46"></semi-material-list>
