import React from 'react';
import { Table } from '@douyinfe/semi-ui';

export default function App() {
    const columns = [
        {
            title: 'Key',
            dataIndex: 'dataKey',
            key: 'dataKey',
        },
        {
            title: '名称',
            dataIndex: 'name',
            key: 'name',
            width: 200,
        },
        {
            title: '数据类型',
            dataIndex: 'type',
            key: 'type',
            width: 400,
        },
    ];
    const data = [
        {
            key: 99,
            dataKey: 99,
            name: 'row 99',
            children: [],
        },
        {
            key: 2,
            dataKey: 'text_info',
            name: '文本信息',
            type: 'Object 对象',
            description: '视频的元信息',
            default: '无',
            children: [
                {
                    key: 21,
                    dataKey: 'title',
                    name: '视频标题',
                    type: 'String 字符串',
                    description: '视频的标题',
                    default: '无',
                },
            ],
        },
    ];
    return <div>
        <Table expandIcon={false} defaultExpandAllRows columns={columns} dataSource={data} />
        <Table defaultExpandAllRows columns={columns} dataSource={data} />
    </div>;
}