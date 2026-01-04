import React from 'react';
import { Table, Typography, Tag, Popover } from '../../../../index';

const { Text } = Typography;
const src = 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/bag.jpeg';

class App extends React.Component {
    constructor(props) {
        super(props);
        this.columns = [
            {
                title: '需求标题',
                dataIndex: 'featureTitle',
                render: (text, record, index) => <a href="https://semi.design/zh-CN/show/table" rel="noreferrer" target="_blank">{text}</a>,
            },
            {
                title: '文档',
                dataIndex: 'doc',
                width: 150,
                render: (text, record, index) => (
                    <Text link ellipsis={{ showTooltip: true }} style={{ width: 150, breakWord: 'break-all' }}>
                        {text}
                    </Text>
                ),
            },
            {
                title: '需求状态',
                dataIndex: 'featureStatus',
                width: 100,
                render: (text, record, index) => (
                    <Tag style={{ width: 50 }}>
                        <Text ellipsis={{ showTooltip: true }} style={{ width: 50 }}>
                            {text}
                        </Text>
                    </Tag>
                ),
            },
            {
                title: '优先级',
                dataIndex: 'priority',
                render: (text, record, index) => (
                    <Tag>
                        {text}
                    </Tag>
                ),
            },
            {
                title: 'PM',
                dataIndex: 'pm',
                render: (text, record, index) => (
                    <Popover
                        showArrow
                        content={(
                            <article>
                                Hi ByteDancer, this is a popover.
                                <br /> We have 2 lines.
                            </article>
                        )}
                        key={index}
                    >
                        <Tag avatarSrc={src} avatarShape="circle">{text}</Tag>
                    </Popover>
                ),
            },
            {
                title: '产品线',
                dataIndex: 'productLine',
                render: (text, record, index) => (
                    <Tag>
                        <Text ellipsis={{ showTooltip: true }} style={{ width: 50 }}>
                            {text}
                        </Text>
                    </Tag>
                ),
            },
            {
                title: '前端',
                dataIndex: 'fe',
                render: (text, record, index) => (
                    <Popover
                        showArrow
                        content={(
                            <article>
                                Hi ByteDancer, this is a popover.
                                <br /> We have 2 lines.
                            </article>
                        )}
                        key={index}
                    >
                        <Tag color="blue">{text}</Tag>
                    </Popover>
                ),
            },
            {
                title: '服务端',
                dataIndex: 'server',
                render: (text, record, index) => (
                    <Popover
                        showArrow
                        content={(
                            <article>
                                Hi ByteDancer, this is a popover.
                                <br /> We have 2 lines.
                            </article>
                        )}
                        key={index}
                    >
                        <Tag avatarSrc={src}>{text}</Tag>
                    </Popover>
                ),
            },
            {
                title: '创建时间',
                dataIndex: 'createTime',
                render: (text, record, index) => (
                    <Text
                        ellipsis={{ showTooltip: true }}
                        style={{ width: 50 }}
                        onClick={() => {
                            console.log('click createTime', record);
                        }}
                    >
                        {text}
                    </Text>
                ),
            },
            {
                title: '完成时间',
                dataIndex: 'completeTime',
                render: (text, record, index) => (
                    <Text
                        ellipsis={{ showTooltip: true }}
                        style={{ width: 50 }}
                        onClick={() => {
                            console.log('click completeTime', record);
                        }}
                    >
                        {text}
                    </Text>
                ),
            },
        ];

        this.data = Array.from(
            {
                length: 100,
            },
            (_, key) => {
                const rowRandom = Math.round(Math.random() * 1000);
                const prioritySet = ['P0', 'P1', 'P2'];
                const priority = prioritySet[Math.round(Math.random() * 2)];
                const featureStatusSet = ['待埋点', '开始', '待需详评', '测试', '已完成'];
                const featureStatus = featureStatusSet[Math.round(Math.random() * 4)];
                const doc = 'https://semi.design';
                const createTime = new Date().valueOf();
                return ({
                    key,
                    featureTitle: `需求-${rowRandom}`,
                    doc,
                    featureStatus,
                    priority,
                    pm: 'Li',
                    productLine: 'Hotsoon',
                    fe: '石嘉',
                    server: 'ZhuYi',
                    createTime,
                    completeTime: createTime + rowRandom,
                });
            }
        );
        this.scroll = { y: 500 };
    }

    render() {
        return (
            <>
                <Table
                    title={`数据条数：${this.data.length}`}
                    rowSelection
                    columns={this.columns}
                    dataSource={this.data}
                    pagination={false}
                    scroll={this.scroll}
                    resizable
                    bordered
                />
            </>
        );
    }
}

export default App;
