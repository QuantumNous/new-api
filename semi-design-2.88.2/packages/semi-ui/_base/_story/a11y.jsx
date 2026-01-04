import React, { useEffect, useState } from 'react';
import {
    Avatar,
    Badge,
    Breadcrumb,
    Button,
    Layout,
    Nav,
    Pagination,
    Popover,
    Rating,
    Row,
    Steps,
    Space,
    Tag,
    Timeline,
    Tooltip,
    Col,
    Typography,
    Anchor,
    BackTop,
    Tabs,
    TabPane,
    Calendar,
    Card,
    Collapse,
    Descriptions,
    Dropdown,
    Empty,
    List,
    ButtonGroup,
    Modal,
    OverflowList,
    Slider,
    SideSheet,
    Table,
    Banner,
    Popconfirm,
    Notification,
    Progress,
    Toast,
    Spin,
    Form,
    Select,
    Collapsible,
    Skeleton,
    Tree,
    Transfer
} from '@douyinfe/semi-ui';
import {
    IconSemiLogo,
    IconBell,
    IconHelpCircle,
    IconBytedanceLogo,
    IconHome,
    IconHistogram,
    IconLive,
    IconSetting,
    IconEdit,
    IconCamera,
    IconAlarm,
    IconBookmark,
    IconDuration,
    IconFolder,
    IconDelete,
    IconUpload,
    IconSun,
    IconMoon,
    IconSearch
} from '@douyinfe/semi-icons';
import {
    IllustrationConstruction,
    IllustrationConstructionDark,
    IllustrationNoResult,
    IllustrationNoResultDark,
    IllustrationSuccess,
    IllustrationSuccessDark,
    IllustrationFailure,
    IllustrationFailureDark,
    IllustrationNoAccess,
    IllustrationNoAccessDark,
    IllustrationNoContent,
    IllustrationNoContentDark,
    IllustrationNotFound,
    IllustrationNotFoundDark,
    IllustrationIdle,
    IllustrationIdleDark
} from '@douyinfe/semi-illustrations';
import './a11y.scss';

SemiA11y.storyName = 'Semi A11y';

const raw = [
    {
        key: '1',
        name: 'Semi Design 设计稿标题可能有点长这时候应该显示 Tooltip.fig',
        nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/figma-icon.png',
        size: '2M',
        owner: '姜鹏志',
        updateTime: '2020-02-02 05:13',
        avatarBg: 'grey',
    },
    {
        key: '2',
        name: 'Semi Design 分享演示文稿',
        nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png',
        size: '2M',
        owner: '郝宣',
        updateTime: '2020-01-17 05:31',
        avatarBg: 'red',
    },
    {
        key: '3',
        name: '设计文档',
        nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png',
        size: '34KB',
        owner: 'Zoey Edwards',
        updateTime: '2020-01-26 11:01',
        avatarBg: 'light-blue',
    },
    {
        key: '4',
        name: 'Semi Pro 设计文档可能也有点长所以也会显示Tooltip',
        nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png',
        size: '34KB',
        owner: '姜琪',
        updateTime: '2020-01-26 11:01',
        avatarBg: 'green',
    },
];

const treeData = [
    {
        label: '亚洲',
        value: 'Asia',
        key: '0',
        children: [
            {
                label: '中国',
                value: 'China',
                key: '0-0',
                children: [
                    {
                        label: '北京',
                        value: 'Beijing',
                        key: '0-0-0',
                    },
                    {
                        label: '上海',
                        value: 'Shanghai',
                        key: '0-0-1',
                    },
                ],
            },
        ],
    },
    {
        label: '北美洲',
        value: 'North America',
        key: '1',
    }
];

const listData = [
    {
        title: '审核管理平台',
        rating: 4.5,
        feedbacks: 124,
    },
    {
        title: '扁鹊',
        rating: 4,
        feedbacks: 108,
    },
    {
        title: '直播审核平台',
        rating: 3.5,
        feedbacks: 244,
    },
    {
        title: '抖音安全测试',
        feedbacks: 189,
    },
    {
        title: '内容平台',
        rating: 3,
        feedbacks: 128,
    },
    {
        title: '策略平台',
        rating: 4,
        feedbacks: 156,
    },
];

const style = { width: '90%' };
const initValues = {
    name: 'semi',
    business: ['ulikeCam'],
    role: 'ued',
    switch: true,
    files: [
        {
            uid: '1',
            name: 'vigo.png',
            status: 'success',
            size: '130KB',
            preview: true,
            url:
                'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/vigo.png',
        },
        {
            uid: '2',
            name: 'jiafang1.jpeg',
            status: 'validateFail',
            size: '222KB',
            percent: 50,
            preview: true,
            fileInstance: new File([new ArrayBuffer(2048)], 'jiafang1.jpeg', { type: 'image/jpeg' }),
            url:
                'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/bag.jpeg',
        },
        {
            uid: '3',
            name: 'jiafang2.jpeg',
            status: 'uploading',
            size: '222KB',
            percent: 50,
            preview: true,
            fileInstance: new File([new ArrayBuffer(2048)], 'jiafang2.jpeg', { type: 'image/jpeg' }),
            url:
                'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/bag.jpeg',
        },
    ],
};

const listItemStyle = {
    border: '1px solid var(--semi-color-border)',
    backgroundColor: 'var(--semi-color-bg-2)',
    borderRadius: '3px',
    paddingLeft: '20px',
    margin: '8px 2px',
};

const descriptionData = [
    { key: '实际用户数量', value: '1,480,000' },
    { key: '7天留存', value: '98%' },
    { key: '安全等级', value: '3级' },
    { key: '垂类标签', value: <Tag style={{ margin: 0 }}>电商</Tag> },
    { key: '认证状态', value: '未认证' },
];
const descriptionStyle = {
    boxShadow: 'var(--semi-shadow-elevated)',
    backgroundColor: 'var(--semi-color-bg-2)',
    borderRadius: '4px',
    padding: '10px',
    margin: '10px',
    width: '200px',
};

const emptyStyle = {
    padding: 30,
};

const transferData = Array.from({ length: 100 }, (v, i) => {
    return {
        label: `选项名称 ${i}`,
        value: i,
        disabled: false,
        key: i,
    };
});

const items = [
    { icon: <IconAlarm style={{ marginRight: 4 }} />, key: 'alarm' },
    { icon: <IconBookmark style={{ marginRight: 4 }} />, key: 'bookmark' },
    { icon: <IconCamera style={{ marginRight: 4 }} />, key: 'camera' },
    { icon: <IconDuration style={{ marginRight: 4 }} />, key: 'duration' },
    { icon: <IconEdit style={{ marginRight: 4 }} />, key: 'edit' },
    { icon: <IconFolder style={{ marginRight: 4 }} />, key: 'folder' },
];

const empty = (
    <Empty
        image={<IllustrationNoResult />}
        darkModeImage={<IllustrationNoResultDark />}
        description={'搜索无结果'}
    />
);

const placeholder = (
    <div style={style}>
        <Skeleton.Avatar style={{ marginRight: 12 }} />
        <div>
            <Skeleton.Title style={{ width: 120, marginBottom: 12, marginTop: 12 }} />
            <Skeleton.Paragraph style={{ width: 240 }} rows={3} />
        </div>
    </div>
);

export default function SemiA11y() {
    const { Header, Footer, Sider, Content } = Layout;
    const { Title, Text, Paragraph } = Typography;
    const [modalVisible, setModalVisible] = useState(false);
    const [sideSheetVisible, setSideSheetVisible] = useState(false);
    const [overflowWidth, setOverflowWidth] = useState(100);
    const [isOpen, setCollapsibleOpen] = useState(false);
    const [dataSource, setData] = useState(raw);
    const [mode, setMode] = useState('light');
    const [stringData, setStringData] = useState([]);

    const removeRecord = key => {
        let newDataSource = [...dataSource];
        if (key != null) {
            let idx = newDataSource.findIndex(data => data.key === key);

            if (idx > -1) {
                newDataSource.splice(idx, 1);
                setData(newDataSource);
            }
        }
    };

    const columns = [
        {
            title: '标题',
            dataIndex: 'name',
            width: 400,
            render: (text, record, index) => {
                return (
                    <span style={{ display: 'flex', alignItems: 'center' }}>
                        <Avatar
                            size="small"
                            shape="square"
                            src={record.nameIconSrc}
                            style={{ marginRight: 12 }}
                        ></Avatar>
                        {/* 宽度计算方式为单元格设置宽度 - 非文本内容宽度 */}
                        <Text ellipsis={{ showTooltip: true }} style={{ width: 'calc(400px - 76px)' }}>
                            {text}
                        </Text>
                    </span>
                );
            },
        },
        {
            title: '大小',
            dataIndex: 'size',
            width: 150,
        },
        {
            title: '所有者',
            dataIndex: 'owner',
            render: (text, record, index) => {
                return (
                    <div>
                        <Avatar size="small" color={record.avatarBg} style={{ marginRight: 4 }}>
                            {typeof text === 'string' && text.slice(0, 1)}
                        </Avatar>
                        {text}
                    </div>
                );
            },
        },
        {
            title: '更新日期',
            dataIndex: 'updateTime',
        },
        {
            title: '',
            width: 100,
            dataIndex: 'operate',
            render: (text, record) => (
                <Button icon={<IconDelete />} theme="borderless" onClick={() => removeRecord(record.key)} />
            ),
        },
    ];

    const onConfirm = () => {
        Toast.success('确认保存！');
    };

    const onCancel = () => {
        Toast.warning('取消保存！');
    };

    const switchMode = () => {
        const body = document.body;
        if (body.hasAttribute('theme-mode')) {
            body.removeAttribute('theme-mode');
            setMode('light');
        } else {
            body.setAttribute('theme-mode', 'dark');
            setMode('dark');
        }
    };

    const handleStringSearch = (value) => {
        let result;
        if (value) {
            result = ['gmail.com', '163.com', 'qq.com'].map(domain => `${value}@${domain}`);
        } else {
            result = [];
        }
        setStringData(result);
    };

    const renderOverflow = items => {
        return items.length ? <Tag style={{ flex: '0 0 auto' }}>+{items.length}</Tag> : null;
    };
    const renderOverflowItem = (item, ind) => {
        return (
            <Tag color="blue" key={item.key} style={{ marginRight: 8, flex: '0 0 auto' }}>
                {item.icon}
                {item.key}
            </Tag>
        );
    };

    useEffect(() => {
        document.body && document.body.setAttribute('data-page', 'a11y');

        return () => {
            document.body && document.body.removeAttribute('data-page');
        };
    }, []);

    return (
        <>
            <Layout style={{ border: '1px solid var(--semi-color-border)' }}>
                <Header style={{ backgroundColor: 'var(--semi-color-bg-1)' }}>
                    <div>
                        <Nav mode="horizontal" defaultSelectedKeys={['Home']}>
                            <Nav.Header>
                                <IconSemiLogo style={{ width: '96px', height: '36px', fontSize: 36 }} />
                                <span
                                    style={{
                                        color: 'var(--semi-color-text-2)',
                                    }}
                                >
                                    <span
                                        style={{
                                            marginRight: '24px',
                                            color: 'var(--semi-color-text-0)',
                                            fontWeight: '600',
                                        }}
                                    >
                                        模版推荐
                                    </span>
                                    <span style={{ marginRight: '24px' }}>所有模版</span>
                                    <span>我的模版</span>
                                </span>
                            </Nav.Header>
                            <Nav.Footer>
                                <Button
                                    theme="borderless"
                                    icon={mode === 'dark' ? <IconSun size="large" /> : <IconMoon size="large" />}
                                    style={{
                                        color: 'var(--semi-color-text-2)',
                                        marginRight: '12px',
                                    }}
                                    onClick={switchMode}
                                />
                                <Button
                                    theme="borderless"
                                    icon={<IconBell size="large" />}
                                    style={{
                                        color: 'var(--semi-color-text-2)',
                                        marginRight: '12px',
                                    }}
                                />
                                <Button
                                    theme="borderless"
                                    icon={<IconHelpCircle size="large" />}
                                    style={{
                                        color: 'var(--semi-color-text-2)',
                                        marginRight: '12px',
                                    }}
                                />
                                <Avatar color="orange" size="small">
                                    YJ
                                </Avatar>
                            </Nav.Footer>
                        </Nav>
                    </div>
                </Header>
                <Layout>
                    <Sider style={{ backgroundColor: 'var(--semi-color-bg-1)' }}>
                        <Nav
                            style={{ maxWidth: 220, height: '100%' }}
                            defaultSelectedKeys={['Home']}
                            items={[
                                { itemKey: 'Home', text: '首页', icon: <IconHome size="large" /> },
                                { itemKey: 'Histogram', text: '基础数据', icon: <IconHistogram size="large" /> },
                                { itemKey: 'Live', text: '测试功能', icon: <IconLive size="large" /> },
                                { itemKey: 'Setting', text: '设置', icon: <IconSetting size="large" /> },
                            ]}
                            footer={{
                                collapseButton: true,
                            }}
                        />
                    </Sider>
                    <Content
                        style={{
                            padding: '24px',
                            backgroundColor: 'var(--semi-color-bg-1)',
                            maxHeight: 'calc(100vh - 120px)',
                        }}
                    >
                        <Breadcrumb
                            style={{
                                marginBottom: '24px',
                            }}
                            routes={['首页', '当这个页面标题很长时需要省略', '上一页', '详情页']}
                        />
                        <div
                            style={{
                                borderRadius: '10px',
                                border: '1px solid var(--semi-color-border)',
                                padding: '32px',
                            }}
                            className="rows-container"
                        >
                            <Row id="基本示例">
                                <Pagination total={80} showSizeChanger></Pagination>
                                <Steps current={1}>
                                    <Steps.Step title="Finished" description="This is a description." />
                                    <Steps.Step title="In Progress" description="This is a description." />
                                    <Steps.Step title="Waiting" description="This is a description." />
                                </Steps>
                                <Steps current={1} status="error">
                                    <Steps.Step title="Finished" description="This is a description" />
                                    <Steps.Step title="In Process" description="This is a description" />
                                    <Steps.Step title="Waiting" description="This is a description" />
                                </Steps>
                            </Row>
                            <Row>
                                <div style={{ display: 'flex' }}>
                                    <div style={{ padding: 8 }}>
                                        <Badge count={5} theme="solid">
                                            <Avatar color="blue" shape="square">
                                                XZ
                                            </Avatar>
                                        </Badge>
                                    </div>
                                    <div style={{ padding: 8 }}>
                                        <Badge count={5} theme="light">
                                            <Avatar color="cyan" shape="square">
                                                YB
                                            </Avatar>
                                        </Badge>
                                    </div>
                                    <div style={{ padding: 8 }}>
                                        <Badge count={5} theme="inverted">
                                            <Avatar color="indigo" shape="square">
                                                LX
                                            </Avatar>
                                        </Badge>
                                    </div>
                                    <div style={{ padding: 8 }}>
                                        <Badge dot theme="solid">
                                            <Avatar color="light-blue" shape="square">
                                                YZ
                                            </Avatar>
                                        </Badge>
                                    </div>
                                    <div style={{ padding: 8 }}>
                                        <Badge dot theme="light">
                                            <Avatar color="teal" shape="square">
                                                HW
                                            </Avatar>
                                        </Badge>
                                    </div>
                                    <div
                                        style={{
                                            padding: '8px',
                                            borderRadius: '4px',
                                            backgroundColor: 'var(--semi-color-fill-0)',
                                        }}
                                    >
                                        <Badge dot theme="inverted">
                                            <Avatar color="green" shape="square">
                                                XM
                                            </Avatar>
                                        </Badge>
                                    </div>
                                </div>
                                <div>
                                    <Space wrap>
                                        <Tag color="grey">grey tag</Tag>
                                        <Tag color="blue">blue tag</Tag>
                                        <Tag color="blue" type="ghost">
                                            ghost tag
                                        </Tag>
                                        <Tag color="blue" type="solid">
                                            solid tag
                                        </Tag>
                                        <Tag color="red">red tag</Tag>
                                        <Tag color="green">green tag</Tag>
                                        <Tag color="orange">orange tag</Tag>
                                        <Tag color="teal">teal tag</Tag>
                                        <Tag color="violet">violet tag</Tag>
                                        <Tag color="white">white tag</Tag>
                                    </Space>
                                </div>
                                <div>
                                    <Space>
                                        <Popover content={'hi semi-design'} style={{ padding: 8 }}>
                                            <Tag style={{ marginRight: 8 }}>I am Popover</Tag>
                                        </Popover>
                                        <Tooltip content={'hi semi-design'}>
                                            <Tag style={{ marginRight: 8 }}>I am Tooltip</Tag>
                                        </Tooltip>
                                        <Dropdown
                                            render={
                                                <Dropdown.Menu>
                                                    <Dropdown.Item>Menu Item 1</Dropdown.Item>
                                                    <Dropdown.Item>Menu Item 2</Dropdown.Item>
                                                    <Dropdown.Item>Menu Item 3</Dropdown.Item>
                                                </Dropdown.Menu>
                                            }
                                        >
                                            <Tag>I am dropdown</Tag>
                                        </Dropdown>
                                        <Rating defaultValue={3} size="small" style={{ marginRight: 8 }} />
                                    </Space>
                                </div>
                                <div className="mt12">
                                    <Space>
                                        <Button onClick={() => setModalVisible(true)}>Modal</Button>
                                        <Button type="tertiary" onClick={() => setSideSheetVisible(true)}>
                                            SideSheet
                                        </Button>
                                        <Button
                                            type="warning"
                                            onClick={() =>
                                                Notification.open({
                                                    title: 'Hi, Bytedance',
                                                    content: 'ies dance dance dance',
                                                    duration: 3,
                                                })
                                            }
                                        >
                                            Notification
                                        </Button>
                                        <Popconfirm
                                            title="确定是否要保存此修改？"
                                            content="此修改将不可逆"
                                            onConfirm={onConfirm}
                                            onCancel={onCancel}
                                        >
                                            <Button type="danger">Popconfirm</Button>
                                        </Popconfirm>
                                        <Modal
                                            title="基本对话框"
                                            visible={modalVisible}
                                            onOk={() => setModalVisible(false)}
                                            onCancel={() => setModalVisible(false)}
                                        >
                                            This is the content of a basic modal.
                                            More content...
                                        </Modal>
                                        <SideSheet
                                            title="滑动侧边栏"
                                            visible={sideSheetVisible}
                                            onCancel={() => setSideSheetVisible(false)}
                                        >
                                            <p>This is the content of a basic side sheet.</p>
                                            <p>Here is more content...</p>
                                        </SideSheet>
                                    </Space>
                                </div>
                            </Row>
                            <Row>
                                <Col span={12} style={{ paddingRight: 24 }}>
                                    <div style={{ maxWidth: 640 }}>
                                        <Banner
                                            className="mb12"
                                            fullMode={false}
                                            type="info"
                                            bordered
                                            icon={null}
                                            closeIcon={null}
                                            title={
                                                <div style={{ fontWeight: 600, fontSize: '14px', lineHeight: '20px' }}>
                                                    不知道 AppKey？
                                                </div>
                                            }
                                            description={
                                                <div>
                                                    你可先联系对应的研发同学，确认是否已在
                                                    <Text link={{ href: 'https://semi.design/' }}>应用云平台</Text>
                                                    申请了应用，并填写对应的信息。
                                                </div>
                                            }
                                        />
                                        <Banner
                                            className="mb12"
                                            fullMode={false}
                                            type="warning"
                                            bordered
                                            icon={null}
                                            closeIcon={null}
                                            title={
                                                <div style={{ fontWeight: 600, fontSize: '14px', lineHeight: '20px' }}>
                                                    不知道 AppKey？
                                                </div>
                                            }
                                            description={
                                                <div>
                                                    你可先联系对应的研发同学，确认是否已在
                                                    <Text link={{ href: 'https://semi.design/' }}>应用云平台</Text>
                                                    申请了应用，并填写对应的信息。
                                                </div>
                                            }
                                        />
                                        <Banner
                                            className="mb12"
                                            fullMode={false}
                                            type="danger"
                                            bordered
                                            icon={null}
                                            closeIcon={null}
                                            title={
                                                <div style={{ fontWeight: 600, fontSize: '14px', lineHeight: '20px' }}>
                                                    不知道 AppKey？
                                                </div>
                                            }
                                            description={
                                                <div>
                                                    你可先联系对应的研发同学，确认是否已在
                                                    <Text link={{ href: 'https://semi.design/' }}>应用云平台</Text>
                                                    申请了应用，并填写对应的信息。
                                                </div>
                                            }
                                        />
                                        <Banner
                                            fullMode={false}
                                            type="success"
                                            bordered
                                            icon={null}
                                            closeIcon={null}
                                            title={
                                                <div style={{ fontWeight: 600, fontSize: '14px', lineHeight: '20px' }}>
                                                    不知道 AppKey？
                                                </div>
                                            }
                                            description={
                                                <div>
                                                    你可先联系对应的研发同学，确认是否已在
                                                    <Text link={{ href: 'https://semi.design/' }}>应用云平台</Text>
                                                    申请了应用，并填写对应的信息。
                                                </div>
                                            }
                                        />
                                    </div>
                                </Col>
                                <Col span={12}>
                                    <Title style={{ margin: '8px 0' }}>h1. Semi Design</Title>
                                    <Title heading={2} style={{ margin: '8px 0' }}>
                                        h2. Semi Design
                                    </Title>
                                    <Title heading={3} style={{ margin: '8px 0' }}>
                                        h3. Semi Design
                                    </Title>
                                    <Title heading={4} style={{ margin: '8px 0' }}>
                                        h4. Semi Design
                                    </Title>
                                    <Title heading={5} style={{ margin: '8px 0' }}>
                                        h5. Semi Design
                                    </Title>
                                    <Title heading={6} style={{ margin: '8px 0' }}>
                                        h6. Semi Design
                                    </Title>
                                </Col>
                            </Row>
                            <Row id="组件">
                                <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                                    <Empty
                                        image={<IllustrationSuccess style={{ width: 150, height: 150 }} />}
                                        darkModeImage={<IllustrationSuccessDark style={{ width: 150, height: 150 }} />}
                                        description={'创建成功'}
                                        style={emptyStyle}
                                    />
                                    <Empty
                                        image={<IllustrationFailure style={{ width: 150, height: 150 }} />}
                                        darkModeImage={<IllustrationFailureDark style={{ width: 150, height: 150 }} />}
                                        description={'加载失败'}
                                        style={emptyStyle}
                                    />
                                    <Empty
                                        image={<IllustrationNoAccess style={{ width: 150, height: 150 }} />}
                                        darkModeImage={<IllustrationNoAccessDark style={{ width: 150, height: 150 }} />}
                                        description={'没有权限'}
                                        style={emptyStyle}
                                    />
                                    <Empty
                                        image={<IllustrationNoContent style={{ width: 150, height: 150 }} />}
                                        darkModeImage={<IllustrationNoContentDark style={{ width: 150, height: 150 }} />}
                                        description={'暂无内容，请添加'}
                                        style={emptyStyle}
                                    />
                                    <Empty
                                        image={<IllustrationNotFound style={{ width: 150, height: 150 }} />}
                                        darkModeImage={<IllustrationNotFoundDark style={{ width: 150, height: 150 }} />}
                                        description={'页面404'}
                                        style={emptyStyle}
                                    />
                                    <Empty
                                        image={<IllustrationNoResult style={{ width: 150, height: 150 }} />}
                                        darkModeImage={<IllustrationNoResultDark style={{ width: 150, height: 150 }} />}
                                        description={'搜索无结果'}
                                        style={emptyStyle}
                                    />
                                    <Empty
                                        image={<IllustrationConstruction style={{ width: 150, height: 150 }} />}
                                        darkModeImage={<IllustrationConstructionDark style={{ width: 150, height: 150 }} />}
                                        description={'建设中'}
                                        style={emptyStyle}
                                    />
                                    <Empty
                                        image={<IllustrationIdle style={{ width: 150, height: 150 }} />}
                                        darkModeImage={<IllustrationIdleDark style={{ width: 150, height: 150 }} />}
                                        description={'神游四方'}
                                        style={emptyStyle}
                                    />
                                </div>
                            </Row>
                            <Row>                                       
                                <Timeline>
                                    <Timeline.Item time="2019-07-14 10:35" type="ongoing">
                                        审核中
                                    </Timeline.Item>
                                    <Timeline.Item time="2019-06-13 16:17" type="success">
                                        发布成功
                                    </Timeline.Item>
                                    <Timeline.Item time="2019-05-14 18:34" type="error">
                                        审核失败
                                    </Timeline.Item>
                                </Timeline>
                                <div style={{ width: 200 }}>
                                    <Progress className="mb12" percent={10} stroke="#fc8800" aria-label='download progress'/>
                                    <Progress className="mb12" percent={25} stroke="#f93920" aria-label='download progress'/>
                                    <Progress className="mb12" percent={50} aria-label='download progress'/>
                                    <Progress className="mb12" percent={80} aria-label='download progress'/>
                                    <Progress className="mb12" percent={80} size="large" aria-label='download progress'/>
                                    <Progress className="mb12" percent={80} style={{ height: '8px' }} aria-label='download progress'/>
                                </div>
                                <div className="mb12">
                                    <Skeleton placeholder={placeholder} loading={true} active>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                        }}>
                                            <Avatar color="blue" style={{ marginRight: 12 }}>
                                                UI
                                            </Avatar>
                                            <div>
                                                <h3>Semi UI</h3>
                                                <p>Hi, Bytedance dance dance.</p>
                                                <p>Hi, Bytedance dance dance.</p>
                                                <p>Hi, Bytedance dance dance.</p>
                                            </div>
                                        </div>
                                    </Skeleton>
                                </div>
                                <div>
                                    <Spin size="small" />
                                    <Spin size="middle" />
                                    <Spin size="large" />
                                </div>
                            </Row>
                            <Row>
                                <div style={{ width: 300 }}>
                                    <Slider
                                        step={1}
                                        value={overflowWidth}
                                        onChange={value => setOverflowWidth(value)}
                                    />
                                    <div style={{ width: `${overflowWidth}%` }}>
                                        <OverflowList
                                            items={items}
                                            overflowRenderer={renderOverflow}
                                            visibleItemRenderer={renderOverflowItem}
                                        />
                                    </div>
                                </div>
                            </Row>
                            <Row id="设计语言">
                                <Table
                                    style={{ minHeight: 350 }}
                                    columns={columns}
                                    dataSource={dataSource}
                                    pagination={false}
                                    empty={empty}
                                />
                            </Row>
                            <Row id="物料平台">
                                <Form
                                    initValues={initValues}
                                    style={{ padding: 10, width: '100%' }}
                                    onValueChange={v => console.log(v)}
                                >
                                    <Form.Section text={'基本信息'}>
                                        <Row>
                                            <Col span={12}>
                                                <Form.Input
                                                    field="name"
                                                    label="名称（Input）"
                                                    initValue={'mikeya'}
                                                    style={style}
                                                    trigger="blur"
                                                />
                                            </Col>
                                            <Col span={12}>
                                                <Form.DatePicker
                                                    field="date"
                                                    label="日期（DatePicker）"
                                                    style={style}
                                                    initValue={new Date()}
                                                    placeholder="请选择生效日期"
                                                />
                                            </Col>
                                        </Row>
                                        <Row>
                                            <Col span={12}>
                                                <Form.Select
                                                    field="role"
                                                    style={style}
                                                    label="角色（Select）"
                                                    placeholder="请选择你的角色"
                                                >
                                                    <Select.Option value="operate">运营</Select.Option>
                                                    <Select.Option value="rd">开发</Select.Option>
                                                    <Select.Option value="pm">产品</Select.Option>
                                                    <Select.Option value="ued">设计</Select.Option>
                                                </Form.Select>
                                            </Col>
                                            <Col span={12}>
                                                <Form.Select
                                                    field="business"
                                                    multiple
                                                    style={style}
                                                    placeholder="请选择业务线"
                                                    label="业务线（多选Select）"
                                                    extraText={
                                                        <div
                                                            style={{
                                                                color: 'rgba(var(--semi-blue-5), 1)',
                                                                fontSize: 14,
                                                                userSelect: 'none',
                                                                cursor: 'pointer',
                                                            }}
                                                        >
                                                            没有找到合适的业务线？
                                                        </div>
                                                    }
                                                >
                                                    <Select.Option value="abc">Semi</Select.Option>
                                                    <Select.Option value="ulikeCam">轻颜相机</Select.Option>
                                                    <Select.Option value="toutiao">今日头条</Select.Option>
                                                </Form.Select>
                                            </Col>
                                        </Row>
                                        <Row>
                                            <Col span={12}>
                                                <Form.Cascader
                                                    placeholder="请选择所在地区"
                                                    treeData={treeData}
                                                    field="area"
                                                    label="地区（Cascader）"
                                                    style={style}
                                                ></Form.Cascader>
                                            </Col>
                                            <Col span={12}>
                                                <Form.TreeSelect
                                                    field="tree"
                                                    style={style}
                                                    label="节点（TreeSelect）"
                                                    placeholder="请选择服务节点"
                                                    treeData={treeData}
                                                    filterTreeNode
                                                ></Form.TreeSelect>
                                            </Col>
                                        </Row>
                                        <Row>
                                            <Col span={12}>
                                                <Form.TagInput
                                                    field="product"
                                                    label="产品（TagInput）"
                                                    placeholder="请输入产品"
                                                    style={style}
                                                />
                                            </Col>
                                            <Col span={12}>
                                                <Form.AutoComplete
                                                    field="email"
                                                    label="邮箱（AutoComplete）"
                                                    data={stringData}
                                                    showClear
                                                    prefix={<IconSearch />}
                                                    placeholder="搜索... "
                                                    onSearch={handleStringSearch}
                                                    style={style}
                                                />
                                            </Col>
                                        </Row>
                                        <Row>
                                            <Col span={24}>
                                                <Form.Upload
                                                    field="files"
                                                    label="证明文件（Upload）"
                                                    action="//semi.design/api/upload"
                                                >
                                                    <Button icon={<IconUpload />} theme="light">
                                                        点击上传
                                                    </Button>
                                                </Form.Upload>
                                            </Col>
                                        </Row>
                                    </Form.Section>
                                    <Form.Section text="资源详情">
                                        <Row>
                                            <Col span={12}>
                                                <Form.TextArea
                                                    style={{ ...style, height: 120 }}
                                                    field="description"
                                                    label="申请理由（TextArea）"
                                                    placeholder="请填写申请资源理由"
                                                />
                                            </Col>
                                            <Col span={12}>
                                                <Form.CheckboxGroup
                                                    field="type"
                                                    direction="horizontal"
                                                    label="申请类型（CheckboxGroup）"
                                                    initValue={['user', 'admin']}
                                                    rules={[{ required: true }]}
                                                >
                                                    <Form.Checkbox value="admin">admin</Form.Checkbox>
                                                    <Form.Checkbox value="user">user</Form.Checkbox>
                                                    <Form.Checkbox value="guest">guest</Form.Checkbox>
                                                    <Form.Checkbox value="root">root</Form.Checkbox>
                                                </Form.CheckboxGroup>
                                                <Form.RadioGroup
                                                    field="isMonopolize"
                                                    label="是否独占资源（Radio）"
                                                    rules={[
                                                        { type: 'boolean' },
                                                        { required: true, message: '必须选择是否独占 ' },
                                                    ]}
                                                >
                                                    <Form.Radio value={true}>是</Form.Radio>
                                                    <Form.Radio value={false}>否</Form.Radio>
                                                </Form.RadioGroup>
                                            </Col>
                                        </Row>
                                        <Row>
                                            <Col span={12}>
                                                <Form.TimePicker
                                                    field="time"
                                                    label="截止时刻（TimePicker）"
                                                    style={{ width: '90%' }}
                                                />
                                            </Col>
                                            <Col span={12}>
                                                <Form.InputNumber
                                                    field="number"
                                                    label="申请数量（InputNumber）"
                                                    initValue={20}
                                                    style={style}
                                                />
                                            </Col>
                                        </Row>
                                        <Row>
                                            <Col span={12}>
                                                <Form.Slider
                                                    field="range"
                                                    label="资源使用报警阈值(%)（Slider）"
                                                    initValue={10}
                                                    style={{ width: '90%' }}
                                                />
                                            </Col>
                                            <Col span={12}>
                                                <Form.Switch field="switch" label="开关(Switch)" />
                                            </Col>
                                        </Row>
                                        <Row>
                                            <Col span={12}>
                                                <Form.Rating
                                                    field="rating"
                                                    label="满意度(Rating)"
                                                    initValue={2}
                                                    style={{ width: '90%' }}
                                                />
                                            </Col>
                                        </Row>
                                    </Form.Section>
                                    <Form.Checkbox value="false" field="agree" noLabel={true}>
                                        我已阅读并清楚相关规定（Checkbox）
                                    </Form.Checkbox>
                                    <Button type="primary" htmlType="submit" className="btn-margin-right">
                                        提交(submit)
                                    </Button>
                                    <Button htmlType="reset">重置(reset)</Button>
                                </Form>
                            </Row>
                            <Row>
                                <Col span={12}>
                                    <Tree
                                        treeData={treeData}
                                        defaultExpandAll
                                        style={{
                                            width: 260,
                                            height: 420,
                                            border: '1px solid var(--semi-color-border)'
                                        }}
                                    />
                                </Col>
                                <Col span={12}>
                                    <Transfer
                                        style={{ width: 568, height: 416 }}
                                        dataSource={transferData}
                                        onChange={(values, items) => console.log(values, items)}
                                    />
                                </Col>
                            </Row>
                            <Row id="主题商店">
                                <List
                                    grid={{
                                        gutter: 12,
                                        xs: 0,
                                        sm: 0,
                                        md: 12,
                                        lg: 8,
                                        xl: 8,
                                        xxl: 6,
                                    }}
                                    dataSource={listData}
                                    renderItem={item => (
                                        <List.Item style={listItemStyle}>
                                            <div>
                                                <h3 style={{ color: 'var(--semi-color-text-0)', fontWeight: 500 }}>
                                                    {item.title}
                                                </h3>
                                                <Descriptions
                                                    align="center"
                                                    size="small"
                                                    row
                                                    data={[
                                                        {
                                                            key: '满意度',
                                                            value: (
                                                                <Rating allowHalf size="small" value={item.rating} />
                                                            ),
                                                        },
                                                        { key: '反馈数', value: item.feedbacks },
                                                    ]}
                                                />
                                                <div
                                                    style={{
                                                        margin: '12px 0',
                                                        display: 'flex',
                                                        justifyContent: 'flex-end',
                                                    }}
                                                >
                                                    <ButtonGroup theme="borderless" style={{ marginTop: 8 }}>
                                                        <Button>编辑</Button>
                                                        <Button>更多</Button>
                                                    </ButtonGroup>
                                                </div>
                                            </div>
                                        </List.Item>
                                    )}
                                />
                                <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                                    <Descriptions align="center" data={descriptionData} style={descriptionStyle} />
                                    <Descriptions align="justify" data={descriptionData} style={descriptionStyle} />
                                    <Descriptions align="left" data={descriptionData} style={descriptionStyle} />
                                    <Descriptions align="plain" data={descriptionData} style={descriptionStyle} />
                                </div>
                                <div
                                    style={{
                                        backgroundColor: 'var(--semi-color-fill-0)',
                                        padding: 20,
                                    }}
                                >
                                    <Row gutter={[16, 16]}>
                                        <Col span={8}>
                                            <Card title="Card Title" bordered={false}>
                                                Card Content
                                            </Card>
                                        </Col>
                                        <Col span={8}>
                                            <Card title="Card Title" bordered={false}>
                                                Card Content
                                            </Card>
                                        </Col>
                                        <Col span={8}>
                                            <Card title="Card Title" bordered={false}>
                                                Card Content
                                            </Card>
                                        </Col>
                                    </Row>
                                    <Row gutter={[16, 16]}>
                                        <Col span={16}>
                                            <Card title="Card Title" bordered={false}>
                                                Card Content
                                            </Card>
                                        </Col>
                                        <Col span={8}>
                                            <Card title="Card Title" bordered={false}>
                                                Card Content
                                            </Card>
                                        </Col>
                                    </Row>
                                </div>
                            </Row>
                            <Row>
                                <Calendar mode="month" />
                            </Row>
                            <Row>
                                <Collapse className="mt12">
                                    <Collapse.Panel header="This is panel header 1" itemKey="1">
                                        <p>Hi, bytedance dance dance. This is the docsite of Semi UI. </p>
                                    </Collapse.Panel>
                                    <Collapse.Panel header="This is panel header 2" itemKey="2">
                                        <p>Hi, bytedance dance dance. This is the docsite of Semi UI. </p>
                                    </Collapse.Panel>
                                    <Collapse.Panel header="This is panel header 3" itemKey="3">
                                        <p>Hi, bytedance dance dance. This is the docsite of Semi UI. </p>
                                    </Collapse.Panel>
                                </Collapse>
                                <Tabs type="button" className="mt12">
                                    <TabPane tab="文档" itemKey="1">
                                        文档
                                    </TabPane>
                                    <TabPane tab="快速起步" itemKey="2">
                                        快速起步
                                    </TabPane>
                                    <TabPane tab="帮助" itemKey="3">
                                        帮助
                                    </TabPane>
                                </Tabs>
                                <div className="mt12" style={{ height: 200 }}>
                                    <Button onClick={() => setCollapsibleOpen(!isOpen)}>Toggle</Button>
                                    <Collapsible isOpen={isOpen}>
                                        <ul>
                                            <li>
                                                <p>Semi Design 以内容优先进行设计。</p>
                                            </li>
                                            <li>
                                                <p>更容易地自定义主题。</p>
                                            </li>
                                            <li>
                                                <p>适用国际化场景。</p>
                                            </li>
                                            <li>
                                                <p>效率场景加入人性化关怀。</p>
                                            </li>
                                        </ul>
                                    </Collapsible>
                                </div>
                                <Anchor style={{ position: 'fixed', top: 150, right: 50 }}>
                                    <Anchor.Link href="#基本示例" title="基本示例" />
                                    <Anchor.Link href="#组件" title="组件" />
                                    <Anchor.Link href="#设计语言" title="设计语言" />
                                    <Anchor.Link href="#物料平台" title="物料平台" />
                                    <Anchor.Link href="#主题商店" title="主题商店" />
                                </Anchor>
                                <BackTop style={{ bottom: 100, right: 50 }} target={() => document && document.querySelector('.semi-layout-content' || window)} visibilityHeight={-1} />
                            </Row>
                        </div>
                    </Content>
                </Layout>
                <Footer
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '20px',
                        color: 'var(--semi-color-text-2)',
                        backgroundColor: 'rgba(var(--semi-grey-0), 1)',
                    }}
                >
                    <span
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                        }}
                    >
                        <IconBytedanceLogo size="large" style={{ marginRight: '8px' }} />
                        <span>{`Copyright © ${(new Date()).getFullYear()} Semi Design. All Rights Reserved. `}</span>
                    </span>
                    <span>
                        <span style={{ marginRight: '24px' }}>平台客服</span>
                        <span>反馈建议</span>
                    </span>
                </Footer>
            </Layout>
        </>
    );
}
