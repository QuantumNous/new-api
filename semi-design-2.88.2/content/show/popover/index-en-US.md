---
localeCode: en-US
order: 77
category: Show
title: Popover
subTitle: Popover
icon: doc-popover
brief: Click / mouse to move into the element and pop up the bubble card floating layer.
---

## When to Use

When the target element has further description and related operations, it can be included in the card and displayed according to the user's operational behavior.

The difference with Tooltip is that users can operate on elements on the floating layer, so it can carry more complex content, such as links or buttons.

## Demos

### How to import

```jsx import
import { Popover } from '@douyinfe/semi-ui';
```

### Cautions

Tooltip needs to apply DOM event listeners to children. If the child element is a custom component, you need to ensure that it can pass properties to the underlying DOM element 

At the same time, in order to calculate the positioning of the popup layer, it is necessary to obtain the real DOM elements of the children, so Popover supports the following types of children 

1. Class Component, it is not mandatory to bind ref, but you need to ensure that props can be transparently transmitted to the real DOM node 
2. Use the functional component wrapped by forwardRef to transparently transmit props and ref to the real DOM node in children 
3. Real DOM nodes, such as span, div, p...  

```jsx live=true noInline=true dir="column"
import React, { forwardRef } from 'react';
import { Popover, Space } from '@douyinfe/semi-ui';

const style={ border: '2px solid var(--semi-color-border)', paddingLeft: 4, paddingRight: 4, borderRadius: 4 };

// Spread the props to the underlying DOM element. binding ref
const FCChildren = forwardRef((props, ref) => {
    return (<span {...props} ref={ref} style={style}>Functional Component</span>);
});

// Spread the props to the underlying DOM element.
class MyComponent extends React.Component {
    render() {
        return (<span {...this.props} style={style}>ClassComponent</span>);
    }
};

const content = (<article style={{ padding: 12 }}> Hi ByteDancer, this is a popover. <br /> We have 2 lines.</article>);

function Demo() {
    return (
        <Space>
            <Popover content={content}>
                <FCChildren />
            </Popover>
            <Popover content={content}>
                <MyComponent />
            </Popover>
            <Popover content={content}>
                <span style={style}>DOM</span>
            </Popover>
        </Space>
    );
}
render(Demo);

```

### Basic Usage

```jsx live=true
import React from 'react';
import { Popover, Tag } from '@douyinfe/semi-ui';

function Demo() {
    return (
        <Popover
            content={
                <article style={{ padding: 12 }}>
                    Hi ByteDancer, this is a popover.
                    <br /> We have 2 lines.
                </article>
            }
        >
            <Tag>Hover here</Tag>
        </Popover>
    );
}
```

### Pop-up Position

Support twelve directions.

```jsx live=true
import React from 'react';
import { Popover, Tag } from '@douyinfe/semi-ui';

function Demo() {
    const tops = [
        ['topLeft', 'TL'],
        ['top', 'Top'],
        ['topRight', 'TR'],
    ];
    const lefts = [
        ['leftTop', 'LT'],
        ['left', 'Left'],
        ['leftBottom', 'LB'],
    ];
    const rights = [
        ['rightTop', 'RT'],
        ['right', 'Right'],
        ['rightBottom', 'RB'],
    ];
    const bottoms = [
        ['bottomLeft', 'BL'],
        ['bottom', 'Bottom'],
        ['bottomRight', 'BR'],
    ];

    return (
        <div style={{ paddingLeft: 40 }} className="tag-margin-right">
            <div style={{ marginLeft: 40, whiteSpace: 'nowrap' }}>
                {tops.map((pos, index) => (
                    <Popover
                        content={
                            <article style={{ padding: 12 }}>
                                Hi ByteDancer, this is a popover.
                                <br /> We have 2 lines.
                            </article>
                        }
                        position={Array.isArray(pos) ? pos[0] : pos}
                        key={index}
                    >
                        <Tag>{Array.isArray(pos) ? pos[1] : pos}</Tag>
                    </Popover>
                ))}
            </div>
            <div style={{ width: 40, float: 'left' }}>
                {lefts.map((pos, index) => (
                    <Popover
                        content={
                            <article style={{ padding: 12 }}>
                                Hi ByteDancer, this is a popover.
                                <br /> We have 2 lines.
                            </article>
                        }
                        position={Array.isArray(pos) ? pos[0] : pos}
                        key={index}
                    >
                        <Tag>{Array.isArray(pos) ? pos[1] : pos}</Tag>
                    </Popover>
                ))}
            </div>
            <div style={{ width: 40, marginLeft: 180 }}>
                {rights.map((pos, index) => (
                    <Popover
                        content={
                            <article style={{ padding: 12 }}>
                                Hi ByteDancer, this is a popover.
                                <br /> We have 2 lines.
                            </article>
                        }
                        position={Array.isArray(pos) ? pos[0] : pos}
                        key={index}
                    >
                        <Tag>{Array.isArray(pos) ? pos[1] : pos}</Tag>
                    </Popover>
                ))}
            </div>
            <div style={{ marginLeft: 40, clear: 'both', whiteSpace: 'nowrap' }}>
                {bottoms.map((pos, index) => (
                    <Popover
                        content={
                            <article style={{ padding: 12 }}>
                                Hi ByteDancer, this is a popover.
                                <br /> We have 2 lines.
                            </article>
                        }
                        position={Array.isArray(pos) ? pos[0] : pos}
                        key={index}
                    >
                        <Tag>{Array.isArray(pos) ? pos[1] : pos}</Tag>
                    </Popover>
                ))}
            </div>
        </div>
    );
}
```

### Controlled Display

In this scenario, Popover's display is completely at the control of parameter `visible`.

```jsx live=true
import React from 'react';
import { Popover, Button } from '@douyinfe/semi-ui';

class App extends React.Component {
    constructor(props = {}) {
        super(props);

        this.state = {
            visible: false,
        };

        this.content = (
            <article style={{ padding: 12 }}>
                Hi ByteDancer, this is a popover.
                <br /> We have 2 lines.
            </article>
        );

        this.toggleShow = this.toggleShow.bind(this);
    }

    toggleShow() {
        this.setState({
            visible: !this.state.visible,
        });
    }

    render() {
        const content = this.content;

        const { visible } = this.state;

        return (
            <div>
                <div>
                    <Popover visible={visible} content={content} trigger="custom">
                        <Button onClick={this.toggleShow}>Click me</Button>
                    </Popover>
                </div>
            </div>
        );
    }
}
```

### Show Small Triangle

**Version: >= 0.19.0**

Popover also supports the display of a small triangle.

> The floating layer in this mode has a default style that you can overwrite by passing the style parameters.

```jsx live=true
import React from 'react';
import { Popover, Tag } from '@douyinfe/semi-ui';

function Demo() {
    const tops = [
        ['topLeft', 'TL'],
        ['top', 'Top'],
        ['topRight', 'TR'],
    ];
    const lefts = [
        ['leftTop', 'LT'],
        ['left', 'Left'],
        ['leftBottom', 'LB'],
    ];
    const rights = [
        ['rightTop', 'RT'],
        ['right', 'Right'],
        ['rightBottom', 'RB'],
    ];
    const bottoms = [
        ['bottomLeft', 'BL'],
        ['bottom', 'Bottom'],
        ['bottomRight', 'BR'],
    ];

    return (
        <div style={{ paddingLeft: 40 }} className="tag-margin-right">
            <div style={{ marginLeft: 40, whiteSpace: 'nowrap' }}>
                {tops.map((pos, index) => (
                    <Popover
                        showArrow
                        content={
                            <article>
                                Hi ByteDancer, this is a popover.
                                <br /> We have 2 lines.
                            </article>
                        }
                        position={Array.isArray(pos) ? pos[0] : pos}
                        key={index}
                    >
                        <Tag>{Array.isArray(pos) ? pos[1] : pos}</Tag>
                    </Popover>
                ))}
            </div>
            <div style={{ width: 40, float: 'left' }}>
                {lefts.map((pos, index) => (
                    <Popover
                        showArrow
                        content={
                            <article>
                                Hi ByteDancer, this is a popover.
                                <br /> We have 2 lines.
                            </article>
                        }
                        position={Array.isArray(pos) ? pos[0] : pos}
                        key={index}
                    >
                        <Tag>{Array.isArray(pos) ? pos[1] : pos}</Tag>
                    </Popover>
                ))}
            </div>
            <div style={{ width: 40, marginLeft: 180 }}>
                {rights.map((pos, index) => (
                    <Popover
                        showArrow
                        content={
                            <article>
                                Hi ByteDancer, this is a popover.
                                <br /> We have 2 lines.
                            </article>
                        }
                        position={Array.isArray(pos) ? pos[0] : pos}
                        key={index}
                    >
                        <Tag>{Array.isArray(pos) ? pos[1] : pos}</Tag>
                    </Popover>
                ))}
            </div>
            <div style={{ marginLeft: 40, clear: 'both', whiteSpace: 'nowrap' }}>
                {bottoms.map((pos, index) => (
                    <Popover
                        showArrow
                        content={
                            <article>
                                Hi ByteDancer, this is a popover.
                                <br /> We have 2 lines.
                            </article>
                        }
                        position={Array.isArray(pos) ? pos[0] : pos}
                        key={index}
                    >
                        <Tag>{Array.isArray(pos) ? pos[1] : pos}</Tag>
                    </Popover>
                ))}
            </div>
        </div>
    );
}
```

### Arrow Point at Center

**Version: >= 0.34.0**

Under the condition of **showArrow=true**, you can pass in `arrowPointAtCenter=true` so that the small triangle always points to the center of the element.

```jsx live=true
import React from 'react';
import { Popover, Tag } from '@douyinfe/semi-ui';

function Demo() {
    const tops = [
        ['topLeft', 'TL'],
        ['top', 'Top'],
        ['topRight', 'TR'],
    ];
    const lefts = [
        ['leftTop', 'LT'],
        ['left', 'Left'],
        ['leftBottom', 'LB'],
    ];
    const rights = [
        ['rightTop', 'RT'],
        ['right', 'Right'],
        ['rightBottom', 'RB'],
    ];
    const bottoms = [
        ['bottomLeft', 'BL'],
        ['bottom', 'Bottom'],
        ['bottomRight', 'BR'],
    ];

    return (
        <div style={{ paddingLeft: 40 }} className="tag-margin-right">
            <div style={{ marginLeft: 40, whiteSpace: 'nowrap' }}>
                {tops.map((pos, index) => (
                    <Popover
                        showArrow
                        arrowPointAtCenter
                        content={
                            <article>
                                Hi ByteDancer, this is a popover.
                                <br /> We have 2 lines.
                            </article>
                        }
                        position={Array.isArray(pos) ? pos[0] : pos}
                        key={index}
                    >
                        <Tag>{Array.isArray(pos) ? pos[1] : pos}</Tag>
                    </Popover>
                ))}
            </div>
            <div style={{ width: 40, float: 'left' }}>
                {lefts.map((pos, index) => (
                    <Popover
                        showArrow
                        arrowPointAtCenter
                        content={
                            <article>
                                Hi ByteDancer, this is a popover.
                                <br /> We have 2 lines.
                            </article>
                        }
                        position={Array.isArray(pos) ? pos[0] : pos}
                        key={index}
                    >
                        <Tag>{Array.isArray(pos) ? pos[1] : pos}</Tag>
                    </Popover>
                ))}
            </div>
            <div style={{ width: 40, marginLeft: 180 }}>
                {rights.map((pos, index) => (
                    <Popover
                        showArrow
                        arrowPointAtCenter
                        content={
                            <article>
                                Hi ByteDancer, this is a popover.
                                <br /> We have 2 lines.
                            </article>
                        }
                        position={Array.isArray(pos) ? pos[0] : pos}
                        key={index}
                    >
                        <Tag>{Array.isArray(pos) ? pos[1] : pos}</Tag>
                    </Popover>
                ))}
            </div>
            <div style={{ marginLeft: 40, clear: 'both', whiteSpace: 'nowrap' }}>
                {bottoms.map((pos, index) => (
                    <Popover
                        showArrow
                        arrowPointAtCenter
                        content={
                            <article>
                                Hi ByteDancer, this is a popover.
                                <br /> We have 2 lines.
                            </article>
                        }
                        position={Array.isArray(pos) ? pos[0] : pos}
                        key={index}
                    >
                        <Tag>{Array.isArray(pos) ? pos[1] : pos}</Tag>
                    </Popover>
                ))}
            </div>
        </div>
    );
}
```

### Set Floating Layer Background Color

If you need to customize the background color or border color of the floating layer, please **Be sure to set `backgroundColor` and `borderColor` properties in `style` separately.** This enables the "small triangle" to apply the same background color and border color.

```jsx live=true
import React from 'react';
import { Popover, Tag } from '@douyinfe/semi-ui';

function Demo() {
    return (
        <div id='popup-parent' style={{ position: 'relative' }}>
            <Popover
                content={
                    <article style={{ padding: 4 }}>
                        Hi, Semi UI Popover.
                    </article>
                }
                getPopupContainer={() => document.querySelector('#popup-parent')}
                trigger='custom'
                visible
                position='right'
                showArrow
                style={{
                    backgroundColor: 'rgba(var(--semi-blue-4),1)',
                    borderColor: 'rgba(var(--semi-blue-4),1)',
                    color: 'var(--semi-color-white)',
                    borderWidth: 1,
                    borderStyle: 'solid',
                }}
            >
                <Tag
                    style={{
                        backgroundColor: 'rgba(var(--semi-blue-4),1)',
                        color: 'var(--semi-color-white)'
                    }}
                >
                    Colorful Popover
                </Tag>
            </Popover>
        </div>
    );
}
```

### Initialize the Focus Position of Popup Layer

Popover `content` also supports functions. Its input parameter is an object, which binds `initialFocusRef` to the focusable DOM or component. When the panel is opened, it will automatically focus at that position.

```jsx live=true
import React from 'react';
import { Button, Input, Popover, Space } from '@douyinfe/semi-ui';
() => {
    const renderContent = ({ initialFocusRef }) => {
        return (
            <div style={{ padding: 12 }}>
                <Space>
                    <Button>first focusable element</Button>
                    <Input ref={initialFocusRef} placeholder="focus here" />
                </Space>
            </div>
        );
    };
    return (
        <Popover content={renderContent} trigger="click">
            <Button>click me</Button>
        </Popover>
    );
};
```

### Use with Tooltip or Popconfirm

Please refer to [Use with Tooltip/Popconfirm](/en-US/show/tooltip#%E6%90%AD%E9%85%8D%20Popover%20%E6%88%96%20Popconfirm%20%E4%BD%BF%E7%94%A8)

## API Reference

| Properties | Instructions                                                                                                                                                                                                                                  | Type | Default | Version |
| --- |-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------| --- | --- | --- |
| autoAdjustOverflow | Whether to automatically adjust the expansion direction of the floating layer for automatic adjustment of the expansion direction during edge occlusion                                                                                       | boolean | true |
| arrowPointAtCenter | Whether the "small triangle" points to the center of the element, you need to pass in "showArrow = true" at the same time                                                                                                                     | boolean | true | **0.34.0** |
| className | Pop-up layer classname                                                                                                                                                                                                      | string |  |  |
| closeOnEsc | Whether to close the panel by pressing the Esc key in the trigger or popup layer. It does not take effect when visible is under controlled                                                                                                    | boolean | true | **2.8.0** |
| content | Content displayed                                                                                                                                                                                                                             | string \| ReactNode |  |
| clickToHide | Whether to automatically close the elastic layer when clicking on the floating layer and any element inside                                                                                                                                   | boolean | false | **0.24.0** |
| disableFocusListener | When trigger is `hover`, does not respond to the keyboard focus popup event, see details at [issue#977](https://github.com/DouyinFE/semi-design/issues/977)                                                                                   | boolean | true | **2.17.0** |
| getPopupContainer | Specifies the parent DOM, and the bullet layer will be rendered to the DOM, you need to set 'position: relative`  This will change the DOM tree position, but not the view's rendering position.                                                                                                                              | () => HTMLElement | () => document.body |
| guardFocus | When the focus is in the popup layer, toggle whether the Tab makes the focus loop in the popup layer                                                                                                                                          | boolean | true | **2.8.0** |
| keepDOM | Whether to keep internal components from being destroyed when closing                                                                                                                                                                         | boolean | false | **2.31.0** |
| margin | Popup layer calculates the size of the safe area when the current direction overflows, used in scenes covered by fixed elements, more detail refer to [issue#549](https://github.com/DouyinFE/semi-design/issues/549), same as Tooltip margin | object\|number |  | 2.25.0 |
| mouseEnterDelay | After the mouse is moved in, the display delay time, in milliseconds (only effective when the trigger is hover/focus)                                                                                                                         | number | 50 |  |
| mouseLeaveDelay | The time for the delay to disappear after the mouse is moved out, in milliseconds (only effective when the trigger is hover/focus)                                                                                                            | number | 50 |  |
| rePosKey | You can update the value of this item to manually trigger the repositioning of the pop-up layer                                                                                                                                               | string\|number |  |  |
| returnFocusOnClose | After pressing the Esc key, whether the focus returns to the trigger, it only takes effect when the trigger is set to hover, focus, click, etc                                                                                                | boolean | true | **2.8.0** |
| visible | Display popup or not                                                                                                                                                                                                                          | boolean |  |
| position | Directions, optional values: `top`, `topLeft`, `topRight`, `left`, `leftTop`, `leftBottom`, `right`, `rightTop`, `rightBottom`, `bottom`, `bottomLeft`, `bottomRight`                                                                         | string | "bottom" |
| spacing | The distance between the out layer and the children element, in px. object type props supported after v2.45                                                                                                                                                                            | number｜ <ApiType detail='{ x: number; y: number }'>SpacingObject</ApiType>  | 4(while showArrow=false) 10(while showArrow=true) |  |
| showArrow | Display little arrow or not                                                                                                                                                                                                                   | boolean |  |
| trigger | Trigger mode, optional value: `hover`, `focus`, `click`, `custom`                                                                                                                                                                             | string | 'hover' |
| stopPropagation | Whether to prevent click events on the bomb layer from bubbling                                                                                                                                                                               | boolean | false | **0.34.0** |
| style | Pop-up layer inline style                                                                                                                                                                                                   | object |  |  |
| zIndex | Floating layer z-index value                                                                                                                                                                                                                  | number | 1030 |
| onClickOutSide  | Callback when the pop-up layer is in the display state and the non-Children, non-floating layer inner area is clicked (only valid when trigger is custom, click)                                                                              | (e:event) => void | | **2.1.0** |
| onEscKeyDown | Called when Esc key is pressed in trigger or popup layer                                                                                                                                                                                      | function(e:event) | | **2.8.0** |
| onVisibleChange | A callback triggered when the pop-up layer is displayed / hidden                                                                                                                                                                              | (isVisible: boolean) => void |  |

## Accessibility

### ARIA

-  About role
   - If the trigger is set to `click`、`custom`, the PopoverContent element has role set to `dialog`.
   - If the trigger is set to hover, it has role set to `tooltip`.
- Popover's content
   - The content wrapper will be automatically added with the id attribute
- Popover's children 
  - Will be automatically added [aria-expanded](https://www.w3.org/TR/wai-aria-1.1/#aria-expanded) attribute, when Popover is visible, the attribute value is `true`, when invisible Is `false`
  - Will be automatically added [aria-haspopup](https://www.w3.org/TR/wai-aria-1.1/#aria-haspopup) attribute, which is `dialog`
  - Will be automatically added [aria-controls](https://www.w3.org/TR/wai-aria-1.1/#aria-controls) attribute, which is the id of the content wrapper

### Keyboard and Focus

- When the Popover trigger method is set to `hover`: Open the Popover when the mouse is hovered or focused
- When the Popover trigger method is set to `click`: Click the trigger or focus and use the Enter key to open the Popover
- After the Popover is activated, press the `arrow key` ⬇️ to move the focus to the Popover. At this time, the focus is on the first interactive element in the Popover by default, and the user can also customize the focus position (if there is no interactive element in the Popover, it will appear as No response)
- Use the `Tab` key when the focus is in the Popover, the focus will cycle in the Popover, and use `Shift + Tab` to move the focus in the opposite direction
- Keyboard users can close the Popover by pressing `Esc`, after closing the focus returns to the trigger (when the trigger is click)

## Design Tokens

<DesignToken/>

## FAQ

-   **Why the position of the popover overlay card and the relative position of the overlay trigger are not as expected?**  
    Popover relies on Tooltip at the bottom. In order to calculate positioning, Tooltip needs to obtain the real DOM elements of children. Therefore, the Popover type currently supports the following two types of children:
    1. The Jsx type of the real dom node, such as span, div, p...
    2. Use the FunctionComponent wrapped by forwardRef to pass props and ref to the real dom node

    When Semi Input with prefix is used as children, even if the same width of Input and Popover content are set, the position of the floating card is still positioned relative to the input box that does not contain the prefix part. At this time, just put another div on the outer layer of the children to solve the problem.
- **Why does the popover layer card lose its width and wrap unexpectedly when the width is not enough near the screen border?**

     After Chromium 104, the wrapping rendering strategy when the width of the screen border text is not enough has changed. For details, see [issue #1022](https://github.com/DouyinFE/semi-design/issues/1022), the semi-side has been This problem was fixed in v2.17.0.
