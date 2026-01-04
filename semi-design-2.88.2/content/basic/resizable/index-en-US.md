---
localeCode: en-US
order: 20
category: Basic
title: Resizable
icon: doc-steps
dir: column
brief: The component size is adjusted based on the user's mouse drag, supporting both resizing of a single component and combined resizing.
---

## Demos

### How to import

Resizable supported from 2.69.0

```jsx 
import { Resizable } from '@douyinfe/semi-ui';
import { ResizeItem, ResizeHandler, ResizeGroup } from '@douyinfe/semi-ui'
```

### Single Component
Basic Usage and Callbacks
You can set the initial size using defaultSize, and set drag callbacks with onResizeStart, onResize, and onResizeEnd.

```tsx
interface Size {
    width: string | number;
    height: string | number;
}
```

```jsx live=true
import React, { useState } from 'react';
import { Resizable } from '@douyinfe/semi-ui';

function Demo() {
  const [text, setText] = useState('Drag edge to resize')
  const opts_1 = {
    content: 'resize start',
    duration: 1,
    stack: true,
  };
  const opts_2 = {
    content: 'resize end',
    duration: 1,
    stack: true,
  };
  return (
    <div style={{ width: '500px' }}>
      <Resizable
        style={{ backgroundColor: 'rgba(var(--semi-grey-1), 1)' }}
        defaultSize={{
          width: '60%',
          height: 300,
        }}
        onChange={() => { setText('resizing') }}
        onResizeStart={() => Toast.info(opts_1)}
        onResizeEnd={() => { Toast.info(opts_2); setText('Drag edge to resize') }}
      >
        <div style={{ marginLeft: '20%' }}>
          {text}
        </div>
      </Resizable>
    </div>
  );
}

```


### Controlling Resize Directions
You can enable or disable specific resizing directions by setting the value of enable. All directions are enabled by default.

```tsx
interface Enable {
  left: Boolean;
  right: Boolean;
  top: Boolean;
  bottom: Boolean;
  topLeft: Boolean;
  topRight: Boolean;
  bottomLeft: Boolean;
  bottomRight: Boolean;
}
```


```jsx live=true
import React, { useState } from 'react';
import { Resizable, Switch, Typography } from '@douyinfe/semi-ui';

function Demo() {
  const [b, setB] = useState(false)
  const { Title } = Typography;
  return (
    <div style={{ width: '500px', height: '60%' }}>
        <div style={{ display: 'flex', alignItems: 'center', margin: 8 }}>
          <Switch checked={b} onChange={setB}></Switch>
            <Title heading={6} style={{ margin: 8 }}>
                {b ? 'able' : 'disable'}
            </Title>
        </div>
      <Resizable
        style={{ backgroundColor: 'rgba(var(--semi-grey-1), 1)' }}
        enable={{
          left: b
        }}
        defaultSize={{
          width: 200,
          height: 200,
        }}
      >
        <div style={{ marginLeft: '20%' }}>
          {'enable.left:' + b}
        </div>
      </Resizable>
    </div>
  );
}

```


### Setting Resizing Ratio

You can set the drag and resize ratio using ratio.

```jsx live=true
import React, { useState } from 'react';
import { Resizable } from '@douyinfe/semi-ui';

function Demo() {
  return (
    <div style={{ width: '500px', height: '60%' }}>
      <Resizable
        style={{ backgroundColor: 'rgba(var(--semi-grey-1), 1)' }}
        ratio={2}
        defaultSize={{
          width: 200,
          height: 200,
        }}
      >
        <div style={{ marginLeft: '20%' }}>
          ratio=2
        </div>
      </Resizable>
    </div>
  );
}

```

### Locking Aspect Ratio
You can lock the aspect ratio by setting lockAspectRatio. It can be a boolean or a number. If true, it locks to the initial aspect ratio; if a number, it locks to the given ratio.

```jsx live=true
import React, { useState } from 'react';
import { Resizable } from '@douyinfe/semi-ui';

function Demo() {
  return (
    <div style={{ width: '500px', height: '60%' }}>
      <Resizable
        style={{ backgroundColor: 'rgba(var(--semi-grey-1), 1)', marginBottom: '10px' }}
        defaultSize={{
          width: 400,
          height: 300,
        }}
        lockAspectRatio
      >
        <div style={{ marginLeft: '20%' }}>
          lock
        </div>
      </Resizable>
      <Resizable
        style={{backgroundColor: 'rgba(var(--semi-grey-1), 1)'}}
        defaultSize={{
          width: 200,
          height: 200 * 9 / 16,
        }}
        lockAspectRatio={16 / 9}
      >
        <div style={{ marginLeft: '20%' }}>
          16 / 9
        </div>
      </Resizable>
    </div>
  );
}

```

### Setting Maximum and Minimum Width/Height

You can set the maximum and minimum width and height using maxHeight, maxWidth, minHeight, and minWidth.

```jsx live=true
import React, { useState } from 'react';
import { Resizable } from '@douyinfe/semi-ui';

function Demo() {
  return (
    <div style={{ width: '500px', height: '60%' }}>
      <Resizable
        style={{ backgroundColor: 'rgba(var(--semi-grey-1), 1)' }}
        maxWidth={200}
        maxHeight={300}
        minWidth={50}
        minHeight={50}
        defaultSize={{
          width: 100,
          height: 100,
        }}
      >
        <div style={{ marginLeft: '20%' }}>
          width is between 50 and 200, height is between 50 and 300
        </div>
      </Resizable>
    </div>
  );
}

```

### Control Width/Height

You can control the size of the element through the size prop.

```jsx live=true
import React, { useState } from 'react';
import { Resizable } from '@douyinfe/semi-ui';

function Demo() {
  const [size, setSize] = useState({ width: 200, height: 100 });
  const onButtonClick = (() => {
    let realSize = { width: size.width + 10, height: size.height + 10 };
    setSize(realSize);
  })
  const onChange = (s) => { setSize(s); }

  return (
    <div style={{ width: '500px', height: '60%' }}>
      <Button onClick={onButtonClick}>set += 10</Button>
      <Resizable
        style={{ backgroundColor: 'rgba(var(--semi-grey-1), 1)', marginTop: '10px' }}
        size={size}
        onChange={onChange}
      >
        <div style={{ marginLeft: '20%' }}>
          Control Width/Height
        </div>
      </Resizable>
    </div>
  );
}
```


### Setting Scale
You can scale the entire element by setting the scale prop.

```jsx live=true
import React, { useState } from 'react';
import { Resizable } from '@douyinfe/semi-ui';

function Demo() {
  return (
    <div style={{ width: '500px', height: '60%', transform: 'scale(0.5)', transformOrigin: '0 0' }}>
      <Resizable
        style={{ backgroundColor: 'rgba(var(--semi-grey-1), 1)' }}
        defaultSize={{
          width: '60%',
          height: '60%',
        }}
        scale={0.5}
      >
        <div style={{ marginLeft: '20%' }}>
          scale 0.5
        </div>
      </Resizable>
    </div>
  );
}

```


### Restricting Width/Height by an Element
You can restrict the width and height by setting the boundElement, which supports string values like 'parent' or 'window'.

```jsx live=true
import React, { useState } from 'react';
import { Resizable } from '@douyinfe/semi-ui';

function Demo() {
  return (
    <div style={{ width: '300px', height: '300px', border: 'var(--semi-color-border) 1px solid' }}>
      <Resizable
        style={{ marginLeft: '20%', backgroundColor: 'rgba(var(--semi-grey-1), 1)' }}
        defaultSize={{
          width: '60%',
          height: 200,
        }}
        boundElement={'parent'}
      >
        <div style={{ marginLeft: '20%' }}>
          bound：parent
        </div>
      </Resizable>
    </div>
  );
}

```

### Customizing Corner Handler Styles
You can customize the drag handles for each direction using handleNode, and apply different styles using handleStyle and handleClassName.
```jsx
type HandleNode = {
  left: ReactNode;
  right: ReactNode;
  top: ReactNode;
  bottom: ReactNode;
  topLeft: ReactNode;
  topRight: ReactNode;
  bottomLeft: ReactNode;
  bottomRight: ReactNode;
}

type HandleStyle = {
  left: React.CSSProperties;
  right: React.CSSProperties;
  top: React.CSSProperties;
  bottom: React.CSSProperties;
  topLeft: React.CSSProperties;
  topRight: React.CSSProperties;
  bottomLeft: React.CSSProperties;
  bottomRight: React.CSSProperties;
}

type HandleClass = {
  left: string;
  right: string;
  top: string;
  bottom: string;
  topLeft: string;
  topRight: string;
  bottomLeft: string;
  bottomRight: string;
}
```

```jsx live=true
import React, { useState } from 'react';
import { Resizable, Button } from '@douyinfe/semi-ui';
function Demo() {
    return (
    <div style={{ width: '500px', height: '60%' }}>
      <Resizable
        style={{ marginLeft: '20%', backgroundColor: 'rgba(var(--semi-grey-1), 1)', border: 'var(--semi-color-border) 1px solid' }}
        defaultSize={{
          width: '60%',
          height: 300,
        }}
        handleNode={{
          right: <div style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            width: 'fit-content',
          }}><IconTransfer /></div>
        }}
      >
        <div style={{ marginLeft: '20%' }}>
          right
        </div>
      </Resizable>
    </div>
  );
}
```


### Allowing Incremental Width and Height Adjustment
You can allow gradual adjustments in width and height using the grid and snap properties. The grid property specifies the increments to which resizing should snap. The default value is [1, 1]. The snap property specifies the absolute pixel values to which resizing should snap. Both x and y are optional, allowing you to define only the desired axis. These two parameters can be combined with the snapGap property, which specifies the minimum gap required to move to the next target. The default is 0, meaning the target defined by grid/snap is always used.

```tsx
interface Snap {
    x: number[];
    y: number[];
}
```

```jsx live=true 
import React, { useState } from 'react';
import { Resizable } from '@douyinfe/semi-ui';

function Demo() {
  return (
    <div style={{ width: '500px', height: '60%' }}>
      <Resizable
        style={{ marginLeft: '20%', backgroundColor: 'rgba(var(--semi-grey-1), 1)', border: 'var(--semi-color-border) 1px solid' }}
        defaultSize={{
          width: '60%',
          height: 300,
        }}
        grid={100}
        snapGap={20}
      >
        <div style={{ marginLeft: '20%' }}>
          snap
        </div>
      </Resizable>
    </div >
  );
}
```

### Group Component 
<Notice type='primary' title='notice'>
The parent element of `ResizeGroup` needs to have a size in the main axis direction.
It's best not to set padding for ResizeItem, as it may cause the minimum size to not match the expected value. You can set padding for child elements instead.
</Notice>



Use the direction prop to set the resizing direction. Options are horizontal and vertical. Supports onResizeStart, onResize, and onResizeEnd callbacks, as well as setting min and max to control the maximum and minimum width/height.

```jsx live=true dir="column"
import React, { useState } from 'react';
import { ResizeItem, ResizeHandler, ResizeGroup, Toast } from '@douyinfe/semi-ui';

function Demo() {
  const [text, setText] = useState('Drag to resize')
  return (
    <div style={{ width: '1000px', height: '100px' }}>
      <ResizeGroup direction='horizontal'>
        <ResizeItem
          style={{ backgroundColor: 'rgba(var(--semi-grey-1), 1)', border: 'var(--semi-color-border) 1px solid' }}
          defaultSize={'400px'}
          min={'10%'}
          onChange={() => { setText('resizing') }}
          onResizeEnd={() => { setText('Drag to resize') }}
        >
          <div style={{ marginLeft: '20%' }}>
            {text + " min:10%"}
          </div>
        </ResizeItem>
        <ResizeHandler></ResizeHandler>
        <ResizeItem
          style={{ backgroundColor: 'rgba(var(--semi-grey-1), 1)', border: 'var(--semi-color-border) 1px solid' }}
          defaultSize={'20%'}
          min={'10%'}
          max={'30%'}
          onChange={() => { setText('resizing') }}
        >
          <div style={{ marginLeft: '20%' }}>
            {text + " min:10% max:30%"}
          </div>
        </ResizeItem>
        <ResizeHandler></ResizeHandler>
        <ResizeItem
          style={{ backgroundColor: 'rgba(var(--semi-grey-1), 1)', border: 'var(--semi-color-border) 1px solid' }}
          defaultSize={'0.5'}
          onChange={() => { setText('resizing') }}
        >
          <div style={{ marginLeft: '20%' }}>
            {text}
          </div>
        </ResizeItem>
        <ResizeHandler></ResizeHandler>
        <ResizeItem
          style={{ backgroundColor: 'rgba(var(--semi-grey-1), 1)', border: 'var(--semi-color-border) 1px solid' }}
          defaultSize={1}
          onChange={() => { setText('resizing') }}
        >
          <div style={{ marginLeft: '20%' }}>
            {text}
          </div>
        </ResizeItem>
      </ResizeGroup>
    </div>
  );
}

```

### Nested
Set the resizing direction using the direction prop. Options are horizontal and vertical.

```jsx live=true dir="column"
import React, { useState } from 'react';
import { ResizeItem, ResizeHandler, ResizeGroup } from '@douyinfe/semi-ui';

function Demo() {
  const [text, setText] = useState('Drag to resize')
  const opts_1 = {
    content: 'resize start',
    duration: 1,
    stack: true,
  };
  const opts = {
    content: 'resize end',
    duration: 1,
    stack: true,
  };
  return (
    <div style={{ width: '1000px', height: '600px' }}>
      <ResizeGroup direction='vertical'>
        <ResizeItem
          style={{ backgroundColor: 'rgba(var(--semi-grey-1), 1)' }}
          defaultSize={"20%"}
          onChange={() => { setText('resizing') }}
          onResizeStart={() => Toast.info(opts_1)}
          onResizeEnd={() => { Toast.info(opts); setText('Drag to resize') }}
        >
          <div style={{ marginLeft: '20%' }}>
            {'header'}
          </div>
        </ResizeItem>
        <ResizeHandler></ResizeHandler>
        <ResizeItem
          defaultSize={"80%"}
          onChange={() => { setText('resizing') }}
        >
          <ResizeGroup direction='horizontal'>
            <ResizeItem
              style={{ backgroundColor: 'rgba(var(--semi-grey-1), 1)', border: 'var(--semi-color-border) 1px solid' }}
              defaultSize={"25%"}
              onChange={() => { setText('resizing') }}
              onResizeStart={() => Toast.info(opts_1)}
              onResizeEnd={() => { Toast.info(opts); setText('Drag to resize') }}
            >
              <div style={{ marginLeft: '20%' }}>
                {'tab'}
              </div>
            </ResizeItem>
            <ResizeHandler></ResizeHandler>
            <ResizeItem
              style={{ backgroundColor: 'rgba(var(--semi-grey-1), 1)', border: 'var(--semi-color-border) 1px solid' }}
              defaultSize={"75%"}
              onChange={() => { setText('resizing') }}
            >
              <div style={{ marginLeft: '20%' }}>
                {text}
              </div>
            </ResizeItem>
            
          </ResizeGroup>
        </ResizeItem>
      </ResizeGroup>
    </div>
  );
}
```

```jsx live=true dir="column"
import React, { useState } from 'react';
import { ResizeItem, ResizeHandler, ResizeGroup } from '@douyinfe/semi-ui';

function Demo() {
  const [text, setText] = useState('Drag to resize')
  const opts_1 = {
    content: 'resize start',
    duration: 1,
    stack: true,
  };
  const opts = {
    content: 'resize end',
    duration: 1,
    stack: true,
  };
  return (
    <div style={{ width: '1000px', height: '600px' }}>
      <ResizeGroup direction='vertical'>
        <ResizeItem
          defaultSize={"80%"}
        >
          <ResizeGroup direction='horizontal'>
            <ResizeItem
              style={{ backgroundColor: 'rgba(var(--semi-grey-1), 1)', border: 'var(--semi-color-border) 1px solid' }}
              defaultSize={"25%"}
              min={'10%'}
              max={'30%'}
            >
              <div style={{ marginLeft: '20%' }}>
                {text + ' min:10% max:30%'}
              </div>
            </ResizeItem>
            <ResizeHandler></ResizeHandler>
            <ResizeItem
              style={{ border: 'var(--semi-color-border) 1px solid' }}
              defaultSize={"50%"}
            >
              <div style={{ height: '100%' }}>
                <ResizeGroup direction='vertical'>
                  <ResizeItem
                    style={{ backgroundColor: 'rgba(var(--semi-grey-1), 1)', border: 'var(--semi-color-border) 1px solid' }}
                    defaultSize={'33%'}
                    min={'10%'}
                    onChange={() => { setText('resizing') }}
                    onResizeEnd={() => { setText('Drag to resize') }}
                  >
                    <div style={{ marginLeft: '20%' }}>
                      {text + " min:10%"}
                    </div>
                  </ResizeItem>
                  <ResizeHandler></ResizeHandler>
                  <ResizeItem
                    style={{ backgroundColor: 'rgba(var(--semi-grey-1), 1)', border: 'var(--semi-color-border) 1px solid' }}
                    defaultSize={'33%'}
                    min={'10%'}
                    max={'40%'}
                  >
                    <div style={{ marginLeft: '20%' }}>
                      {text + " min:10% max:40%"}
                    </div>
                  </ResizeItem>
                  <ResizeHandler></ResizeHandler>
                  <ResizeItem
                    style={{ backgroundColor: 'rgba(var(--semi-grey-1), 1)', border: 'var(--semi-color-border) 1px solid' }}
                  >
                    <div style={{ marginLeft: '20%' }}>
                      {text}
                    </div>
                  </ResizeItem>
                </ResizeGroup>
              </div>
            </ResizeItem>
            <ResizeHandler></ResizeHandler>
            <ResizeItem
              style={{ backgroundColor: 'rgba(var(--semi-grey-1), 1)', border: 'var(--semi-color-border) 1px solid' }}
              defaultSize={"1"}
              max={'30%'}
            >
              <div style={{ marginLeft: '20%' }}>
                {text + ' max:30%'}
              </div>
            </ResizeItem>
            
          </ResizeGroup>
        </ResizeItem>
        <ResizeHandler></ResizeHandler>
        <ResizeItem
          defaultSize={"20%"}
          onChange={() => { setText('resizing') }}
        >
          <ResizeGroup direction='horizontal'>
            <ResizeItem
              style={{ backgroundColor: 'rgba(var(--semi-grey-1), 1)', border: 'var(--semi-color-border) 1px solid' }}
              defaultSize={"50%"}
            >
              <div style={{ marginLeft: '20%' }}>
                {'tab'}
              </div>
            </ResizeItem>
            <ResizeHandler></ResizeHandler>
            <ResizeItem
              style={{ backgroundColor: 'rgba(var(--semi-grey-1), 1)', border: 'var(--semi-color-border) 1px solid' }}
              defaultSize={"50%"}
            >
              <div style={{ marginLeft: '20%' }}>
                {'content'}
              </div>
            </ResizeItem>
          </ResizeGroup>
        </ResizeItem>
      </ResizeGroup>
    </div>
  );
}
```

### Dynamic Direction
```jsx live=true 
import React, { useState } from 'react';
import { ResizeItem, ResizeHandler, ResizeGroup } from '@douyinfe/semi-ui';

function Demo() {
  const [text, setText] = useState('drag to resize')
  const [direction, setDirection] = useState('horizontal')

  const changeDirection = () => {
    if (direction === 'horizontal') {
      setDirection('vertical')
    } else {
      setDirection('horizontal')
    }
  }
  return (
    <div style={{ width: '400px', height: '300px' }}>
      <Button onClick={changeDirection}>{direction}</Button>
      <ResizeGroup direction={direction} >
        <ResizeItem
          onChange={() => { setText('resizing') }}
          onResizeEnd={() => { setText('drag to resize') }}
          defaultSize={5}
        >
            <ResizeGroup direction='horizontal'>
              <ResizeItem
                style={{ backgroundColor: 'rgba(var(--semi-grey-1), 1)', }}
                onChange={() => { setText('resizing') }}
                onResizeEnd={() => { setText('drag to resize') }}
              >
                <div style={{ marginLeft: '20%',  padding:'5px' }}>
                  {text}
                </div>
              </ResizeItem>
              <ResizeHandler></ResizeHandler>
              <ResizeItem
                style={{ backgroundColor: 'rgba(var(--semi-grey-1), 1)', }}
                onChange={() => { setText('resizing') }}
              >
                <div style={{ marginLeft: '20%',  padding:'5px' }}>
                  {text}
                </div>
              </ResizeItem>
            </ResizeGroup>
        </ResizeItem>
        <ResizeHandler></ResizeHandler>
        <ResizeItem
          style={{ backgroundColor: 'rgba(var(--semi-grey-1), 1)',  }}
          defaultSize={1.3}
          onChange={() => { setText('resizing') }}
        >
          <div style={{ marginLeft: '20%',  padding:'5px' }}>
            {text}
          </div>
        </ResizeItem>
      </ResizeGroup>
    </div>
  );
}
```


## API

### Resizable

| 参数      | 说明                                                                          | 类型                    | 默认值     | 版本   |
| --------- | ----------------------------------------------------------------------------- | ----------------------- | ---------- | ------ |
| className | ClassName                                                                          | string                  |            |        |
| size   | Controls the size of the resizable box, supports both numeric and string (px/vw/vh/%) formats | [Size](#basic-usage-and-callbacks)                  |           |        |
| defaultSize   | Sets the initial width and height, supports both numeric and string (px/vw/vh/%) formats | [Size](#basic-usage-and-callbacks)                  |           |        |
| minWidth | Specifies the minimum width of the resizable box      |  string \| number                  |   |        |
| maxWidth | Specifies the maximum width of the resizable box      |  string \| number                  |   |        |
| minHeight | Specifies the minimum height of the resizable box      |  string \| number                  |   |        |
| maxHeight | Specifies the maximum height of the resizable box      |  string \| number                  |   |     
| lockAspectRatio | Locks the aspect ratio of the resizable box when true, using the initial width and height as the ratio    |  boolean \| number                  |   |        |
| enable | Specifies the directions in which the resizable box can be resized. If not set, all directions are enabled by default      |    [Enable](#controlling-resize-directions) 
| scale | The scale ratio of the resizable element      |   number                  |  1 |        |   
| boundElement | Restricts the size of the resizable element within a specific element. Pass "parent" to set the parent element as the bounding element    | string                  |            |        |
| handleNode     | Custom nodes for the drag handles in each direction             | [HandleNode](#customizing-corner-handler-styles)          |            |        |
| handleStyle    | Styles for the drag handles in each direction             | [HandleNode](#customizing-corner-handler-styles)            |            |        |
| handleClass   | Class names for the drag handles in each direction              | [HandleNode](#customizing-corner-handler-styles)            |            |        |
| style | Style | CSSProperties |      |
| snapGap      | Specifies the minimum gap required to snap to the next target                        | number                  | 0       |  |
| snap      | Specifies the pixel values to snap to during resizing. Both x and y are optional, allowing the definition of specific axes only                        | [Snap](#allowing-incremental-width-and-height-adjustment)                  | null       |  |
| grid      | Specifies the increment to align to when resizing                          | \[number, number\]                  | \[1,1\]       |  |
| onChange  | Callback during the dragging process                                                    | (size: Size; e: Event; direction: String) => void | -          |  |
| onResizeStart  | Callback when resizing starts                                                  | (e: Event; direction: String) => void | -          |  |
| onResizeEnd  | Callback when resizing ends                                                   | (size: Size; e: Event; direction: String) => void | -          |  |

### ResizeGroup

| 参数        | 说明                                                                                                                        | 类型                               | 默认值 | 版本 |
| ----------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------ | ---- |
| className   | ClassName | string                             |        |      |
| direction | Specifies the resize direction within the group  | 'horizontal' \| 'vertical' | 'horizontal' |      |

### ResizeHandler

| 参数        | 说明                                                                                                                        | 类型                               | 默认值 | 版本 |
| ----------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------ | ---- |
| className   | ClassName | string  |        |      |
| style | Style | CSSProperties |      |

### ResizeItem

| 参数      | 说明                                                                          | 类型                    | 默认值     | 版本   |
| --------- | ----------------------------------------------------------------------------- | ----------------------- | ---------- | ------ |
| className | ClassName                                                                     | string                  |            |        |
| defaultSize   | Used to set the initial width and height. **The string supports % and px units, and when the string is a pure number or a number is set directly, it represents the proportional allocation of the remaining space based on the value.**  | string \| number                  |           |        |
| min | Specifies the minimum size of the resizable box (as percentage or pixel)     |  string                  |   |        |
| max | Specifies the maximum size of the resizable box (as percentage or pixel)     |  string                  |   |        |   
| style | Style | CSSProperties |      |
| onChange  | Callback during the dragging process                                                    | (size: Size; e: Event; direction: String) => void | -          |  |
| onResizeStart  | Callback when resizing starts                                                  | (e: Event; direction: String) => void | -          |  |
| onResizeEnd  | Callback when resizing ends                                                   | (size: Size; e: Event; direction: String) => void | -          |  |


## Design Tokens

<DesignToken/>
