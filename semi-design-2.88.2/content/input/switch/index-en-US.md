---
localeCode: en-US
order: 47
category: Input
title: Switch
subTitle: Switch
icon: doc-switch
width: 60%
brief: Switch is an interactive form used to switch two mutually exclusive states.
---

## Demos

### How to import

```jsx import
import { Switch } from '@douyinfe/semi-ui';
```

### Basic Usage

You can monitor state changes through `onChange`, and set the selected state through `defaultChecked` or controlled `checked`.  
Use `aria-label` to describe the specific function of the Switch

```jsx live=true
import React from 'react';
import { Switch } from '@douyinfe/semi-ui';

() => (
    <div>
        <Switch onChange={(v, e) => console.log(v)} aria-label="a switch for demo"></Switch>
        <br />
        <Switch defaultChecked={true} onChange={(v, e) => console.log(v)} aria-label="a switch for demo"></Switch>
    </div>
);
```

### Size

```jsx live=true
import React from 'react';
import { Switch } from '@douyinfe/semi-ui';

() => (
    <div>
        <Switch size="small" aria-label="a switch for demo"></Switch>
        <Switch defaultChecked={true} size="small" aria-label="a switch for demo"></Switch>
        <Switch size="small" loading aria-label="a switch for demo" />
        <Switch size="small" loading defaultChecked={true} aria-label="a switch for demo" />
        <br />
        <br />
        <Switch></Switch>
        <Switch defaultChecked={true}></Switch>
        <Switch loading />
        <Switch loading defaultChecked={true} />
        <br />
        <br />
        <Switch size="large"></Switch>
        <Switch defaultChecked={true} size="large"></Switch>
        <Switch size="large" loading />
        <Switch size="large" loading defaultChecked={true} />
    </div>
);
```

### Disabled

```jsx live=true
import React from 'react';
import { Switch } from '@douyinfe/semi-ui';

() => (
    <div>
        <Switch disabled aria-label='a switch for demo'></Switch>
        <br />
        <Switch disabled checked={true} aria-label='a switch for demo'></Switch>
    </div>
);
```

### With text

Can pass `checkedText` with `uncheckedText` Text when setting the switch  
The long text is recommended to be placed directly on the outside.  
Note: This does not work with the smallest switch (size = 'small')

```jsx live=true
import React from 'react';
import { Switch } from '@douyinfe/semi-ui';

() => (
    <div>
        <Switch checkedText="on" uncheckedText="off" />
        <Switch checkedText="｜" uncheckedText="〇" style={{ marginLeft: 5 }} />
        <br />
        <br />
        <Switch defaultChecked checkedText="on" uncheckedText="off" />
        <Switch defaultChecked checkedText="｜" uncheckedText="〇" style={{ marginLeft: 5 }} />
        <br />
        <br />
        <Switch checkedText="on" uncheckedText="off" size="large" />
        <Switch checkedText="｜" uncheckedText="〇" size="large" style={{ marginLeft: 5 }} />
        <br />
        <br />
        <Switch defaultChecked checkedText="on" uncheckedText="off" size="large" />
        <Switch defaultChecked checkedText="｜" uncheckedText="〇" size="large" style={{ marginLeft: 5 }} />
    </div>
);
```

Compared to setting the embedded text through checkedText and uncheckedText, we recommend placing the text description outside the Switch

```jsx live=true
import React, { useState } from 'react';
import { Switch, Typography } from '@douyinfe/semi-ui';

() => {
    const [open, setOpen] = useState();
    const { Title } = Typography;
    return (
        <div style={{ display: 'flex', alignItems: 'center' }}>
            <Title heading={6} style={{ margin: 8 }}>
                {open ? 'Open' : 'Closed'}
            </Title>
            <Switch checked={open} onChange={setOpen} />
        </div>
    );
};
```

### Controlled component

Whether the component is selected depends entirely on the incoming checked value, used with `onChange`

```jsx live=true
import React from 'react';
import { Switch } from '@douyinfe/semi-ui';

() => {
    const [checked, setChecked] = useState(true);

    const onChange = (checked) => {
        setChecked(checked);
    };

    return (
        <Switch
            checked={checked}
            aria-label='a switch for demo'
            onChange={onChange}
        />
    );

};
```

### loading

version: >= 1.29.0

You can turn on the loading state by setting loading="true".

```jsx live=true
import React from 'react';
import { Switch } from '@douyinfe/semi-ui';

() => (
    <div>
        <Switch loading />
        <br />
        <Switch loading defaultChecked={true} />
    </div>
);
```

## API reference

| Properties | Instructions | Type | Default | version |
| --- | --- | --- | --- | --- |
| aria-label | [aria-label](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Techniques/Using_the_aria-label_attribute) used to define a string that labels the current element. Use it in cases where a text label is not visible on the screen | string |  | 2.2.0 |
| aria-labelledby | [aria-labelledby](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Techniques/Using_the_aria-labelledby_attribute)attribute establishes relationships between objects and their label(s), and its value should be one or more element IDs, which refer to elements that have the text needed for labeling. | string |  | 2.2.0 |
| className | The CSS class name of the wrapper element | string |  |  |
| checked | Indicates whether currently selected, used with onchange | boolean | false |  |
| checkedText | Content displayed when open, invalid when size is small | React Node |  | 0.25.0 |
| defaultChecked | Whether selected when component mounted | boolean | false |  |
| disabled | If true, the switch will be disabled. | boolean | false |  |
| loading | Turn on loading status | boolean | false | 1.29.0 |
| onChange | Callback function when changing | function (checked: boolean) |  |  |
| onMouseEnter | A callback when the mouse moves in | function () |  |  |
| onMouseLeave | A callback when the mouse moves out | function () |  |  |
| size | Size, optional value `large`, `default`, `small` | string | 'default' |  |
| style | Inline style | object | {} |  |
| uncheckedText | Content displayed when closed, invalid when size is small | React Node |  | 0.25.0 |

## Accessibility
### ARIA
- Switch has a `switch` role, when checked is true, `aria-checked` will be automatically set to true, and vice versa.
- As a form field, it should have a Label, which will be automatically brought on when you use Form.Switch.
- If you use Switch alone, it is recommended to use `aria-label` to describe the current label function.

### Keyboard and Focus
- Keyboard users can use `Tab` and `Shift + Tab` to switch focus.
- When focusing, you can switch on or off by pressing the `Space` key.

## Content Guidelines
- Switch description
  - First letter is capitalized, no punctuation is required
  - Indirectly and explicitly state whether the setting is on or off
  - If needed, explain to the user what the on and off states represent
## Design Tokens

<DesignToken/>
