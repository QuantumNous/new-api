import React from 'react';
import { Table, Tooltip, Tag } from '../../index';

function App() {
    const columns = [
        {
            title: 'Name',
            width: 150,
            fixed: true,
            filters: [
                {
                    text: 'Code 45',
                    value: '45',
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
            fixed: true,
            width: 150,
            sorter: (a, b) => (a.age - b.age > 0 ? 1 : -1),
        },
        {
            title: 'Address',
            width: 200,
            dataIndex: 'address',
        },
        {
            fixed: 'right' as const,
            width: 250,
            render: (text, record) => (
                <Tooltip content={record.description}>
                    <Tag color="green">Show Info</Tag>
                </Tooltip>
            ),
        },
    ];
    
    const data = [];
    
    for (let i = 0; i < 10; i++) {
        const age = 40 + (Math.random() > 0.5 ? 1 : -1) * (i % 9);
        const name = `Edward King ${i}`;
        data.push({
            key: `${ i}`,
            name,
            age,
            address: `London, Park Lane no. ${i}`,
            description: `My name is ${name}, I am ${age} years old, living in New York No. ${i + 1} Lake Park.`,
        });
    }
    
    const tableProps = {
        pagination: false,
        columns,
        dataSource: data,
    };

    return (
        <Table
            {...tableProps}
        />
    );
}

export default App;