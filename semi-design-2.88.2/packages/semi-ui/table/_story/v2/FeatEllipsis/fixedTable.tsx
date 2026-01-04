import React from 'react';
import { Table } from '@douyinfe/semi-ui';

App.storyName = 'ellipsis - fixed table';
/**
 * test with cypress
 */
export default function App() {
    const columns = [
        {
            title: '标题标题标题标题标题标题标题标题标题标题标题标题标题标题标题标题',
            dataIndex: 'name',
            fixed: true,
            width: 300,
            filters: [
                {
                    text: 'Semi Design 设计稿',
                    value: 'Semi Design 设计稿',
                },
                {
                    text: 'Semi Pro 设计稿',
                    value: 'Semi Pro 设计稿',
                },
            ],
            onFilter: (value, record) => record.name.includes(value),
            sorter: (a, b) => (a.name.length - b.name.length > 0 ? 1 : -1),
            ellipsis: true,
        },
        {
            title: '所有者',
            dataIndex: 'owner',
            width: 300,
            ellipsis: true,
            filters: [
                {
                    text: 'Semi Design 设计稿',
                    value: 'Semi Design 设计稿',
                },
                {
                    text: 'Semi Pro 设计稿',
                    value: 'Semi Pro 设计稿',
                },
            ],
            onFilter: (value, record) => record.name.includes(value),
            sorter: (a, b) => (a.name.length - b.name.length > 0 ? 1 : -1),
        },
        {
            title: '大小大小大小大小大小大小大小大小大小大小大小大小大小大小',
            dataIndex: 'size',
            sorter: (a, b) => (a.name.length - b.name.length > 0 ? 1 : -1),
            ellipsis: true,
        },
        {
            title: '更新日期',
            dataIndex: 'updateTime',
            width: 300,
            fixed: 'right',
            ellipsis: true,
        },
    ];
    const data = [
        {
            key: '1',
            name: 'Jiang_Pengzhi_Jiang_Pengzhi_Jiang_Pengzhi_Jiang_Pengzhi_Jiang_Pengzhi_Jiang_Pengzhi_Jiang_Pengzhi_Jiang_Pengzhi',
            nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/figma-icon.png',
            size: '2M',
            owner: 'Jiang_Pengzhi_Jiang_Pengzhi_Jiang_Pengzhi_Jiang_Pengzhi_Jiang_Pengzhi_Jiang_Pengzhi_Jiang_Pengzhi_Jiang_Pengzhi',
            updateTime: '2020-02-02 05:13',
            avatarBg: 'grey',
        },
        {
            key: '2',
            name: 'Semi is designed based on FA architecture, and the main logic is extracted as Foundation package, which is easy to migrate to other frameworks',
            nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png',
            size: '2M',
            owner: 'Semi is designed based on FA architecture, and the main logic is extracted as Foundation package, which is easy to migrate to other frameworks',
            updateTime: '2020-02-02 05:13',
            avatarBg: 'red',
        },
        {
            key: '3',
            name: '由抖音前端与 UED 团队维护，易于定制的现代化设计系统，帮助设计师与开发者打造高质量产品。由抖音前端与 UED 团队维护，易于定制的现代化设计系统，帮助设计师与开发者打造高质量产品。',
            nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png',
            size: '34KB',
            owner: 'LiveCode 允许你使用在线代码编辑器即时演示你的 UI 组件 LiveCode 允许你使用在线代码编辑器即时演示你的 UI 组件 LiveCode 允许你使用在线代码编辑器即时演示你的 UI 组件',
            updateTime: '2020-02-02 05:13',
            avatarBg: 'light-blue',
        },
        {
            key: '4',
            name: '由抖音前端与 UED 团队维护，易于定制的现代化设计系统，帮助设计师与开发者打造高质量产品。由抖音前端与 UED 团队维护，易于定制的现代化设计系统，帮助设计师与开发者打造高质量产品。',
            nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png',
            size: '34KB',
            owner: 'LiveCode 允许你使用在线代码编辑器即时演示你的 UI 组件 LiveCode 允许你使用在线代码编辑器即时演示你的 UI 组件 LiveCode 允许你使用在线代码编辑器即时演示你的 UI 组件',
            updateTime: '2020-02-02 05:13',
            avatarBg: 'light-blue',
        },
    ];

    return <Table style={{ width: 1000 }} scroll={{ x: 1200 }} columns={columns} dataSource={data} pagination={false} />;
}