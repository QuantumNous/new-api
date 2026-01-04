---
localeCode: zh-CN
order: 79
category: 展示类
title: SideSheet 滑动侧边栏
icon: doc-sidesheet
brief: 可从屏幕边沿滑出的浮层面板，通常用于承载二级操作页面
---

## 代码演示

### 如何引入

```jsx import
import { SideSheet } from '@douyinfe/semi-ui';
```

### 基本

默认侧边栏从右滑出，支持点击遮罩区关闭。

```jsx live=true
import React, { useState } from 'react';
import { SideSheet, Button } from '@douyinfe/semi-ui';

() => {
    const [visible, setVisible] = useState(false);
    const change = () => {
        setVisible(!visible);
    };
    return (
        <>
            <Button onClick={change}>Open SideSheet</Button>
            <SideSheet title="滑动侧边栏" visible={visible} onCancel={change}>
                <p>This is the content of a basic sidesheet.</p>
                <p>Here is more content...</p>
            </SideSheet>
        </>
    );
};
```

### 自定义位置

可以通过设置 `placement` 属性设置侧边栏滑出位置，支持`top`, `bottom`, `left`, `right`。

```jsx live=true
import React, { useState } from 'react';
import { SideSheet, RadioGroup, Radio, Button } from '@douyinfe/semi-ui';

() => {
    const [visible, setVisible] = useState(false);
    const change = () => {
        setVisible(!visible);
    };
    const [placement, setPlacement] = useState('right');
    const changePlacement = e => {
        setPlacement(e.target.value);
    };
    return (
        <>
            <RadioGroup onChange={changePlacement} value={placement}>
                <Radio value={'right'}>right</Radio>
                <Radio value={'left'}>left</Radio>
                <Radio value={'top'}>top</Radio>
                <Radio value={'bottom'}>bottom</Radio>
            </RadioGroup>
            <br />
            <br />
            <Button onClick={change}>Open SideSheet</Button>
            <SideSheet title="滑动侧边栏" visible={visible} onCancel={change} placement={placement}>
                <p>This is the content of a basic sidesheet.</p>
                <p>Here is more content...</p>
            </SideSheet>
        </>
    );
};
```

### 自定义尺寸

可以通过设置 `size` 属性设置侧边栏尺寸，支持 `small`(448px)， `medium`(684px), `large`(920px)，仅在 `placement` 为 `left` 或 `right` 时生效。 `0.29.0` 版本之后支持。若默认的尺寸不满足你的需求，你还可以通过设置 `width` 属性自行设置宽度，例如 `width={900}` / `width={'800px'}`

```jsx live=true
import React, { useState } from 'react';
import { SideSheet, RadioGroup, Radio, Button } from '@douyinfe/semi-ui';

() => {
    const [visible, setVisible] = useState(false);
    const change = () => {
        setVisible(!visible);
    };
    const [size, setSize] = useState('small');
    const changeSize = e => {
        setSize(e.target.value);
    };
    return (
        <>
            <RadioGroup onChange={changeSize} value={size}>
                <Radio value={'small'}>small</Radio>
                <Radio value={'medium'}>medium</Radio>
                <Radio value={'large'}>large</Radio>
            </RadioGroup>
            <br />
            <br />
            <Button onClick={change}>Open SideSheet</Button>
            <SideSheet title="滑动侧边栏" visible={visible} onCancel={change} size={size}>
                <p>This is the content of a basic sidesheet.</p>
                <p>Here is more content...</p>
            </SideSheet>
        </>
    );
};
```

### 可操作的外部区域

在 `0.29.0` 版本之后，当 `mask={false}`时允许对外部区域进行操作。

<Notice title='注意'>
当 SideSheet 是默认渲染在 body 中时（即不传入 getPopupContainer 参数），会在打开时自动给 body 添加 overflow: hidden 来禁止滚动。如果你希望外部区域依然可滚动，可以将 disableScroll 设为false
</Notice>

```jsx live=true
import React, { useState } from 'react';
import { SideSheet, TextArea, Button } from '@douyinfe/semi-ui';

() => {
    const [visible, setVisible] = useState(false);
    const [value, setValue] = useState('');
    return (
        <>
            <Button onClick={() => setVisible(true)}>Open SideSheet</Button>
            <TextArea placeholder="Please enter something" onChange={value => setValue(value)} style={{ marginTop: 12 }}/>
            <SideSheet
                title="可操作外部的侧边栏"
                visible={visible}
                onCancel={() => setVisible(false)}
                mask={false}
                disableScroll={false}
            >
                <p>这里是输入的内容：</p>
                <p>{value}</p>
            </SideSheet>
        </>
    );
};
```

### 渲染在指定容器

可以通过 `getPopupContainer` 指定父级 DOM，弹层将会渲染至该 DOM 中， `0.29.0` 版本之后支持。

<Notice title='注意'>
  容器需要手动设置样式 `overflow: hidden`，否则会导致动画溢出
</Notice>

```jsx live=true
import React, { useState } from 'react';
import { SideSheet, Button } from '@douyinfe/semi-ui';

() => {
    const [visible, setVisible] = useState(false);
    const [value, setValue] = useState('');
    const getContainer = () => {
        return document.querySelector('.sidesheet-container');
    };
    return (
        <div
            style={{
                height: 320,
                overflow: 'hidden',
                position: 'relative',
                border: '1px solid var(--semi-color-border)',
                borderRadius: 2,
                padding: 24,
                textAlign: 'center',
                background: 'var(--semi-color-fill-0)',
            }}
            className="sidesheet-container"
        >
            <span>Render in this</span>
            <br />
            <br />
            <Button onClick={() => setVisible(true)}>Open SideSheet</Button>
            <SideSheet
                title="渲染在指定容器内部"
                visible={visible}
                onCancel={() => setVisible(false)}
                width={220}
                getPopupContainer={getContainer}
            >
                <p>This is the content of a basic sidesheet.</p>
                <p>Here is more content...</p>
            </SideSheet>
        </div>
    );
};
```

### 自定义内容区域

可以通过自定义 `title`，`footer`(v>=1.3.0) 等创建出丰富的内容样式。

```jsx live=true hideInDSM
import React from 'react';
import { SideSheet, Form, Button, Typography, Banner } from '@douyinfe/semi-ui';

class Demo extends React.Component {
    constructor() {
        super();
        this.state = { visible: false };
    }
    show() {
        this.setState({
            visible: true,
        });
    }
    handleCancel(e) {
        this.setState({
            visible: false,
        });
    }
    render() {
        const {
            DatePicker,
            Select,
            Radio,
            RadioGroup,
        } = Form;
        const footer = (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button style={{ marginRight: 8 }}>重置</Button>
                <Button theme="solid">提交</Button>
            </div>
        );
        return (
            <>
                <Button onClick={() => this.show()}>More Information</Button>
                <SideSheet
                    title={<Typography.Title heading={4}>创建资源包</Typography.Title>}
                    headerStyle={{ borderBottom: '1px solid var(--semi-color-border)' }}
                    bodyStyle={{ borderBottom: '1px solid var(--semi-color-border)' }}
                    visible={this.state.visible}
                    footer={footer}
                    closeIcon={null}
                    onCancel={() => this.handleCancel()}
                >
                    <Form>
                        <DatePicker
                            field="date"
                            type="dateTime"
                            initValue={new Date()}
                            style={{ width: 272 }}
                            label={{ text: '创建时间', required: true }}
                        />
                        <RadioGroup field="type" label="目标操作系统" direction="horizontal" initValue={'all'}>
                            <Radio value="all">全平台</Radio>
                            <Radio value="ios">iOS</Radio>
                            <Radio value="android">Android</Radio>
                            <Radio value="web">Web</Radio>
                        </RadioGroup>
                        <RadioGroup field="origin" label="资源包来源" direction="horizontal" initValue={'scm'}>
                            <Radio value="scm">从SCM上传</Radio>
                            <Radio value="manual">手动上传</Radio>
                        </RadioGroup>
                        <Banner
                            fullMode={false}
                            icon={null}
                            type="warning"
                            bordered
                            description={
                                <>
                                    <Typography.Text strong>当前部署环境：线上部署</Typography.Text>
                                    <br />
                                    <Typography.Text>
                                        请选择正确的SCM构建产物，防止出现不符合预期的发布操作。
                                    </Typography.Text>
                                </>
                            }
                        />
                        <br />
                        <Select
                            field="users"
                            label={{ text: '创建用户', required: true }}
                            style={{ width: 560 }}
                            multiple
                            initValue={['1', '2', '3', '4']}
                        >
                            <Select.Option value="1">曲晨一</Select.Option>
                            <Select.Option value="2">夏可曼</Select.Option>
                            <Select.Option value="3">曲晨三</Select.Option>
                            <Select.Option value="4">蔡妍</Select.Option>
                        </Select>
                    </Form>
                </SideSheet>
            </>
        );
    }
}
```

## API 参考

| 属性 | 说明                                                                            | 类型 | 默认值 | 版本 |
| --- |-------------------------------------------------------------------------------| --- | --- | --- |
| afterVisibleChange | 面板展示/隐藏时动画结束触发的回调                                                             | (isVisible: boolean) => void | - | 1.0.0 |
| bodyStyle | 面板内容的样式                                                                       | CSSProperties | - | - |
| className | 类名                                                                            | string | - | - |
| closable | 是否允许通过右上角的关闭按钮关闭                                                              | boolean | true | - |
| closeIcon | 关闭按钮的 icon                                                                 | ReactNode | <IconClose /\> | - |
| closeOnEsc | 允许通过键盘事件 Esc 触发关闭                                                             | boolean | false | 1.0.0 |
| disableScroll | 默认渲染在 document.body 层时是否禁止 body 的滚动，即给 body 添加 `overflow: hidden`             | boolean | true | - |
| footer | 侧边栏底部                                                                         | ReactNode | null | 1.3.0 |
| getPopupContainer | 指定父级 DOM，弹层将会渲染至该 DOM 中，自定义需要设置 `position: relative` 这会改变浮层 DOM 树位置，但不会改变视图渲染位置。                          | () => HTMLElement | - | 0.29.0 |
| headerStyle | 面板头部的样式                                                                       | CSSProperties | - | 1.0.0 |
| height | 高度，位置为 `top` 或 `bottom` 时生效                                                   | number \| string | 400 | - |
| keepDOM | 关闭 SideSheet 时是否保留内部组件不销毁                                                     | boolean | false | 1.18.0|
| mask | 是否显示遮罩，在 `0.29.0` 版本之后，当 `mask={false}` 时允许对外部区域进行操作                          | boolean | true | - |
| maskClosable | 是否允许通过点击遮罩来关闭面板                                                               | boolean | true | - |
| maskStyle | 遮罩的样式                                                                         | CSSProperties | - | - |
| motion | 是否允许动画                                                                        | boolean | true | - |
| placement | 侧边栏滑出位置，支持`top`, `bottom`, `left`, `right`                                    | string | `right` | - |
| size | 尺寸，支持 `small`(448px)， `medium`(684px), `large`(920px)，仅在 `left` 或 `right` 时生效 | string | `small` | 0.29.0 |
| style | 可用于设置样式                                                                       | CSSProperties | - | - |
| title | 面板的标题                                                                         | ReactNode | - | - |
| visible | 面板是否可见                                                                        | boolean | false | - |
| width | 宽度，位置为 `left` 或 `right` 时生效                                                   | number \| string | 448 | - |
| zIndex | 弹层 z-index 值                                                                  | number | 1000 | 0.29.0 |
| onCancel | 取消面板时的回调函数                                                                    | (e: MouseEvent) => void | - | - |

## Accessibility

### ARIA

- SideSheet 具有 `dialog` role 来表示它是一个弹窗组件， 内部 header 具有 `heading` role 表明是 header。

## 设计变量

<DesignToken/>

## FAQ:

-   SideSheet 会自动禁止 body 的滚动吗？当 SideSheet 是默认渲染在 body 中时（即不传入 getPopupContainer 参数），会在打开时自动给 body 添加 `overflow: hidden` 来禁止滚动。可以通过 `disableScroll={false}` 允许滚动。
