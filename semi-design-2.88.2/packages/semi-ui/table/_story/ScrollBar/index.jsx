import React, { useCallback, useState } from 'react';
import { Table, Switch, Typography, Tooltip, Tag } from '../../../index';
import { getData } from '../../../_test_/utils/table';

const { Title } = Typography;

export default function App(props) {
    const [bordered, setBorder] = useState(false);
    const columns = [
        {
            title: 'Name',
            dataIndex: 'name',
            width: 150,
            fixed: true,
            filters: [
                {
                    text: 'King 3',
                    value: 'King 3',
                },
                {
                    text: 'King 4',
                    value: 'King 4',
                },
            ],
            onFilter: (value, record) => record.name.includes(value),
        },
        {
            title: 'Age',
            dataIndex: 'age',
            width: 150,
            sorter: (a, b) => (a.age - b.age > 0 ? 1 : -1),
        },
        {
            title: 'Address',
            width: 200,
            dataIndex: 'address',
        },
        {
            title: 'Description',
            // width: 400,
            dataIndex: 'description',
        },
        {
            fixed: 'right',
            width: 250,
            render: (text, record) => (
                <Tooltip content={record.description}>
                    <Tag color="green">Show Info</Tag>
                </Tooltip>
            ),
        },
    ];

    const data = getData(12);
    const scroll = { y: 300, x: '120%' };
    const handleChange = useCallback(checked => {
        setBorder(checked);
    }, []);

    return (
        <>
            <div style={{ display: 'flex', alignItems: 'center' }}>
                <Title heading={6} style={{ margin: 8 }}>
                    {bordered ? '已显示border' : '已隐藏border'}
                </Title>
                <Switch onChange={handleChange}>border</Switch>
            </div>
            <Table bordered={bordered} columns={columns} dataSource={data} scroll={scroll} />
        </>
    );
}
