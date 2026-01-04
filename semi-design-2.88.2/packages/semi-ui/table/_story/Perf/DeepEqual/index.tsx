import React, { useEffect, useState } from 'react';
import { Table, Typography, Tag, Popover, Button, Switch } from '@douyinfe/semi-ui';
import { cloneDeep } from 'lodash';
import { ColumnProps } from 'table/interface';

export default function App() {
    const [count, setCount] = useState(100);
    const [data, setData] = useState([]);

    const handleSwitchChange = (options: { checked; record; index }) => {
        const { checked, index } = options;
        const newData = cloneDeep(data);
        newData[index].completeStatus = checked;
        setData(newData);
    };

    const src = 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/bag.jpeg';

    const shouldCellUpdate: ColumnProps['shouldCellUpdate'] = (props, prevProps) => {
        return props.record !== prevProps.record;
    };

    const columns: ColumnProps[] = [
        {
            title: '需求标题',
            dataIndex: 'featureTitle',
            render: (text, record, index) => (
                <a rel="noreferrer" href="https://semi.design/zh-CN/show/table" target="_blank">
                    {text}
                </a>
            ),
            filterIcon: <div>test</div>,
            shouldCellUpdate
        },
        {
            title: '文档',
            dataIndex: 'doc',
            width: 150,
            render: (text, record, index) => (
                <Typography.Text link ellipsis={{ showTooltip: true }} style={{ width: 150, breakWord: 'break-all' }}>
                    {text}
                </Typography.Text>
            ),
            shouldCellUpdate
        },
        {
            title: '需求状态',
            dataIndex: 'featureStatus',
            width: 100,
            render: (text, record, index) => (
                <Tag style={{ width: 50 }}>
                    <Typography.Text ellipsis={{ showTooltip: true }} style={{ width: 50 }}>
                        {text}
                    </Typography.Text>
                </Tag>
            ),
            shouldCellUpdate
        },
        {
            title: '优先级',
            dataIndex: 'priority',
            render: (text, record, index) => <Tag>{text}</Tag>,
            shouldCellUpdate
        },
        {
            title: 'PM',
            dataIndex: 'pm',
            render: (text, record, index) => (
                <Popover
                    showArrow
                    content={
                        <article>
                            Hi ByteDancer, this is a popover.
                            <br /> We have 2 lines.
                        </article>
                    }
                    key={index}
                >
                    <Tag avatarSrc={src} avatarShape="circle">
                        {text}
                    </Tag>
                </Popover>
            ),
            shouldCellUpdate
        },
        {
            title: '产品线',
            dataIndex: 'productLine',
            render: (text, record, index) => (
                <Tag>
                    <Typography.Text ellipsis={{ showTooltip: true }} style={{ width: 50 }}>
                        {text}
                    </Typography.Text>
                </Tag>
            ),
            shouldCellUpdate
        },
        {
            title: '前端',
            dataIndex: 'fe',
            render: (text, record, index) => (
                <Popover
                    showArrow
                    content={
                        <article>
                            Hi ByteDancer, this is a popover.
                            <br /> We have 2 lines.
                        </article>
                    }
                    key={index}
                >
                    <Tag color="blue">{text}</Tag>
                </Popover>
            ),
            shouldCellUpdate
        },
        {
            title: '服务端',
            dataIndex: 'server',
            render: (text, record, index) => (
                <Popover
                    showArrow
                    content={
                        <article>
                            Hi ByteDancer, this is a popover.
                            <br /> We have 2 lines.
                        </article>
                    }
                    key={index}
                >
                    <Tag avatarSrc={src}>{text}</Tag>
                </Popover>
            ),
            shouldCellUpdate
        },
        {
            title: '创建时间',
            dataIndex: 'createTime',
            render: (text, record, index) => (
                <Typography.Text
                    ellipsis={{ showTooltip: true }}
                    style={{ width: 50 }}
                    onClick={() => {
                        console.log('click createTime', record);
                    }}
                >
                    {text}
                </Typography.Text>
            ),
            shouldCellUpdate
        },
        {
            title: '完成时间',
            dataIndex: 'completeTime',
            render: (text, record, index) => (
                <Typography.Text
                    ellipsis={{ showTooltip: true }}
                    style={{ width: 50 }}
                    onClick={() => {
                        console.log('click completeTime', record);
                    }}
                >
                    {text}
                </Typography.Text>
            ),
            shouldCellUpdate
        },
        {
            title: '完成状态',
            dataIndex: 'completeStatus',
            render: (text, record, index) => (
                <Switch
                    checked={record.completeStatus}
                    onChange={checked => handleSwitchChange({ checked, record, index })}
                ></Switch>
            ),
            shouldCellUpdate
        },
    ];

    useEffect(() => {
        const getData = () => {
            const data = Array.from(
                {
                    length: count,
                },
                (_, key) => {
                    const rowRandom = Math.round(Math.random() * 1000);
                    const prioritySet = ['P0', 'P1', 'P2'];
                    const priority = prioritySet[Math.round(Math.random() * 2)];
                    const featureStatusSet = ['待埋点', '开始', '待需详评', '测试', '已完成'];
                    const featureStatus = featureStatusSet[Math.round(Math.random() * 4)];
                    const doc = 'https://semi.design';
                    const createTime = new Date().valueOf();
                    return {
                        key,
                        featureTitle: `需求-${rowRandom}`,
                        doc,
                        featureStatus,
                        priority,
                        pm: 'Li',
                        productLine: 'Hotsoon',
                        fe: '姜鹏志',
                        server: 'ZhuYi',
                        createTime,
                        completeTime: createTime + rowRandom,
                        completeStatus: false,
                    };
                }
            );
            return data;
        };

        const newData = getData();
        setData(newData);
    }, [count]);

    const scroll = { y: 500 };

    return (
        <>
            <div>
                <Button onClick={() => setCount(count * 2)}>count * 2</Button>
            </div>
            <Table
                title={`数据条数：${data.length}`}
                rowSelection
                columns={columns}
                dataSource={data}
                pagination={false}
                scroll={scroll}
            />
        </>
    );
}
