---
localeCode: zh-CN
order: 65
category: 展示类
title: Carousel 轮播图
icon: doc-carousel
brief: 轮播图是一种媒体组件，可以在可视化应用中展示多张图片轮流播放的效果。
---

## 代码演示

### 如何引入
```jsx import
import { Carousel } from '@douyinfe/semi-ui';
```

### 基本用法

基本用法

```jsx live=true dir="column"
import React from 'react';
import { Carousel, Typography, Space } from '@douyinfe/semi-ui';

() => {
    const { Title, Paragraph } = Typography;

    const style = {
        width: '100%',
        height: '400px',
    };

    const titleStyle = { 
        position: 'absolute', 
        top: '100px', 
        left: '100px',
        color: '#1C1F23'
    };

    const colorStyle = {
        color: '#1C1F23'
    };

    const renderLogo = () => {
        return (
            <img src='https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/semi_logo.svg' alt='semi_logo' style={{ width: 87, height: 31 }} />   
        );
    };

    const imgList = [
        'https://lf3-static.bytednsdoc.com/obj/eden-cn/hjeh7pldnulm/SemiDocs/bg-1.png',
        'https://lf3-static.bytednsdoc.com/obj/eden-cn/hjeh7pldnulm/SemiDocs/bg-2.png',
        'https://lf3-static.bytednsdoc.com/obj/eden-cn/hjeh7pldnulm/SemiDocs/bg-3.png',
    ];

    const textList = [
        ['Semi 设计管理系统', '从 Semi Design，到 Any Design', '快速定制你的设计系统，并应用在设计稿和代码中'],
        ['Semi 物料市场', '面向业务场景的定制化组件，支持线上预览和调试', '内容由 Semi Design 用户共建'],
        ['Semi Template', '高效的 Design2Code 设计稿转代码', '海量 Figma 设计模板一键转为真实前端代码'],
    ];

    return (
        <Carousel style={style} theme='dark'>
            {
                imgList.map((src, index) => {
                    return (
                        <div key={index} style={{ backgroundSize: 'cover', backgroundImage: `url('${src}')` }}>
                            <Space vertical align='start' spacing='medium' style={titleStyle}>
                                {renderLogo()}
                                <Title heading={2} style={colorStyle}>{textList[index][0]}</Title>
                                <Space vertical align='start'>
                                    <Paragraph style={colorStyle}>{textList[index][1]}</Paragraph>
                                    <Paragraph style={colorStyle}>{textList[index][2]}</Paragraph>
                                </Space>
                            </Space>
                        </div>
                    );
                })
            }
        </Carousel>
    );
};
```

### 主题切换

默认定义了三种主题：  `primary`、`light`、`dark`

```jsx live=true dir="column"
import React from 'react';
import { Carousel, RadioGroup, Radio, Space, Typography } from '@douyinfe/semi-ui';

() => {
    const { Title, Paragraph } = Typography;
    const [theme, setTheme] = useState('primary');

    const style = {
        width: '100%',
        height: '400px',
    };

    const titleStyle = { 
        position: 'absolute', 
        top: '100px', 
        left: '100px'
    };

    const colorStyle = {
        color: '#1C1F23'
    };

    const renderLogo = () => {
        return (
            <img src='https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/semi_logo.svg' alt='semi_logo' style={{ width: 87, height: 31 }}/>
        );
    };

    const imgList = [
        'https://lf3-static.bytednsdoc.com/obj/eden-cn/hjeh7pldnulm/SemiDocs/bg-1.png',
        'https://lf3-static.bytednsdoc.com/obj/eden-cn/hjeh7pldnulm/SemiDocs/bg-2.png',
        'https://lf3-static.bytednsdoc.com/obj/eden-cn/hjeh7pldnulm/SemiDocs/bg-3.png',
    ];

    const textList = [
        ['Semi 设计管理系统', '从 Semi Design，到 Any Design', '快速定制你的设计系统，并应用在设计稿和代码中'],
        ['Semi 物料市场', '面向业务场景的定制化组件，支持线上预览和调试', '内容由 Semi Design 用户共建'],
        ['Semi 设计/代码模板', '高效的 Design2Code 设计稿转代码', '海量 Figma 设计模板一键转为真实前端代码'],
    ];
    
    return (
        <div>
            <Carousel style={style} theme={theme} autoPlay={false}>
                {
                    imgList.map((src, index) => {
                        return (
                            <div key={index} style={{ backgroundSize: 'cover', backgroundImage: `url('${src}')` }}>
                                <Space vertical align='start' spacing='medium' style={titleStyle}>
                                    {renderLogo()}
                                    <Title heading={2} style={colorStyle}>{textList[index][0]}</Title>
                                    <Space vertical align='start'>
                                        <Paragraph style={colorStyle}>{textList[index][1]}</Paragraph>
                                        <Paragraph style={colorStyle}>{textList[index][2]}</Paragraph>
                                    </Space>
                                </Space>
                            </div>
                        );
                    })
                }
            </Carousel>
            <br/>
            <Space> 
                <div>主题</div>
                <RadioGroup onChange={e => setTheme(e.target.value)} value={theme} type="button">
                    <Radio value='primary'>primary</Radio>
                    <Radio value='light'>light</Radio>
                    <Radio value='dark'>dark</Radio>
                </RadioGroup>
            </Space>
        </div>
    );
};
```

### 指示器

指示器可以调节类型、位置、尺寸  
类型：  `dot`、`line`、`columnar`  
位置：  `left`、`center`、`right`  
尺寸：  `small`、`medium`

```jsx live=true dir="column"
import React from 'react';
import { Carousel, RadioGroup, Radio, Space, Typography } from '@douyinfe/semi-ui';

() => {
    const { Title, Paragraph } = Typography;
    const [size, setSize] = useState('small');
    const [type, setType] = useState('dot');
    const [position, setPosition] = useState('left');

    const style = {
        width: '100%',
        height: '400px',
    };

    const titleStyle = { 
        position: 'absolute', 
        top: '100px', 
        left: '100px'
    };

    const colorStyle = {
        color: '#1C1F23'
    };

    const renderLogo = () => {
        return (
            <img src='https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/semi_logo.svg' alt='semi_logo' style={{ width: 87, height: 31 }}/>
        );
    };

    const imgList = [
        'https://lf3-static.bytednsdoc.com/obj/eden-cn/hjeh7pldnulm/SemiDocs/bg-1.png',
        'https://lf3-static.bytednsdoc.com/obj/eden-cn/hjeh7pldnulm/SemiDocs/bg-2.png',
        'https://lf3-static.bytednsdoc.com/obj/eden-cn/hjeh7pldnulm/SemiDocs/bg-3.png',
    ];

    const textList = [
        ['Semi 设计管理系统', '从 Semi Design，到 Any Design', '快速定制你的设计系统，并应用在设计稿和代码中'],
        ['Semi 物料市场', '面向业务场景的定制化组件，支持线上预览和调试', '内容由 Semi Design 用户共建'],
        ['Semi 设计/代码模板', '高效的 Design2Code 设计稿转代码', '海量 Figma前端代码一键转'],
    ];

    return (
        <div>
            <Carousel style={style} indicatorType={type} indicatorPosition={position} indicatorSize={size} theme='dark' autoPlay={false}>
                {
                    imgList.map((src, index) => {
                        return (
                            <div key={index} style={{ backgroundSize: 'cover', backgroundImage: `url('${src}')` }}>
                                <Space vertical align='start' spacing='medium' style={titleStyle}>
                                    {renderLogo()}
                                    <Title heading={2} style={colorStyle}>{textList[index][0]}</Title>
                                    <Space vertical align='start'>
                                        <Paragraph style={colorStyle}>{textList[index][1]}</Paragraph>
                                        <Paragraph style={colorStyle}>{textList[index][2]}</Paragraph>
                                    </Space>
                                </Space>
                            </div>
                        );
                    })
                }
            </Carousel>
            <br/>
            <Space vertical align='start'>
                <Space> 
                    <div>类型</div>
                    <RadioGroup onChange={e => setType(e.target.value)} value={type} type="button">
                        <Radio value='dot'>dot</Radio>
                        <Radio value='line'>line</Radio>
                        <Radio value='columnar'>columnar</Radio>
                    </RadioGroup>
                </Space>
                <Space> 
                    <div>位置</div>
                    <RadioGroup onChange={e => setPosition(e.target.value)} value={position} type="button">
                        <Radio value='left'>left</Radio>
                        <Radio value='center'>center</Radio>
                        <Radio value='right'>right</Radio>
                    </RadioGroup>
                </Space>
                <Space> 
                    <div>尺寸</div>
                    <RadioGroup onChange={e => setSize(e.target.value)} value={size} type="button">
                        <Radio value='small'>small</Radio>
                        <Radio value='medium'>medium</Radio>
                    </RadioGroup>
                </Space>
            </Space>
        </div>
    );
};
```

### 箭头

通过 showArrow 属性控制箭头是否可见  
如果箭头可见，通过 arrowType 属性控制箭头展示的时机

```jsx live=true dir="column"
import React from 'react';
import { Carousel, RadioGroup, Radio, Space, Typography } from '@douyinfe/semi-ui';

() => {
    const { Title, Paragraph } = Typography;
    const [arrowType, setArrowType] = useState('always');
    const [show, setShow] = useState(true);
  
    const style = {
        width: '100%',
        height: '400px',
    };

    const titleStyle = { 
        position: 'absolute', 
        top: '100px', 
        left: '100px'
    };

    const colorStyle = {
        color: '#1C1F23'
    };

    const renderLogo = () => {
        return (
            <img src='https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/semi_logo.svg' alt='semi_logo' style={{ width: 87, height: 31 }}/>
        );
    };

    const imgList = [
        'https://lf3-static.bytednsdoc.com/obj/eden-cn/hjeh7pldnulm/SemiDocs/bg-1.png',
        'https://lf3-static.bytednsdoc.com/obj/eden-cn/hjeh7pldnulm/SemiDocs/bg-2.png',
        'https://lf3-static.bytednsdoc.com/obj/eden-cn/hjeh7pldnulm/SemiDocs/bg-3.png',
    ];

    const textList = [
        ['Semi 设计管理系统', '从 Semi Design，到 Any Design', '快速定制你的设计系统，并应用在设计稿和代码中'],
        ['Semi 物料市场', '面向业务场景的定制化组件，支持线上预览和调试', '内容由 Semi Design 用户共建'],
        ['Semi 设计/代码模板', '高效的 Design2Code 设计稿转代码', '海量 Figma 设计模板一键转为真实前端代码'],
    ];

    return (
        <div>
            <Carousel style={style} showArrow={show} arrowType={arrowType} theme='dark' autoPlay={false}>
                {
                    imgList.map((src, index) => {
                        return (
                            <div key={index} style={{ backgroundSize: 'cover', backgroundImage: `url('${src}')` }}>
                                <Space vertical align='start' spacing='medium' style={titleStyle}>
                                    {renderLogo()}
                                    <Title heading={2} style={colorStyle}>{textList[index][0]}</Title>
                                    <Space vertical align='start'>
                                        <Paragraph style={colorStyle}>{textList[index][1]}</Paragraph>
                                        <Paragraph style={colorStyle}>{textList[index][2]}</Paragraph>
                                    </Space>
                                </Space>
                            </div>
                        );
                    })
                }
            </Carousel>
            <br/>
            <Space vertical align='start'>
                <Space> 
                    <div>展示箭头</div>
                    <RadioGroup onChange={e => setShow(e.target.value)} value={show} type="button">
                        <Radio value={true}>show</Radio>
                        <Radio value={false}>hide</Radio>
                    </RadioGroup>
                </Space>
                <Space> 
                    <div>展示时机</div>
                    <RadioGroup onChange={e => setArrowType(e.target.value)} value={arrowType} type="button">
                        <Radio value='always'>always</Radio>
                        <Radio value='hover'>hover</Radio>
                    </RadioGroup>
                </Space>
            </Space>
        </div>
    );
};
```

### 定制箭头
通过 arrowProps 属性定制箭头样式和点击事件

```jsx live=true dir="column"
import React from 'react';
import { Carousel, Typography, Space } from '@douyinfe/semi-ui';
import { IconArrowLeft, IconArrowRight } from "@douyinfe/semi-icons";

class CarouselDemo extends React.Component {
    constructor(props) {
        super(props);
        this.imgList = [
            'https://lf3-static.bytednsdoc.com/obj/eden-cn/hjeh7pldnulm/SemiDocs/bg-1.png',
            'https://lf3-static.bytednsdoc.com/obj/eden-cn/hjeh7pldnulm/SemiDocs/bg-2.png',
            'https://lf3-static.bytednsdoc.com/obj/eden-cn/hjeh7pldnulm/SemiDocs/bg-3.png',
        ];
        this.textList = [
            ['Semi 设计管理系统', '从 Semi Design，到 Any Design', '快速定制你的设计系统，并应用在设计稿和代码中'],
            ['Semi 物料市场', '面向业务场景的定制化组件，支持线上预览和调试', '内容由 Semi Design 用户共建'],
            ['Semi 设计/代码模板', '高效的 Design2Code 设计稿转代码', '海量 Figma 设计模板一键转为真实前端代码'],
        ];
        this.arrowProps = {
            leftArrow: { children: <IconArrowLeft size='large'/> },
            rightArrow: { children: <IconArrowRight size='large'/> },
        };
    };

    renderLogo() {
        return (
            <img src='https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/semi_logo.svg' alt='semi_logo' style={{ width: 87, height: 31 }} />
        );
    };

    render() {
        const style = {
            width: '100%',
            height: '400px',
        };

        const titleStyle = { 
            position: 'absolute', 
            top: '100px', 
            left: '100px'
        };

        const colorStyle = {
            color: '#1C1F23'
        };

        return (
            <div>
                <Carousel 
                    theme='dark'
                    style={style} 
                    autoPlay={false} 
                    arrowProps={this.arrowProps}
                >
                    {
                        this.imgList.map((src, index) => {
                            return (
                                <div key={index} style={{ backgroundSize: 'cover', backgroundImage: `url('${src}')` }}>
                                    <Space vertical align='start' spacing='medium' style={titleStyle}>
                                        {this.renderLogo()}
                                        <Typography.Title heading={2} style={colorStyle}>{this.textList[index][0]}</Typography.Title>
                                        <Space vertical align='start'>
                                            <Typography.Paragraph style={colorStyle}>{this.textList[index][1]}</Typography.Paragraph>
                                            <Typography.Paragraph style={colorStyle}>{this.textList[index][2]}</Typography.Paragraph>
                                        </Space>
                                    </Space>
                                </div>
                            );
                        })
                    }
                </Carousel>
            </div>
        );
    }
}
```

### 播放参数
通过给 autoPlay 传入参数 interval 控制两张图片之间的时间间隔，传入 hoverToPause 控制鼠标放置在图片上时是否停止播放

```jsx live=true dir="column"
import React from 'react';
import { Carousel, Typography, Space } from '@douyinfe/semi-ui';

() => {
    const { Title, Paragraph } = Typography;

    const style = {
        width: '100%',
        height: '400px',
    };

    const titleStyle = { 
        position: 'absolute', 
        top: '100px', 
        left: '100px'
    };

    const colorStyle = {
        color: '#1C1F23'
    };

    const renderLogo = () => {
        return (
            <img src='https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/semi_logo.svg' alt='semi_logo' style={{ width: 87, height: 31 }}/>
        );
    };

    const imgList = [
        'https://lf3-static.bytednsdoc.com/obj/eden-cn/hjeh7pldnulm/SemiDocs/bg-1.png',
        'https://lf3-static.bytednsdoc.com/obj/eden-cn/hjeh7pldnulm/SemiDocs/bg-2.png',
        'https://lf3-static.bytednsdoc.com/obj/eden-cn/hjeh7pldnulm/SemiDocs/bg-3.png',
    ];

    const textList = [
        ['Semi 设计管理系统', '从 Semi Design，到 Any Design', '快速定制你的设计系统，并应用在设计稿和代码中'],
        ['Semi 物料市场', '面向业务场景的定制化组件，支持线上预览和调试', '内容由 Semi Design 用户共建'],
        ['Semi 设计/代码模板', '高效的 Design2Code 设计稿转代码', '海量 Figma 设计模板一键转为真实前端代码'],
    ];

    return (
        <div>
            <Carousel style={style} autoPlay={{ interval: 1500, hoverToPause: true }} theme='dark'>
                {
                    imgList.map((src, index) => {
                        return (
                            <div key={index} style={{ backgroundSize: 'cover', backgroundImage: `url('${src}')` }}>
                                <Space vertical align='start' spacing='medium' style={titleStyle}>
                                    {renderLogo()}
                                    <Title heading={2} style={colorStyle}>{textList[index][0]}</Title>
                                    <Space vertical align='start'>
                                        <Paragraph style={colorStyle}>{textList[index][1]}</Paragraph>
                                        <Paragraph style={colorStyle}>{textList[index][2]}</Paragraph>
                                    </Space>
                                </Space>
                            </div>
                        );
                    })
                }
            </Carousel>
        </div>
    );
};
```

### 动画效果与切换速度
通过给 animation 属性控制动画，可选值有 `fade`，`slide`  
通过给 speed 属性控制两张图片之间的切换时间，单位为ms

```jsx live=true dir="column"
import React from 'react';
import { Carousel, Typography, Space } from '@douyinfe/semi-ui';

() => {
    const { Title, Paragraph } = Typography;

    const style = {
        width: '100%',
        height: '400px',
    };

    const titleStyle = { 
        position: 'absolute', 
        top: '100px', 
        left: '100px'
    };

    const colorStyle = {
        color: '#1C1F23'
    };

    const renderLogo = () => {
        return (
            <img src='https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/semi_logo.svg' alt='semi_logo' style={{ width: 87, height: 31 }}/>
        );
    };


    const imgList = [
        'https://lf3-static.bytednsdoc.com/obj/eden-cn/hjeh7pldnulm/SemiDocs/bg-1.png',
        'https://lf3-static.bytednsdoc.com/obj/eden-cn/hjeh7pldnulm/SemiDocs/bg-2.png',
        'https://lf3-static.bytednsdoc.com/obj/eden-cn/hjeh7pldnulm/SemiDocs/bg-3.png',
    ];

    const textList = [
        ['Semi 设计管理系统', '从 Semi Design，到 Any Design', '快速定制你的设计系统，并应用在设计稿和代码中'],
        ['Semi 物料市场', '面向业务场景的定制化组件，支持线上预览和调试', '内容由 Semi Design 用户共建'],
        ['Semi 设计/代码模板', '高效的 Design2Code 设计稿转代码', '海量 Figma 设计模板一键转为真实前端代码'],
    ];

    return (
        <div>
            <Carousel style={style} speed={1000} animation='fade' theme='dark' autoPlay={false}>
                {
                    imgList.map((src, index) => {
                        return (
                            <div key={index} style={{ backgroundSize: 'cover', backgroundImage: `url('${src}')` }}>
                                <Space vertical align='start' spacing='medium' style={titleStyle}>
                                    {renderLogo()}
                                    <Title heading={2} style={colorStyle}>{textList[index][0]}</Title>
                                    <Space vertical align='start'>
                                        <Paragraph style={colorStyle}>{textList[index][1]}</Paragraph>
                                        <Paragraph style={colorStyle}>{textList[index][2]}</Paragraph>
                                    </Space>
                                </Space>
                            </div>
                        );
                    })
                }
            </Carousel>
        </div>
    );
};
```

### 受控的轮播图

```jsx live=true dir="column"
import React from 'react';
import { Carousel, Space, Typography } from '@douyinfe/semi-ui';

class CarouselDemo extends React.Component {
    constructor(props) {
        super(props);
        this.imgList = [
            'https://lf3-static.bytednsdoc.com/obj/eden-cn/hjeh7pldnulm/SemiDocs/bg-1.png',
            'https://lf3-static.bytednsdoc.com/obj/eden-cn/hjeh7pldnulm/SemiDocs/bg-2.png',
            'https://lf3-static.bytednsdoc.com/obj/eden-cn/hjeh7pldnulm/SemiDocs/bg-3.png',
        ];
        this.textList = [
            ['Semi 设计管理系统', '从 Semi Design，到 Any Design', '快速定制你的设计系统，并应用在设计稿和代码中'],
            ['Semi 物料市场', '面向业务场景的定制化组件，支持线上预览和调试', '内容由 Semi Design 用户共建'],
            ['Semi 设计/代码模板', '高效的 Design2Code 设计稿转代码', '海量 Figma 设计模板一键转为真实前端代码'],
        ];
        this.state = {
            activeIndex: 0,
        };
    }

    renderLogo() {
        return (
            <img src='https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/semi_logo.svg' alt='semi_logo' style={{ width: 87, height: 31 }} />
        );
    };

    onChange(activeIndex) {
        this.setState({ activeIndex });
    }

    render() {
        const style = {
            width: '100%',
            height: '400px',
        };

        const titleStyle = { 
            position: 'absolute', 
            top: '100px', 
            left: '100px'
        };

        const colorStyle = {
            color: '#1C1F23'
        };

        const { activeIndex } = this.state;
        
        return (
            <div>
                <Carousel style={style} activeIndex={activeIndex} autoPlay={false} theme='dark' onChange={this.onChange.bind(this)}>
                    {
                        this.imgList.map((src, index) => {
                            return (
                                <div key={index} style={{ backgroundSize: 'cover', backgroundImage: `url('${src}')` }}>
                                    <Space vertical align='start' spacing='medium' style={titleStyle}>
                                        {this.renderLogo()}
                                        <Typography.Title heading={2} style={colorStyle}>{this.textList[index][0]}</Typography.Title>
                                        <Space vertical align='start'>
                                            <Typography.Paragraph style={colorStyle}>{this.textList[index][1]}</Typography.Paragraph>
                                            <Typography.Paragraph style={colorStyle}>{this.textList[index][2]}</Typography.Paragraph>
                                        </Space>
                                    </Space>
                                </div>
                            );
                        })
                    }
                </Carousel>
            </div>
        );
    }
}
```


### API 参考

**Carousel**

|属性               |说明                                                           |类型               |默认值 |版本   |
|------------------|---------------------------------------------------------------|------------------|------|------|
|activeIndex       |受控属性                                                         |number            |-     |2.10.0|
|animation         |切换动画，可选值：`fade`，`slide`                                  |"fade" \| "slide"  |"slide"|2.10.0|
|arrowProps        |箭头参数，用于自定义箭头样式和点击事件                                |() => { leftArrow: ArrowButton, rightArrow: ArrowButton }                                                                              |-     |2.10.0|
|autoPlay          |是否自动循环展示，或者传入 { interval: 自动切换时间间隔(默认: 2000), hoverToPause: 鼠标悬浮时是否暂停自动切换(默认: true) }                                                                      |boolean ｜ { interval?: number, hoverToPause?: boolean }                                                                         |true  |2.10.0|
|className         |样式类名                                                         |string            |-      |2.10.0|
|defaultActiveIndex|初始化时默认展示的索引                                             |number            |0     |2.10.0|
|indicatorPosition |指示器位置，可选值有： `left`、`center`、`right`                    |"left" \| "center" \| "right"                                                                                                |"center"|2.10.0|
|indicatorSize     |指示器尺寸，可选值有： `small`、`medium`                            |"small" \| "medium"|"small"|2.10.0|
|indicatorType     |指示器类型，可选值有： `dot`、`line`、`columnar`                    |"dot" \| "line" \| "columnar"|"dot"|2.10.0|
|theme             |指示器和箭头主题，可选值有：  `primary`、`light`、`dark`              |"primary" \| "light" \| "dark" |"light"|2.10.0|
|onChange          |图片切换时的回调                                                   |(index: number, preIndex: number) => void |-      |2.10.0|
|arrowType         |箭头展示时机，可选值有：  `hover`、`always`                          |"hover" \| "always"|always |2.10.0|
|showArrow         |是否展示箭头                                                      |boolean          |true   |2.10.0|
|showIndicator     |是否展示指示器                                                    |boolean          |true   |2.10.0|
|slideDirection    |动画效果为`slide`时的滑动的方向，可选值有： `left`、`right`           |"left" \| "right" |"left" |2.10.0|
|speed             |切换速度，单位ms                                                   |number           |300    |2.10.0|
|style             |内联样式                                                          |CSSProperties    |-       |2.10.0|
|trigger           |指示器触发的时机，可选值有： `hover`、`click`                         |"hover" \| "click"|-     |2.10.0|

**ArrowButton**

|属性               |说明                                                           |类型               |默认值 |版本   |
|------------------|---------------------------------------------------------------|------------------|------|------|
|props             |箭头div上的可传参数，包括style, onClick事件等                                                  | React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement\>, HTMLDivElement\>       |-     |2.10.0|
|children          |箭头自定义Icon                                                   |React.ReactNode      |-     |2.10.0|
## Methods

绑定在组件实例上的方法，可以通过 ref 调用实现某些特殊交互

| 方法               | 说明                        | 版本    |
| ----------------- | --------------------------  | ------ |
| play()            | 播放                        | 2.10.0 |
| stop()            | 停止播放                     | 2.10.0 |
| goTo(targetIndex) | 切换到指定位置                | 2.10.0 |
| prev()            | 切换到上一位置                | 2.10.0 |
| next()            | 切换到下一位置                | 2.10.0 |

## 设计变量

<DesignToken/>