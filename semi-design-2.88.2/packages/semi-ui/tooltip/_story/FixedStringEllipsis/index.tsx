import React from 'react';
import { Table, Tooltip } from '../../..';

export default function App() {
    const columns = [
        {
            title: 'Key',
            dataIndex: 'dataKey',
            key: 'dataKey',
            ellipsis: { showTitle: false },
            render: text => <Tooltip arrowPointAtCenter={false} content={text} position="topLeft">{text}</Tooltip>,
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
        {
            title: '描述',
            dataIndex: 'description',
            key: 'description',
        },
        {
            title: '默认值',
            dataIndex: 'default',
            key: 'default',
            width: 100,
        },
    ];

    const data = [
        {
            key: 1,
            dataKey: 'videos_infovideos_infovideos_infovideos_infovideos_infovideos_infovideos_infovideos_infovideos_info',
            name: '视频信息',
            type: 'Object 对象',
            description: '视频的元信息',
            default: '无',
            children: [
                {
                    key: 11,
                    dataKey: 'status',
                    name: '视频状态',
                    type: 'Enum <Integer> 枚举',
                    description: '视频的可见、推荐状态',
                    default: '1',
                },
                {
                    key: 12,
                    dataKey: 'vid',
                    name: '视频 ID',
                    type: 'String 字符串',
                    description: '标识视频的唯一 ID',
                    default: '无',
                    children: [
                        {
                            dataKey: 'video_url',
                            name: '视频地址',
                            type: 'String 字符串',
                            description: '视频的唯一链接',
                            default: '无',
                        },
                    ],
                },
            ],
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
                {
                    key: 22,
                    dataKey: 'video_description',
                    name: '视频描述',
                    type: 'String 字符串',
                    description: '视频的描述',
                    default: '无',
                },
            ],
        },
    ];

    return <Table columns={columns} defaultExpandAllRows dataSource={data} />;
}