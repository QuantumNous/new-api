---
localeCode: en-US
order: 79
category: Show
title: SideSheet
subTitle: SideSheet
icon: doc-sidesheet
brief: An overlay panel that slides out from the edge of the screen, typically used to host secondary action pages.
---

## Demos

### How to import
```jsx import
import { SideSheet } from '@douyinfe/semi-ui';
```

### Basic Usage

By default, SideSheet slides from the right side of the screen and could be closed by clicking on the mask.

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
            <SideSheet title="Sidesheet" visible={visible} onCancel={change}>
                <p>This is the content of a basic sidesheet.</p>
                <p>Here is more content...</p>
            </SideSheet>
        </>
    );
};
```

### Placement

You could use `placement` to set the position from which SideSheet comes in, supporting one of `top`, `bottom`, `left`, `right`。

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
            <SideSheet title="Sidesheet" visible={visible} onCancel={change} placement={placement}>
                <p>This is the content of a basic sidesheet.</p>
                <p>Here is more content...</p>
            </SideSheet>
        </>
    );
};
```

### Size

You could use `size` to set the size of SideSheet, supporting one of `small`(448px), `medium`(684px), and `large`(920px). Only takes effects when `placement` is set to `left` or `right`, and used after `v0.29.0`. If the default size does not meet your needs, you can also set the width by setting the `width` property, for example `width={900}` / `width={'800px'}`

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
            <SideSheet title="SideSheet" visible={visible} onCancel={change} size={size}>
                <p>This is the content of a basic sidesheet.</p>
                <p>Here is more content...</p>
            </SideSheet>
        </>
    );
};
```

### Non-blocking Workflow

After `v0.29.0`, you could set `mask={false}` to continue working on the area outside SideSheet.

<Notice title='Tips'>
  By default, if you are not setting `getPopupContainer`, SideSheet is rendered inside body. If you want body element to be able to scroll, you could set disableScroll to false and the component will not add `overflow: hidden` to it.
</Notice>

```jsx live=true
import React, { useState } from 'react';
import { SideSheet, Button, TextArea } from '@douyinfe/semi-ui';

() => {
    const [visible, setVisible] = useState(false);
    const [value, setValue] = useState('');
    return (
        <>
            <Button onClick={() => setVisible(true)}>Open SideSheet</Button>
            <TextArea placeholder="Please enter something" onChange={value => setValue(value)} style={{ marginTop: 12 }}/>
            <SideSheet title="SideSheet" visible={visible} onCancel={() => setVisible(false)} mask={false} disableScroll={false}>
                <p>Here is what you entered: </p>
                <p>{value}</p>
            </SideSheet>
        </>
    );
};
```

### Rendered Inside Container

After `v0.29.0`, you could use `getPopupContainer` to render SideSheet in targeted DOM. 

<Notice title='Tips'>
  The container must have `overflow: hidden` to avoid animated SideSheet overflows.
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
                title="SideSheet"
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

### Customized Content

Use `title`, `footer`(v>=1.3.0) and other Semi Components, you could create customized information display layers.

```jsx live=true hideInDSM
import React from 'react';
import { SideSheet, Button, Typography, Banner, Form } from '@douyinfe/semi-ui';

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
                <Button style={{ marginRight: 8 }}>Reset</Button>
                <Button theme="solid">Submit</Button>
            </div>
        );
        return (
            <>
                <Button onClick={() => this.show()}>More Information</Button>
                <SideSheet
                    title={<Typography.Title heading={4}>Create New Package</Typography.Title>}
                    headerStyle={{ borderBottom: '1px solid var(--semi-color-border)' }}
                    bodyStyle={{ borderBottom: '1px solid var(--semi-color-border)' }}
                    visible={this.state.visible}
                    footer={footer}
                    onCancel={() => this.handleCancel()}
                >
                    <Form>
                        <DatePicker
                            field="date"
                            type="dateTime"
                            initValue={new Date()}
                            style={{ width: 272 }}
                            label={{ text: 'Created Time', required: true }}
                        />
                        <RadioGroup
                            field="type"
                            label="Target Operating System"
                            direction="horizontal"
                            initValue={'all'}
                        >
                            <Radio value="all">All</Radio>
                            <Radio value="ios">iOS</Radio>
                            <Radio value="android">Android</Radio>
                            <Radio value="web">Web</Radio>
                        </RadioGroup>
                        <RadioGroup field="origin" label="Package Origin" direction="horizontal" initValue={'scm'}>
                            <Radio value="scm">Uploaded From SCM</Radio>
                            <Radio value="manual">Uploaded Manually</Radio>
                        </RadioGroup>
                        <Banner
                            fullMode={false}
                            icon={null}
                            closeIcon={null}
                            bordered
                            description={
                                <Typography.Text>
                                    Software Config Management (SCM) is a platform for publish and manage code versions.
                                    You can compile and manage code versions in this platform.
                                </Typography.Text>
                            }
                        />
                        <br />
                        <Select
                            field="users"
                            label={{ text: 'Created User', required: true }}
                            style={{ width: 560 }}
                            multiple
                            initValue={['1', '2', '3', '4']}
                        >
                            <Select.Option value="1">Tianyi Lee</Select.Option>
                            <Select.Option value="2">Chen Qu</Select.Option>
                            <Select.Option value="3">Yan Cai</Select.Option>
                            <Select.Option value="4">Wenzhuo Cui</Select.Option>
                        </Select>
                    </Form>
                </SideSheet>
            </>
        );
    }
}
```

## API Reference

| Properties | Instructions                                                                                                               | type | Default | Version |
| --- |----------------------------------------------------------------------------------------------------------------------------| --- | --- | --- |
| afterVisibleChange | Callback function when animation of SideSheet ends                                                                         | (isVisible: boolean) => void | - | 1.0.0 |
| bodyStyle | Content style                                                                                                              | CSSProperties | - | - |
| className | Class name                                                                                                                 | string | - | - |
| closable | Toggle whether to show close button                                                                                        | boolean | true | - |
| closeIcon         | Icon for close button                                                                                              | ReactNode | <IconClose /\>    | - |
| closeOnEsc | oggle whether to allow close modal by keyboard event Esc                                                                   | boolean | false | 1.0.0 |
| disableScroll | Toggle whether to add `overflow: hidden` to document.body element. Only works when not setting `getPopupContainer`         | boolean | true | - |
| footer | Footer                                                                                                                     | ReactNode | null | 1.3.0 |
| getPopupContainer | Container where to render SideSheet inside, you need to set 'position: relative`  This will change the DOM tree position, but not the view's rendering position.                                           | () => HTMLElement | - | 0.29.0 |
| headerStyle | Header style                                                                                                               | CSSProperties | - | 1.0.0 |
| height | Height, takes effect when `placement` is set to `top` or `bottom`                                                          | number \| string | 400 | - |
| keepDOM | Keep components inside when closing sideSheet<br/>**v1.18.0 provided**                                                     | boolean | false |
| mask | Toggle whether to show mask. After `v0.29.0`, when `mask={false}`, you could continue operations outside SideSheet         | boolean | true | - |
| maskClosable | Toggle whether to allow closing when clicking mask                                                                         | boolean | true | - |
| maskStyle | Mask style                                                                                                                 | CSSProperties | - | - |
| motion | Toggle whether to turn on animation                                                                                        | boolean | true | - |
| placement | Sliding position, one of `top`, `bottom`, `left`, `right`                                                                  | string | `right` | - |
| size | Size, one of `small`(448px)， `medium`(684px), `large`(920px), only take effects when placement is set to `left` or `right` | string | `small` | 0.29.0 |
| style | Inline style                                                                                                               | CSSProperties | - | - |
| title | Title                                                                                                                      | ReactNode | - | - |
| visible | Toggle visibility of the SideSheet                                                                                         | boolean | false | - |
| width | Width, takes effect when `placement` is set to `left` or `right`                                                           | number \| string | 448 | - |
| zIndex | Z-index value for SideSheet                                                                                                | number | 1000 | 0.29.0 |
| onCancel | Callback function when clicking cancel button                                                                              | (e: MouseEvent) => void | - | - |

## Accessibility

### ARIA

- SideSheet has a `dialog` role to indicate that it is a pop-up component, and the internal header has a `heading` role to indicate that it is a header.

## Design Tokens

<DesignToken/>
