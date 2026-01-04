---
localeCode: en-US
order: 83
category: Show
title: Tooltip
subTitle: Tooltip
icon: doc-tooltip
width: 65%
brief: Tooltip is used to identify an element or attach a small amount of auxiliary information. The most typical scenario is to explain the meaning of the icon to the user, display the truncated text, display the description of the picture, and so on.
---

## Demos

### How to import

```jsx import
import { Tooltip } from '@douyinfe/semi-ui';
```

### Cautions

Tooltip needs to apply DOM event listeners to children. If the child element is a custom component, you need to ensure that it can pass properties to the underlying DOM element 

At the same time, in order to calculate the positioning of the popup layer, it is necessary to obtain the real DOM elements of the children, so Tooltip supports the following types of children 

1. Functional components wrapped with `forwardRef` pass props and refs to the actual DOM nodes within their children.
2. Actual DOM nodes, such as span, div, p, etc.
3. Class components do not require mandatory ref binding, but must ensure that props can be passed to the actual DOM nodes. (**Note**: This rule only applies to React versions lower than v19; `@douyinfe/semi-ui` is not applicable in React v19. See [React v19 Adaptation Notes](/en-US/start/react19#%E6%B3%A8%E6%84%8F%E4%BA%8B%E9%A1%B9))

```jsx live=true noInline=true dir="column"
import React, { forwardRef } from 'react';
import { Tooltip, Space } from '@douyinfe/semi-ui';

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

function Demo() {
    return (
        <Space>
            <Tooltip content={'semi design'}>
                <FCChildren />
            </Tooltip>
            <Tooltip content={'semi design'}>
                <MyComponent />
            </Tooltip>
            <Tooltip content={'semi design'}>
                <span style={style}>DOM</span>
            </Tooltip>
        </Space>
    );
}
render(Demo);

```

### Position

The direction and alignment position of the popup layer can be configured through `position`. For detailed optional values of position, please refer to the API document below 

When configured as `topLeft`, it pops up, and the popup layer is left-aligned with the children (when arrowPointAtCenter=false) . 
When configured as `topRight`, it pops up, and the popup layer is right-aligned with the children (when arrowPointAtCenter=false) . 
Same for other directions

```jsx live=true dir="column"
import React from 'react';
import { Tooltip, Tag } from '@douyinfe/semi-ui';

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
        <div>
            <div style={{ marginLeft: 80, whiteSpace: 'nowrap' }}>
                {tops.map((pos, index) => (
                    <Tooltip
                        content={
                            <article>
                                <p>hi bytedance</p>
                                <p>hi bytedance</p>
                            </article>
                        }
                        arrowPointAtCenter={false}
                        position={Array.isArray(pos) ? pos[0] : pos}
                        key={index}
                    >
                        <Tag style={{ margin: 8, padding: 20 }}>{Array.isArray(pos) ? pos[1] : pos}</Tag>
                    </Tooltip>
                ))}
            </div>
            <div style={{ width: 80, float: 'left' }}>
                {lefts.map((pos, index) => (
                    <Tooltip
                        content={
                            <article>
                                <p>hi bytedance</p>
                                <p>hi bytedance</p>
                            </article>
                        }
                        arrowPointAtCenter={false}
                        position={Array.isArray(pos) ? pos[0] : pos}
                        key={index}
                    >
                        <Tag style={{ margin: 8, padding: 20, width: 60 }}>{Array.isArray(pos) ? pos[1] : pos}</Tag>
                    </Tooltip>
                ))}
            </div>
            <div style={{ width: 40, marginLeft: 300 }}>
                {rights.map((pos, index) => (
                    <Tooltip
                        content={
                            <article>
                                <p>hi bytedance</p>
                                <p>hi bytedance</p>
                            </article>
                        }
                        arrowPointAtCenter={false}
                        position={Array.isArray(pos) ? pos[0] : pos}
                        key={index}
                    >
                        <Tag style={{ margin: 8, padding: 20, width: 60 }}>{Array.isArray(pos) ? pos[1] : pos}</Tag>
                    </Tooltip>
                ))}
            </div>
            <div style={{ marginLeft: 80, clear: 'both', whiteSpace: 'nowrap' }}>
                {bottoms.map((pos, index) => (
                    <Tooltip
                        content={
                            <article>
                                <p>hi bytedance</p>
                                <p>hi bytedance</p>
                            </article>
                        }
                        arrowPointAtCenter={false}
                        position={Array.isArray(pos) ? pos[0] : pos}
                        key={index}
                    >
                        <Tag style={{ margin: 8, padding: 20, width: 60 }}>{Array.isArray(pos) ? pos[1] : pos}</Tag>
                    </Tooltip>
                ))}
            </div>
        </div>
    );
}
```


### Arrow Point at Center

By default `arrowPointAtCenter=true`, the small triangle always points to the center of the children element.  
You can set it to false and the little triangle will no longer keep pointing to the center of the element. The popover is aligned to the edges of the children 

```jsx live=true
import React from 'react';
import { Tooltip, Button } from '@douyinfe/semi-ui';

function Demo() {
    return (
        <>
            <div>
                <Tooltip
                    position='topLeft'
                    content='semi design tooltip'>
                    <Button type='secondary' style={{ marginRight: 8 }}>Arrow Point at Center</Button>
                </Tooltip>
            </div>

            <div style={{ marginTop: 20 }}>
                <Tooltip
                    content='semi design tooltip'
                    arrowPointAtCenter={false}
                    position='topLeft'
                >
                    <Button type='secondary' style={{ marginRight: 8, width: 120 }}>Edge align</Button>
                </Tooltip>
            </div>
        </>
    );
};

```

### Trigger Timing

-   Configure the timing of the trigger display, the default is `hover`, optional `hover` / `focus` / `click` / `custom` . 
-   When set to `custom`, it needs to be used in conjunction with the `visible`attribute, at which point the display is completely controlled 

```jsx live=true hideInDSM
import React, { useState } from 'react';
import { Tooltip, Button, ButtonGroup, Input } from '@douyinfe/semi-ui';

function Demo() {
    const [visible, setVisible] = useState(false);
    // Container needs to set position: relative
    const getPopupContainer = () => document.querySelector('#tooltip-container');

    return (
        <div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }} id="tooltip-container">
            <div style={{ width: '150%', height: '150%', paddingLeft: 50, paddingTop: 50 }}>
                <Tooltip content={'hi bytedance'} getPopupContainer={getPopupContainer}>
                    <Button style={{ marginBottom: 20 }}>Hover to show</Button>
                </Tooltip>
                <br />
                <Tooltip content={'hi bytedance'} trigger="click" getPopupContainer={getPopupContainer}>
                    <Button style={{ marginBottom: 20 }}>Click to show</Button>
                </Tooltip>
                <br />
                <Tooltip content={'hi bytedance'} trigger="focus" getPopupContainer={getPopupContainer}>
                    <Input style={{ width: 150, marginBottom: 20 }} placeholder="Focus to show" />
                </Tooltip>
                <br />
                <Tooltip
                    content={'hi bytedance'}
                    trigger="custom"
                    visible={visible}
                    getPopupContainer={getPopupContainer}
                >
                    <span style={{ display: 'inline-block' }}>
                        <ButtonGroup>
                            <Button onClick={() => setVisible(true)}>Controlled show</Button>
                            <Button onClick={() => setVisible(false)}>Controlled hide</Button>
                        </ButtonGroup>
                    </span>
                </Tooltip>
            </div>
        </div>
    );
}
```

### Override Style

Configure specific styles for the pop-up layer through the `className` and `style` API, such as overriding the default maxWidth (240px)

```jsx live=true
import React from 'react';
import { Tooltip, Tag } from '@douyinfe/semi-ui';

() => {
    return (
        <Tooltip
            style={{
                maxWidth: 320,
            }}
            className="another-classname"
            content={'hi semi semi semi semi semi semi semi'}
        >
            <Tag style={{ marginRight: '8px' }}>Custom Style And ClassName</Tag>
        </Tooltip>
    );
};
```

### Render to Specified DOM

With `getPopupContainer` the bullet layer will be rendered to the DOM returned by the function.

**It should be noted that:** The returned container, if not `document.body`,**`position` Will be set by default `"relative"`**(Version > = 0.18.0).

```jsx live=true hideInDSM
import React from 'react';
import { Tooltip, Tag } from '@douyinfe/semi-ui';

function Demo() {
    return (
        <div id="tooltip-wrapper" style={{ position: 'relative' }}>
            <Tooltip
                position="right"
                content="Popup will be rendered in element#tooltip-wrapper"
                trigger="click"
                getPopupContainer={() => document.querySelector('#tooltip-wrapper')}
            >
                <Tag>Click here</Tag>
            </Tooltip>
        </div>
    );
}
```

### Use with Popver or Popconfirm

Tooltip, Popconfirm, and Popover all need to hijack related events of children (onMouseEnter / onMouseLeave / onClick ....) to configure `trigger`. If used directly, it will invalidate the outer trigger.  
Need to add a layer of elements (div or span) in the middle to prevent trigger event hijack failure.

```jsx live=true hideInDSM
import React from 'react';
import { Popconfirm, Tooltip, Button } from '@douyinfe/semi-ui';

() => (
    <Popconfirm content="Are you sure to delete this comment" title='Confirm Delete'>
        <span style={{ display: 'inline-block' }}>
            <Tooltip content={'Delete Comment'}>
                <Button type="danger">Delete</Button>
            </Tooltip>
        </span>
    </Popconfirm>
);
```

## API Reference

---

| Properties | Instructions                                                                                                                                                                                                                | Type | Default | Version |
| --- |-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------| --- | --- | --- |
| autoAdjustOverflow | Whether the floating layer automatically adjusts its direction when it is blocked                                                                                                                                           | boolean | true |  |
| arrowPointAtCenter | Whether the "small triangle" points to the center of the element, you need to pass in "showArrow = true" at the same time                                                                                                   | boolean | true | **0.34.0** |
| className | Pop-up layer classname                                                                                                                                                                                                      | string |  |  |
| content | Pop-up layer content                                                                                                                                                                                                        | string | ReactNode |  |
| clickToHide | Whether to automatically close the elastic layer when clicking on the floating layer and any element inside                                                                                                                 | boolean | false | **0.24.0** |
| disableFocusListener | When trigger is `hover`, does not respond to the keyboard focus popup event, see details at [issue#977](https://github.com/DouyinFE/semi-design/issues/977)                                                                 | boolean | false | **2.17.0** |
| getPopupContainer | Specifies the parent DOM, and the bullet layer will be rendered to the DOM  This will change the DOM tree position, but not the view's rendering position.                                                                                                                                                  | () => HTMLElement | () => document.body |
| keepDOM | Whether to keep internal components from being destroyed when closing                                                                                                                                                       | boolean | false | **2.31.0** |
| margin | Calculate the added redundancy value when overflowing, see [issue#549](https://github.com/DouyinFE/semi-design/issues/549)                                                                                                  | number ｜ { marginLeft: number; marginTop: number; marginRight: number; marginBottom: number } | 0 |  **2.23.0**|
| mouseEnterDelay | After the mouse is moved in, the display delay time, in milliseconds (only effective when the trigger is hover/focus)                                                                                                       | number | 50 |  |
| mouseLeaveDelay | The time for the delay to disappear after the mouse is moved out, in milliseconds (only effective when the trigger is hover/focus), and is not less than mouseEnterDelay                                                    | number | 50 |  |
| motion | Whether to show the pop-up motion                                                                                                                                                                                           | boolean | true |  |
| position | Pop-up layer display position, optional value: `top`, `topLeft`, `topRight`, `left`, `leftTop`, `leftBottom`, `right`, `rightTop`, `rightBottom`, `bottom`, `bottomLeft`, `bottomRight`                                     | string | 'top' |  |
| prefixCls | The `className` prefix of the pop-up layer wrapper div. When this item is set, the pop-up layer will no longer have the style of Tooltip.                                                                                   | string | 'semi-tooltip ' |  |
| preventScroll | Indicates whether the browser should scroll the document to display the newly focused element, acting on the focus method inside the component, excluding the component passed in by the user                               | boolean |  |  |
| rePosKey | This value can be updated to manually trigger the repositioning of the pop-up layer.                                                                                                                                        | string | number |  |
| style | Pop-up layer inline style                                                                                                                                                                                                   | object |  |  |
| spacing | The distance between the pop-up layer and the `children`. object type props supported after v2.45 element                                                                                                                                                            | number ｜ <ApiType detail='{ x: number; y: number }'>SpacingObject</ApiType>|  |  |
| showArrow | Does it show an arrow triangle?                                                                                                                                                                                             | boolean | true |  |
| stopPropagation | Whether to prevent click events on the bomb layer from bubbling                                                                                                                                                             | boolean | false | **0.34.0** |
| transformFromCenter | Whether to transform from the horizontal or vertical center of the element of the package, this parameter affects only the `tansform-origin 'of the dynamic effect transformation and generally does not need to be changed | boolean | true |
| trigger | Timing of triggering display, optional value: `hover`/`focus`/`click`/`custom`                                                                                                                                              | string | 'hover' |  |
| visible | Whether to show the pop-up layer, need to be used with trigger='custom'                                                                                                                                                                                          | boolean |  |  |
| wrapperClassName | When children are disabled or children are multiple elements, the outer layer will wrap a layer of span elements, and the api is used to set the style class name of this span                                              | string |  | 1.32.0 |
| wrapperId | The id of the wrapper node of the popup layer. The aria attribute of the trigger points to this id.                                                                                                                         | string |  | 2.11.0  |
| zIndex              | Bullet levels.                                                                                                                                                                                                              | number                      | 1060                |            |
| onVisibleChange     | A callback triggered when the pop-up layer is displayed/hidden                                                                                                                                                              | (isVisible: boolean) => void |                     |            |
| onClickOutSide      | Callback when the pop-up layer is in the display state and the non-Children, non-floating layer inner area is clicked (only valid when trigger is custom, click)                                                            | (e:event) => void           |                     | **2.1.0** |


## Accessibility

### ARIA

- Tooltip has a tooltip role, following the definition of Tooltip in the [WAI-ARIA](https://www.w3.org/TR/wai-aria-practices/#tooltip) specification
- Tooltip's content and children
  - about content
      - The wrapper of content will be automatically added with id attribute to match the `aria-describedby` of children and associate content with children
  - about children
       - There should be an explicit connection between the content of the Tooltip and its children. Tooltip will automatically add the `aria-describedby` attribute to the children element, the value is the id of the content wraper. 
       - If the children of your Tooltip are Icon and do not contain visible text, we recommend that you add the `aria-label` attribute to the children to describe accordingly 

```js
// Good practices, add aria-label to description tooltip children
/* eslint-disable */
<Tooltip content={<p id='description'>Edit your setting</p>}>
    <IconSetting aria-label='Settings'> 
    </IconSetting>
</Tooltip>
```

## Content Guidelines

- Only display information description and guidance, do not display error information
- Only extra links and buttons not in tooltip
- Try to simplify the description to one sentence without showing punctuation marks

## Design Tokens

<DesignToken/>

## FAQ
-   **Why do some forms of content not wrap when the content in Tooltip and Typography is very long?**    
    Before the v2.36.0 version, considering that different language content (e.g. English, Chinese, combination of English and Chinese) have inconsistent requirements for line breaks, so Semi does not use a default setting. After receiving a lot of usage feedback, since the v2.36.0 version, Tooltip has internally set <a href="https://developer.mozilla.org/en-US/docs/Web/CSS/overflow-wrap" target= "_blank" rel="noopener noreferrer">word-wrap</a> handles text wrapping for break-word. For any version, if the default settings are not as expected, the user can adjust the line break related CSS properties through the style/className API.

<!-- ## Related Material

```material
41
``` -->
## Related Material
<semi-material-list code="41"></semi-material-list>