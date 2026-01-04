---
localeCode: zh-CN
order: 94
category: 其他
title:  ConfigProvider 全局配置
icon: doc-configprovider
dir: column
brief: 为组件提供统一的全局化配置。
---

## 使用场景

覆盖配置分为两种场景

- 需要覆盖多个组件公有 Props 配置（例如 `timezone`、`rtl`），使用 `ConfigProvider`
- 当 `ConfigProvider` 暴露参数未能满足，希望修改全局修改某个组件的 某类 Props（例如期望将所有`Button`的 `theme` 都配置为 `solid` 或所有 `Popover`的 `zIndex`），使用 `semiGlobal`


## ConfigProvider

ConfigProvider 借助 React Context 机制实现，因此它能影响 React 节点树中的子组件

## 代码演示

### 如何引入

```jsx import
import { ConfigProvider } from '@douyinfe/semi-ui';
```
### 基本用法

通过传入 timeZone 参数，用户可以为时间类组件配置时区：

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
                    placeholder={'请选择时区'}
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

### 手动获取值
通常情况下，组件内部会自动获取 ConfigProvider 的值自动消费，无需关心。但是一些特殊场景，你可能需要手动获取值来进行其他操作。

使用 ConfigConsumer 获取 ConfigProvider 的值

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
全局配置 `direction` 可以改变组件的文本方向（1.8.0）。

`rtl` 表示从右到左 (类似希伯来语或阿拉伯语)， `ltr` 表示从左到右 (类似中文、英语等大部分语言)。

特殊组件：
- Modal，Notification，Toast 的命令式调用需要通过 prop 传 `direction`。
- 如果你想对有方向性的 Icon 做 RTL 国际化，需要自己单独进行处理。我们认为对 Icon 进行 RTL 会让它变得难以理解和维护。其他组件内的 icon Semi 已经做了 RTL 适配。
- Table 的树形数据暂不支持 RTL（[Chrome、Safari 浏览器表现与 Firefox 表现不同](https://codesandbox.io/s/table-rtl-treedata-uy7gzl?file=/src/App.jsx)），固定列在 v2.32 版本支持 RTL，Slider 暂不支持 RTL。


```jsx live=true dir="column" hideInDSM
import React, { useState } from 'react';
import { ConfigProvider, ButtonGroup, Button, Row, Col, Notification, DatePicker, TimePicker, Timeline, Popover, Tag, Tooltip, Badge, Avatar, Steps, Pagination, Modal, Breadcrumb, Rating, Nav, Spin, Cascader, Radio, Select, Input, Typography, TextArea, Checkbox, Switch } from '@douyinfe/semi-ui';
import { IconVigoLogo, IconEdit, IconCamera, IconList, IconSidebar, IconChevronDown } from '@douyinfe/semi-icons';

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
            label: '浙江省',
            value: 'zhejiang',
            children: [
                {
                    label: '杭州市',
                    value: 'hangzhou',
                    children: [
                        {
                            label: '西湖区',
                            value: 'xihu',
                        },
                        {
                            label: '萧山区',
                            value: 'xiaoshan',
                        },
                        {
                            label: '临安区',
                            value: 'linan',
                        },
                    ],
                },
                {
                    label: '宁波市',
                    value: 'ningbo',
                    children: [
                        {
                            label: '海曙区',
                            value: 'haishu',
                        },
                        {
                            label: '江北区',
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
            <ConfigProvider direction={direction}>
                <Row>
                    <h3 style={titleStyle}>Buttons</h3>
                </Row>
                <Row style={rowStyle}>
                    <Button loading={true} theme="solid" style={{ marginRight: 8 }}>加载</Button>
                    <Button icon={<IconSidebar />} theme="solid" style={{ marginRight: 8 }}>收起</Button>
                    <Button icon={<IconChevronDown />} theme="solid" iconPosition={"right"} style={{ marginRight: 8 }}>展开选项</Button >
                    <br/><br/>
                    <ButtonGroup>
                        <Button>拷贝</Button>
                        <Button>查询</Button>
                        <Button>剪切</Button>
                    </ButtonGroup>
                </Row>
                <Row>
                    <h3 style={titleStyle}>Input</h3>
                </Row>
                <Row style={rowStyle} gutter={16}>
                    <Col span={12}>
                        <Input placeholder='输入框'></Input>
                        <br/><br/>
                        <Input disabled placeholder='输入框'></Input>
                        <br/><br/>
                        <Input prefix="Prefix" showClear></Input>
                        <br/><br/>
                        <Input suffix={<Typography.Text strong type='secondary' style={{ margin: '0 8px' }}>Suffix</Typography.Text>} showClear></Input>
                        <br/><br/>
                        <TextArea placeholder="文本框" maxCount={100} />
                        <br/><br/>
                        <div style={flexStyle}>
                            <Switch style={{ marginRight: 8 }} defaultChecked={true}></Switch>
                            <Switch style={{ marginRight: 8 }}></Switch>
                            <Switch disabled defaultChecked={true} style={{ marginRight: 8 }}></Switch>
                        </div>
                        <div style={flexStyle}>
                            <Checkbox style={{ marginRight: 8 }} defaultChecked>多选框</Checkbox>
                            <Checkbox style={{ marginRight: 8 }} disabled defaultChecked>禁用的多选框</Checkbox>
                            <Checkbox style={{ marginRight: 8 }}>禁用的多选框</Checkbox>
                        </div>
                        <div style={{ ...flexStyle, marginBottom: 0 }}>
                            <Radio style={{ marginRight: 8 }} defaultChecked>单选框</Radio>
                            <Radio style={{ marginRight: 8 }} disabled defaultChecked>禁用的单选框</Radio>
                            <Radio style={{ marginRight: 8 }}>禁用的单选框</Radio>
                        </div>
                    </Col>
                    <Col span={12}>
                        <DatePicker onChange={(date, dateString) => console.log(dateString)} style={{ width: '100%' }}/>
                        <br/><br/>
                        <TimePicker style={{ width: '100%' }} />
                        <br/><br/>
                        <Select style={{ width: '100%' }} placeholder="选择器-单选">
                            <Option value='abc'>抖音</Option>
                            <Option value='hotsoon'>火山</Option>
                            <Option value='pipixia' disabled>皮皮虾</Option>
                            <Option value='xigua'>西瓜视频</Option>
                        </Select>
                        <br/><br/>
                        <Select disabled style={{ width: '100%' }} placeholder="选择器-禁用">
                            <Option value='abc'>抖音</Option>
                            <Option value='hotsoon'>火山</Option>
                            <Option value='pipixia' disabled>皮皮虾</Option>
                            <Option value='xigua'>西瓜视频</Option>
                        </Select>
                        <br/><br/>
                        <Select multiple style={{ width: '100%' }} placeholder="选择器-多选">
                            <Option value='abc'>抖音</Option>
                            <Option value='hotsoon'>火山</Option>
                            <Option value='pipixia' disabled>皮皮虾</Option>
                            <Option value='xigua'>西瓜视频</Option>
                        </Select>
                        <br/><br/>
                        <Cascader style={{ width: '100%' }} treeData={treeData} placeholder="级联选择器"/>
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
                        <Timeline.Item time='2019-07-14 10:35' type='ongoing'>审核中</Timeline.Item>
                        <Timeline.Item time='2019-06-13 16:17' type='success'>发布成功</Timeline.Item>
                        <Timeline.Item time='2019-05-14 18:34' type='error'>审核失败</Timeline.Item>
                    </Timeline>
                </Row>
                <Row>
                    <h3 style={titleStyle}>Feedback</h3>
                </Row>
                <Row style={rowStyle}>
                    <Button type='primary' onClick={() => Notification.success(opts)} style={buttonStyle}>成功信息的通知</Button>
                    <Button onClick={() => Notification.info(opts)} style={buttonStyle}>提示信息的通知</Button>
                    <Button type="warning" onClick={() => Notification.warning(opts)} style={buttonStyle}>警告信息的通知</Button>
                    <Button type="danger" onClick={() => Notification.error(opts)} style={buttonStyle}>失败信息的通知</Button>
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
                    <Button type='primary' onClick={() => Modal.success(opts)} style={buttonStyle}>成功信息的弹窗</Button>
                    <Button onClick={() => Modal.info(opts)} style={buttonStyle}>提示信息的弹窗</Button>
                    <Button type="warning" onClick={() => Modal.warning(opts)} style={buttonStyle}>警告信息的弹窗</Button>
                    <Button type="danger" onClick={() => Modal.error(opts)} style={buttonStyle}>失败信息的弹窗</Button>
                    <br/>
                    <Button type='primary' onClick={() => Toast.success(opts)} style={buttonStyle}>成功信息的提示</Button>
                    <Button onClick={() => Toast.info(opts)} style={buttonStyle}>提示信息的提示</Button>
                    <Button type="warning" onClick={() => Toast.warning(opts)} style={buttonStyle}>警告信息的提示</Button>
                    <Button type="danger" onClick={() => Toast.error(opts)} style={buttonStyle}>失败信息的提示</Button>
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

## API 参考

| 属性              | 说明                                                              | 类型                   | 默认值              |
|-------------------|-----------------------------------------------------------------|------------------------|---------------------|
| direction         | 设置文本的方向                                                         | `ltr`\| `rtl`          | `ltr`               |
| getPopupContainer | 指定父级 DOM，弹层将会渲染至该 DOM 中，自定义需要设置 `position: relative` 这会改变浮层 DOM 树位置，但不会改变视图渲染位置。            | function():HTMLElement | () => document.body |
| locale            | 多语言配置，同`LocaleProvider`中`locale`参数的[用法](/zh-CN/other/locale#使用)（如果同时在`ConfigProvider`和`LocaleProvider`中配置`locale`，前者优先级高于后者） | object                 |                     |
| timeZone          | [时区标识](#时区标识)                                                   | string\|number         |                     |


### 时区标识

-   数字，例如 `1`、`-9.5`，代表距离 UTC 的时间偏移，单位为小时，可以为负数或小数；
-   字符串，例如`GMT-09:30`、`GMT+08:00`这样的以 `"GMT"` 开头的表征偏移字符串，也可以为 [IANA](https://time.is/time_zones) 标识，如`Asia/Shanghai`、`America/Los_Angeles`等。

当你使用数字或 `GMT-09:00` 类似写法时，Semi 内部会将这些时区标识转换为 IANA 标识。

- 如设置 `-9` 或 `GMT-09:00` 时，会转换成 `Pacific/Gambier`。某些数字对应的 IANA 标识可能有多个，Semi 首选无夏令时的 IANA 标识；

- 如果该数字没有对应的无夏令时 IANA 标识，如 `-3.5`、`3.5`、`10.5`、`13.75`，这时我们映射的就是一个有夏令时的 IANA 标识，有夏令时的时区会在偏移量上进行调整，如 `-3.5` 会在进入夏令时后在标准时间上增加 1h。

如果你想准确设置一个地区的时区，推荐使用 IANA 标识而不是前面的用法。这里可以查看 [IANA 标识列表](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)，以及时区是否有夏令时。

### FAQ

- ConfigProvider中没有提供全局自定义prefix classname的功能，有类似需求如何实现（例如SDK中使用了Semi，期望打包的dom样式不带.semi-xx前缀，以免被宿主的全局 CSS 影响）？
    - 由于 prefixCls 需要同时被组件层的 js/css 消费，Semi 将此开关放在了webpack plugin的配置项中，而不是作为ConfigProvider的配置项。
    - 如果你使用webpack，请在`SemiWebpackPlugin`的参数中进行配置


```diff
# webpack配置示例
const SemiWebpackPlugin = require('@douyinfe/semi-webpack-plugin').default;
module.exports = {
+    plugins: [new SemiWebpackPlugin({ prefixCls: 'imes' })],
}
```


## semiGlobal

除了 ConfigProvider外，你还可以通过 semiGlobal 配置覆盖全局组件的默认 Props。该能力在 v2.59.0后提供    

在 `semiGlobal.config.overrideDefaultProps` 可配置组件默认 Props，你需要将你的配置放到整个站点的入口处，即优先于所有 Semi 组件执行。

<Notice title={"注意事项"}>
semiGlobal 是单例模式，会影响整个站点，如果你只想覆盖某些地方的某些组件 Props ，建议不要使用 semiGlobal，而是将对应需要覆盖的组件封装一层并传入修改后的默认 props。
</Notice>

比如下方配置就是将所有的 Button 默认设置为 warning，Select 的 zIndex 默认设置为 2000 等

```js
import { semiGlobal } from "@douiyinfe/semi-ui";

semiGlobal.config.overrideDefaultProps = {
    Select: {
        zIndex: 2000,
    },
    Tooltip: {
        zIndex: 2001,
        trigger: 'click'
    },
};

```

