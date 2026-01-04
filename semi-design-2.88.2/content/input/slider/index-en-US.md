---
localeCode: en-US
order: 46
category: Input
title:  Slider
subTitle: Slider
icon: doc-slider
brief: Selector to quickly select a number or range of values using drag interaction, more intuitive than InputNumber
---


## Demos

### How to import

```jsx import
import { Slider } from '@douyinfe/semi-ui';
```
### Basic Usage

You can set `range={true}` to allow slider slide from both sides.

```jsx live=true
import React from 'react';
import { Slider } from '@douyinfe/semi-ui';

() => (
    <div>
        <div>
            <div>Default</div>
            <Slider aria-label='Slider default' showBoundary={true}></Slider>
        </div>
        <br/>
        <br/>
        <div>
            <div>Range</div>
            <Slider aria-label='Slider range' defaultValue={[20, 60]} range></Slider>
        </div>
        <br/>
        <br/>
        <div>
            <div>Disabled</div>
            <Slider aria-label='Slider disabled' defaultValue={40} disabled></Slider>
        </div>
    </div>
);
```

### With Input

Synchronize slider with input value.

```jsx live=true
import React from 'react';
import { Slider, InputNumber } from '@douyinfe/semi-ui';

class InputSlider extends React.Component {
    constructor(props) {
        super();
        this.state = { value: 10 };
        this.getSliderValue = this.getSliderValue.bind(this);
    }

    getSliderValue(value) {
        if (isNaN(Number(value))){
            return;
        }
        this.setState({ value: value / 1 });
    }

    render() {
        const { value } = this.state;
        return (
            <div>
                <div style={{ width: 320, marginRight: 15 }}>
                    <Slider step={1} value={value} onChange={(value) => (this.getSliderValue(value))} ></Slider>
                </div>
                <InputNumber onChange={(v) => this.getSliderValue(v)} style={{ width: 100 }} value={value} min={0} max={100} />
            </div>
        );
    }
}
```

### Tooltip

You can use `tipFormatter` to format Tooltip content or set `tipFormatter={null}`to hide Tooltip.

```jsx live=true
import React from 'react';
import { Slider } from '@douyinfe/semi-ui';

() => (
    <div>
        <Slider tipFormatter={v => (`${v}%`)} />
        <br/>
        <br/>
        <Slider tipFormatter={null} />
    </div>
);
```

### With Tag

Use `marks` to label measures on sliders.

```jsx live=true
import React from 'react';
import { Slider } from '@douyinfe/semi-ui';

() => (
    <div>
        <div>step=10</div>
        <Slider step={10} marks={{ 0: '0', 10: '10', 20: '20', 30: '30', 40: '40', 50: '50', 100: '100' }} defaultValue={[10, 100]} range={true}></Slider>
        <br/>
        <br/>
        <div>step=0.1</div>
        <Slider step={0.1} marks={{ 0.1: '0.1', 0.2: '0.2', 0.3: '0.3', 0.4: '0.4', 0.5: '0.5' }} min={0} max={1} defaultValue={[0.1, 0.5]} range={true}></Slider>
        <br/>
        <br/>
        <div>Marks</div>
        <Slider marks={{ 20: '20°C', 40: '40°C' }} defaultValue={[0, 100]} range={true} tipFormatter={v => (`${v}°C`)} getAriaValueText={(value) => `${value}°C`}></Slider>
        <br/>
        <br/>
        <div>Included</div>
        <Slider marks={{ 20: '20°C', 40: '40°C' }} included={false} defaultValue={[0, 100]} range={true} tipFormatter={v => (`${v}°C`)} getAriaValueText={(value) => `${value}°C`}></Slider>
    </div>
);
```


### Segmented Background
To create a slider with segmented background, you could use CSS property `linear-gradient` for `railStyle` along with `onChange` to change background dynamically。
```jsx live=true
import React from 'react';
import { Slider } from '@douyinfe/semi-ui';

class SegSlider extends React.Component {
    constructor(props) {
        super();
        this.state = { value: [20, 60] };
        this.changeValue = this.changeValue.bind(this);
        this.getRailStyle = this.getRailStyle.bind(this);
    }

    changeValue(value) {
        this.setState({ value });
    }

    getRailStyle(range) {
    // color of second segment inherits from .semi-slider-track
        const color = ['var(--semi-color-danger)', 'transparent', 'var(--semi-color-success)'];
        const gradientPos = this.state.value.map(val => 
            ((val - range[0]) / (range[1] - range[0])).toFixed(2) * 100
        );
        const style = {
            background: `linear-gradient(to right, ${color[0]} ${gradientPos[0]}%, ${color[1]} ${gradientPos[0]}%, ${color[1]} ${gradientPos[1]}%, ${color[2]} ${gradientPos[1]}%)`
        };
        return style;
    }

    render() {
        const range = [10, 100];
        const railStyle = this.getRailStyle(range);
        return (
            <Slider
                range
                min={range[0]}
                max={range[1]}
                onChange={this.changeValue}
                railStyle={railStyle}
                defaultValue={this.state.value}
            />
        );
    }
}
```

### Controlled Component

You can use `value` along with `onChange` property if you want to use Slider as a controlled component.

```jsx live=true
import React from 'react';
import { Slider, Button } from '@douyinfe/semi-ui';

class ControllSlider extends React.Component {
    constructor(props) {
        super();
        this.state = { value: 10 };
        this.changeValue = this.changeValue.bind(this);
    }

    changeValue() {
        this.setState({ value: this.state.value + 10 });
    }

    render() {
        return (
            <div>
                <Button onClick={this.changeValue} style={{ marginRight: 20 }}>Click to change value</Button>
                <br/>
                <br/>
                <Slider value={this.state.value}></Slider>
            </div>
        );
    }
}
```

### Vertical

```jsx live=true
import React from 'react';
import { Slider } from '@douyinfe/semi-ui';

() => (
    <div>
        <div style={{ height: 300, marginLeft: 30, marginTop: 10, paddingRight: 30, display: 'inline-block' }}>
            <Slider vertical></Slider>
        </div>
        <div style={{ height: 300, marginLeft: 30, marginTop: 10, paddingRight: 30, display: 'inline-block' }}>
            <Slider vertical verticalReverse></Slider>
        </div>
        <div style={{ height: 300, marginLeft: 30, marginTop: 10, paddingRight: 30, display: 'inline-block' }}>
            <Slider vertical range defaultValue={[20, 60]}></Slider>
        </div>
        <div style={{ height: 300, marginLeft: 30, marginTop: 10, paddingRight: 30, display: 'inline-block' }}>
            <Slider vertical verticalReverse range defaultValue={[20, 60]}></Slider>
        </div>
        <div style={{ height: 300, marginLeft: 30, marginTop: 10, paddingRight: 30, display: 'inline-block' }}>
            <Slider vertical range marks={{ 20: '20°C', 40: '40°C' }} step={10} defaultValue={[20, 60]}></Slider>
        </div>
        <div style={{ height: 300, marginLeft: 30, marginTop: 10, paddingRight: 30, display: 'inline-block' }}>
            <Slider vertical verticalReverse range marks={{ 20: '20°C', 40: '40°C' }} step={10} defaultValue={[20, 60]}></Slider>
        </div>
    </div>
);
```

### Handle with dot
```jsx live=true
  <div>
        <div>
            <div>Default</div>
            <Slider showBoundary={true} handleDot={{size:'4px',color:'blue'}}></Slider>
        </div>
        <br/>
        <br/>
        <div>
            <div>Range</div>
            <Slider defaultValue={[20, 60]} range handleDot={[{size:'4px',color:'blue'},{size:'4px',color:'pink'}]}></Slider>
        </div>
    </div>
```

## API Reference

| Property         | Instructions                                                                                                                                                                                                                                                                                          | type                                                                           | Default | Version | 
|------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------|---------|------ |
| aria-label       | [aria-label](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-label) used to define a string that labels the current element. Use it in cases where a text label is not visible on the screen                                                                          | string                                                                         | -       |-|
| aria-labelledby  | [aria-labelledby](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-labelledby) attribute establishes relationships between objects and their label(s), and its value should be one or more element IDs, which refer to elements that have the text needed for labeling | string                                                                         | -       |-|
| aria-valuetext   | [aria-valuetext](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-valuetext) used to provide a user-friendly name for the current value of the slider                                                                                                                  | string                                                                         | -       |-|
| defaultValue     | Default value                                                                                                                                                                                                                                                                                         | number \| number[]                                                             | 0       |- |
| disabled         | Disable slider                                                                                                                                                                                                                                                                                        | boolean                                                                        | false   |- |
| handleDot | Whether to show the dot on the handle                                                                                                                                                                                                                                                                 | { color: string, size: string} \| <br/> { color: string, size: string}[]       | -      | 2.52.0 |
| included         | Takes effect when `marks` is not null, true means containment and false means coordination                                                                                                                                                                                                            | boolean                                                                        | true    |- |
| marks            | Tick mark of Slider, type of key must be number, and must in closed interval [min, max]                                                                                                                                                                                                               | Record<number, string \>                                                       | -       |- |
| max              | Maximum value of the slider.                                                                                                                                                                                                                                                                          | number                                                                         | 100     |- |
| min              | Minimum value of the slider.                                                                                                                                                                                                                                                                          | number                                                                         | 0       |- |
| railStyle        | Style for slide rail                                                                                                                                                                                                                                                                                  | CSSProperties                                                                  | -       |0.31.0|
| range            | Toggle whether it is allow to move slider from both sides                                                                                                                                                                                                                                             | boolean                                                                        | false   |- |
| showArrow        | whether the tooltip has an arrow                                                                                                                                                                                                                                                                      | boolean                                                                        | true    | 2.48.0|
| showBoundary     | Toggle whether show max/min value when hover                                                                                                                                                                                                                                                          | boolean                                                                        | false   |- |
| showMarkLabel    | Whether to show the label                                                                                                                                                                                                                                                                             | boolean                                                                        | true    | 2.48.0 |
| step             | Increment between successive values                                                                                                                                                                                                                                                                   | number                                                                         | 1       |- |
| tipFormatter     | Format Tooltip content, by default display current value                                                                                                                                                                                                                                              | (value: string \| number \| boolean \| (string \| number \| boolean)[]) => any | v => v  |- |
| tooltipOnMark    | Whether the mark on the slide rail has a tooltip                                                                                                                                                                                                                                                      | false                                                                          | 2.48.0  |
| tooltipVisible   | Toggle whether to display tooltip all the time                                                                                                                                                                                                                                                        | boolean                                                                        | -       |- |
| value            | Set current value, used in controlled component                                                                                                                                                                                                                                                       | number \| number[]                                                             |         |- |
| vertical         | Toggle whether to display slider vertically                                                                                                                                                                                                                                                           | boolean                                                                        | false   |- |
| verticalReverse  | Vertical but reverse direction >=1.29.0                                                                                                                                                                                                                                                               | boolean                                                                        | false   |-|
| onAfterChange    | Triggered when slider changed, passed in current value as params                                                                                                                                                                                                                                      | (value: number \| number[]) => void                                            | -       |- |
| onChange         | Callback function when slider value changes                                                                                                                                                                                                                                                           | (value: number \| number[]) => void                                            | -       |- |
| onMouseUp        | Trigged when mouse up on handle                                                                                                                                                                                                                                                                       | (e: React.MouseEvent<HTMLDivElement\>) => void                                 | -       | 2.41.0 |
| getAriaValueText | Used to provide a user-friendly name for the current value of the slider, important for screen reader users,  The parameters value and index are the current slider value, order                                                                                                                      | (value: number, index?: number) => string                                      | -       |-|
## Accessibility

### ARIA

- The element serving as the focusable slider control has `role` 'slider'.
- The slider element has the `aria-valuenow` property set to a decimal value representing the current value of the slider.
- The slider element has the `aria-valuemin` property set to a decimal value representing the minimum allowed value of the slider.
- The slider element has the `aria-valuemax` property set to a decimal value representing the maximum allowed value of the slider.
- If the slider is vertically oriented, it has `aria-orientation` set to vertical.
- If the value of `aria-valuenow` is not user-friendly, e.g., the day of the week is represented by a number, support setting API `aria-valuetext` property to a string that makes the slider value understandable, e.g., "Monday". And you can use API `getAriaValueText(value, index)` to specify `aria-valuetext`.
- Supporting API `aria-label` `aria-labelledby` to specify Slider label.

### Keyboard and Focus

- The slider of Slider can get the focus and display the prompt information of the current slider, and this information needs to be read by assistive technology.
- When the user uses the `range` API, you can use `Tab` and `Shift` + `Tab` to switch the focus of the left and right sliders.
- Keyboard users can use `Up Arrow` or `Right Arrow` to increase the slider value, `Down Arrow` or `Left Arrow` to decrease the slider value.
- If you want the slider to change more than the step size， Slider supports 10*step changes:
  - Windows users： `Page Up` for increasing, `Page Down` for decreasing;
  - Mac users：`Fn` + `Up Arrow` for increasing, `Fn` + `Down Arrow` for decreasing;
  - When the user uses the `range` property, the Page Up key of the previous slider is only supported until it meets the next slider, and then using the Page Up key on the previous slider will not respond. The same is true for the latter slider. After encountering, there is no response to the Page Down key.
- To move the slider to the minimum value of the slider:
  - Windows users: `Home`;
  - Mac users: `Fn` + `left arrow`;
  - When the user uses the `range` property, the `Home`(`Fn` + `left arrow`) button of the latter slider only supports until it meets the previous slider, and the `Home`(`Fn` + `left arrow`) button is unresponsive after the overlap.
- To move the slider to the maximum value of the slider:
  - Windows users: `End`;
  - Mac users: `Fn` + `right arrow`;
  - When the user uses the `range` property, the `End`(`Fn` + `right arrow`) key of the previous slider is only supported until it meets the next slider, and the `End`(`Fn` + `right arrow`) key is unresponsive after the overlap.


## Design Tokens
<DesignToken/>
