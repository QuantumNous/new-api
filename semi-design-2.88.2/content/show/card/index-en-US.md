---
localeCode: en-US
order: 64
category: Show
title:  Card
subTitle: Card
icon: doc-card
brief: Card container can consist of titles, paragraphs, pictures, lists, and other content.
---

## Demos

### How to import

```jsx import
import { Card } from '@douyinfe/semi-ui';
```
### Basic card

The basic card contains the title, content and other parts.

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
                    More
                </Text>
            }
        >
            Semi Design is a design system developed and maintained by IES-FE & IES-UED. The design system includes a design language and a set of reusable front-end components, helping designers and developers to more easily create high-quality, consistent user experience, design-compliant Web applications.
        </Card>
    );
}

```

### Simple card

The card can only set the content area.

```jsx live=true dir="column"
import React from 'react';
import { Card, Popover, Avatar } from '@douyinfe/semi-ui';
import { IconInfoCircle } from '@douyinfe/semi-icons';

function Demo() {
    const { Meta } = Card;

    return (
        <>
            <Card style={{ maxWidth: 360 }} >
                Semi Design is a design system developed and maintained by IES-FE & IES-UED.
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
                            This is a card.
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

### Cover

You can use the `cover` property to set the cover.

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
            <Meta title="Card cover" />
        </Card>
    );
}

```

### Border and line

You can use `bordered` to set whether the card has an outer border, the default is true. At the same time, you can also use `headerLine` to set whether the content area and title area have borders, and `footerLine` to set whether the content area and footer area have borders.

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
                Semi Design is a design system developed and maintained by IES-FE & IES-UED. The design system includes a design language and a set of reusable front-end components, helping designers and developers to more easily create high-quality, consistent user experience, design-compliant Web applications.
            </Card>
        </div>
    );
}

```


### Shadows

You can use `shadows` to set the timing of the shadow display. Optional: `hover` (show shadow when hover), `always` (show shadow always), if this property is not set, there will be no shadow.

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
                            This is a card.
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
                            This is a card.
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

### Customized content

You can use `Card.Meta` to support more flexible content, allowing you to set `title`, `avatar`, and `description`.

```jsx live=true dir="column"
import React from 'react';
import { Card, Avatar, Space, Button, Typography } from '@douyinfe/semi-ui';

function Demo() {
    const { Meta } = Card;
    const { Text } = Typography;

    return (
        <Card
            style={{ maxWidth: 360 }}
            title={
                <Meta 
                    title="Semi Doc" 
                    description="Easily manage your project icons and easily upload, update and share a series of project icons." 
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
                    <Button theme='borderless' type='primary'>Featured Case</Button>
                    <Button theme='solid' type='primary'>Start</Button>
                </Space>
            }
        >
            Semi Design is a design system developed and maintained by IES-FE & IES-UED. 
        </Card>
    );
}

```

### Inner card

Other cards can be nested inside the card.

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

### Card in column

The system overview page is often combined with the grid.

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

### loading

You can use the `loading` property of `Card` to set whether to display placeholder elements in the card content area. When it is true, the placeholder elements will be displayed, and vice versa.

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
                    title="Semi Design" 
                    description="Semi Design is a design system developed and maintained by IES-FE & IES-UED."
                />
            </Card>
        </>
    );
}

```

### With Skeleton

The `loading` property of `Card` can only set the preloading effect of the content area. If you want to set the preloading of other parts, or customize a richer preloading effect, you can combine it with the Skeleton component.

```jsx live=true dir="column"
import React, { useState } from 'react';
import { Card, Switch, Skeleton, Typography, Avatar } from '@douyinfe/semi-ui';

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
                style={{ maxWidth: 360 }}
                title={
                    <Meta 
                        title={
                            <Skeleton
                                style={{ width: 80 }}
                                placeholder={<Title />}
                                loading={loading}
                            >
                                <Typography.Title heading={5}>
                                    Semi Design
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
                                    Semi Design is a design system developed and maintained by IES-FE & IES-UED.
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
                    <Skeleton style={{ maxWidth: '100%', height: 260 }} placeholder={<Image />} loading={loading}>
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

### With tabs

You can use the `Tabs` component in the card component.

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

### Actions

`actions` receives the ReactNode array, and the elements will be displayed at the bottom of the content area with a horizontal spacing of 12px.

```jsx live=true dir="column"
import React from 'react';
import { Card, Rating } from '@douyinfe/semi-ui';

function Demo() {
    const { Meta } = Card;

    return (
        <Card
            style={{ maxWidth: 360 }}
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
                description="Easily manage your project icons and easily upload, update and share a series of project icons." 
            />
        </Card>
    );
}

```

### Card group

Use `CardGroup` to present the cards in an evenly spaced arrangement.

```jsx live=true dir="column"
import React, { useState } from 'react';
import { Card, CardGroup, Typography, Slider } from '@douyinfe/semi-ui';

function Demo() {
    const { Text } = Typography;
    const [ spacing, setSpacing ] = useState(12);

    return (
        <>
            <Text>Slide to adjust the card spacing</Text>
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

### Grid card

You can use the `type` property of `CardGroup` to set the card group to a grid type.

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

### API reference

**Card**

|PROPERTIES        |INSTRUCTIONS                                                                         |TYPE              |DEFAULT |VERSION|
|------------------|-------------------------------------------------------------------------------------|------------------|--------|-------|
|actions           |Card operation group, located at the bottom of the card content area                 |Array<ReactNode\> |-       |1.21.0 |
|bodyStyle         |Body style                                                                           |CSSProperties     |-       |1.21.0 |
|bordered          |Whether to set the outer border of the card                                          |boolean           |true    |1.21.0 |
|className         |The className of Card container                                                      |string            |-       |1.21.0 |
|cover             |Card cover                                                                           |ReactNode         |-       |1.21.0 |
|headerExtraContent|Extra content to the right of the card title                                         |ReactNode         |-       |1.21.0 |
|footer            |Customize card footer                                                                |ReactNode         |-       |1.21.0 |
|footerLine        |Whether to set borders in the footer area and content area of the card               |boolean           |false   |1.21.0 |
|footerStyle       |Footer style                                                                         |CSSProperties     |-       |1.21.0 |
|header            |Custom card header, if passed in, it will override `title` and `headerExtraContent`  |ReactNode         |-       |1.21.0 |
|headerLine        |Whether to set borders in the title area and content area of the card                |boolean           |true    |1.21.0 |
|headerStyle       |Header style                                                                         |CSSProperties     |-       |1.21.0 |
|loading           |Whether to set a placeholder when loading                                            |boolean           |false   |1.21.0 |
|shadows           |Set the time to show the shadow. If this property is not set, there will be no shadow. Optiona: `hover`, `always`|string |-       |1.21.0 |
|style             |Card style                                                                           |CSSProperties     |-       |1.21.0 |
|title             |Card title                                                                           |ReactNode         |-       |1.21.0 |

**CardGroup**

|PROPERTIES |INSTRUCTIONS                                                                                                      |TYPE               |DEFAULT |VERSION|
|-----------|------------------------------------------------------------------------------------------------------------------|-------------------|--------|-------|
|className  |The className of CardGroup                                                                                        |string             |-       |1.21.0 |
|spacing    |Spacing size, support numeric value or array, `[horizontal spacing, vertical spacing]`                            |number \| number[] |12px    |1.21.0 |
|style      |CardGroup style                                                                                                   |CSSProperties      |-       |1.21.0 |
|type       |You can set the card deck to a grid type. After setting this property, the `spacing` property will be overwritten.Optional: `grid` |string |-  |1.21.0 |

**Card.Meta**

|PROPERTIES |INSTRUCTIONS          |TYPE         |DEFAULT |VERSION|
|-----------|----------------------|-------------|-       |-------|
|avatar     |avatar                |ReactNode    |-       |1.21.0 |
|className  |The className of Meta |string       |-       |1.21.0 |
|description|description           |ReactNode    |-       |1.21.0 |
|style      |Meta style            |CSSProperties|-       |1.21.0 |
|title      |title                 |ReactNode    |-       |1.21.0 |

## Accessibility

- Card supports the input of `aria-label` to indicate the function of the Card
- When Card loading, `aria-busy` will be turned on
- Card is a container-type component, and any elements inside the card need to follow their respective accessibility guidelines

## Content Guidelines

- Card title
  - Card titles should be informative and focus on the most important information
  - try to limit the title to 1 phrase or segment
  - Card titles should be written in sentence case
  - do not end with punctuation marks (except question marks)
- Text
  - Actionable: Use imperative sentences instead of "you can" to describe the body, which better tells the user what can be done
  
| ✅ Recommended usage | ❌ Deprecated usage |   
| --- | --- | 
| Get order progress for details | You can get order progress for details |

- Always say the most important information first
- Use "Need to" instead of "must"

## Design Tokens
<DesignToken/>

<!-- ## Related Material

```material
41,55,64,74,219,73,84,99,179
``` -->
## Related Material
<semi-material-list code="41, 179"></semi-material-list>