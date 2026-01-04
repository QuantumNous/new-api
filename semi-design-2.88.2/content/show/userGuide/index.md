---
localeCode: zh-CN
order: 84
category: 展示类
title:  UserGuide 用户引导
icon: doc-userGuide
brief: 用于页面对新用户进行功能引导
---


## 代码演示

### 如何引入

```jsx import
import { UserGuide } from '@douyinfe/semi-ui';
```

### 基本用法

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
            <Button onClick={showDialog}>开始引导</Button>
            <br />
            <br />
            <Space>
                <Switch id={'basic-demo-1'} defaultChecked={true}></Switch>
                <Tag id={'basic-demo-2'}> Default Tag </Tag>
                <Button id={'basic-demo-3'}>确定</Button>
            </Space>
            <UserGuide
                mode="popup"
                mask={true}
                visible={visible}
                steps={[
                    {
                        target: document.querySelector('#basic-demo-1'),
                        title: '新手引导',
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
                    console.log('当前引导步骤', current);
                }}
                onNext={(current) => {
                    console.log('下一步引导');
                }}
                onPrev={(current) => {
                    console.log('上一步引导');
                }}
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

### 主题
`popup` 气泡卡片模式下提供两种主题 `default` 和 `primary`，通过 `theme` 属性设置。
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
            <Button onClick={showDialog}>开始引导</Button>
            <br />
            <br />
            <Space>
                <Switch id={'theme-demo-1'} defaultChecked={true}></Switch>
                <Tag id={'theme-demo-2'}> Default Tag </Tag>
                <Button id={'theme-demo-3'}>确定</Button>
            </Space>
            <UserGuide
                mode="popup"
                mask={true}
                visible={visible}
                theme="primary"
                steps={[
                    {
                        target: document.querySelector('#theme-demo-1'),
                        title: '新手引导',
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

### 气泡卡片弹出位置
`popup` 气泡卡片模式下提供 12 种弹出位置，可选值有`top`, `topLeft`, `topRight`, `left`, `leftTop`, `leftBottom`, `right`, `rightTop`, `rightBottom`, `bottom`, `bottomLeft`, `bottomRight`，还可以通过 `showArrow` 属性设置是否显示箭头。

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
            <Button id={'position-demo'} onClick={showDialog}>开始引导</Button>
            <UserGuide
                mode="popup"
                mask={true}
                visible={visible}
                steps={[
                    {
                        target: document.querySelector('#position-demo'),
                        title: '新手引导',
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

### 设置高亮区域大小
通过 `spotlightPadding` 属性设置。

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
            <Button onClick={showDialog}>开始引导</Button>
            <br />
            <br />
            <Space>
                <Switch id={'padding-demo-1'} defaultChecked={true}></Switch>
                <Tag id={'padding-demo-2'}> Default Tag </Tag>
                <Button id={'padding-demo-3'}>确定</Button>
            </Space>
            <UserGuide
                mode="popup"
                mask={true}
                visible={visible}
                spotlightPadding={10}
                steps={[
                    {
                        target: document.querySelector('#padding-demo-1'),
                        title: '新手引导',
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

### 定制按钮
通过 `nextButtonProps` 和 `prevButtonProps` 属性设置按钮的样式。
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
            <Button onClick={showDialog}>开始引导</Button>
            <br />
            <br />
            <Space>
                <Switch id={'button-demo-1'} defaultChecked={true}></Switch>
                <Tag id={'button-demo-2'}> Default Tag </Tag>
                <Button id={'button-demo-3'}>确定</Button>
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
                finishText="我知道啦！"
                steps={[
                    {
                        target: document.querySelector('#button-demo-1'),
                        title: '新手引导',
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

### 受控
通过 `current` 属性设置当前引导步骤。

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
            <Button onClick={showDialog}>开始引导</Button>
            <br />
            <br />
            <Space>
                <Switch id={'controlled-demo-1'} defaultChecked={true}></Switch>
                <Tag id={'controlled-demo-2'}> Default Tag </Tag>
                <Button id={'controlled-demo-3'}>确定</Button>
            </Space>
            <UserGuide
                mode="popup"
                mask={true}
                visible={visible}
                current={current}
                steps={[
                    {
                        target: document.querySelector('#controlled-demo-1'),
                        title: '新手引导',
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
                    console.log('引导完成');
                }}
                onSkip={() => {
                    setVisible(false);
                    setCurrent(0);
                    console.log('跳过引导');
                }}
            />  
        </div>
    );
};
```


### 弹窗式引导
通过 `mode` 属性设置为 `modal` 开启弹窗式引导。

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
            <Button onClick={showDialog}>开始引导</Button>
            <UserGuide
                mode="modal"
                mask={true}
                visible={visible}
                steps={[
                    {
                        title: '欢迎使用 Semi DSM!',
                        description: <div>你可以从已发布的主题出发，或者选择{<Typography.Text strong>立即创造</Typography.Text>}来创造一个新的主题</div>,
                        cover: <Image 
                            width={'600px'} 
                            height={'100%'} 
                            src="https://lf9-static.bytednsdoc.com/obj/eden-cn/nuhpxphk/dsm/dsm_welcome.png"
                        />,
                        position: 'bottom',
                    },
                    {
                        title: '高可用的色盘',
                        description: '选取主色后，我们的颜色算法会为你生成一套高可用的色盘',
                        cover: <Image 
                            width={'600px'} 
                            height={'100%'} 
                            src="https://lf9-static.bytednsdoc.com/obj/eden-cn/nuhpxphk/dsm/dsm_console.png"
                        />,
                        position: 'bottom',
                    },
                    {
                        title: '自由定制',
                        description: '开始定制属于你的设计系统吧！',
                        cover: <Image 
                            width={'600px'} 
                            height={'100%'} 
                            src="https://lf9-static.bytednsdoc.com/obj/eden-cn/nuhpxphk/dsm/dsm_palette.png" 
                        />,
                        position: 'bottom',
                    },
                ]}
                onChange={(current) => {
                    console.log('当前引导步骤', current);
                }}
                onNext={(current) => {
                    console.log('下一步引导');
                }}
                onPrev={(current) => {
                    console.log('上一步引导');
                }}
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

### 无遮罩
通过 `mask` 属性设置为 `false` 开启无遮罩引导。

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
            <Button id={'mask-demo'} onClick={showDialog}>开始引导</Button>
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

## API 参考

---
| 属性 | 说明 | 类型 | 默认值 | 版本 |
| --- | --- | --- | --- | --- |
| className | 自定义类名 | string | - | |
| current | 当前步骤的索引 | number | 0 | |
| finishText | 最后一步完成按钮的文本 | string | '完成' | |
| mask | 是否显示蒙层 | boolean | true | |
| mode | 引导模式，可选值：`popup`（气泡卡片）或 `modal`（弹窗式） | string | popup | |
| nextButtonProps | 下一步按钮的属性 | ButtonProps | {} | |
| onChange | 步骤改变时的回调 | function(current: number) | () => void | |
| onFinish | 完成所有步骤时的回调 | function() | () => void | |
| onNext | 点击下一步按钮时的回调 | function(current: number) | () => void | |
| onPrev | 点击上一步按钮时的回调 | function(current: number) | () => void | |
| onSkip | 点击跳过按钮时的回调 | function() | () => void | |
| position | 弹出层相对于目标元素的位置，可选值：`top`, `topLeft`, `topRight`, `left`, `leftTop`, `leftBottom`, `right`, `rightTop`, `rightBottom`, `bottom`, `bottomLeft`, `bottomRight` | string | bottom | |
| prevButtonProps | 上一步按钮的属性 | ButtonProps | {} | |
| showPrevButton | 是否显示上一步按钮 | boolean | true | |
| showSkipButton | 是否显示跳过按钮 | boolean | true | |
| spotlightPadding | 高亮区域的内边距，单位为像素 | number | - | |
| steps | 引导步骤配置，必填 | StepItem[] | [] | |
| style | 自定义样式 | React.CSSProperties | - | |
| theme | 主题样式，可选值：`default` 或 `primary` | string | default | |
| visible | 是否显示引导 | boolean | false | |
| getPopupContainer | 指定父级 DOM，弹层将会渲染至该 DOM 中 | () => HTMLElement | - | |
| zIndex | 弹层层级 | number | 1030 | |

### Steps.Step
| 属性 | 说明 | 类型 | 默认值 | 版本 |
| --- | --- | --- | --- | --- |
| className | 步骤的自定义类名 | string | - | |
| cover | 步骤的封面图 | ReactNode | - | |
| target | 目标元素，高亮区域会聚焦到这个元素上 | (() => Element) \| Element | - | |
| title | 步骤标题 | string \| ReactNode | - | |
| description | 步骤描述 | ReactNode | - | |
| mask | 是否显示此步骤的蒙层，会覆盖全局配置 | boolean | - | |
| showArrow | 是否显示箭头（仅在 mode=`popup` 时有效） | boolean | true | |
| spotlightPadding | 此步骤高亮区域区域的内边距，会覆盖全局配置 | number | - | |
| theme | 此步骤的主题，会覆盖全局配置 | `default` \| `primary` | - | |
| position | 此步骤弹出层的位置，会覆盖全局配置 | Position | - | |

## 设计变量

<DesignToken/>

