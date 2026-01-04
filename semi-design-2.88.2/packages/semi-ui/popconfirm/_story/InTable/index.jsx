import React, { useMemo, useState } from 'react';
import { Table, Popconfirm, Tag, Tooltip, Button } from '@douyinfe/semi-ui/';

export default function Demo(props = {}) {
    const dataTotalSize = 46;

    const columns = useMemo(
        () => [
            {
                title: 'Name',
                dataIndex: 'name',
                width: 150,
            },
            {
                title: 'Age',
                dataIndex: 'age',
                width: 150,
            },
            {
                title: 'Address',
                dataIndex: 'address',
            },
            {
                align: 'left',
                render: (text, record) => (
                    <Popconfirm title={record.descriptionZh} content={record.descriptionZh} position={'leftTop'}>
                        <Tag color="green">Show Info</Tag>
                    </Popconfirm>
                ),
                width: 350,
            },
            {
                align: 'center',
                dataIndex: 'op',
                title: '设置',
                render: (text, record) => (
                    <>
                        <Button icon={'user'} />
                        <Popconfirm
                            title={record.descriptionZh}
                            content={record.descriptionZh}
                            position="left"
                            style={{ width: 330 }}
                        >
                            <Button type="danger" style={{ position: 'relative' }}>
                                Show Info
                            </Button>
                        </Popconfirm>
                    </>
                ),
                width: 150,
            },
        ],
        []
    );

    const data = useMemo(() => {
        const _data = [];
        for (let i = 0; i < dataTotalSize; i++) {
            let age = 40 + (Math.random() > 0.5 ? 1 : -1) * Math.ceil(i / 3);
            let name = `Edward King ${i}`;
            _data.push({
                key: '' + i,
                name,
                age,
                address: `London, Park Lane no. ${i} Lake Park`,
                description: `My name is ${name}, I am ${age} years old, living in New York No. ${i + 1} Lake Park.`,
                descriptionZh: `我的名字叫做 ${name}，${age}岁，住在中关村大街${i + 1}号`,
            });
        }
        return _data;
    }, []);

    return <Table columns={columns} dataSource={data} />;
}
