import React from 'react';
import { Table, Tooltip, Tag } from '../../index';

function App() {
    const columns = [
        {
            title: 'Name',
            dataIndex: 'name',
        },
        {
            title: 'Age',
            dataIndex: 'age',
        },
        {
            title: 'Address',
            dataIndex: 'address',
        },
        {
            title: 'Description',
            dataIndex: 'description',
        },
        {
            dataIndex: 'x',
            render: (text, record) => (
                <Tooltip content={record.description}>
                    <Tag color="green">Show Info</Tag>
                </Tooltip>
            ),
        },
    ];

    const data = [];

    for (let i = 0; i < 8; i++) {
        const age = (i * 1000) % 149 ;
        const name = `Edward King ${i}`;
        data.push({
            key: `${i}`,
            name,
            age,
            address: `London, Park Lane no. ${i}`,
            address2: `London, Park Lane no. ${i}`,
            description: `My name is ${name}`,
        });
    }

    const scroll = { y: 300 };

    return <Table bordered columns={columns} dataSource={data} scroll={scroll} pagination={false} />;
}

export default App;