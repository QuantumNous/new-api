---
localeCode: en-US
order: 65
category: Show
title: Carousel
subTitle: Carousel
icon: doc-carousel
brief: Carousel is a media component that can display the effect of playing multiple pictures in turn in a visualization application.
---

## Demos

### How to import
```jsx import
import { Carousel } from '@douyinfe/semi-ui';
```

### Basic Carousel

Basic carousel

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
        ['Semi Design System Management', 'From Semi Design, To Any Design', 'Quickly define your design system and apply it to design drafts and code'],
        ['Semi Material', 'Customized components for business scenarios, support online preview and debugging', 'Content co-authored by Semi Design users'],
        ['Semi Template', 'Efficient Design2Code converts design into real code in seconds', 'One-click conversion of massive page template front-end code'],
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

### Theme Switch

Three themes are defined by default: `primary`、`light`、`dark`

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
        ['Semi Design System Management', 'From Semi Design, To Any Design', 'Quickly define your design system and apply it to design drafts and code'],
        ['Semi Material', 'Customized components for business scenarios, support online preview and debugging', 'Content co-authored by Semi Design users'],
        ['Semi Template', 'Efficient Design2Code converts design into real code in seconds', 'One-click conversion of massive page template front-end code'],
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
                <div>theme</div>
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

### Indicators

Indicators can be adjusted for type, position, size   
type:  `dot`、`line`、`columnar`   
position:  `left`、`center`、`right`  
size:  `small`、`medium`

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
        ['Semi Design System Management', 'From Semi Design, To Any Design', 'Quickly define your design system and apply it to design drafts and code'],
        ['Semi Material', 'Customized components for business scenarios, support online preview and debugging', 'Content co-authored by Semi Design users'],
        ['Semi Template', 'Efficient Design2Code converts design into real code in seconds', 'One-click conversion of massive page template front-end code'],
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
                    <div>type</div>
                    <RadioGroup onChange={e => setType(e.target.value)} value={type} type="button">
                        <Radio value='dot'>dot</Radio>
                        <Radio value='line'>line</Radio>
                        <Radio value='columnar'>columnar</Radio>
                    </RadioGroup>
                </Space>
                <Space> 
                    <div>position</div>
                    <RadioGroup onChange={e => setPosition(e.target.value)} value={position} type="button">
                        <Radio value='left'>left</Radio>
                        <Radio value='center'>center</Radio>
                        <Radio value='right'>right</Radio>
                    </RadioGroup>
                </Space>
                <Space> 
                    <div>size</div>
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

### Arrows

Control whether the arrow is visible through the showArrow property  
If the arrow is visible, use the arrowType property to control the timing of the arrow display

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
        ['Semi Design System Management', 'From Semi Design, To Any Design', 'Quickly define your design system and apply it to design drafts and code'],
        ['Semi Material', 'Customized components for business scenarios, support online preview and debugging', 'Content co-authored by Semi Design users'],
        ['Semi Template', 'Efficient Design2Code converts design into real code in seconds', 'One-click conversion of massive page template front-end code'],
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
                    <div>arrow</div>
                    <RadioGroup onChange={e => setShow(e.target.value)} value={show} type="button">
                        <Radio value={true}>show</Radio>
                        <Radio value={false}>hide</Radio>
                    </RadioGroup>
                </Space>
                <Space> 
                    <div>show time</div>
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

### Custom Arrow
Customize arrow styles and click events through the arrowProps property

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
            ['Semi Design System Management', 'From Semi Design, To Any Design', 'Quickly define your design system and apply it to design drafts and code'],
            ['Semi Material', 'Customized components for business scenarios, support online preview and debugging', 'Content co-authored by Semi Design users'],
            ['Semi Template', 'Efficient Design2Code converts design into real code in seconds', 'One-click conversion of massive page template front-end code'],
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

### Play Parameters
Pass the parameter interval to autoPlay to control the time interval between two pictures, and pass hoverToPause to control whether to stop playing when the mouse is placed on the picture

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
        ['Semi Design System Management', 'From Semi Design, To Any Design', 'Quickly define your design system and apply it to design drafts and code'],
        ['Semi Material', 'Customized components for business scenarios, support online preview and debugging', 'Content co-authored by Semi Design users'],
        ['Semi Template', 'Efficient Design2Code converts design into real code in seconds', 'One-click conversion of massive page template front-end code'],
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

### Animation and Speed
Control the animation by giving the animation property, optional values are `fade`, `slide`  
Control the switching time between two pictures by giving the speed attribute, the unit is ms

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
        ['Semi Design System Management', 'From Semi Design, To Any Design', 'Quickly define your design system and apply it to design drafts and code'],
        ['Semi Material', 'Customized components for business scenarios, support online preview and debugging', 'Content co-authored by Semi Design users'],
        ['Semi Template', 'Efficient Design2Code converts design into real code in seconds', 'One-click conversion of massive page template front-end code'],
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

### Controlled Carousel

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
            ['Semi Design System Management', 'From Semi Design, To Any Design', 'Quickly define your design system and apply it to design drafts and code'],
            ['Semi Material', 'Customized components for business scenarios, support online preview and debugging', 'Content co-authored by Semi Design users'],
            ['Semi Template', 'Efficient Design2Code converts design into real code in seconds', 'One-click conversion of massive page template front-end code'],
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

    onChange(activeIndex){
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


### API reference

**Carousel**

|PROPERTIES        |INSTRUCTIONS                                                                         |TYPE              |DEFAULT |VERSION|
|------------------|-------------------------------------------------------------------------------------|------------------|--------|-------|
|activeIndex       |Controlled property                                                                  |number            |-     |2.10.0|
|animation        |Animation, optional:`fade`, `slide`                                                   |       "fade" \| "slide"  |"slide"|2.10.0|
|arrowProps        |Arrow parameters for custom arrow styles and click events                            |            () => { leftArrow: ArrowButton, rightArrow:ArrowButton }|-     |2.10.0|
|autoPlay          |Whether to automatically display in a loop, or pass in { interval: Auto switch time interval(default: 2000), hoverToPause: Whether to pause automatic switching when the mouse is hovering(default: true) }|boolean ｜ { interval?: number, hoverToPause?: boolean }          |true  |2.10.0|
|className         |The className of Carousel container                                                   |string            |-      |2.10.0|
|defaultActiveIndex|The index displayed by default when initializing                                      |number            |0     |2.10.0|
|indicatorPosition |Indicator position, optional values are: `left`、`center`、`right`                    |       "left" \| "center" \| "right"|"center"|2.10.0|
|indicatorSize     |Indicator size, optional values are: `small`、`medium`                                |      "small" \| "medium"|"small"|2.10.0|
|indicatorType     |Indicator type, optional values are: `dot`、`line`、`columnar`                        |        "dot" \| "line" \| "columnar"|"dot"|2.10.0|
|theme             |Indicator and arrow theme, optional values are:  `primary`、`light`、`dark`           |    "primary" \| "light" \| "dark" |"light"|2.10.0|
|onChange          |Callback when image is switched                                                     |        (index: number, preIndex: number) => void |-      |2.10.0|
|arrowType         |Arrow display timing, optional values are:  `hover`、`always`                        |       "hover" \| "always"|always |2.10.0|
|showArrow         |Whether to show arrows                                                             |boolean          |true   |2.10.0|
|showIndicator     |Whether to show the indicator                                                        |boolean          |true   |2.10.0|
|slideDirection    |The direction of the slide when the animation effect is `slide`, optional: `left`、 `right` |"left" \| "right" |"left" |2.10.0|
|speed             |Switching speed                                                                      |number            |300    |2.10.0|
|style             |Carousel style                                                                        |CSSProperties     |-       |2.10.0|
|trigger           |When the indicator is triggered, the optional values are: `hover`、`click`            |      "hover" \| "click" |-     |2.10.0|

**ArrowButton**

|PROPERTIES        |INSTRUCTIONS                                                   |TYPE             |DEFAULT|VERSION|
|------------------|---------------------------------------------------------------|------------------|------|------|
|props           |Parameters on the arrow div, including style, onClick events, etc                                      |DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement\>, HTMLDivElement\>         |-     |2.10.0|
|children         |Arrow custom icon                                              |React.ReactNode      |-     |2.10.0|

## Methods
Some internal methods provided by Carousel can be accessed through ref:

| Method             | Instructions                    | Version |
| ------------------ | ------------------------------- | ------- |
| play()             | Play                            | 2.10.0 |
| stop()             | Stop                            | 2.10.0 |
| goTo(targetIndex)  | Go to target index              | 2.10.0 |
| prev()             | Go to previous index            | 2.10.0 |
| next()             | Go to next index                | 2.10.0 |


## Design Tokens
<DesignToken/>