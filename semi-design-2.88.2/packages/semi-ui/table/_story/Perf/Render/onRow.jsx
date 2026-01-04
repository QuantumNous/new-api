import React from 'react';
import { Table, Switch } from '../../../../index';

class App extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            value: false,
        };
        this.columns = [
            {
                title: '需求标题',
                dataIndex: 'featureTitle',
            },
            {
                title: '文档',
                dataIndex: 'doc',
            },
            {
                title: '需求状态',
                dataIndex: 'featureStatus',
            },
            {
                title: '优先级',
                dataIndex: 'priority',
            },
            {
                title: 'PM',
                dataIndex: 'pm',
            },
            {
                title: '产品线',
                dataIndex: 'productLine',
            },
            {
                title: '前端',
                dataIndex: 'fe',
            },
            {
                title: '服务端',
                dataIndex: 'server',
            },
            {
                title: '创建时间',
                dataIndex: 'createTime',
            },
            {
                title: '完成时间',
                dataIndex: 'completeTime',
            },
            {
                title: '操作',
                dataIndex: 'operate',
                render: (text, record) => <Switch onChange={value => this.setState({ value })} />
            },
        ];
        this.data = Array.from(
            {
                length: 12,
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
                    operate: '',
                });
            }
        );
        this.onRow = (record, index) => {
            console.log('render row', index);
            return ({
                onClick: () => console.log('click row', record),
            });
        };
        this.scroll = { y: 300 };
    }

    render() {
        const { value } = this.state;
        return (
            <>
                <div>{`switch value: ${value}`}</div>
                <Table
                    title={`数据条数：${this.data.length}`}
                    rowSelection
                    columns={this.columns}
                    dataSource={this.data}
                    onRow={this.onRow}
                    scroll={this.scroll}
                />
            </>
        );
    }
}

export default App;
