import React from 'react';
import { Table } from '@douyinfe/semi-ui';
import { ColumnProps } from '../../../interface';

App.storyName = 'fixed column align';
export default function App() {
    const columns: ColumnProps[] = [
        {
            title: '标题',
            dataIndex: 'name',
            align: 'center'
        },
        {
            title: '列名有点宽需要缩略列名有点宽需要缩略',
            dataIndex: 'size',
            align: 'center',
            sorter: (a, b) => (a.size - b.size > 0 ? 1 : -1),
            ellipsis: true,
        },
        {
            title: '所有者',
            dataIndex: 'owner',
            align: 'right'
        },
        {
            title: '更新日期列名有点宽需要缩略',
            dataIndex: 'updateTime',
            align: 'right',
            sorter: (a, b) => (a.size - b.size > 0 ? 1 : -1),
            ellipsis: true,
        },
    ];
    const data = [
        {
            key: '1',
            name: 'Semi Design 设计稿.fig',
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
    ];

    return <Table style={{ width: 800 }} columns={columns} dataSource={data} pagination={false} />;
}