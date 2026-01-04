import React from 'react';
import { Table, Tooltip, Tag } from '@douyinfe/semi-ui';

App.storyName = 'fixed z-index bug';
export default function App() {
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
            render: (text, record) => <Tooltip content={record.description}><Tag color="green">Show Info</Tag></Tooltip>
        }
    ];

    let data = [];

    const rowSelection = {
        onChange: (selectedRowKeys, selectedRows) => {
            // console.log(`selectedRowKeys: ${selectedRowKeys}`, 'selectedRows: ', selectedRows);
        },
        getCheckboxProps: record => ({
            disabled: record.name === 'Michael James', // Column configuration not to be checked
            name: record.name,
        }),
        // fixed: true,
    };

    for (let i = 0; i < 46; i++) {
        let age = (i * 1000) % 149;
        let name = `Edward King ${i}`;
        data.push({
            key: `${ i}`,
            name,
            age,
            address: `London, Park Lane no. ${i}`,
            description: `My name is ${name}, I am ${age} years old, living in New York No. ${i + 1} Lake Park.`,
        });
    }

    const scroll = { y: 300, x: 1500 };

    return (
        <div style={{ position: 'relative', height: '100vh' }}>
            <div style={{ height: 60, background: 'red', position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2 }}>
                Fixed Header
            </div>
            <Table
                columns={columns}
                dataSource={data}
                scroll={scroll}
                rowSelection={rowSelection}
            />
        </div>
    );
}