---
localeCode: zh-CN
order: 46
category: 输入类
title:  Slider 滑动选择器
icon: doc-slider
brief: 滑动选择器，使用拖动交互快速选择数值或数值范围，与 InputNumber 相比更直观
---


## 代码演示

### 如何引入

```jsx import
import { Slider } from '@douyinfe/semi-ui';
```
### 基本用法
基本滑动条。当 `range` 为 `true` 时，支持两侧滑动。当 `disabled` 为 `true` 时，滑块处于不可用状态。
```jsx live=true
import React from 'react';
import { Slider } from '@douyinfe/semi-ui';

() => (
    <div>
        <div>
            <div>Default</div>
            <Slider showBoundary={true}></Slider>
        </div>
        <br/>
        <br/>
        <div>
            <div>Range</div>
            <Slider defaultValue={[20, 60]} range></Slider>
        </div>
        <br/>
        <br/>
        <div>
            <div>Disabled</div>
            <Slider defaultValue={40} disabled></Slider>
        </div>
    </div>
);
```

### 带输入框的
滑动条的滑块和输入框组件保持同步。
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

### 自定义提示
使用 `tipFormatter` 可以设置 Tooltip 的显示的格式。设置 `tipFormatter={null}`，则隐藏 Tooltip。`getAriaValueText`用于给滑块的当前值提供一个用户友好的名称，对屏幕阅读器用户很重要。
```jsx live=true
import React from 'react';
import { Slider } from '@douyinfe/semi-ui';

() => (
    <div>
        <Slider tipFormatter={v => (`${v}%`)} getAriaValueText={v => (`${v}%`)}/>
        <br/>
        <br/>
        <Slider tipFormatter={null} />
    </div>
);
```

### 带标签的
使用 `marks` 属性标注滑块的刻度，使用 `value` / `defaultValue` 指定滑块位置。
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
        <Slider marks={{ 20: '20°C', 40: '40°C' }} defaultValue={[0, 100]} tipFormatter={v => (`${v}°C`)} range={true} getAriaValueText={(value) => `${value}°C`}></Slider>
        <br/>
        <br/>
        <div>Included</div>
        <Slider marks={{ 20: '20°C', 40: '40°C' }} included={false} defaultValue={[0, 100]} range={true} tipFormatter={v => (`${v}°C`)} getAriaValueText={(value) => `${value}°C`}></Slider>
    </div>
);
```

### 分段背景
通过使用 `linear-gradient` 及 `railStyle` ，配合 onChange 可以实现动态的分段背景效果。
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

### 受控组件
滑块位置即 `Slider` 的值由 value 控制，配合 onChange 使用。
```jsx live=true hideInDSM
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
                <Button onClick={this.changeValue} style={{ marginRight: 20 }}>点击改变value值</Button>
                <br/>
                <br/>
                <Slider value={this.state.value}></Slider>
            </div>
        );
    }
}
```

### 垂直
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

### 滑块带圆点
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

## API参考
| 属性               | 说明                                                                                                                                                                 | 类型                                                                             | 默认值    | 版本     | 
|------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------|--------|--------|
| aria-label       | [aria-label](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-label)属性，用来给当前元素加上的标签描述, 提升可访问性                                       | string                                                                         | -      | -      |
| aria-labelledby  | [aria-labelledby](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-labelledby)属性，表明某些元素的 id 是某一对象的标签。它被用来确定控件或控件组与它们标签之间的联系, 提升可访问性 | string                                                                         | -      | -      |
| aria-valuetext   | [aria-valuetext](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-valuetext)属性，为滑块的当前值提供用户友好的名称。                                    | string                                                                         | -      | -      |
| defaultValue     | 设置初始取值                                                                                                                                                             | number \| number[]                                                             | 0      | -      |
| disabled         | 滑块是否禁用                                                                                                                                                             | boolean                                                                        | false  | -      |
| handleDot | 滑块是否带有圆点 | { color: string, size: string} \| <br/> { color: string, size: string}[]                                                | -      | 2.52.0 |
| included         | `marks` 不为空对象时有效，值为 true 时表示值为包含关系，false 表示并列                                                                                                                      | boolean                                                                        | true   | -      |
| marks            | 刻度，key 的类型必须为 `number` 且取值在闭区间 \[min, max] 内                                                                                                                       | Record<number, string \>                                                       | 无      | -      |
| max              | 最大值                                                                                                                                                                | number                                                                         | 100    | -      |
| min              | 最小值                                                                                                                                                                | number                                                                         | 0      | -      |
| railStyle        | 滑块轨道的样式                                                                                                                                                            | CSSProperties                                                                  | -      | 0.31.0 |
| range            | 是否支持两边同时可滑动                                                                                                                                                        | boolean                                                                        | false  | -      |
| showArrow        | tooltip 是否带箭头 | boolean                                                                        | true   | 2.48.0 |
| showBoundary     | 是否在 hover 时展示最大值最小值                                                                                                                                                | boolean                                                                        | false  | -      |
| showMarkLabel    | 是否隐藏标签 | boolean                                                                        | true   | 2.48.0 |
| step             | 步长                                                                                                                                                                 | number                                                                         | 1      | -      |
| tipFormatter     | 设置Tooltip的展示格式，默认显示当前选值                                                                                                                                            | (value: string \| number \| boolean \| (string \| number \| boolean)[]) => any | v => v | -      |
| tooltipOnMark    | 滑轨上的 mark 是否带有 tooltip | false                                                                          | 2.48.0 |
| tooltipVisible   | 是否始终显示Tooltip                                                                                                                                                      | boolean                                                                        | 无      | -      |
| value            | 设置当前取值                                                                                                                                                             | number \| number[]                                                             |        | -      |
| vertical         | 是否设置方向为垂直                                                                                                                                                          | boolean                                                                        | false  | -      |
| verticalReverse  | 反转垂直方向，即上大下小 >=1.29.0                                                                                                                                              | boolean                                                                        | false  | -      |
| onAfterChange    | 值变化后触发，把当前值作为参数传入                                                                                                                                                  | (value: number \| number[]) => void                                            | 无      | -      |
| onChange         | 当 Slider 的值发生改变时的回调                                                                                                                                                | (value: number \| number[]) => void                                            | 无      | -      |
| onMouseUp        | 鼠标松开滑块时触发                                                                                                                                                          | (e: React.MouseEvent<HTMLDivElement\>) => void                                 | 无      | 2.41.0 |
| getAriaValueText | 用于给滑块的当前值提供一个用户友好的名称，对屏幕阅读器用户很重要，参数value为当前滑块的值，index为当前滑块的顺序                                                                                                      | (value: number, index?: number) => string                                      | -      | -      |

## Accessibility

### ARIA

- Slider 可聚焦的控制元素 role 为 `slider`。
- 元素的 `aria-valuenow` 属性为当前值的十进制数值。
- 元素的 `aria-valuemin` 属性为最小允许值的十进制数值。
- 元素的 `aria-valuemax` 属性为最大允许值的十进制数值。
- 当 Slider 为纵向时，元素的 `aria-orientation` 属性为 'vertical'。
- 当 `aria-valuenow` 的值不容易被理解时，支持通过 API `aria-valuetext` 传递一个字符串使其更友好。也可以通过 API `getAriaValueText(value, index)` 方法得到 `aria-valuetext` 的值。
- 支持通过 API `aria-label` 或者 `aria-labelledby` 确定 slider 的标签。

### 键盘和焦点

- Slider 的滑块可被获取到焦点，并展示当前滑块的提示信息，且这些信息需要被辅助技术读取到。
- 当用户使用 `range` 属性时，可以使用 `Tab` 及 `Shift`  + `Tab` 切换左右两个滑块的焦点。
- 键盘用户可以通过 `上箭头` 或 `右箭头` 来增加滑块值，`下箭头` 或 `左箭头` 来减少滑块值。
- 若想要滑块高于步长的变化量时， slider支持 10*step 的变化量：
  - Windows 用户： `Page Up` 用于增加，`Page Down` 用于减少；
  - Mac 用户使用： `Fn` + `上箭头` 用于增加，`Fn` + `下箭头` 用于按键；
  - 当用户使用 `range` 属性时，前一个滑块的  `Page Up`(`Fn` + `上箭头`) 键仅支持到与后一个滑块相遇，重合后再对前一个滑块使用  Page Up 键则无响应。后一个滑块同理，相遇后，对`Page Down`(`Fn` + `下箭头`) 键无响应。
- 若想将滑块移动到滑杆的最小值处：
  - Windows 用户： `Home` ；
  - Mac 用户： `Fn` + `左箭头`；
  - 当用户使用 `range` 属性时，后一个滑块的 `Home`(`Fn` + `左箭头`) 键仅支持到与前一个滑块相遇，重合后再次使用 `Home`(`Fn` + `左箭头`) 键无响应。
- 若想将滑块移动到滑杆的最大值处：
  - Windows 用户：`End` ；
  - Mac 用户：`Fn` + `右箭头`；
  - 当用户使用 `range` 属性时，前一个滑块的 `End`(`Fn` + `右箭头`) 键仅支持到与后一个滑块相遇，重合后再次使用 `End`(`Fn` + `右箭头`) 键无响应。



## 设计变量
<DesignToken/>
