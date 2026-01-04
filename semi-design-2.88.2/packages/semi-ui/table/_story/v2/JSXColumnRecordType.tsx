import React, { useMemo } from 'react';
import { Table, Avatar } from '@douyinfe/semi-ui';
import { IconMore } from '@douyinfe/semi-icons';

interface Data {
    key: string;
    name: string;
    nameIconSrc: string;
    size: string;
    owner: string;
    updateTime: string;
    avatarBg: string
}

export function App() {
    const data = useMemo(
        () => [
            {
                key: '1',
                name: 'Semi Design 设计稿.fig',
                nameIconSrc:
                    'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/figma-icon.png',
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
        ],
        []
    );

    return (
        <Table<Data> dataSource={data} pagination={false}>
            <Table.Column<Data>
                title="标题"
                dataIndex="name"
                key="name"
                render={(text, record, index) => {
                    const { nameIconSrc } = record;
                    return (
                        <div>
                            <Avatar size="small" shape="square" src={nameIconSrc} style={{ marginRight: 12 }}></Avatar>
                            {text}
                        </div>
                    );
                }}
            />
            <Table.Column<Data> title="大小" dataIndex="size" key="size" />
            <Table.Column<Data>
                title="所有者"
                dataIndex="owner"
                key="owner"
                render={(text, record, index) => {
                    const { avatarBg } = record;
                    return (
                        <div>
                            <Avatar size="small" color={avatarBg as any} style={{ marginRight: 4 }}>
                                {typeof text === 'string' && text.slice(0, 1)}
                            </Avatar>
                            {text}
                        </div>
                    );
                }}
            />
            <Table.Column<Data> title="更新时间" dataIndex="updateTime" key="updateTime" />
            <Table.Column<Data> title="" dataIndex="operate" key="operate" render={() => <IconMore />} />
        </Table>
    );
}
