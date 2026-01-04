---
localeCode: zh-CN
order: 20
category: 基础
title: Resizable 伸缩框
icon: doc-steps
brief: 根据用户的鼠标拖拽，改变组件的大小，支持单个组件伸缩与组合伸缩
---

## 代码演示

### 如何引入

Resizable 从 2.69.0 开始支持

```jsx
import { Resizable } from '@douyinfe/semi-ui';
import { ResizeItem, ResizeHandler, ResizeGroup } from '@douyinfe/semi-ui';
```

### 单个组件 基本使用

通过`defaultSize`设置初始大小，可以通过`onResizeStart` `onResize` `onResizeEnd`设置拖拽的回调

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
    const [text, setText] = useState('Drag edge to resize');
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
                onChange={() => {
                    setText('resizing');
                }}
                onResizeStart={() => Toast.info(opts_1)}
                onResizeEnd={() => {
                    Toast.info(opts_2);
                    setText('Drag edge to resize');
                }}
            >
                <div style={{ marginLeft: '20%' }}>{text}</div>
            </Resizable>
        </div>
    );
}
```

### 控制伸缩方向

通过设置`enable`的值开启/关闭特定伸缩方向，默认值均为`true`

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
    const [b, setB] = useState(false);
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
                    left: b,
                }}
                defaultSize={{
                    width: 200,
                    height: 200,
                }}
            >
                <div style={{ marginLeft: '20%' }}>{'enable.left:' + b}</div>
            </Resizable>
        </div>
    );
}
```

### 设置变化比例

通过`ratio`设置拖动和实际变化的比例

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
                <div style={{ marginLeft: '20%' }}>ratio=2</div>
            </Resizable>
        </div>
    );
}
```

### 锁定横纵比

通过`lockAspectRatio`设置锁定横纵比,可以为`boolean`或`number`,为`number`时表示横纵比为`number`,为`true`时锁定初始横纵比

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
                <div style={{ marginLeft: '20%' }}>lock</div>
            </Resizable>
            <Resizable
                style={{ backgroundColor: 'rgba(var(--semi-grey-1), 1)' }}
                defaultSize={{
                    width: 200,
                    height: (200 * 9) / 16,
                }}
                lockAspectRatio={16 / 9}
            >
                <div style={{ marginLeft: '20%' }}>16 / 9</div>
            </Resizable>
        </div>
    );
}
```

### 设置最大，最小宽高

可通过 `maxHeight`，`maxWidth`，`minHeight`，`minWidth` 设置最大，最小宽高

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
                <div style={{ marginLeft: '20%' }}>width在50到200之间，height在50到300之间</div>
            </Resizable>
        </div>
    );
}
```

### 受控宽高

可通过 `size` 控制元素的宽高

```jsx live=true
import React, { useState } from 'react';
import { Resizable } from '@douyinfe/semi-ui';

function Demo() {
  const [size, setSize] = useState({ width: 200, height: 100 });
  const onButtonClick = () => {
    let realSize = { width: size.width + 10, height: size.height + 10 };
    setSize(realSize);
  };
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
          受控
        </div>
      </Resizable>
    </div>
  );
}
```

### 设置缩放值

通过设置 `scale`，整体缩放元素

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
                <div style={{ marginLeft: '20%' }}>scale 0.5</div>
            </Resizable>
        </div>
    );
}
```

### 根据元素限制元素宽高

通过 boundElement 设置用于限制宽高的元素，支持 string（'parent'｜'window'）

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
                <div style={{ marginLeft: '20%' }}>bound：parent</div>
            </Resizable>
        </div>
    );
}
```

### 自定义边角 handler 样式

可通过 handleNode 设置不同方向的拖动元素节点，可通过 handleStyle，handleClassName 设置不同方向上的样式

```jsx
type HandleNode = {
    left: ReactNode,
    right: ReactNode,
    top: ReactNode,
    bottom: ReactNode,
    topLeft: ReactNode,
    topRight: ReactNode,
    bottomLeft: ReactNode,
    bottomRight: ReactNode,
};

type HandleStyle = {
    left: React.CSSProperties,
    right: React.CSSProperties,
    top: React.CSSProperties,
    bottom: React.CSSProperties,
    topLeft: React.CSSProperties,
    topRight: React.CSSProperties,
    bottomLeft: React.CSSProperties,
    bottomRight: React.CSSProperties,
};

type HandleClass = {
    left: string,
    right: string,
    top: string,
    bottom: string,
    topLeft: string,
    topRight: string,
    bottomLeft: string,
    bottomRight: string,
};
```

```jsx live=true
import React, { useState } from 'react';
import { Resizable, Button } from '@douyinfe/semi-ui';
function Demo() {
    return (
        <div style={{ width: '500px', height: '60%' }}>
            <Resizable
                style={{
                    marginLeft: '20%',
                    backgroundColor: 'rgba(var(--semi-grey-1), 1)',
                    border: 'var(--semi-color-border) 1px solid',
                }}
                defaultSize={{
                    width: '60%',
                    height: 300,
                }}
                handleNode={{
                    right: (
                        <div
                            style={{
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                width: 'fit-content',
                            }}
                        >
                            <IconTransfer />
                        </div>
                    ),
                }}
            >
                <div style={{ marginLeft: '20%' }}>right</div>
            </Resizable>
        </div>
    );
}
```

### 允许阶段性调整宽高

可通过 grid ，snap 属性允许逐渐调整宽高。 grid 属性用于指定调整大小应对齐的增量。默认为 [1, 1]。 snap 属性用于指定调整大小时应对齐的绝对像素值。 x 和 y 都是可选的，允许仅包含要定义的轴。默认为空。以上两个参数可结合 snapGap 使用，该参数用于指定移动到下一个目标所需的最小间隙。默认为 0，这意味着始终使用 grid/snap 设定的目标。

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
                style={{
                    marginLeft: '20%',
                    backgroundColor: 'rgba(var(--semi-grey-1), 1)',
                    border: 'var(--semi-color-border) 1px solid',
                }}
                defaultSize={{
                    width: '60%',
                    height: 300,
                }}
                grid={100}
                snapGap={20}
            >
                <div style={{ marginLeft: '20%' }}>snap</div>
            </Resizable>
        </div>
    );
}
```

### 组合组件 基本使用

<Notice type='primary' title='注意事项'>
`ResizeGroup`的父元素需要具有主轴方向上的尺寸 
最好不要为`ResizeItem`设置`padding`，会导致最小尺寸不符合预期，可以为子元素设置`padding`
</Notice>

通过`direction`设置伸缩方向，可选值为`horizontal`和`vertical` 支持`onResizeStart` `onResize` `onResizeEnd`回调，支持`min` `max`设置最大最小宽高

```jsx live=true dir="column"
import React, { useState } from 'react';
import { ResizeItem, ResizeHandler, ResizeGroup, Toast } from '@douyinfe/semi-ui';

function Demo() {
    const [text, setText] = useState('Drag to resize');
    return (
        <div style={{ width: '1000px', height: '100px' }}>
            <ResizeGroup direction="horizontal">
                <ResizeItem
                    style={{
                        backgroundColor: 'rgba(var(--semi-grey-1), 1)',
                        border: 'var(--semi-color-border) 1px solid',
                    }}
                    defaultSize={'400px'}
                    min={'10%'}
                    onChange={() => {
                        setText('resizing');
                    }}
                    onResizeEnd={() => {
                        setText('Drag to resize');
                    }}
                >
                    <div style={{ marginLeft: '20%' }}>{text + ' min:10%'}</div>
                </ResizeItem>
                <ResizeHandler></ResizeHandler>
                <ResizeItem
                    style={{
                        backgroundColor: 'rgba(var(--semi-grey-1), 1)',
                        border: 'var(--semi-color-border) 1px solid',
                    }}
                    defaultSize={'20%'}
                    min={'10%'}
                    max={'30%'}
                    onChange={() => {
                        setText('resizing');
                    }}
                >
                    <div style={{ marginLeft: '20%' }}>{text + ' min:10% max:30%'}</div>
                </ResizeItem>
                <ResizeHandler></ResizeHandler>
                <ResizeItem
                    style={{
                        backgroundColor: 'rgba(var(--semi-grey-1), 1)',
                        border: 'var(--semi-color-border) 1px solid',
                    }}
                    defaultSize={'0.5'}
                    onChange={() => {
                        setText('resizing');
                    }}
                >
                    <div style={{ marginLeft: '20%' }}>{text}</div>
                </ResizeItem>
                <ResizeHandler></ResizeHandler>
                <ResizeItem
                    style={{
                        backgroundColor: 'rgba(var(--semi-grey-1), 1)',
                        border: 'var(--semi-color-border) 1px solid',
                    }}
                    defaultSize={1}
                    onChange={() => {
                        setText('resizing');
                    }}
                >
                    <div style={{ marginLeft: '20%' }}>{text}</div>
                </ResizeItem>
            </ResizeGroup>
        </div>
    );
}
```

### 嵌套使用

通过`direction`设置伸缩方向，可选值为`horizontal`和`vertical`

```jsx live=true dir="column"
import React, { useState } from 'react';
import { ResizeItem, ResizeHandler, ResizeGroup } from '@douyinfe/semi-ui';

function Demo() {
    const [text, setText] = useState('Drag to resize');
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
            <ResizeGroup direction="vertical">
                <ResizeItem
                    style={{ backgroundColor: 'rgba(var(--semi-grey-1), 1)' }}
                    defaultSize={'20%'}
                    onChange={() => {
                        setText('resizing');
                    }}
                    onResizeStart={() => Toast.info(opts_1)}
                    onResizeEnd={() => {
                        Toast.info(opts);
                        setText('Drag to resize');
                    }}
                >
                    <div style={{ marginLeft: '20%' }}>{'header'}</div>
                </ResizeItem>
                <ResizeHandler></ResizeHandler>
                <ResizeItem
                    defaultSize={'80%'}
                    onChange={() => {
                        setText('resizing');
                    }}
                >
                    <ResizeGroup direction="horizontal">
                        <ResizeItem
                            style={{
                                backgroundColor: 'rgba(var(--semi-grey-1), 1)',
                                border: 'var(--semi-color-border) 1px solid',
                            }}
                            defaultSize={'25%'}
                            onChange={() => {
                                setText('resizing');
                            }}
                            onResizeStart={() => Toast.info(opts_1)}
                            onResizeEnd={() => {
                                Toast.info(opts);
                                setText('Drag to resize');
                            }}
                        >
                            <div style={{ marginLeft: '20%' }}>{'tab'}</div>
                        </ResizeItem>
                        <ResizeHandler></ResizeHandler>
                        <ResizeItem
                            style={{
                                backgroundColor: 'rgba(var(--semi-grey-1), 1)',
                                border: 'var(--semi-color-border) 1px solid',
                            }}
                            defaultSize={'75%'}
                            onChange={() => {
                                setText('resizing');
                            }}
                        >
                            <div style={{ marginLeft: '20%' }}>{text}</div>
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
    const [text, setText] = useState('Drag to resize');
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
            <ResizeGroup direction="vertical">
                <ResizeItem defaultSize={'80%'}>
                    <ResizeGroup direction="horizontal">
                        <ResizeItem
                            style={{
                                backgroundColor: 'rgba(var(--semi-grey-1), 1)',
                                border: 'var(--semi-color-border) 1px solid',
                            }}
                            defaultSize={'25%'}
                            min={'10%'}
                            max={'30%'}
                        >
                            <div style={{ marginLeft: '20%' }}>{text + ' min:10% max:30%'}</div>
                        </ResizeItem>
                        <ResizeHandler></ResizeHandler>
                        <ResizeItem style={{ border: 'var(--semi-color-border) 1px solid' }} defaultSize={'50%'}>
                            <div style={{ height: '100%' }}>
                                <ResizeGroup direction="vertical">
                                    <ResizeItem
                                        style={{
                                            backgroundColor: 'rgba(var(--semi-grey-1), 1)',
                                            border: 'var(--semi-color-border) 1px solid',
                                        }}
                                        defaultSize={'33%'}
                                        min={'10%'}
                                        onChange={() => {
                                            setText('resizing');
                                        }}
                                        onResizeEnd={() => {
                                            setText('Drag to resize');
                                        }}
                                    >
                                        <div style={{ marginLeft: '20%' }}>{text + ' min:10%'}</div>
                                    </ResizeItem>
                                    <ResizeHandler></ResizeHandler>
                                    <ResizeItem
                                        style={{
                                            backgroundColor: 'rgba(var(--semi-grey-1), 1)',
                                            border: 'var(--semi-color-border) 1px solid',
                                        }}
                                        defaultSize={'33%'}
                                        min={'10%'}
                                        max={'40%'}
                                    >
                                        <div style={{ marginLeft: '20%' }}>{text + ' min:10% max:40%'}</div>
                                    </ResizeItem>
                                    <ResizeHandler></ResizeHandler>
                                    <ResizeItem
                                        style={{
                                            backgroundColor: 'rgba(var(--semi-grey-1), 1)',
                                            border: 'var(--semi-color-border) 1px solid',
                                        }}
                                    >
                                        <div style={{ marginLeft: '20%' }}>{text}</div>
                                    </ResizeItem>
                                </ResizeGroup>
                            </div>
                        </ResizeItem>
                        <ResizeHandler></ResizeHandler>
                        <ResizeItem
                            style={{
                                backgroundColor: 'rgba(var(--semi-grey-1), 1)',
                                border: 'var(--semi-color-border) 1px solid',
                            }}
                            defaultSize={'1'}
                            max={'30%'}
                        >
                            <div style={{ marginLeft: '20%' }}>{text + ' max:30%'}</div>
                        </ResizeItem>
                    </ResizeGroup>
                </ResizeItem>
                <ResizeHandler></ResizeHandler>
                <ResizeItem
                    defaultSize={'20%'}
                    onChange={() => {
                        setText('resizing');
                    }}
                >
                    <ResizeGroup direction="horizontal">
                        <ResizeItem
                            style={{
                                backgroundColor: 'rgba(var(--semi-grey-1), 1)',
                                border: 'var(--semi-color-border) 1px solid',
                            }}
                            defaultSize={'50%'}
                        >
                            <div style={{ marginLeft: '20%' }}>{'tab'}</div>
                        </ResizeItem>
                        <ResizeHandler></ResizeHandler>
                        <ResizeItem
                            style={{
                                backgroundColor: 'rgba(var(--semi-grey-1), 1)',
                                border: 'var(--semi-color-border) 1px solid',
                            }}
                            defaultSize={'50%'}
                        >
                            <div style={{ marginLeft: '20%' }}>{'content'}</div>
                        </ResizeItem>
                    </ResizeGroup>
                </ResizeItem>
            </ResizeGroup>
        </div>
    );
}
```

### 动态方向

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

## API 参考

### Resizable

单个伸缩框组件。

| 参数      | 说明                                                                          | 类型                    | 默认值     | 版本   |
| --------- | ----------------------------------------------------------------------------- | ----------------------- | ---------- | ------ |
| className | 类名                                                                          | string                  |            |        |
| size   | 控制伸缩框的大小，支持数字和字符串（px/vw/vh/%）两种格式 | [Size](#基本使用与回调)                  |           |        |
| defaultSize   | 用于设置初始宽高，支持数字和字符串（px/vw/vh/%）两种格式 | [Size](#基本使用与回调)                  |           |        |
| minWidth | 指定伸缩框最小宽度      |  string \| number                  |   |        |
| maxWidth | 指定伸缩框最大宽度      |  string \| number                  |   |        |
| minHeight | 指定伸缩框最小高度      |  string \| number                  |   |        |
| maxHeight | 指定伸缩框最大高度      |  string \| number                  |   |     
| lockAspectRatio | 设置伸缩框横纵比，当为`true`时按照初始宽高锁定    |  boolean \| number                  |   |        |
| enable | 指定伸缩框可以伸缩的方向，没有设置为 false，则默认允许该方向的拖动      |    [Enable](#控制伸缩方向) 
| scale | 可伸缩元素被缩放的比例      |   number                  |  1 |        |   
| boundElement | 用于限制可伸缩元素宽高的元素,传入 `parent` 设置父节点为限制节点    | string                  |            |        |
| handleNode     | 用于设置拖拽处理元素各个方向的自定义节点             | [HandleNode](#自定义边角handler样式)          |            |        |
| handleStyle    | 用于设置拖拽处理元素各个方向的样式              | [HandleStyles](#自定义边角handler样式)            |            |        |
| handleClass  | 用于设置拖拽处理元素各个方向的类名称              | [HandleClasses](#自定义边角handler样式)            |            |        |
| style | 样式 | CSSProperties |      |
| snapGap      | 用于指定移动到下一个目标所需的最小间隙。                        | number                  | 0       |  |
| snap      | 指定调整大小时应对齐的绝对像素值。 x 和 y 都是可选的，允许仅包含要定义的轴                        | [Snap](#允许阶段性调整宽高)                  | null       |  |
| grid      | 指定调整大小应对齐的增量                           | \[number, number\]                  | \[1,1\]       |  |
| onChange  | 拖拽过程中的回调                                                    | (size: Size; e: Event; direction: String) => void | -          |  |
| onResizeStart  | 开始伸缩的回调                                                   | (e: Event; direction: String) => void | -          |  |
| onResizeEnd  | 结束伸缩的回调                                                    | (size: Size; e: Event; direction: String) => void | -          |  |

### ResizeGroup

| 参数        | 说明                                                                                                                        | 类型                               | 默认值 | 版本 |
| ----------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------ | ---- |
| className   | 类名                                                                                                                        | string                             |        |      |
| direction | 指定Group内的伸缩方向  | 'horizontal' \| 'vertical' | 'horizontal' |      |
### ResizeHandler
| 参数        | 说明                                                                                                                        | 类型                               | 默认值 | 版本 |
| ----------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------ | ---- |
| className   | 类名                                                                                                                        | string                             |        |      |
| style | 样式 | CSSProperties |      |
### ResizeItem
| 参数      | 说明                                                                          | 类型                    | 默认值     | 版本   |
| --------- | ----------------------------------------------------------------------------- | ----------------------- | ---------- | ------ |
| className | 类名                                                                          | string                  |            |        |
| defaultSize   | 用于设置初始宽高，**字符串支持%和px单位，当字符串为纯数字或直接设置数字时表示按照值的比例分配剩余空间** | string \| number                 |           |        |
| min | 指定伸缩框最小尺寸（百分比或像素值）      |  string                   |   |        |
| max | 指定伸缩框最大尺寸（百分比或像素值）     |  string                   |   |        |
| style | 样式 | CSSProperties |      |
| onChange  | 拖拽过程中的回调                                                    | (size: Size; e: Event; direction: String) => void | -          |  |
| onResizeStart  | 开始伸缩的回调                                                   | (e: Event; direction: String) => void | -          |  |
| onResizeEnd  | 结束伸缩的回调                                                    | (size: Size; e: Event; direction: String) => void | -          |  |


## 设计变量

<DesignToken/>
