---
localeCode: zh-CN
order: 58
category: 导航类
title:  Steps 步骤
icon: doc-steps
dir: column
brief: 将复杂任务或存在先后关系的任务分解，使用步骤组件引导用户按规定流程操作，并让其知道其当前的进度
---

## 代码演示

### 如何引入

```jsx import
import { Steps } from '@douyinfe/semi-ui';
const Step = Steps.Step;
```

### 默认步骤条（旧版）

建议使用简易版 steps（新版），旧版后续会逐渐 deprecate

```jsx live=true dir="column"
import React from 'react';
import { Steps } from '@douyinfe/semi-ui';

() => (
    <Steps current={1} onChange={(i)=>console.log(i)}>
        <Steps.Step title="Finished" description="This is a description" />
        <Steps.Step title="In Progress" description="This is a description" />
        <Steps.Step title="Waiting" description="This is a description" />
    </Steps>
);
```

### 简单步骤条（新版）

通过设置 type="basic" 显示为简洁风格步骤条

```jsx live=true dir="column"
import React from 'react';
import { Steps } from '@douyinfe/semi-ui';

() => (
    <Steps type="basic" current={1} onChange={(i)=>console.log(i)}>
        <Steps.Step title="Finished" description="This is a description" />
        <Steps.Step title="In Progress" description="This is a description" />
        <Steps.Step title="Waiting" description="This is a description" />
    </Steps>
);
```

### 导航步骤条

通过设置 type="nav" 显示为导航风格步骤条。导航风格的步骤条有以下特点：
1. 步骤条不支持交互。

2. 适用于步骤间互相关联较小，内容互不影响，且需要突出页面视觉元素时使用。

3. 步骤条的宽度按照内容物撑开。

4. Steps.Step 仅支持title、className、style 属性。

```jsx live=true dir="column"
import React from 'react';
import { Steps } from '@douyinfe/semi-ui';

() => (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
        <Steps type="nav" current={1} style={{ margin: 'auto' }} onChange={(i)=>console.log(i)}>
            <Steps.Step title="注册账号" />
            <Steps.Step title="这个项目的文字比较多多多多" />
            <Steps.Step title="产品用途" />
            <Steps.Step title="期待尝试功能" />
        </Steps>
    </div>
);
```


### 迷你尺寸步骤条

通过设置 size="small" 显示迷你尺寸步骤条

```jsx live=true dir="column"
import React from 'react';
import { Steps } from '@douyinfe/semi-ui';

() => (
    <Steps type="basic" size="small" current={1} onChange={(i)=>console.log(i)}>
        <Steps.Step title="Finished" description="This is a description" />
        <Steps.Step title="In Progress" description="This is a description" />
        <Steps.Step title="Waiting" description="This is a description" />
    </Steps>
);
```

```jsx live=true dir="column"
import React from 'react';
import { Steps } from '@douyinfe/semi-ui';

() => (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
        <Steps type="nav" size="small" current={1} style={{ margin: 'auto' }} onChange={(i)=>console.log(i)}>
            <Steps.Step title="注册账号" />
            <Steps.Step title="这个项目的文字比较多多多多" />
            <Steps.Step title="产品用途" />
            <Steps.Step title="期待尝试功能" />
        </Steps>
    </div>
);

```

### 处理进度

配合内容及按钮使用，表示一个流程的处理进度

```jsx live=true dir="column"
import React from 'react';
import { Steps, Button } from '@douyinfe/semi-ui';

class App extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            current: 0,
        };
    }

    next() {
        const current = this.state.current + 1;
        this.setState({ current });
    }

    prev() {
        const current = this.state.current - 1;
        this.setState({ current });
    }

    render() {
        const { current } = this.state;
        const { Step } = Steps;
        const steps = [
            {
                title: 'First',
                content: 'First-content',
            },
            {
                title: 'Second',
                content: 'Second-content',
            },
            {
                title: 'Last',
                content: 'Last-content',
            },
        ];

        return (
            <div>
                <Steps type="basic" current={current} onChange={(i)=>console.log(i)}>
                    {steps.map(item => (
                        <Step key={item.title} title={item.title} />
                    ))}
                </Steps>
                <div className="steps-content" style={{ marginTop: 4, marginBottom: 4 }}>{steps[current].content}</div>
                <div className="steps-action">
                    {current < steps.length - 1 && (
                        <Button type="primary" onClick={() => this.next()}>
                            Next
                        </Button>
                    )}
                    {current === steps.length - 1 && (
                        <Button type="primary" onClick={() => console.log('Processing complete!')}>
                            Done
                        </Button>
                    )}
                    {current > 0 && (
                        <Button style={{ marginLeft: 8 }} onClick={() => this.prev()}>
                            Previous
                        </Button>
                    )}
                </div>
            </div>
        );
    }
}

```

### 竖直方向的步骤条

通过设置 `direction`，使用竖直方向的步骤条

```jsx live=true dir="column"
import React from 'react';
import { Steps } from '@douyinfe/semi-ui';

() => (
    <Steps direction="vertical" current={1} style={{ width: 300 }} onChange={(i)=>console.log(i)}>
        <Steps.Step title="Finished" description="This is a description" />
        <Steps.Step title="In Progress" description="This is a description" />
        <Steps.Step title="Waiting" description="This is a description" />
    </Steps>
);
```

```jsx live=true dir="column"
import React from 'react';
import { Steps } from '@douyinfe/semi-ui';

() => (
    <Steps direction="vertical" type="basic" current={1} onChange={(i)=>console.log(i)}>
        <Steps.Step title="Finished" description="This is a description" />
        <Steps.Step title="In Progress" description="This is a description" />
        <Steps.Step title="Waiting" description="This is a description" />
    </Steps>
);
```

### 指定步骤状态

步骤运行错误，使用 Steps 的 `status` 属性来指定当前步骤的状态。

```jsx live=true dir="column"
import React from 'react';
import { Steps } from '@douyinfe/semi-ui';

() => (
    <Steps type="basic" current={1} status="error" onChange={(i)=>console.log(i)}>
        <Steps.Step title="Finished" description="This is a description" />
        <Steps.Step title="In Process" description="This is a description" />
        <Steps.Step title="Waiting" description="This is a description" />
    </Steps>
);
```

### 自定义图标/状态

通过设置 Steps.Step 的 `icon` 属性，可以启用自定义图标  
通过设置 Steps.Step 的 `status` 属性，可以自定义每个 step 的状态

```jsx live=true dir="column"
import React from 'react';
import { Steps } from '@douyinfe/semi-ui';
import { IconHome, IconLock } from '@douyinfe/semi-icons';

() => (
    <Steps type="basic" onChange={(i)=>console.log(i)}>
        <Steps.Step status="finish" title="已完成" />
        <Steps.Step status="error" title="错误" />
        <Steps.Step status="warning" title="警告" />
        <Steps.Step status="process" title="正在进行" icon={<IconHome size="extra-large" />} />
        <Steps.Step status="wait" title="等待" icon={<IconLock size="extra-large" />} />
    </Steps>
);
```

### onChange 回调

从 1.29.0 版本开始支持 onChange，可以使用它来实现处理进度。onChange 接收一个 number 类型的参数，该参数等于 initial + current。

```jsx live=true dir="column" hideInDSM
import React from 'react';
import { Steps } from '@douyinfe/semi-ui';

class App extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            current: 1,
        };
    }

    onChange(index) {
        this.setState({ current: index });
    }

    render() {
        const { current } = this.state;
        const { Step } = Steps;
        const steps = [
            {
                title: 'First',
                content: 'First-content',
            },
            {
                title: 'Second',
                content: 'Second-content',
            },
            {
                title: 'Last',
                content: 'Last-content',
            },
        ];

        return (
            <div>
                <Steps type="basic" current={current} onChange={index => this.onChange(index)}>
                    {steps.map(item => (
                        <Step key={item.title} title={item.title} />
                    ))}
                </Steps>
            </div>
        );
    }
}
```

## Accessibility

### ARIA

- Steps、Step组件支持传入`aria-label`属性，来表示Steps和Step的描述
- Step组件具有 `aria-current` `step` 属性，表示这是步骤条内的一步

## API 参考

### Steps

整体步骤条。

| 参数      | 说明   | 类型   | 默认值     | 版本    |
| --------- | ------- | ------ | ----- | ----- |
| className | 类名  | string |    |   |
| current   | 指定当前步骤，从 0 开始记数。在子 Step 元素中，可以通过 `status` 属性覆盖状态 | number | 0  |    |
| direction | 指定步骤条方向。目前支持水平（`horizontal`）和竖直（`vertical`）两种方向      | string | horizontal |    |
| hasLine   | 步骤条类型为basic时，可控制是否显示连接线  | boolean | true       | 1.18.0    |
| initial   | 起始序号，从 0 开始记数   | number | 0   |    |
| status    | 指定当前步骤的状态，可选 `wait`、`process`、`finish`、`error`、`warning`  | string | process    |    |
| size      | 对于简单步骤条和导航步骤条，可选尺寸尺寸，值为`small`、`default`   | string  | `default` | 1.18.0  |
| style     | 样式   | CSSProperties |   |    |
| type     | 步骤条类型，可选 `fill`、`basic`、`nav`  | string | fill | 1.18.0    |
| onChange  | 改变步骤条的回调 | (index: number) => void | -  | 1.29.0    |

### Steps.Step

步骤条内的每一个步骤。

| 参数  | 说明  | 类型  | 默认值 | 版本  |
| ---- | -------| ----- | ----- | ---- |
| aria-label | 容器aria-label   | React.AriaAttributes["aria-label"] |  |   |
| className | 类名   | string |  |   |
| description | 步骤的详情描述，可选  | ReactNode | -  |    |
| icon      | 步骤图标的类型，可选  | ReactNode | -  |    |
| role      | 容器role  | React.AriaRole | -  |    |
| status | 指定状态。当不配置该属性时，会使用 Steps 的 `current` 来自动指定状态。可选：`wait`、`process`、`finish`、`error`、`warning` | string | wait  |  |
| style  | 样式 | CSSProperties |  |   |
| title   | 标题  | ReactNode | -  |   |
| onClick     | 点击回调  | function | -   |    |
| onKeyDown     | 回车事件回调  | function | -   |    |


## 文案规范
- 步骤标题
  - 标题应保持简洁，避免截断和换行；
  - 使用句子大小写书写；
  - 不要包含标点符号
- 描述
  - 为标题补充上下文信息
  - 不要以标点符号结尾
## 设计变量
<DesignToken/>