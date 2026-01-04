import React, { useMemo } from 'react';
import { Table } from '../../../index';

export default function Demo() {
    const columns = [
        {
            title: 'Base Information',
            fixed: 'left',
            children: [
                {
                    title: 'Name',
                    dataIndex: 'name',
                    fixed: 'left',
                    width: 200,
                    filters: [
                        {
                            text: '',
                            value: '',
                        },
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
                    fixed: 'left',
                    width: 100,
                    sorter: (a, b) => (a.age - b.age > 0 ? 1 : -1),
                },
            ],
        },
        {
            title: 'Company Information',
            children: [
                {
                    title: 'Company Name',
                    dataIndex: 'company.name',
                    width: 200,
                },
                {
                    title: 'Company Address',
                    dataIndex: 'company.address',
                },
            ],
        },
        {
            title: 'Address',
            width: 250,
            dataIndex: 'address',
            fixed: 'right',
        },
    ];

    const data = useMemo(() => {
        const data = [];
        for (let i = 0; i < 100; i++) {
            let age = (i * 1000) % 149 ;
            let name = `Edward King ${i}`;
            data.push({
                key: '' + i,
                company: {
                    name: 'ByteDance',
                    address: 'No. 48, Zhichun Road',
                },
                name,
                age,
                address: `London, Park Lane no. ${i}`,
                description: `My name is ${name}, I am ${age} years old, living in New York No. ${i + 1} Lake Park.`,
            });
        }
        return data;
    });

    return (
        <Table
            resizable={{
                onResize: (...args) => console.log(...args),
            }}
            rowSelection={{ fixed: true }}
            expandedRowRender={record => <article>{record.description}</article>}
            columns={columns}
            dataSource={data}
            scroll={{ x: '150%', y: 500 }}
            onChange={(...args) => console.log(...args)}
        />
    );
}
