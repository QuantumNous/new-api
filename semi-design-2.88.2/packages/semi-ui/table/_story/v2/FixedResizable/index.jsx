import React, { useState } from 'react';
import { Table, Avatar, Button, Space } from '@douyinfe/semi-ui';
import { IconMore } from '@douyinfe/semi-icons';

const columns = [
    {
        title: '标题',
        dataIndex: 'name',
        width: 300,
        key: 'name',
        render: (text, record, index) => {
            return (
                <div>
                    <Avatar size="small" shape="square" src={record.nameIconSrc} style={{ marginRight: 12 }}></Avatar>
                    {text}
                </div>
            );
        },
    },
    {
        title: '大小',
        dataIndex: 'size',
        key: 'size',
        width: 200,
    },
    {
        title: '所有者',
        dataIndex: 'owner',
        key: 'owner',
        width: 200,
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
        key: 'updateTime',
        width: 200,
    },
    {
        title: '',
        dataIndex: 'operate',
        key: 'operate',
        render: () => {
            return <IconMore />;
        },
    },
];

/**
 * fix https://github.com/DouyinFE/semi-design/issues/650
 */
App.storyName = 'fixed resizable column width bug';
App.parameters = { chromatic: { disableSnapshot: true } };
function App() {
    const [cols, setCols] = useState(columns);

    const onClickHandle = () => {
        const localCols = [...cols].filter((i, index) => index !== 1);
        setCols(localCols);
    };

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

    return (
        <>
            <Space>
                <Button onClick={onClickHandle}>减少一列</Button>
                <Button theme="solid" onClick={() => setCols(columns)}>
                    reset
                </Button>
            </Space>
            <Table columns={cols} dataSource={data} pagination={false} resizable />
        </>
    );
}

export default App;
