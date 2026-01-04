---
localeCode: en-US
order: 90
category: Feedback
title: Progress
subTitle: Progress
icon: doc-progress
width: 60%
brief: Used to display the current progress and status of the user operation, and is generally used when the operation takes a long time. Can also be used to indicate the degree of completion of a task/object
---
## Demos

### How to import

```jsx
import { Progress } from '@douyinfe/semi-ui';
```

### Standard progress bar

Use `stroke` Property to control the filling color of the progress bar  
Use `Percent` Property to control completed progress  
Use `size` Property control progress bar size  
Use `aria-label` Property to explain the specific role  
If the preset size is not satisfied, You can pass height to customize the height of the progress bar through `style` property.

```jsx live=true
import React from 'react';
import { Progress } from '@douyinfe/semi-ui';

() => (
    <div style={{ width: 200 }}>
        <Progress percent={10} stroke="var(--semi-color-warning)" aria-label="disk usage" />
        <br />
        <Progress percent={25} stroke="var(--semi-color-danger)" aria-label="disk usage" />
        <br />
        <Progress percent={50} aria-label="disk usage"/>
        <br />
        <Progress percent={80} aria-label="disk usage"/>
        <br />
        <Progress percent={80} size="large" aria-label="disk usage"/>
        <br />
        <Progress percent={80} style={{ height: '8px' }} aria-label="disk usage"/>
    </div>
);
```

### Show percentage text

You can control whether to show percentage number through the `showInfo` property In addition, you can format the percentage text show through `format`.

```jsx live=true
import React from 'react';
import { Progress } from '@douyinfe/semi-ui';

() => (
    <div style={{ width: 200 }}>
        <Progress percent={10} stroke="var(--semi-color-warning)" showInfo={true} aria-label="disk usage"/>
        <br />
        <Progress percent={25} stroke="var(--semi-color-danger)" showInfo={true} aria-label="disk usage"/>
        <br />
        <Progress percent={50} showInfo={true} aria-label="disk usage"/>
        <br />
        <Progress percent={50} showInfo={true} format={percent => percent * 10 + '‰'} aria-label="disk usage"/>
    </div>
);
```

### Vertical progress bar

You can use vertical progress bar by setting `direction='vertical'` If preset width is not satisfied, you can pass width to customize the width of the vertical progress bar through `style` property.

```jsx live=true
import React from 'react';
import { Progress } from '@douyinfe/semi-ui';

() => (
    <div style={{ height: 100, display: 'flex' }}>
        <Progress percent={10} direction="vertical" aria-label="disk usage"/>
        <Progress percent={25} direction="vertical" aria-label="disk usage"/>
        <Progress percent={50} direction="vertical" aria-label="disk usage"/>
        <Progress percent={80} direction="vertical" size="large" aria-label="disk usage"/>
        <Progress percent={80} direction="vertical" style={{ width: '8px' }} aria-label="disk usage"/>
    </div>
);
```

### Circular progress bar

Set type to`circle`, the progress bar will be displayed in a ring shape. The default size of the progress bar is 72 x 72

```jsx live=true
import React from 'react';
import { Progress } from '@douyinfe/semi-ui';

() => (
    <div>
        <Progress percent={10} type="circle" style={{ margin: 5 }} aria-label="disk usage"/>
        <Progress percent={25} type="circle" style={{ margin: 5 }} aria-label="disk usage"/>
        <Progress percent={50} type="circle" style={{ margin: 5 }} aria-label="disk usage"/>
        <Progress percent={80} type="circle" style={{ margin: 5 }} aria-label="disk usage"/>
    </div>
);
```

You can modify it's `width` to control the size of the circular progress bar.

```jsx live=true
import React from 'react';
import { Progress } from '@douyinfe/semi-ui';

() => (
    <React.Fragment>
        <div>
            <Progress percent={100} type="circle" width={100} style={{ margin: 5 }} aria-label="disk usage"/>
        </div>
        <div>
            <Progress percent={100} type="circle" width={100} style={{ margin: 5 }} stroke="#f93920" aria-label="disk usage"/>
        </div>
    </React.Fragment>
);
```

### Small circular progress bar

Small progress bar default size is 24 x 24.

```jsx live=true
import React from 'react';
import { Progress } from '@douyinfe/semi-ui';

() => (
    <React.Fragment>
        <Progress percent={10} type="circle" size="small" style={{ margin: 5 }} aria-label="disk usage"/>
        <Progress percent={25} type="circle" size="small" style={{ margin: 5 }} aria-label="disk usage"/>
        <Progress percent={50} type="circle" size="small" style={{ margin: 5 }} aria-label="disk usage"/>
        <Progress percent={80} type="circle" size="small" style={{ margin: 5 }} aria-label="disk usage"/>
    </React.Fragment>
);
```

### Dynamic change percent

```jsx live=true
import React from 'react';
import { Progress, Button } from '@douyinfe/semi-ui';
import { IconChevronLeft, IconChevronRight } from '@douyinfe/semi-icons';

() => {
    const [percent, setPercent] = useState(40);
    return (
        <>
            <div>
                <Progress percent={percent} showInfo />
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
import React from 'react';
import { Progress, Button } from '@douyinfe/semi-ui';
import { IconChevronLeft, IconChevronRight } from '@douyinfe/semi-icons';

() => {
    const [cirPerc, setCirPerc] = useState(40);
    return (
        <div>
            <div>
                <Progress percent={cirPerc} type="circle" aria-label="disk usage"/>
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

### Custom central text content

You can customize the central text by passing `format` function, and the argument of the format is the current percentage  
If you don't need central text content, you can set `showInfo` to false or return an empty string directly in `format`

```jsx live=true
import React from 'react';
import { Progress } from '@douyinfe/semi-ui';

() => (
    <React.Fragment>
        <Progress percent={75} showInfo type="circle" format={per => per + 'Days'} style={{ margin: 10 }} aria-label="disk usage"/>
        <Progress percent={100} showInfo type="circle" format={per => 'Done'} style={{ margin: 10 }} aria-label="disk usage"/>
        <Progress percent={50} type="circle" showInfo={false} style={{ margin: 10 }} aria-label="disk usage"/>
    </React.Fragment>
);
```

### Round / square edges

With the `strokeLinecap` property, you can control the edge shape of the ring progress bar.

```jsx live=true
import React from 'react';
import { Progress } from '@douyinfe/semi-ui';

() => (
    <React.Fragment>
        <Progress percent={50} strokeLinecap="round" type="circle" style={{ margin: 10 }} aria-label="disk usage"/>
        <Progress percent={50} strokeLinecap="square" type="circle" style={{ margin: 10 }} aria-label="disk usage"/>
    </React.Fragment>
);
```

### Customise the progress bar color

The color of a specific `percent` can be customised by setting the `stroke` property

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

### Auto-completion of colour intervals

The gradient can be generated by setting the `strokeGradient` property to `true`, automatically fill the colour interval.

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

## API Reference

| PROPERTIES | Instructions | Type | Default |
| --- | --- | --- | --- |
| aria-label | [aria-label](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Techniques/Using_the_aria-label_attribute) attribute. Used to add a label description to the current element to improve a11y<br/>**provided after v2.2.0** | string |  |
| aria-labelledby | [aria-labelledby](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Techniques/Using_the_aria-labelledby_attribute) attribute. Indicates that the id of some element is the label of the current element. It is used to determine the connection between controls or control groups and their labels, to improve a11y<br/>**provided after v2.2.0** | string |  |  |
| aria-valuetext | [aria-labelledby](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Techniques/Using_the_aria-labelledby_attribute) attribute. Used to improve a11y<br/>**provided after v2.2.0** | string |  |  |
| className | style class name | string |  |
| direction | The direction of the bar progress bar `horizontal`, `vertical` | string | 'horizontal' |
| id | id attribute <br/>**provided after v2.2.0** | string |  |
| format | Formatting function, the input parameter is the current percentage, the result of return will be directly rendered in the center of the circular progress bar | (percent: number) => ReactNode | (percent) => percent +'%' |
| orbitStroke | Progress bar track fill color<br/>**provided after v1.0.0** | string | 'var(--semi-color-fill-0)' |
| percent | percentage of progress | number |  |
| showInfo | Whether to display the middle text in the circular progress bar, and whether to display the text on the right side of the bar-shaped progress bar | boolean | false |
| size | size, optional `default`, `small` (only type=circle is effective), `large` (only type=line is effective) | string | 'default' |
| stroke | Fill color of progress bar, When of type `Array<{percent:number; color:string }>`, the `color` parameter supports the color types: `'Hex'` &#124; `'Hsl'` &#124; `'Hsla'` &#124; `'Rgb'` &#124; `'Rgba'` &#124; `'Semi Design Tokens'` | string &#124; Array<{percent:number; color:string }> | 'var(--semi-color-success)' |
| strokeGradient | Whether to automatically generate gradient colors to fill color intervals, requires `stroke` to set at least one color interval | boolean | false |
| strokeLinecap | round corner `round`/square corner `square` (only effective in type='circle' mode) | string | 'round' |
| strokeWidth |when type is `circle`, this property controls the width of the progress bar | number | 4 |
| style | style | CSSProperties |  |
| type | type, optional `line`, `circle` | string | 'line' |
| width | Width of circular progress bar | number | 72 when size='default', 24 for 'small' |

## Accessibility
### ARIA

-   Progress has a `progressbar` role to indicate that it is a progress bar component.
-   Progress will automatically set `aria-valuenow` as the progress percentage (`percent`) passed to the component to ensure that the screen reader can get the correct percentage value. In addition, Progress supports incoming `aria-valuetext`. When you pass in, according to W3C specifications, `aria-valuetext` will be used and consumed by screen readers instead of `aria-valuenow`
-   Progress support `aria-label`, `aria-labelledby`
    -   When there is a description element about the role of Progress outside of Progress, you can explicitly specify that the id of certain elements is the label of Progress through `aria-labelledby`
    -   Otherwise, you should use aria-label to explain the specific meaning of the value represented by Progress

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

## Content Guidelines
- If the progress bar process is complicated, or there is a long waiting time, you can use the help text to explain. This lets the user know what progress is happening.
## Design Tokens

<DesignToken/>
