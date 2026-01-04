import React, { useState } from 'react';
import { Table, Tag, Tooltip, Button } from '../../../index';

export default function App() {
    const [data, setData] = useState([]);

    const loadData = () => {
        if (Array.isArray(data) && data.length > 0) {
            setData([]);
            return;
        }

        const newData = [];
        for (let i = 0; i < 10000; i++) {
            const age = (i * 1000) % 149;
            const name = `Edward King ${i}`;
            newData.push({
                key: '' + i,
                name,
                age,
                address: `London, Park Lane no. ${i}`,
                description: `My name is ${name}, I am ${age} years old, living in New York No. ${i + 1} Lake Park.`,
            });
        }

        setData(newData);
    };

    const scroll = { y: 600, x: 1600 };
    const style = { width: 800 };
    const columns = [
        {
            title: 'Name',
            dataIndex: 'name',
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
            dataIndex: 'age',
            width: 150,
            sorter: (a, b) => (a.age - b.age > 0 ? 1 : -1),
        },
        {
            title: 'Address',
            // width: 200,
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
    return (
        <div>
            <Button onClick={loadData}>load data</Button>
            <Table pagination={false} columns={columns} dataSource={data} scroll={scroll} style={style} virtualized />
        </div>
    );
}
