import React from 'react';
import { Table } from '@douyinfe/semi-ui';

App.storyName = 'word break - fixed table';
export default function App() {
    const columns = [
        {
            title: '标题',
            dataIndex: 'name',
            fixed: true,
            width: 300,
        },
        {
            title: '所有者',
            dataIndex: 'owner',
            width: 300,
        },
        {
            title: '大小',
            dataIndex: 'size',
        },
        {
            title: '更新日期',
            dataIndex: 'updateTime',
            width: 300,
            fixed: 'right',
        },
    ];
    const data = [
        {
            key: '1',
            name: 'Maintained by the Douyin front-end and UED teams, an easy-to-customize modern design system that helps designers and developers create high-quality products.',
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
            owner: 'Jiang_Pengzhi_Jiang_Pengzhi_Jiang_Pengzhi_Jiang_Pengzhi_Jiang_Pengzhi_Jiang_Pengzhi_Jiang_Pengzhi_Jiang_Pengzhi',
            updateTime: '2020-02-02 05:13',
            avatarBg: 'red',
        },
        {
            key: '3',
            name: 'Semi uses a variety of methods such as unit testing to ensure the stability and quality of components, and the code coverage rate reaches 90%',
            nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png',
            size: '34KB',
            owner: 'Zoey Edwards Zoey Edwards Zoey Edwards Zoey Edwards Zoey Edwards Zoey Edwards Zoey Edwards Zoey Edwards Zoey Edwards',
            updateTime: '2020-02-02 05:13',
            avatarBg: 'light-blue',
        },
    ];

    return <Table style={{ width: 1000 }} scroll={{ x: 1200 }} columns={columns} dataSource={data} pagination={false} />;
}