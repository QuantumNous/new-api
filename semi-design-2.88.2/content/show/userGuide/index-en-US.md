---
localeCode: en-US
order: 84
category: Show
title: UserGuide
icon: doc-userGuide
brief: Used to guide new users through pages
---


## Demos

### How to import

```jsx import
import { UserGuide } from '@douyinfe/semi-ui';
```

### Basic Usage

```jsx live=true
import React from 'react';
import { UserGuide, Button, Space, Tag, Switch } from '@douyinfe/semi-ui';

() => {
    const [visible, setVisible] = useState(false);
    const showDialog = () => {
        setVisible(true);
    };
    return (
        <div>
            <Button onClick={showDialog}>Start Guide</Button>
            <br />
            <br />
            <Space>
                <Switch id={'basic-demo-1'} defaultChecked={true}></Switch>
                <Tag id={'basic-demo-2'}> Default Tag </Tag>
                <Button id={'basic-demo-3'}>Confirm</Button>
            </Space>
            <UserGuide
                mode="popup"
                mask={true}
                visible={visible}
                steps={[
                    {
                        target: document.querySelector('#basic-demo-1'),
                        title: "Beginner's Guide",
                        description: 'Hello ByteDancer!',
                        position: 'bottom',
                    },
                    {
                        target: document.querySelector('#basic-demo-2'),
                        title: 'Switch',
                        description: 'This is a Semi Switch',
                        position: 'bottom',
                    },
                    {
                        target: document.querySelector('#basic-demo-3'),
                        title: 'Button',
                        description: 'This is a Semi Button',
                        position: 'bottom',
                    },
                ]}
                onChange={(current) => {
                    console.log('Current guide step', current);
                }}
                onNext={(current) => {
                    console.log('Next guide step');
                }}
                onPrev={(current) => {
                    console.log('Previous guide step');
                }}
                onFinish={() => {
                    setVisible(false);
                    console.log('Guide completed');
                }}
                onSkip={() => {
                    setVisible(false);
                    console.log('Skip guide');
                }}
            />  
        </div>
    );
};
```

### Theme
`popup` bubble card mode provides two themes `default` and `primary`, set by the `theme` property.
```jsx live=true
import React from 'react';
import { UserGuide, Button, Space, Tag, Switch } from '@douyinfe/semi-ui';

() => {
    const [visible, setVisible] = useState(false);
    const showDialog = () => {
        setVisible(true);
    };
    return (
        <div>
            <Button onClick={showDialog}>Start Guide</Button>
            <br />
            <br />
            <Space>
                <Switch id={'theme-demo-1'} defaultChecked={true}></Switch>
                <Tag id={'theme-demo-2'}> Default Tag </Tag>
                <Button id={'theme-demo-3'}>Confirm</Button>
            </Space>
            <UserGuide
                mode="popup"
                mask={true}
                visible={visible}
                theme="primary"
                steps={[
                    {
                        target: document.querySelector('#theme-demo-1'),
                        title: "Beginner's Guide",
                        description: 'Hello ByteDancer!',
                        position: 'bottom',
                    },
                    {
                        target: document.querySelector('#theme-demo-2'),
                        title: 'Switch',
                        description: 'This is a Semi Switch',
                        position: 'bottom',
                    },
                    {
                        target: document.querySelector('#theme-demo-3'),
                        title: 'Button',
                        description: 'This is a Semi Button',
                        position: 'bottom',
                    },
                ]}
                onFinish={() => {
                    setVisible(false);
                    console.log('引导完成');
                }}
                onSkip={() => {
                    setVisible(false);
                    console.log('跳过引导');
                }}
            />  
        </div>
    );
};
```

### Popup position
`popup` bubble card mode provides 12 positions, optional values are `top`, `topLeft`, `topRight`, `left`, `leftTop`, `leftBottom`, `right`, `rightTop`, `rightBottom`, `bottom`, `bottomLeft`, `bottomRight`, and can be set by the `showArrow` property to display the arrow.

```jsx live=true
import React from 'react';
import { UserGuide, Button, Space, Tag, Switch } from '@douyinfe/semi-ui';

() => {
    const [visible, setVisible] = useState(false);
    const showDialog = () => {
        setVisible(true);
    };
    return (
        <div>
            <Button id={'position-demo'} onClick={showDialog}>Start Guide</Button>
            <UserGuide
                mode="popup"
                mask={true}
                visible={visible}
                steps={[
                    {
                        target: document.querySelector('#position-demo'),
                        title: "Beginner's Guide",
                        description: 'Hello ByteDancer!',
                        position: 'top',
                    },
                    {
                        target: document.querySelector('#position-demo'),
                        title: 'New Position',
                        description: 'This is Right Position',
                        position: 'right',
                    },
                    {
                        target: document.querySelector('#position-demo'),
                        title: 'Hide Arrow',
                        description: 'We hide the arrow',
                        position: 'bottom',
                        showArrow: false,
                    },
                ]}
                onFinish={() => {
                    setVisible(false);
                    console.log('Guide completed');
                }}
                onSkip={() => {
                    setVisible(false);
                    console.log('Skip guide');
                }}
            />  
        </div>
    );
};
```

### Set the size of the highlight area
Set by the `spotlightPadding` property.

```jsx live=true
import React from 'react';
import { UserGuide, Button, Space, Tag, Switch } from '@douyinfe/semi-ui';

() => {
    const [visible, setVisible] = useState(false);
    const showDialog = () => {
        setVisible(true);
    };
    return (
        <div>
            <Button onClick={showDialog}>Start Guide</Button>
            <br />
            <br />
            <Space>
                <Switch id={'padding-demo-1'} defaultChecked={true}></Switch>
                <Tag id={'padding-demo-2'}> Default Tag </Tag>
                <Button id={'padding-demo-3'}>Confirm</Button>
            </Space>
            <UserGuide
                mode="popup"
                mask={true}
                visible={visible}
                spotlightPadding={10}
                steps={[
                    {
                        target: document.querySelector('#padding-demo-1'),
                        title: "Beginner's Guide",
                        description: 'Hello ByteDancer!',
                    },
                    {
                        target: document.querySelector('#padding-demo-2'),
                        title: 'New Padding',
                        description: 'This is 10px padding',
                    },
                    {
                        target: document.querySelector('#padding-demo-3'),
                        title: 'Change Padding',
                        spotlightPadding: 15,
                        description: 'We change the Padding to 15px',
                    },
                ]}
                onFinish={() => {
                    setVisible(false);
                    console.log('Guide completed');
                }}
                onSkip={() => {
                    setVisible(false);
                    console.log('Skip guide');
                }}
            />  
        </div>
    );
};
```

### Customize the button
Set by the `nextButtonProps` and `prevButtonProps` properties.
```jsx live=true
import React from 'react';
import { UserGuide, Button, Space, Tag, Switch } from '@douyinfe/semi-ui';

() => {
    const [visible, setVisible] = useState(false);
    const showDialog = () => {
        setVisible(true);
    };
    return (
        <div>
            <Button onClick={showDialog}>Start Guide</Button>
            <br />
            <br />
            <Space>
                <Switch id={'button-demo-1'} defaultChecked={true}></Switch>
                <Tag id={'button-demo-2'}> Default Tag </Tag>
                <Button id={'button-demo-3'}>Confirm</Button>
            </Space>
            <UserGuide
                mode="popup"
                mask={true}
                visible={visible}
                nextButtonProps={{
                    children: 'Next',
                }}
                prevButtonProps={{
                    children: 'Prev',
                    theme: 'borderless',
                }}
                finishText="I know!"
                steps={[
                    {
                        target: document.querySelector('#button-demo-1'),
                        title: "Beginner's Guide",
                        description: 'Hello ByteDancer!',
                    },
                    {
                        target: document.querySelector('#button-demo-2'),
                        title: 'New Button Style',
                        description: 'Button text is Next',
                    },
                    {
                        target: document.querySelector('#button-demo-3'),
                        title: 'New finish button text',
                        description: 'Button text is I know',
                    },
                ]}
                onFinish={() => {
                    setVisible(false);
                    console.log('Guide completed');
                }}
                onSkip={() => {
                    setVisible(false);
                    console.log('Skip guide');
                }}
            />  
        </div>
    );
};
```

### Controlled
Set by the `current` property.

```jsx live=true
import React from 'react';
import { UserGuide, Button, Space, Tag, Switch } from '@douyinfe/semi-ui';

() => {
    const [visible, setVisible] = useState(false);
    const [current, setCurrent] = useState(0);

    const showDialog = () => {
        setVisible(true);
    };
    return (
        <div>
            <Button onClick={showDialog}>Start Guide</Button>
            <br />
            <br />
            <Space>
                <Switch id={'controlled-demo-1'} defaultChecked={true}></Switch>
                <Tag id={'controlled-demo-2'}> Default Tag </Tag>
                <Button id={'controlled-demo-3'}>Confirm</Button>
            </Space>
            <UserGuide
                mode="popup"
                mask={true}
                visible={visible}
                current={current}
                steps={[
                    {
                        target: document.querySelector('#controlled-demo-1'),
                        title: "Beginner's Guide",
                        description: 'Hello ByteDancer!',
                        position: 'bottom',
                    },
                    {
                        target: document.querySelector('#controlled-demo-2'),
                        title: 'Switch',
                        description: 'This is a Semi Switch',
                        position: 'bottom',
                    },
                    {
                        target: document.querySelector('#controlled-demo-3'),
                        title: 'Button',
                        description: 'This is a Semi Button',
                        position: 'bottom',
                    },
                ]}
                onChange={(current) => {
                    setCurrent(current);
                }}
                onFinish={() => {
                    setVisible(false);
                    setCurrent(0);
                    console.log('Guide completed');
                }}
                onSkip={() => {
                    setVisible(false);
                    setCurrent(0);
                    console.log('Skip guide');
                }}
            />  
        </div>
    );
};
```


### Modal guide
Set by the `mode` property.

```jsx live=true
import React from 'react';
import { UserGuide, Button, Space, Tag, Switch, Image, Typography } from '@douyinfe/semi-ui';

() => {
    const [visible, setVisible] = useState(false);
    const showDialog = () => {
        setVisible(true);
    };
    return (
        <div>
            <Button onClick={showDialog}>Start Guide</Button>
            <UserGuide
                mode="modal"
                mask={true}
                visible={visible}
                steps={[
                    {
                        title: 'Welcome to Semi DSM!',
                        description: <div>You can start from the published theme, or choose {<Typography.Text strong>Create Now</Typography.Text>} to create a new theme</div>,
                        cover: <Image 
                            width={'600px'} 
                            height={'100%'} 
                            src="https://lf9-static.bytednsdoc.com/obj/eden-cn/nuhpxphk/dsm/dsm_welcome.png"
                        />,
                        position: 'bottom',
                    },
                    {
                        title: 'High-available color palette',
                        description: 'After selecting the main color, our color algorithm will generate a high-available color palette for you',
                        cover: <Image 
                            width={'600px'} 
                            height={'100%'} 
                            src="https://lf9-static.bytednsdoc.com/obj/eden-cn/nuhpxphk/dsm/dsm_console.png"
                        />,
                        position: 'bottom',
                    },
                    {
                        title: 'Customize freely',
                        description: 'Start customizing your design system!',
                        cover: <Image 
                            width={'600px'} 
                            height={'100%'} 
                            src="https://lf9-static.bytednsdoc.com/obj/eden-cn/nuhpxphk/dsm/dsm_palette.png" 
                        />,
                        position: 'bottom',
                    },
                ]}
                onChange={(current) => {
                    console.log('Current guide step', current);
                }}
                onNext={(current) => {
                    console.log('Next guide step');
                }}
                onPrev={(current) => {
                    console.log('Previous guide step');
                }}
                onFinish={() => {
                    setVisible(false);
                    console.log('Guide completed');
                }}
                onSkip={() => {
                    setVisible(false);
                    console.log('Skip guide');
                }}
            />  
        </div>
    );
};
```

### No mask
Set by the `mask` property.

```jsx live=true
import React from 'react';
import { UserGuide, Button, Space, Tag, Switch, Image } from '@douyinfe/semi-ui';

() => {
    const [visible, setVisible] = useState(false);
    const showDialog = () => {
        setVisible(true);
    };
    return (
        <div>
            <Button id={'mask-demo'} onClick={showDialog}>Start Guide</Button>
            <UserGuide
                mode="popup"
                mask={false}
                visible={visible}
                steps={[
                    {
                        target: document.querySelector('#mask-demo'),
                        title: 'No Mask',
                        description: 'Hello ByteDancer!',
                    },
                ]}
                onFinish={() => {
                    setVisible(false);
                    console.log('Guide completed');
                }}
                onSkip={() => {
                    setVisible(false);
                    console.log('Skip guide');
                }}
            />  
        </div>
    );
};
```

## API Reference

---
| Properties | Instructions | Type | Default | Version |
| --- | --- | --- | --- | --- |
| className | Custom class name | string | - | |
| current | Current step index | number | 0 | |
| finishText | Text of the last step completion button | string | '完成' | |
| mask | Whether to display the mask | boolean | true | |
| mode | Guide mode, optional values: `popup` (bubble card) or `modal` (modal) | string | popup | |
| nextButtonProps | The properties of the next button | ButtonProps | {} | |
| onChange | Callback when the step changes | function(current: number) | () => void | |
| onFinish | Callback when all steps are completed | function() | () => void | |
| onNext | Callback when the next button is clicked | function(current: number) | () => void | |
| onPrev | Callback when the previous button is clicked | function(current: number) | () => void | |
| onSkip | Callback when the skip button is clicked | function() | () => void | |
| position | The position of the pop-up layer relative to the target element, optional values: `top`, `topLeft`, `topRight`, `left`, `leftTop`, `leftBottom`, `right`, `rightTop`, `rightBottom`, `bottom`, `bottomLeft`, `bottomRight` | string | bottom | |
| prevButtonProps | The properties of the previous button | ButtonProps | {} | |
| showPrevButton | Whether to display the previous button | boolean | true | |
| showSkipButton | Whether to display the skip button | boolean | true | |
| spotlightPadding | The inner padding of the highlight area, in pixels | number | - | |
| steps | Guide step configuration, required | StepItem[] | [] | |
| style | Custom style | React.CSSProperties | - | |
| theme | Theme style, optional values: `default` or `primary` | string | default | |
| visible | Whether to display the guide | boolean | false | |
| getPopupContainer | Specify the parent DOM, the pop-up layer will be rendered to the DOM | () => HTMLElement | - | |
| zIndex | Pop-up layer level | number | 1030 | |

### Steps.Step
| Properties | Instructions | Type | Default | Version |
| --- | --- | --- | --- | --- |
| className | Custom class name | string | - | |
| cover | The cover image of the step | ReactNode | - | |
| target | The target element, the highlight area will focus on this element | (() => Element) \| Element | - | |
| title | Step title | string \| ReactNode | - | |
| description | Step description | ReactNode | - | |
| mask | Whether to display the mask of this step, it will override the global configuration | boolean | - | |
| showArrow | Whether to display the arrow (only valid when mode=`popup`) | boolean | true | | 
| spotlightPadding | The inner padding of the highlight area of this step, it will override the global configuration | number | - | |
| theme | The theme of this step, it will override the global configuration | `default` \| `primary` | - | |
| position | The position of the pop-up layer of this step, it will override the global configuration | Position | - | |

## Design Tokens

<DesignToken/>

