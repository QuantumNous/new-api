import React from 'react';
import { Table, Avatar } from '@douyinfe/semi-ui';
import * as dateFns from 'date-fns';

/**
 * test with cypress
 */
export default function App() {
    const columns = [
        {
            title: '标题',
            dataIndex: 'name',
            width: 400,
            render: (text, record, index) => {
                return (
                    <div>
                        <Avatar size="small" shape="square" src={figmaIconUrl} style={{ marginRight: 12 }}></Avatar>
                        {text}
                    </div>
                );
            }
        },
        {
            title: '大小',
            dataIndex: 'size',
            sorter: (r1, r2, order) => {
                console.log('order', order);
                const a = r1.size;
                const b = r2.size;
                if (typeof a === "number" && typeof b === "number") {
                    return a - b; // 数字大的在前面
                } else if (typeof a === "undefined") {
                    return order === "ascend" ? 1 : -1; // undefined 在后面
                } else if (typeof b === "undefined") {
                    return order === "ascend" ? -1 : 1; // undefined 在后面
                } else {
                    return 0; // 保持原来的顺序
                }
            },
            render: text => text ? `${text} KB` : '未知',
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
            render: value => {
                return dateFns.format(new Date(value), 'yyyy-MM-dd');
            },
        },
    ];

    const figmaIconUrl = 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/figma-icon.png';
    const docIconUrl = 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png';

    const dataSource = [
        {
            key: '1',
            name: 'Semi Design 设计稿.fig',
            nameIconSrc: figmaIconUrl,
            size: 3,
            owner: '姜鹏志',
            updateTime: '2020-02-02 05:13',
            avatarBg: 'grey',
        },
        {
            key: '2',
            name: 'Semi Design 分享演示文稿',
            nameIconSrc: docIconUrl,
            size: undefined,
            owner: '郝宣',
            updateTime: '2020-01-17 05:31',
            avatarBg: 'red',
        },
        {
            key: '3',
            name: '设计文档3',
            nameIconSrc: docIconUrl,
            size: 1,
            owner: 'Zoey Edwards',
            updateTime: '2020-01-26 11:01',
            avatarBg: 'light-blue',
        },
        {
            key: '4',
            name: '设计文档4',
            nameIconSrc: docIconUrl,
            size: 5,
            owner: 'Zoey Edwards',
            updateTime: '2020-01-26 11:01',
            avatarBg: 'light-blue',
        },
        {
            key: '5',
            name: '设计文档5',
            nameIconSrc: docIconUrl,
            size: undefined,
            owner: 'Zoey Edwards',
            updateTime: '2020-01-26 11:01',
            avatarBg: 'light-blue',
        },
        {
            key: '6',
            name: '设计文档6',
            nameIconSrc: docIconUrl,
            size: 2,
            owner: 'Zoey Edwards',
            updateTime: '2020-01-26 11:01',
            avatarBg: 'light-blue',
        },
    ];

    return <Table columns={columns} dataSource={dataSource} />;
}
