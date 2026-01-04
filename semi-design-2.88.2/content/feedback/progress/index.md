---
localeCode: zh-CN
order: 90
category: 反馈类
title: Progress 进度条
icon: doc-progress
width: 60%
brief: 用于展示用户操作的当前进度和状态，一般在操作耗时较长时使用。也可用来表示任务/对象的完成度
---

## 代码演示

### 如何引入

```jsx import
import { Progress } from '@douyinfe/semi-ui';
```

### 标准的进度条

通过`stroke`属性来控制进度条的填充色  
通过`percent`属性控制已完成的进度  
通过`size`属性控制进度条尺寸  
通过`aria-label`说明进度条具体代表含义  
如果`size`预设的尺寸不满足，可以通过`style`传入 height 自定义进度条高度

```jsx live=true
import React from 'react';
import { Progress } from '@douyinfe/semi-ui';

() => (
    <div style={{ width: 200 }}>
        <Progress percent={10} stroke="var(--semi-color-warning)" aria-label="disk usage" />
        <br />
        <Progress percent={25} stroke="var(--semi-color-danger)" aria-label="disk usage" />
        <br />
        <Progress percent={50} aria-label="disk usage" />
        <br />
        <Progress percent={80} aria-label="download progress" />
        <br />
        <Progress percent={80} size="large" aria-label="disk usage" />
        <br />
        <Progress percent={80} style={{ height: '8px' }} aria-label="disk usage" />
    </div>
);
```

### 展示百分比文本

通过`showInfo`控制是否展示百分比数字，可以通过`format`格式化展示文本

```jsx live=true
import React from 'react';
import { Progress } from '@douyinfe/semi-ui';

() => (
    <div style={{ width: 200 }}>
        <Progress percent={10} stroke="var(--semi-color-warning)" showInfo={true} aria-label="disk usage" />
        <br />
        <Progress percent={25} stroke="var(--semi-color-danger)" showInfo={true} aria-label="disk usage" />
        <br />
        <Progress percent={50} showInfo={true} aria-label="disk usage" />
        <br />
        <Progress percent={50} showInfo={true} format={percent => percent * 10 + '‰'} aria-label="disk usage" />
    </div>
);
```

### 垂直的进度条

设置`direction='vertical'`，展示垂直进度条，可以通过`style`传入 width 控制进度条宽度

```jsx live=true
import React from 'react';
import { Progress } from '@douyinfe/semi-ui';

() => (
    <div style={{ height: 100, display: 'flex' }}>
        <Progress percent={10} direction="vertical" aria-label="disk usage" />
        <Progress percent={25} direction="vertical" aria-label="disk usage" />
        <Progress percent={50} direction="vertical" aria-label="disk usage" />
        <Progress percent={80} direction="vertical" size="large" aria-label="disk usage" />
        <Progress percent={80} direction="vertical" style={{ width: '8px' }} aria-label="disk usage" />
    </div>
);
```

### 环形进度条

将 type 设为`circle`，进度条将会展示成环状。进度条默认尺寸为 72 x 72

```jsx live=true
import React from 'react';
import { Progress } from '@douyinfe/semi-ui';

() => (
    <div>
        <Progress percent={10} type="circle" style={{ margin: 5 }} aria-label="disk usage" />
        <Progress percent={25} type="circle" style={{ margin: 5 }} aria-label="disk usage" />
        <Progress percent={50} type="circle" style={{ margin: 5 }} aria-label="disk usage" />
        <Progress percent={80} type="circle" style={{ margin: 5 }} aria-label="disk usage" />
    </div>
);
```

你可以通过修改`width`来控制环形进度条的大小

```jsx live=true
import React from 'react';
import { Progress } from '@douyinfe/semi-ui';

() => (
    <React.Fragment>
        <div>
            <Progress percent={100} type="circle" width={100} style={{ margin: 5 }} aria-label="disk usage" />
        </div>
        <div>
            <Progress
                percent={100}
                type="circle"
                width={100}
                style={{ margin: 5 }}
                stroke="var(--semi-color-danger)"
                aria-label="disk usage"
            />
        </div>
    </React.Fragment>
);
```

### 小号的环形进度条

小号进度条默认尺寸为 24 x 24

```jsx live=true
import React from 'react';
import { Progress } from '@douyinfe/semi-ui';

() => (
    <React.Fragment>
        <Progress percent={10} type="circle" size="small" style={{ margin: 5 }} aria-label="disk usage" />
        <Progress percent={25} type="circle" size="small" style={{ margin: 5 }} aria-label="disk usage" />
        <Progress percent={50} type="circle" size="small" style={{ margin: 5 }} aria-label="disk usage" />
        <Progress percent={80} type="circle" size="small" style={{ margin: 5 }} aria-label="disk usage" />
    </React.Fragment>
);
```

### 动态改变进度

```jsx live=true
import React, { useState } from 'react';
import { Progress, Button } from '@douyinfe/semi-ui';
import { IconChevronLeft, IconChevronRight } from '@douyinfe/semi-icons';

() => {
    const [percent, setPercent] = useState(40);
    return (
        <>
            <div>
                <Progress percent={percent} showInfo aria-label="disk usage" />
                <Button
                    icon={<IconChevronLeft />}
                    theme="light"
                    onClick={() => {
                        setPercent(percent - 10);
                    }}
                    disabled={percent === 0}
                />
                <Button
                    icon={<IconChevronRight />}
                    theme="light"
                    onClick={() => {
                        setPercent(percent + 10);
                    }}
                    disabled={percent >= 100}
                />
            </div>
        </>
    );
};
```

```jsx live=true
import React, { useState } from 'react';
import { Progress, Button } from '@douyinfe/semi-ui';
import { IconChevronLeft, IconChevronRight } from '@douyinfe/semi-icons';

() => {
    const [cirPerc, setCirPerc] = useState(40);
    return (
        <div>
            <div>
                <Progress percent={cirPerc} type="circle" aria-label="disk usage" />
            </div>
            <Button
                icon={<IconChevronLeft />}
                theme="light"
                onClick={() => {
                    setCirPerc(cirPerc - 10);
                }}
                disabled={cirPerc === 0}
            />
            <Button
                icon={<IconChevronRight />}
                theme="light"
                onClick={() => {
                    setCirPerc(cirPerc + 10);
                }}
                disabled={cirPerc >= 100}
            />
        </div>
    );
};
```

### 自定义中心文字内容

你可以通过传入 `format` 函数自定义中心文字，`format` 的入参为当前百分比  
如果不需要中心文本内容，你可以将 `showInfo` 设为 false，或者在 `format` 中直接返回空字符串

```jsx live=true
import React from 'react';
import { Progress } from '@douyinfe/semi-ui';

() => (
    <React.Fragment>
        <Progress
            percent={75}
            showInfo
            type="circle"
            format={per => per + 'Days'}
            style={{ margin: 10 }}
            aria-label="disk usage"
        />
        <Progress
            percent={100}
            showInfo
            type="circle"
            format={per => 'Done'}
            style={{ margin: 10 }}
            aria-label="disk usage"
        />
        <Progress percent={50} type="circle" showInfo={false} style={{ margin: 10 }} aria-label="disk usage" />
    </React.Fragment>
);
```

### 圆角/方角边缘

通过 strokeLinecap 属性，你可以控制环形进度条边缘形状

```jsx live=true
import React from 'react';
import { Progress } from '@douyinfe/semi-ui';

() => (
    <React.Fragment>
        <Progress percent={50} strokeLinecap="round" type="circle" style={{ margin: 10 }} aria-label="disk usage" />
        <Progress percent={50} strokeLinecap="square" type="circle" style={{ margin: 10 }} aria-label="disk usage" />
    </React.Fragment>
);
```

### 自定义进度条颜色

可通过设置 `stroke` 属性，自定义具体 `percent` 的颜色

```jsx live=true
import React, { useState } from 'react';
import { Progress, Button } from '@douyinfe/semi-ui';
import { IconChevronLeft, IconChevronRight } from '@douyinfe/semi-icons';

() => {
    const [percent, setPercent] = useState(10);
    const strokeArr = [
        { percent: 20, color: 'red' },
        { percent: 40, color: 'orange-9' },
        { percent: 60, color: 'light-green-8' },
        { percent: 80, color: 'hsla(125, 50%, 46% / 1)' }
    ];
    return (
        <>
            <div>
                <Progress
                    percent={percent}
                    stroke={strokeArr}
                    showInfo
                    type="circle"
                    width={100}
                    aria-label="disk usage"
                />
                <Progress
                    percent={percent}
                    stroke={strokeArr}
                    showInfo
                    style={{ margin: '20px 0 10px' }}
                    aria-label="disk usage"
                />
            </div>
            <Button
                icon={<IconChevronLeft />}
                theme="light"
                onClick={() => {
                    setPercent(percent - 10);
                }}
                disabled={percent === 0}
            />
            <Button
                icon={<IconChevronRight />}
                theme="light"
                onClick={() => {
                    setPercent(percent + 10);
                }}
                disabled={percent === 100}
            />
        </>
    );
};
```

### 自动补齐颜色区间

可通过设置 `strokeGradient` 属性，属性为 `true` 时自动补齐颜色区间，生成渐变色

```jsx live=true
import React, { useEffect, useState } from 'react';
import { Space, Progress, Button } from '@douyinfe/semi-ui';
import { IconChevronLeft, IconChevronRight } from '@douyinfe/semi-icons';

() => {
    const [percent, setPercent] = useState(65);
    const [percentInterval, setPercentInterval] = useState(0);
    useEffect(() => {
        setTimeout(
            () => {
                setPercentInterval(percentInterval > 100 ? 0 : percentInterval + 3);
            },
            percentInterval === 0 || percentInterval > 100 ? 1200 : 290 - (percentInterval % 50) * 3
        );
    }, [percentInterval]);
    const strokeArr = [
        { percent: 0, color: 'rgb(249, 57, 32)' },
        { percent: 50, color: '#46259E' },
        { percent: 100, color: 'hsla(125, 50%, 46% / 1)' },
    ];
    const strokeArrReverse = [
        { percent: 0, color: 'hsla(125, 50%, 46% / 1)' },
        { percent: 50, color: '#46259E' },
        { percent: 100, color: 'rgb(249, 57, 32)' },
    ];
    return (
        <>
            <Space spacing={20}>
                <div>
                    <Progress
                        percent={percentInterval}
                        stroke={strokeArr}
                        strokeGradient={true}
                        showInfo
                        type="circle"
                        width={100}
                        aria-label="file download speed"
                    />
                </div>
                <div>
                    <Progress
                        percent={percentInterval}
                        stroke={strokeArrReverse}
                        strokeGradient={true}
                        showInfo
                        type="circle"
                        width={100}
                        aria-label="file download speed"
                    />
                </div>
            </Space>
            <div style={{ width: '100%', margin: '20px 0 10px' }}>
                <Progress
                    percent={percent}
                    stroke={strokeArr}
                    strokeGradient={true}
                    showInfo
                    size="large"
                    aria-label="file download speed"
                />
            </div>
            <Button
                icon={<IconChevronLeft />}
                theme="light"
                onClick={() => {
                    setPercent(percent - 5);
                }}
                disabled={percent === 0}
            />
            <Button
                icon={<IconChevronRight />}
                theme="light"
                onClick={() => {
                    setPercent(percent + 5);
                }}
                disabled={percent === 100}
            />
        </>
    );
};
```

## API 参考

| 属性 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| aria-label | [aria-label](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Techniques/Using_the_aria-label_attribute)属性，用来给当前元素加上的标签描述, 用于提升可访问性<br/>**v2.2.0 后提供** | string |  |
| aria-labelledby | [aria-labelledby](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Techniques/Using_the_aria-labelledby_attribute)属性，表明某些元素的 id 是当前元素的标签。它被用来确定控件或控件组与它们标签之间的联系, 提升可访问性<br/>**v2.2.0 后提供** | string |  |  |
| aria-valuetext | [aria-valuetext](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Techniques/Using_the_aria-valuetext_attribute)属性，用于提升可访问性<br/>**v2.2.0 后提供** | string |  |  |
| className | 样式类名 | string |  |
| direction | 条状进度条方向 `horizontal`、`vertical` | string | 'horizontal' |
| format | 格式化函数，入参为当前百分比，return 的结果将会直接渲染在圆形进度条中心 | (percent: number) => ReactNode | (percent) => percent + '%' |
| id | id 标识<br/>**v2.2.0 后提供** | string |  |
| orbitStroke | 进度条轨道填充色<br/>**v1.0.0 后提供** | string | 'var(--semi-color-fill-0)' |
| percent | 进度百分比 | number |  |
| showInfo | 环形进度条是否显示中间文本，条状进度条后右侧是否显示文本 | boolean | false |
| size | 尺寸,可选`default`、`small`(仅 type=circle 生效)、`large`(仅 type=line 生效) | string | 'default' |
| stroke | 进度条填充色，类型为 `Array<{percent:number; color:string }>` 时，`color` 参数支持颜色类型：`'Hex'` &#124; `'Hsl'` &#124; `'Hsla'` &#124; `'Rgb'` &#124; `'Rgba'` &#124; `'Semi Design Tokens'` | string &#124; Array<{percent:number; color:string }> | 'var(--semi-color-success)' |
| strokeGradient | 是否自动生成渐变色补齐区间颜色，需要 `stroke` 设置至少一个颜色区间 | boolean | false |
| strokeLinecap | 圆角`round`/方角`square`(仅在 type='circle'模式下生效) | string | 'round' |
| strokeWidth | type 为`circle`时，该属性控制进度条宽度 | number | 4 |
| style | 样式 | CSSProperties |  |
| type | 类型，可选`line`、`circle` | string | 'line' |
| width | 环形进度条宽度 | number | size='default'时为 72，'small'为 24 |

## Accessibility

### ARIA

-   Progress 具有 `progressbar` role 来表示它是一个进度条组件。
-   Progress 会自动将 `aria-valuenow` 设置为传递给组件的进度百分比（`percent`），以确保屏幕阅读器可以获取正确的百分比数值。另外，Progress 支持传入 `aria-valuetext`，当你传入时，根据 W3C 规范，`aria-valuetext` 将优先被屏幕阅读器使用消费，而不是 `aria-valuenow`
-   Progress 支持传入 `aria-label`、`aria-labelledby`
    -   当 Progress 外部存在关于 Progress 作用的描述元素时，你可以通过 aria-labelledby 显式指定某些元素的 id 是 Progress 的标签
    -   否则你应当通过 aria-label 说明 Progress 所代表的具体数值含义

```js
// good case
<p id="progressbar-label">Disk Usage</p>
<Progress aria-labelledby="progressbar-label" percent={80} />

// good case
<Progress aria-label='Percent of disk usage' percent={80} />
<Progress aria-label='Percent of file downloaded' percent={80} />

// usage of aria-valuetext
<Progress aria-label='Percent of disk usage' percent={80} aria-valuetext="Step 2: Copying files... "/>
```

## 文案规范

-   如果进度条过程复杂，或者有很长的等待时间，可以使用帮助文本来做说明。这样可以让用户知道正在发生的进度进展

## 设计变量

<DesignToken/>
