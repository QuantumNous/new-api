---
localeCode: en-US
order: 37
category: Input
title: ColorPicker
icon: doc-colorPlatteNew
brief: Quickly and easily select colors, and provide a dropper tool to pick colors
---

## Demos

### How to import

ColorPicker component supported from v2.64.0

```jsx import
import { ColorPicker } from '@douyinfe/semi-ui';
```

### Basic Use

#### In portal

```jsx live=true
import React from 'react';
import { ColorPicker, Button } from '@douyinfe/semi-ui';
function Demo() {
    return (
        <div>
            <ColorPicker
                alpha={true}
                onChange={value => {
                    console.log(value);
                }}
                usePopover={true}
            />

            <br />
            <div>自定义 trigger</div>

            <ColorPicker
                alpha={true}
                onChange={value => {
                    console.log(value);
                }}
                usePopover={true}
            >
                <Button> Trigger </Button>
            </ColorPicker>
        </div>
    );
}
```

#### Normal display

```jsx live=true
import { ColorPicker } from '@douyinfe/semi-ui';
import React from 'react';

function Demo() {
    return (
        <ColorPicker
            alpha={true}
            onChange={value => {
                console.log(value);
            }}
        />
    );
}
```

### Eyedropper Color Picker

Use `eyeDropper={true}` to enable the eyedropper function, which supports picking colors from the browser or external software screen.

<Notice title='Notes'>
To enable this function, the current web page must be deployed in a secure context such as HTTPS or localhost domain name, otherwise it will have no effect. The user's browser version must be Chromium > 95
</Notice>

```jsx live=true
import React from 'react';
import { ColorPicker } from '@douyinfe/semi-ui';
function Demo() {
    return (
        <ColorPicker
            alpha={true}
            eyeDropper={true}
            onChange={value => {
                console.log(value);
            }}
        />
    );
}
```

### Default Value

When converting between various color representation formats, there are theoretical errors between some formats, so the value returned to you by onChange is an object containing color values ​​in three formats: hsva, hex, and rgba.

The defaultValue (uncontrolled) and value (controlled) you pass in should also be objects containing the same three formats.

We provide a static tool function `colorStringToValue` on the component class to convert common color strings to this object, supporting direct passing of strings such as rgb(57,197,187) #39c5bb and hsv(176,71,77).

```jsx live=true
import React from 'react';
import { ColorPicker } from '@douyinfe/semi-ui';
function Demo() {
    return (
        <div>
            <ColorPicker
                defaultValue={ColorPicker.colorStringToValue('rgb(57,197,187)')}
                onChange={value => {
                    console.log(value);
                }}
                alpha={true}
            />
        </div>
    );
}
```

### Controlled

Controlled use by passing in value

```jsx live=true
import React from 'react';
import { ColorPicker } from '@douyinfe/semi-ui';
function Demo() {
    const [value, setValue] = useState(ColorPicker.colorStringToValue('#39c5bb'));
    console.log(value);
    return (
        <div>
            <ColorPicker
                value={value}
                onChange={value => {
                    setValue(value);
                }}
                alpha={true}
            />
        </div>
    );
}
```

### Rendering additional elements at the top and bottom

Use `topSlot` and `bottomSlot` to render additional elements at the top and bottom

```jsx live=true
import React from 'react';
import { ColorPicker } from '@douyinfe/semi-ui';
function Demo() {
    return (
        <ColorPicker
            topSlot={<div>TopSlot</div>}
            bottomSlot={<div>Bottom Slot</div>}
            alpha={true}
            onChange={value => {
                console.log(value);
            }}
        />
    );
}
```

### API Table

| Parameter     | Description                                             | Type          | Default value |
| ------------- | ------------------------------------------------------- | ------------- | ------------- |
| onChange      | User selected color callback                            | (value)=>void | -             |
| alpha         | Whether to enable transparency selection                | boolean       | true          |
| bottomSlot    | Bottom rendering additional elements                    | ReactNode     | -             |
| className     | Class name                                              | string        | -             |
| defaultFormat | Default format for manual input                         | rgba hex hsva | hex           |
| defaultValue  | Default value                                           | Object        | -             |
| eyeDropper    | Whether to enable the eyedropper color picker           | boolean       | true          |
| height        | Height                                                  | number        | 280           |
| style         | Style                                                   | CSSProperties | -             |
| topSlot       | Top rendering additional elements                       | ReactNode     | -             |
| width         | Width                                                   | number        | 280           |
| usePopover    | Whether to put in Popover rendering                     | boolean       | false         |
| popoverProps  | When placing a Popover, the props passed to the Popover | Popover Props | -             |
