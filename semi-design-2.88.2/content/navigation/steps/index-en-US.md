---
localeCode: en-US
order: 58
category: Navigation
title: Steps
subTitle: Steps
icon: doc-steps
dir: column
brief: Decompose complex tasks or tasks with prior relationships, use step components to guide users to operate according to the prescribed process, and let them know their current progress
---

## Demos

### How to import

```jsx
import { Steps } from '@douyinfe/semi-ui';
const Step = Steps.Step;
```

### Default step bar(Deprecated)

It is recommended to use the simple version of steps, which will be gradually deprecated later

```jsx live=true dir="column"
import React from 'react';
import { Steps } from '@douyinfe/semi-ui';

() => (
    <Steps current={1} onChange={(i)=>console.log(i)}>
        <Steps.Step title="Finished" description="This is a description." />
        <Steps.Step title="In Progress" description="This is a description." />
        <Steps.Step title="Waiting" description="This is a description." />
    </Steps>
);
```

### Basic Steps(Recommended)

Set type=`"basic"` to display a simple style step bar

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

### Nav Steps

You can use type="nav" to set the navigation style step bar. The navigation style step bar has the following characteristics:
1. The step bar does not support interaction.

2. It is suitable when the steps are not related to each other, the content does not affect each other, and the visual elements of the page need to be highlighted.

3. The width of the step bar is opened according to the content.

4. Steps.Step only supports title, className, and style attributes.

```jsx live=true dir="column"
import React from 'react';
import { Steps } from '@douyinfe/semi-ui';

() => (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
        <Steps type="nav" current={1} style={{ margin: 'auto' }} onChange={(i)=>console.log(i)}>
            <Steps.Step title="Register an account" />
            <Steps.Step title="There is a lot of text in this project" />
            <Steps.Step title="Product Usage" />
            <Steps.Step title="Looking forward to trying out features" />
        </Steps>
    </div>
);
```

### Mini size step bar

Display the mini size step bar by setting size=`"small"`

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
            <Steps.Step title="Register an account" />
            <Steps.Step title="There is a lot of text in this project" />
            <Steps.Step title="Product Usage" />
            <Steps.Step title="Looking forward to trying out features" />
        </Steps>
    </div>  
);
```

### Processing progress

Use with content and buttons to represent the processing progress of a process

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
                <div className Name="steps-content" style={{ marginTop: 4, marginBottom: 4 }}>
                    {steps[current].content}
                </div>
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

### Steps bar in vertical direction

Show steps in vertical direction by setting direction

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

### Specify step status

Using Steps `status` Property to specify the state of the current step.

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

### Custom icons

By setting Steps.Step's `icon` Properties, you can use custom icons.

```jsx live=true dir="column"
import React from 'react';
import { Steps } from '@douyinfe/semi-ui';
import { IconHome, IconLock, IconClear, IconTickCircle } from '@douyinfe/semi-icons';

() => (
    <Steps type="basic" onChange={(i)=>console.log(i)}>
        <Steps.Step status="finish" title="Login" icon={<IconHome />} />
        <Steps.Step status="finish" title="Verification" icon={<IconLock />} />
        <Steps.Step status="process" title="Pay" icon={<IconClear />} />
        <Steps.Step status="wait" title="Done" icon={<IconTickCircle />} />
    </Steps>
);
```

### onChange CallBack

Since version 1.29.0, onChange is supported, which can be used to realize the processing progress. onChange receives a parameter of type number, which is equal to initial + current.

```jsx live=true dir="column"
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

## API reference

### Steps

| Parameters | Instructions | type | Default | Version |
| --- | --- | --- | --- | --- |
| className | Class name | string |  |  |
| current | Specifies the current step, counting from 0. In the subStep element, the state can be overridden by the `status` attribute | number | 0 |  |
| direction | Specify step bar directions. Currently support level (`vertical`) and vertical (`vertical`) in both directions | string | with |  |
| hasLine | When the step bar type is basic, you can control whether to display the connecting line | boolean | true | 1.18.0 |
| initial | Start serial number, count from 0. | number | 0 |  |
| size | For simple step bar and navigation step bar, the size is optional, the value is `small`, `default` | string | `default` | 1.18.0 |
| status | Specify the status of the current step, optional `wait`,`process`,`finish`,`error`,`warning` | string | process |  |
| style | Style | CSSProperties |  |  |
| type | Steps type, optional `fill` `basic`、`nav` | string | fill | 1.18.0 |
| onChange  | onChange callback    | (index: number)=>void | -       | 1.29.0    |

### Steps.Step

Step in the step bar.

| Parameters | Instructions | type | Default | Version |
| --- | --- | --- | --- | --- |
| aria-label | Container aria-label   | React.AriaAttributes["aria-label"] |  |   |
| description | Detailed description of steps, optional | ReactNode |  | - |  |
| icon | Type of step icon, optional | ReactNode |  | - |  |
| role      | Container role  | React.AriaRole | -  |    |
| status | Specify the state. When this property is not configured, the `current`of Steps is used to automatically specify the state. Optional: `wait`,`process`,`finish`,`error`,`warning` | string | wait |  |
| style     | CSS Style                                                                          | CSSProperties |            |    |
| title | Title | ReactNode |  | - |  |
| onClick | Callback of click | function | - |  |
| onKeyDown     | Callback ok keyDown  | function | -   |    |

## Accessibility

### ARIA

- Steps and Step components support passing in the `aria-label` attribute to represent the description of Steps and Steps
- Step component has an `aria-current` `step` attribute, indicating that this is a step in the step bar

## Content Guidelines
- Step title
  - title should be kept concise, avoiding truncation and line breaks
  - use sentence capitalization
  - do not include punctuation
- Step description
  - supplementary contextual information for the title
  - don't end with punctuation

## Design Tokens

<DesignToken/>
