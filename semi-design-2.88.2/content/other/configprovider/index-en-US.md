---
localeCode: en-US
order: 94
category: Other
title: ConfigProvider
icon: doc-configprovider
dir: column
brief: Provide a unified global configuration for components.
---

## Scenes to be used

Coverage configuration is divided into two scenarios

- When you need to override the public Props configuration of multiple components (such as `timezone`, `rtl`), use ConfigProvider
- When the ConfigProvirder props are not met and you want to modify a certain type of Props of a certain component globally (for example, if you want to configure the `theme` of all `Buttons to `Solid` or the `zIndex` of all `Popover`), use semiGlobal


## ConfigProvider

## Demos

### How to import
```jsx import
import { ConfigProvider } from '@douyinfe/semi-ui';
```
### Basic Usage

By passing in the timeZone parameter, users can configure the time zone for the time components:

```jsx live=true dir="column" hideInDSM
import React, { useMemo, useState } from 'react';
import { ConfigProvider, Select, DatePicker, TimePicker } from '@douyinfe/semi-ui';

function Demo(props = {}) {
    const [timeZone, setTimeZone] = useState('GMT+08:00');
    const defaultTimestamp = 1581599305265;
    const gmtList = useMemo(() => {
        const list = [];
        for (let hourOffset = -11; hourOffset <= 14 ; hourOffset++) {
            const prefix = hourOffset >= 0 ? '+' : '-';
            const hOffset = Math.abs(parseInt(hourOffset, 10));
            list.push(`GMT${prefix}${String(hOffset).padStart(2, '0')}:00`);
        }
        return list;
    }, []);

    return (
        <ConfigProvider timeZone={timeZone}>
            <div style={{ width: 300 }}>
                <h5 style={{ margin: 10 }}>Select Time Zone:</h5>
                <Select
                    placeholder={'Select time zone'}
                    style={{ width: 300 }}
                    value={timeZone}
                    showClear={true}
                    onSelect={value => setTimeZone(value)}
                >
                    {gmtList.map(gmt => (
                        <Select.Option key={gmt} value={gmt}>
                            {gmt}
                        </Select.Option>
                    ))}
                </Select>
                <br/>
                <br/>
                <DatePicker type={'dateTime'} defaultValue={defaultTimestamp} onChange={(date, dateString) => console.log('DatePicker changed: ', date, dateString)} />
                <br/>
                <br/>
                <TimePicker defaultValue={defaultTimestamp} onChange={(date, dateString) => console.log('DatePicker changed: ', date, dateString)} />
            </div>
        </ConfigProvider>
    );
}
```

### Manually obtain values
Usually, the value of ConfigProvider is automatically obtained and consumed within the component, so you don't need to worry about it. However, in some special scenarios, you may need to manually obtain the value to perform other operations.

Use ConfigConsumer to obtain the value of ConfigProvider

```jsx live=true dir="column" hideInDSM
import React, { useMemo, useState } from 'react';
import { ConfigProvider, ConfigConsumer, Select, DatePicker, TimePicker, Typography } from '@douyinfe/semi-ui';

function Demo(props = {}) {
  const [timeZone, setTimeZone] = useState('GMT+08:00');
  const defaultTimestamp = 1581599305265;
  const gmtList = useMemo(() => {
    const list = [];
    for (let hourOffset = -11; hourOffset <= 14; hourOffset++) {
      const prefix = hourOffset >= 0 ? '+' : '-';
      const hOffset = Math.abs(parseInt(hourOffset, 10));
      list.push(`GMT${prefix}${String(hOffset).padStart(2, '0')}:00`);
    }
    return list;
  }, []);

  return (
          <ConfigProvider timeZone={timeZone}>
            {/*...*/}
            <ConfigConsumer>
              {(value) => {
                return <Typography.Text ellipsis={{ showTooltip: {opts:{style:{minWidth:"1200px"}} }}}  style={{ width: 600 }}>
                  {JSON.stringify(value)}
                </Typography.Text>
              }}
            </ConfigConsumer>
            {/*...*/}
          </ConfigProvider>
  );
}

```

### RTL/LTR
Global configuration `direction` can change the text direction of components。`rtl` means right to left (similar to Hebrew or Arabic), `ltr` means left to right (similar to most languages such as English)

Special components:
- Command call of Modal, Notification and Toast needs to be passed to 'direction' through prop.
- If you want to internationalize the directional icon, you need to handle it on your own. We think RTL for icon will make it difficult to understand and maintain. Semi has adapted the icons in other components.
- The tree data of Table does not support RTL ([Chrome, Safari have different behave with Firefox](https://codesandbox.io/s/table-rtl-treedata-uy7gzl?file=/src/App.jsx)), and fixed column supports RTL in v2.32 version, Slider does not support RTL yet.

```jsx live=true dir="column" hideInDSM
import React, { useState } from 'react';
import { ConfigProvider, ButtonGroup, Button, Row, Col, Notification, DatePicker, TimePicker, Timeline, Popover, Tag, Tooltip, Badge, Avatar, Steps, Pagination, Modal, Breadcrumb, Rating, Nav, Spin, Cascader, Radio, Select, Input, Typography, TextArea, Checkbox, Switch } from '@douyinfe/semi-ui';
import { IconVigoLogo, IconEdit, IconCamera, IconList, IconSidebar, IconChevronDown } from '@douyinfe/semi-icons';
import en_GB from '@douyinfe/semi-ui/locale/source/en_GB';

function Demo(props = {}) {
    const { Option } = Select;
    const [direction, setDirection] = useState();
    const flexStyle = { display: 'flex', marginBottom: 32, flexWrap: 'wrap' };
    const titleStyle = { margin: '50px 0 16px 0' };
    const rowStyle = { margin: '16px 10px' };
    const badgeStyle = {
        width: '42px',
        height: '42px',
        borderRadius: '4px',
        display: 'inline-block',
    };
    const tagStyle = { marginRight: 8, marginBottom: 8 };
    const buttonStyle = { ...tagStyle };
    const opts = {
        title: 'Hi,Bytedance',
        content: 'ies dance dance dance',
        duration: 3,
        direction,
    };
    const treeData = [
        {
            label: 'Zhejiang',
            value: 'zhejiang',
            children: [
                {
                    label: 'Hangzhou',
                    value: 'hangzhou',
                    children: [
                        {
                            label: 'Xihu',
                            value: 'xihu',
                        },
                        {
                            label: 'Xianhan',
                            value: 'xiaoshan',
                        },
                        {
                            label: 'Lin’an',
                            value: 'linan',
                        },
                    ],
                },
                {
                    label: 'Ningbo',
                    value: 'ningbo',
                    children: [
                        {
                            label: 'Haishu',
                            value: 'haishu',
                        },
                        {
                            label: 'Jiangbei',
                            value: 'jiangbei',
                        }
                    ]
                },
            ],
        }
    ];

    return (
        <div>
            <div style={{ marginBottom: 20 }}>
                <ButtonGroup>
                    <Button onClick={() => setDirection('ltr')}>LTR</Button>
                    <Button onClick={() => setDirection('rtl')}>RTL</Button>
                </ButtonGroup>
            </div>
            <ConfigProvider direction={direction} locale={en_GB}>
                <Row>
                    <h3 style={titleStyle}>Buttons</h3>
                </Row>
                <Row style={rowStyle}>
                    <Button loading={true} theme="solid" style={{ marginRight: 8 }}>Loading</Button>
                    <Button icon={<IconSidebar />} theme="solid" style={{ marginRight: 8 }}>Collapsing</Button>
                    <Button icon={<IconChevronDown />} theme="solid" iconPosition={"right"} style={{ marginRight: 8 }}>Expand options</Button >
                    <br/><br/>
                    <ButtonGroup>
                        <Button>Copy</Button>
                        <Button>Query</Button>
                        <Button>Cut</Button>
                    </ButtonGroup>
                </Row>
                <Row>
                    <h3 style={titleStyle}>Input</h3>
                </Row>
                <Row style={rowStyle} gutter={16}>
                    <Col span={12}>
                        <Input placeholder='Input something'></Input>
                        <br/><br/>
                        <Input disabled placeholder='Input something'></Input>
                        <br/><br/>
                        <Input prefix="Prefix" showClear></Input>
                        <br/><br/>
                        <Input suffix={<Typography.Text strong type='secondary' style={{ margin: '0 8px' }}>Suffix</Typography.Text>} showClear></Input>
                        <br/><br/>
                        <TextArea placeholder="Input something" maxCount={100} />
                        <br/><br/>
                        <div style={flexStyle}>
                            <Switch style={{ marginRight: 8 }} defaultChecked={true}></Switch>
                            <Switch style={{ marginRight: 8 }}></Switch>
                            <Switch disabled defaultChecked={true} style={{ marginRight: 8 }}></Switch>
                        </div>
                        <div style={flexStyle}>
                            <Checkbox style={{ marginRight: 8 }} defaultChecked>Checkbox</Checkbox>
                            <Checkbox style={{ marginRight: 8 }} disabled defaultChecked>Disabled Checkbox</Checkbox>
                            <Checkbox style={{ marginRight: 8 }} disabled>Disabled Checkbox</Checkbox>
                        </div>
                        <div style={{ ...flexStyle, marginBottom: 0 }}>
                            <Radio style={{ marginRight: 8 }} defaultChecked>Radio</Radio>
                            <Radio style={{ marginRight: 8 }} disabled defaultChecked>Disabled Radio</Radio>
                            <Radio style={{ marginRight: 8 }} disabled>Disabled Radio</Radio>
                        </div>
                    </Col>
                    <Col span={12}>
                        <DatePicker onChange={(date, dateString) => console.log(dateString)} style={{ width: '100%' }}/>
                        <br/><br/>
                        <TimePicker style={{ width: '100%' }} />
                        <br/><br/>
                        <Select style={{ width: '100%' }} placeholder="Select-single">
                            <Option value='abc'>Semi</Option>
                            <Option value='hotsoon'>Hotsoon</Option>
                            <Option value='pipixia' disabled>Pipixia</Option>
                            <Option value='xigua'>Xigua</Option>
                        </Select>
                        <br/><br/>
                        <Select disabled style={{ width: '100%' }} placeholder="Select-disabled">
                            <Option value='abc'>Semi</Option>
                            <Option value='hotsoon'>Hotsoon</Option>
                            <Option value='pipixia' disabled>Pipixia</Option>
                            <Option value='xigua'>Xigua</Option>
                        </Select>
                        <br/><br/>
                        <Select multiple style={{ width: '100%' }} placeholder="Select-mutiple">
                            <Option value='abc'>Semi</Option>
                            <Option value='hotsoon'>Hotsoon</Option>
                            <Option value='pipixia' disabled>Pipixia</Option>
                            <Option value='xigua'>Xigua</Option>
                        </Select>
                        <br/><br/>
                        <Cascader style={{ width: '100%' }} treeData={treeData} placeholder="Cascader"/>
                    </Col>
                </Row>
                <Row>
                    <h3 style={titleStyle}>Navigation</h3>
                </Row>
                <Row style={rowStyle}>
                    <Breadcrumb>
                        <Breadcrumb.Item>Semi-ui</Breadcrumb.Item>
                        <Breadcrumb.Item>Breadcrumb</Breadcrumb.Item>
                        <Breadcrumb.Item>Default</Breadcrumb.Item>
                    </Breadcrumb>
                    <Nav
                        mode={'horizontal'}
                        items={[
                            { itemKey: 'user', text: 'Option1', icon: <IconEdit /> },
                            { itemKey: 'union', text: 'Option2', icon: <IconCamera /> },
                            {
                                itemKey: 'approve-management',
                                text: 'Group3',
                                icon: <IconList />,
                                items: [
                                    '3-1',
                                    '3-2'
                                ]
                            },
                        ]}
                    />
                    <br/><br/>
                    <Pagination total={80} showSizeChanger></Pagination>
                    <br/>
                    <Steps current={1}>
                        <Steps.Step title="Finished" description="This is a description." />
                        <Steps.Step title="In Progress" description="This is a description." />
                        <Steps.Step title="Waiting" description="This is a description." />
                    </Steps>
                    <br/>
                    <Steps current={1} status="error">
                        <Steps.Step title="Finished" description="This is a description" />
                        <Steps.Step title="In Process" description="This is a description" />
                        <Steps.Step title="Waiting" description="This is a description" />
                    </Steps>
                </Row>
                <Row>
                    <h3 style={titleStyle}>Display</h3>
                </Row>
                <Row style={rowStyle}>
                    <div style={{ display: 'flex' }}>
                        <div style={{ padding: 8 }}>
                            <Badge count={5} theme='solid' >
                                <Avatar color='blue' shape='square' style={badgeStyle}>XZ</Avatar>
                            </Badge>
                        </div>
                        <div style={{ padding: 8 }}>
                            <Badge count={5} theme='light' >
                                <Avatar color='cyan' shape='square' style={badgeStyle}>YB</Avatar>
                            </Badge>
                        </div>
                        <div style={{ padding: 8 }}>
                            <Badge count={5} theme='inverted'>
                                <Avatar color='indigo' shape='square' style={badgeStyle}>LX</Avatar>
                            </Badge>
                        </div>
                        <div style={{ padding: 8 }}>
                            <Badge dot theme='solid' >
                                <Avatar color='light-blue' shape='square' style={badgeStyle}>YZ</Avatar>
                            </Badge>
                        </div>
                        <div style={{ padding: 8 }}>
                            <Badge dot theme='light' >
                                <Avatar color='teal' shape='square' style={badgeStyle}>HW</Avatar>
                            </Badge>
                        </div>
                        <div style={{ padding: '8px', borderRadius: '4px', backgroundColor: 'var(--semi-color-fill-0)' }}>
                            <Badge dot theme='inverted'>
                                <Avatar color='green' shape='square' style={badgeStyle}>XM</Avatar>
                            </Badge>
                        </div>
                    </div>
                    <br/>
                    <div>
                        <Tag color='grey' style={tagStyle}> grey tag </Tag>
                        <Tag color='blue' style={tagStyle}> blue tag </Tag>
                        <Tag color='blue' type='ghost' style={tagStyle}> ghost tag </Tag>
                        <Tag color='blue' type='solid' style={tagStyle}> solid tag </Tag>
                        <Tag color='red' style={tagStyle}> red tag </Tag>
                        <Tag color='green' style={tagStyle}> green tag </Tag>
                        <Tag color='orange' style={tagStyle}> orange tag </Tag>
                        <Tag color='teal' style={tagStyle}> teal tag </Tag>
                        <Tag color='violet' style={tagStyle}> violet tag </Tag>
                        <Tag color='white' style={tagStyle}> white tag </Tag>
                    </div>
                    <br/>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <Popover content={'hi semi-design'} style={{ padding: 8 }}><Tag style={{ marginRight: 8 }}>I am Popover</Tag></Popover>
                        <Tooltip content={'hi semi-design'}>
                            <Tag style={{ marginRight: 8 }}>I am Tooltip</Tag>
                        </Tooltip>
                        <Rating defaultValue={3} size='small' style={{ marginRight: 8 }} />
                    </div>
                    <br/>
                    <Timeline>
                        <Timeline.Item time='2019-07-14 10:35' type='ongoing'>Under review</Timeline.Item>
                        <Timeline.Item time='2019-06-13 16:17' type='success'>Publish successfully</Timeline.Item>
                        <Timeline.Item time='2019-05-14 18:34' type='error'>Audit failure</Timeline.Item>
                    </Timeline>
                </Row>
                <Row>
                    <h3 style={titleStyle}>Feedback</h3>
                </Row>
                <Row style={rowStyle}>
                    <Button type='primary' onClick={() => Notification.success(opts)} style={buttonStyle}>Notification of success information</Button>
                    <Button onClick={() => Notification.info(opts)} style={buttonStyle}>Notification of prompt information</Button>
                    <Button type="warning" onClick={() => Notification.warning(opts)} style={buttonStyle}>Notification of warning information</Button>
                    <Button type="danger" onClick={() => Notification.error(opts)} style={buttonStyle}>Notification of failure information</Button>
                    <Button
                        style={buttonStyle}
                        ghost={false}
                        icon={<IconVigoLogo />}
                        onClick={() => Notification.info({ ...opts, icon: <IconVigoLogo /> })}
                    />
                    <Button
                        style={buttonStyle}

                        ghost={false}
                        icon={<IconVigoLogo />}
                        onClick={() => Notification.info({ ...opts, icon: <IconVigoLogo style={{ color: 'pink' }} /> })}
                    />
                    <br/>
                    <Button type='primary' onClick={() => Modal.success(opts)} style={buttonStyle}>Modal of success information</Button>
                    <Button onClick={() => Modal.info(opts)} style={buttonStyle}>Modal of prompt information</Button>
                    <Button type="warning" onClick={() => Modal.warning(opts)} style={buttonStyle}>Modal of warning information</Button>
                    <Button type="danger" onClick={() => Modal.error(opts)} style={buttonStyle}>Modal of failure information</Button>
                    <br/>
                    <Button type='primary' onClick={() => Toast.success(opts)} style={buttonStyle}>Toast of success information</Button>
                    <Button onClick={() => Toast.info(opts)} style={buttonStyle}>Toast of prompt information</Button>
                    <Button type="warning" onClick={() => Toast.warning(opts)} style={buttonStyle}>Toast of waning information</Button>
                    <Button type="danger" onClick={() => Toast.error(opts)} style={buttonStyle}>Toast of failure information</Button>
                    <br/><br/>
                    <Spin tip='I am loading...'>
                        <div style={{
                            backgroundColor: 'var(--semi-color-primary-light-default',
                            border: '1px solid var(--semi-color-primary)',
                            borderRadius: '4px',
                            padding: '16px 10px'
                        }}>
                            <p>Here are some texts.</p>
                            <p>And more texts on the way.</p>
                        </div>
                    </Spin>
                </Row>
            </ConfigProvider>
        </div>
    );
}
```

## API Reference

| Properties | Instructions                                                                                                      | type          | Default |
|------------|-------------------------------------------------------------------------------------------------------------------|---------------|---------|
| direction  | Sets the direction of the text                                                                                    | `ltr`\| `rtl` | `ltr`   |
| getPopupContainer | Specifies the parent DOM, and the bullet layer will be rendered to the DOM, you need to set 'position: relative`  This will change the DOM tree position, but not the view's rendering position.  | function():HTMLElement | () => document.body    |
| locale     | Multi-language configuration, same as the [usage](/en-US/other/locale) of `locale` parameter in `LocaleProvider`(If `locale` is configured in `ConfigProvider` and `LocaleProvider` at the same time, the former has higher priority than the latter)  | object         |         |
| timeZone   | [Time zone identifier](#Time_Zone_Identifier)                                                                     | string\|number |         |


### Time Zone Identifier

-   Numbers, such as `1`,`-9.5`, represent the time offset from UTC, the unit is hour, and it can be negative or decimal;
-   A string, such as `"GMT-09: 30"`,`"GMT+08: 00"`, which is a characterization offset string starting with `"GMT"`, or [IANA](https://time.is/time_zones), such as `"Asia/Shanghai"`,`"America/Los_Angeles"`, etc.

When you use numbers or similar writing of `GMT-09:00`, Semi will internally convert these time zone identifiers to the IANA.

- If you set `-9` or `GMT-09:00`, it will be converted to `Pacific/Gambier`. There may be multiple IANA identifiers corresponding to certain numbers. Semi prefers IANA identifiers without daylight saving time;

- If the number does not have a corresponding IANA identifier without daylight saving time, such as `-3.5`, `3.5`, `10.5`, `13.75`, then we are mapping an IANA identifier with daylight saving time, and the time zone with daylight saving time will be adjust the offset. For example, `-3.5` will add 1h to the standard time after entering daylight saving time.

If you want to accurately set the time zone of a region, it is recommended to use the IANA identifiers instead of the previous usage. Here you can check the [IANA list](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones), and whether the time zone has daylight saving time.


### FAQ

- The ConfigProvider does not provide the function of global custom prefix classname. How to achieve similar requirements (for example, Semi is used in the SDK, and it is expected that the packaged dom style does not have the .semi-xx prefix, so as not to be affected by the host's global CSS)?
    - Since prefixCls needs to be consumed by the js/css of the component layer at the same time, Semi put this switch in the configuration item of webpack plugin, rather than as a configuration item of ConfigProvider.
    - If you use webpack, please configure it in the parameters of `SemiWebpackPlugin`

```diff
# webpack config example: webpack.config.js
const SemiWebpackPlugin = require('@douyinfe/semi-webpack-plugin').default;
module.exports = {
+    plugins: [new SemiWebpackPlugin({ prefixCls: 'imes' })],
}
```


## semiGlobal

You can override the default Props of global components

In `semiGlobal.config.overrideDefaultProps` you can configure the component default Props. You need to put your configuration at the entrance of the entire site, that is, it will be executed before all semi components.

<Notice title={"Notes"}>
semiGlobal is a singleton mode that affects the entire site. If you only want to cover certain components in certain places, it is recommended not to use semiGlobal. Instead, encapsulate the corresponding components that need to be covered and pass in the modified default props.
</Notice>

For example, the configuration below sets all Buttons to warning by default, and the zIndex of Select to 2000 by default, etc.

```js
import { semiGlobal } from "@douiyinfe/semi-ui"

semiGlobal.config.overrideDefaultProps = {
   Select: {
     zIndex: 2000,
   },
   Tooltip: {
     zIndex: 2001,
     trigger:"click"
   },
};


```
