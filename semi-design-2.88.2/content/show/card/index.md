---
localeCode: zh-CN
order: 64
category: 展示类
title:  Card 卡片
subTitle: 卡片
icon: doc-card
brief: 常规的卡片容器，可以承载标题、段落、图片、列表等内容。
---

## 代码演示

### 如何引入

```jsx import
import { Card } from '@douyinfe/semi-ui';
```
### 基础卡片

基础卡片包含标题、内容等部分。

```jsx live=true dir="column"
import React from 'react';
import { Card, Typography } from '@douyinfe/semi-ui';

function Demo() {
    const { Text } = Typography;
  
    return (
        <Card 
            title='Semi Design' 
            style={{ maxWidth: 360 }}
            headerExtraContent={
                <Text link>
                    更多
                </Text>
            }
        >
            Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的 Web 应用。
        </Card>
    );
}

```

### 简洁卡片

卡片可以只设置内容区域。

```jsx live=true dir="column"
import React from 'react';
import { Card, Popover, Avatar } from '@douyinfe/semi-ui';
import { IconInfoCircle } from '@douyinfe/semi-icons';

function Demo() {
    const { Meta } = Card;

    return (
        <>
            <Card style={{ maxWidth: 360 }} >
                Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统。
            </Card>
            <br />
            <Card 
                style={{ maxWidth: 360 }} 
                bodyStyle={{ 
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}
            >
                <Meta 
                    title="Semi Doc" 
                    avatar={
                        <Avatar 
                            alt='Card meta img'
                            size="default"
                            src='https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/card-meta-avatar-docs-demo.jpg'
                        />
                    }
                />
                <Popover
                    position='top'
                    showArrow
                    content={
                        <article style={{ padding: 6 }}>
                            这是一个 Card
                        </article>
                    }
                >
                    <IconInfoCircle style={{ color: 'var(--semi-color-primary)' }}/>
                </Popover>
            </Card>
        </>
    );
}

```

### 封面

可以使用 `cover` 属性设置封面。

```jsx live=true dir="column"
import React from 'react';
import { Card } from '@douyinfe/semi-ui';

function Demo() {
    const { Meta } = Card;

    return (
        <Card
            style={{ maxWidth: 300 }}
            cover={ 
                <img 
                    alt="example" 
                    src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/card-cover-docs-demo2.jpeg" 
                />
            }
        >
            <Meta title="卡片封面" />
        </Card>
    );
}

```

### 边线和外边框

可以使用 `bordered` 设置卡片是否有外边框，默认为 true 。同时，也可以使用 `headerLine` 设置内容区和标题区是否有边线， `footerLine` 设置内容区和页尾区是否有边线。

```jsx live=true dir="column"
import React from 'react';
import { Card } from '@douyinfe/semi-ui';

function Demo() {
    return (
        <div 
            style={{
                display: 'inline-block',
                padding: 20,
                backgroundColor: 'var(--semi-color-fill-0)'
            }}
        >
            <Card 
                style={{ maxWidth: 360 }}
                bordered={false}
                headerLine={true}
                title='Semi Design'
            >
                Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的 Web 应用。
            </Card>
        </div>
    );
}

```


### 阴影

可以使用 `shadows` 设置显示阴影的时机，可选值为: `hover`（hover 时显示阴影）、`always`（始终显示阴影），如果不设置该属性则没有阴影。

```jsx live=true dir="column"
import React from 'react';
import { Card, Avatar, Popover } from '@douyinfe/semi-ui';
import { IconInfoCircle } from '@douyinfe/semi-icons';

function Demo() {
    const { Meta } = Card;

    return (
        <div>
            <Card 
                shadows='hover'
                style={{ maxWidth: 360 }} 
                bodyStyle={{ 
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}
            >
                <Meta 
                    title="Semi Doc" 
                    avatar={
                        <Avatar 
                            alt='Card meta img'
                            size="default"
                            src='https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/card-meta-avatar-docs-demo.jpg'
                        />
                    }
                />
                <Popover
                    position='top'
                    showArrow
                    content={
                        <article style={{ padding: 6 }}>
                            这是一个 Card
                        </article>
                    }
                >
                    <IconInfoCircle style={{ color: 'var(--semi-color-primary)' }}/>
                </Popover>
            </Card>
            <br/>
            <Card 
                shadows='always'
                style={{ maxWidth: 360 }} 
                bodyStyle={{ 
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}
            >
                <Meta 
                    title="Semi Doc" 
                    avatar={
                        <Avatar 
                            alt='Card meta img'
                            size="default"
                            src='https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/card-meta-avatar-docs-demo.jpg'
                        />
                    }
                />
                <Popover
                    position='top'
                    showArrow
                    content={
                        <article style={{ padding: 6 }}>
                            这是一个 Card
                        </article>
                    }
                >
                    <IconInfoCircle style={{ color: 'var(--semi-color-primary)' }}/>
                </Popover>
            </Card>
        </div>
    );
}

```

### 更灵活的内容展示

可以利用 `Card.Meta` 支持更灵活的内容，允许设置 `title`、`avatar`、`description`。

```jsx live=true dir="column"
import React from 'react';
import { Card, Avatar, Space, Button, Typography } from '@douyinfe/semi-ui';

function Demo() {
    const { Meta } = Card;
    const { Text } = Typography;

    return (
        <Card
            style={{ maxWidth: 340 }}
            title={
                <Meta 
                    title="Semi Doc" 
                    description="全面、易用、优质" 
                    avatar={
                        <Avatar 
                            alt='Card meta img'
                            size="default"
                            src='https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/card-meta-avatar-docs-demo.jpg'
                        />
                    }
                />
            }
            headerExtraContent={
                <Text link>
                    More
                </Text>
            }
            cover={ 
                <img 
                    alt="example" 
                    src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/card-cover-docs-demo.jpeg" 
                />
            }
            footerLine={ true }
            footerStyle={{ display: 'flex', justifyContent: 'flex-end' }}
            footer={
                <Space>
                    <Button theme='borderless' type='primary'>精选案例</Button>
                    <Button theme='solid' type='primary'>开始使用</Button>
                </Space>
            }
        >
            Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统。
        </Card>
    );
}

```

### 内部卡片

卡片内部可以嵌套其他卡片。

```jsx live=true dir="column"

import React from 'react';
import { Card, Typography } from '@douyinfe/semi-ui';

function Demo() {
    const { Text } = Typography;
  
    return (
        <Card title='Card title' >
            <Card 
                title='Inner Card title'
                style={{ marginBottom: 20 }}
                headerExtraContent={
                    <Text link>
                        More
                    </Text>
                }
            >
                Inner Card content
            </Card>
            <Card 
                title='Inner Card title'
                headerExtraContent={
                    <Text link>
                        More
                    </Text>
                }
            >
                Inner Card content
            </Card>
        </Card>
    );
}

```

### 栅格卡片

在系统概览页面常常和栅格进行配合。

```jsx live=true dir="column"
import React from 'react';
import { Card, Row, Col } from '@douyinfe/semi-ui';

function Demo() {
    return (
        <div 
            style={{
                backgroundColor: 'var(--semi-color-fill-0)', 
                padding: 20
            }}
        >
            <Row gutter={[16, 16]}>
                <Col span={8}>
                    <Card title='Card Title' bordered={false} >
                        Card Content
                    </Card>
                </Col>
                <Col span={8}>
                    <Card title='Card Title' bordered={false} >
                        Card Content
                    </Card>
                </Col>
                <Col span={8}>
                    <Card title='Card Title' bordered={false} >
                        Card Content
                    </Card>
                </Col>
            </Row>
            <Row gutter={[16, 16]}>
                <Col span={16}>
                    <Card title='Card Title' bordered={false} >
                        Card Content
                    </Card>
                </Col>
                <Col span={8}>
                    <Card title='Card Title' bordered={false} >
                        Card Content
                    </Card>
                </Col>
            </Row>
        </div>
    );
}

```

### 内置预加载

可以使用 `Card` 的 `loading` 属性来设置卡片内容区是否显示占位元素，当它为 true 时将显示占位元素，反之则不显示。

```jsx live=true dir="column"
import React, { useState } from 'react';
import { Card, Switch } from '@douyinfe/semi-ui';

function Demo() {
    const [loading, setLoading] = useState(true);
    const { Meta } = Card;

    return (
        <>
            <Switch onChange={ v => setLoading(!v) } />
            <br />
            <br />
            <Card 
                style={{ maxWidth: 360 }}
                loading={ loading }
            >
                <Meta 
                    title="Semi Doc" 
                    description="全面、易用、优质"
                />
            </Card>
        </>
    );
}

```

### 更丰富的预加载效果

`Card` 自带的 `loading` 属性只能设置内容区的预加载效果，如果你想要设置其他部分的预加载，或者自定义更丰富的预加载效果，你可以结合 Skeleton 组件来实现。

```jsx live=true dir="column"
import React, { useState } from 'react';
import { Card, Switch, Skeleton, Avatar, Typography } from '@douyinfe/semi-ui';

function Demo() {
    const [loading, setLoading] = useState(true);
    const { Meta } = Card;
    const { Title, Paragraph, Image } = Skeleton;

    return (
        <>
            <Switch onChange={ v => setLoading(!v) } />
            <br />
            <br />
            <Card
                style={{ maxWidth: 300 }}
                title={
                    <Meta 
                        title={
                            <Skeleton
                                style={{ width: 80 }}
                                placeholder={<Title />}
                                loading={loading}
                            >
                                <Typography.Title heading={5}>
                                    Semi Doc
                                </Typography.Title>
                            </Skeleton>
                        } 
                        description={
                            <Skeleton 
                                style={{ width: 150, marginTop: 12 }} 
                                placeholder={<Paragraph rows={1} />} 
                                loading={loading}
                            >
                                <Typography.Text>
                                    全面、易用、优质
                                </Typography.Text>
                            </Skeleton>
                        }
                        avatar={
                            <Skeleton placeholder={<Skeleton.Avatar />} loading={loading}>
                                <Avatar 
                                    alt='Card meta img'
                                    size="default"
                                    src='https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/card-meta-avatar-docs-demo.jpg'
                                />
                            </Skeleton>
                        }
                    />
                }
                headerExtraContent={
                    <Skeleton style={{ width: 50 }} placeholder={<Paragraph rows={1} />} loading={loading}>
                        <Typography.Text link>
                            More
                        </Typography.Text>
                    </Skeleton>
                }
                cover={ 
                    <Skeleton style={{ maxWidth: '100%', height: 220 }} placeholder={<Image />} loading={loading}>
                        <img 
                            alt="example" 
                            src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/card-cover-docs-demo.jpeg" 
                        />
                    </Skeleton> 
                }
            >
            </Card>
        </>
    );
}

```

### 带页签的卡片

可以结合 Tabs 组件，实现带页签的卡片。

```jsx live=true dir="column"
import React from 'react';
import { Card, Tabs, TabPane } from '@douyinfe/semi-ui';

function demo() {
    return (
        <Card title='Card title'>
            <Tabs 
                type="line" 
                style={{
                    marginTop: -20,
                    marginBottom: -20
                }}
            >
                <TabPane tab="Tab 1" itemKey="1">
                    <p>content1</p>
                    <p>content1</p>
                    <p>content1</p>
                </TabPane>
                <TabPane tab="Tab 2" itemKey="2">
                    <p>content2</p>
                    <p>content2</p>
                    <p>content2</p>
                </TabPane>
            </Tabs>
        </Card>
    );
}

```

### 卡片操作区

`actions` 接收 ReactNode 数组，元素间将以 12px 的水平间距展示于内容区底部。

```jsx live=true dir="column"
import React from 'react';
import { Card, Rating } from '@douyinfe/semi-ui';

function Demo() {
    const { Meta } = Card;

    return (
        <Card
            style={{ maxWidth: 300 }}
            actions={[    
                // eslint-disable-next-line react/jsx-key
                <Rating size='small' defaultValue={4}/>
            ]}
            headerLine={ false }
            cover={ 
                <img 
                    alt="example" 
                    src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/card-cover-docs-demo.jpeg" 
                />
            }
        >
            <Meta 
                title="Semi Doc" 
                description="全面、易用、优质" 
            />
        </Card>
    );
}

```

### 卡片组

`CardGroup` 中的卡片将呈现为等间距排列，利用 `spacing` 属性可以设置卡片间距大小。

```jsx live=true dir="column"
import React, { useState } from 'react';
import { Card, CardGroup, Typography, Slider } from '@douyinfe/semi-ui';

function Demo() {
    const { Text } = Typography;
    const [ spacing, setSpacing ] = useState(12);

    return (
        <>
            <Text>滑动调节 Card 间距</Text>
            <Slider 
                defaultValue={12}
                max={40}
                min={10}
                style={{ width: 360 }}
                onChange={v=> setSpacing(v)}
            />
            <br />
            <CardGroup spacing={spacing}>
                {
                    new Array(8).fill(null).map((v, idx)=>(
                        <Card 
                            key={idx}
                            shadows='hover'
                            title='Card title'
                            headerLine={false}
                            style={{ width: 260 }}
                            headerExtraContent={
                                <Text link>
                                    More
                                </Text>
                            }
                        >
                            <Text>Card content</Text>
                        </Card>
                    ))
                }
            </CardGroup>
        </>
    );
}

```

### 网格型卡片组

使用 `CardGroup` 的 `type` 属性，可以将卡片组设置为网格型。

```jsx live=true dir="column"
import React from 'react';
import { Card, CardGroup, Typography } from '@douyinfe/semi-ui';

function Demo() {
    const { Text } = Typography;

    return (
        <CardGroup type='grid'>
            {
                new Array(7).fill(null).map((v, idx)=>(
                    <Card 
                        key={idx}
                        shadows='hover'
                        title='Card title'
                        headerLine={false}
                        style={{ width: 260 }}
                        headerExtraContent={
                            <Text link>
                                More
                            </Text>
                        }
                    >
                        <Text>Card content</Text>
                    </Card>
                ))
            }     
        </CardGroup>
    );
}

```

### API 参考

**Card**

|属性               |说明                                                           |类型               |默认值 |版本   |
|------------------|---------------------------------------------------------------|------------------|------|------|
|actions           |卡片操作组，位于卡片内容区的底部                                    |Array<ReactNode\> |-     |1.21.0|
|bodyStyle         |卡片内容区内联样式                                                |CSSProperties     |-     |1.21.0|
|bordered          |是否设置卡片的外边框                                              |boolean           |true  |1.21.0|
|className         |卡片的样式类名                                                   |string            |-     |1.21.0|
|cover             |卡片封面                                                        |ReactNode         |-     |1.21.0|
|headerExtraContent|卡片标题右侧的额外内容                                            |ReactNode          |-    |1.21.0|
|footer            |自定义卡片页脚                                                   |ReactNode         |-     |1.21.0|
|footerLine        |卡片页脚区与内容区是否有边线                                        |boolean           |false|1.21.0|
|footerStyle       |卡片页脚区内联样式                                                |CSSProperties     |-     |1.21.0|
|header            |自定义卡片头部，若传入将覆盖 `title` 和 `headerExtraContent`        |ReactNode         |-     |1.21.0|
|headerLine        |卡片标题区与内容区是否有边线                                        |boolean           |true  |1.21.0|
|headerStyle       |卡片标题区内联样式                                                |CSSProperties     |-     |1.21.0|
|loading           |是否设置加载时的占位                                              |boolean           |false |1.21.0|
|shadows           |设置显示阴影的时机，如果不设置该属性则没有阴影，可选值：`hover`、`always`|string            |-     |1.21.0|
|style             |卡片内联样式                                                     |CSSProperties     |-     |1.21.0|
|title             |卡片标题                                                        |ReactNode         |-     |1.21.0|

**CardGroup**

|属性      |说明                                                                |类型              |默认值 |版本  |
|---------|-------------------------------------------------------------------|------------------|------|------|
|className|卡片组的样式类名                                                      |string            |-     |1.21.0|
|spacing  |间距尺寸，支持数值或数组，数组形如: `[水平间距,垂直间距]`                   |number \| number[]|12px  |1.21.0|
|style    |卡片组的内联样式                                                      |CSSProperties     |-     |1.21.0|
|type     |可以把卡片组设置为网格型，设置完该属性后将覆盖 `spacing` 属性，可选值：`grid` |string            |-     |1.21.0|

**Card.Meta**

|属性        |说明  |类型          |默认值 |版本   |
|-----------|------|-------------|-     |------|
|avatar     |头像   |ReactNode    |-     |1.21.0|
|className  |类名   |string       |-     |1.21.0|
|description|描述   |ReactNode    |-     |1.21.0|
|style      |内联样式|CSSProperties|-     |1.21.0|
|title      |标题   |ReactNode    |-     |1.21.0|

## Accessibility

- Card 支持传入 `aria-label` 来表示该 Card 作用
- Card loading 时，将开启 `aria-busy`
- Card 为容器型组件，卡片内部的任何元素需要遵循各自的可访问性指南

## 文案规范

- 卡片标题
  - 卡片标题应具有信息描述性，聚焦最重要的信息
  - 尽量将标题限制在 1 个短语或句段中
  - 卡片标题应句子大小写书写
  - 不要以标点符号结尾（除了问号）
- 正文
  - 可操作的：使用祈使句而不是“你可以”来描述正文，可以更好的告诉用户可以做什么
  
| ✅ 推荐用法 | ❌ 不推荐用法 |   
| --- | --- | 
| Get order progress for details | You can get order progress for details |

- 总是优先说最重要的信息
- 使用 “Need to”而不是”must“

## 设计变量
<DesignToken/>

<!-- ## 相关物料

```material
41,55,64,74,219,73,84,99,179
``` -->
## 相关物料
<semi-material-list code="41, 179"></semi-material-list>