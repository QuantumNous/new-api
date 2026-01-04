import React from 'react';
import { Table, Tooltip, Tag, Space, Typography, Switch } from '../../index';
import RTLWrapper from '../../configProvider/_story/RTLDirection/RTLWrapper';

function App() {
    const [bordered, setBordered] = React.useState(true);
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
            fixed: true,
            width: 150,
            sorter: (a, b) => (a.age - b.age > 0 ? 1 : -1),
        },
        {
            title: 'Address',
            width: 200,
            dataIndex: 'address',
        },
        // {
        //     title: 'Address2',
        //     width: 200,
        //     dataIndex: 'address',
        // },
        // {
        //     title: 'Address3',
        //     width: 200,
        //     dataIndex: 'address',
        // },
        // {
        //     title: 'Address4',
        //     width: 200,
        //     dataIndex: 'address',
        // },
        // {
        //     title: 'Address5',
        //     width: 200,
        //     dataIndex: 'address',
        // },
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
        const age = (i * 1000) % 149 ;
        const name = `Edward King ${i}`;
        data.push({
            key: `${ i}`,
            name,
            age,
            address: `London, Park Lane no. ${i}`,
            description: `My name is ${name}, I am ${age} years old, living in New York No. ${i + 1} Lake Park.`,
        });
    }
    
    const allColumnsWidth = columns.reduce((count, column) => count + column.width, 0);

    const tableProps = {
        pagination: false,
        columns,
        bordered,
        dataSource: data,
    };

    return (
        <RTLWrapper>
            <div style={{ textAlign: 'left', marginBottom: 12 }}>
                <Space>
                    <Typography.Title heading={6}>边框</Typography.Title>
                    <Switch onChange={() => setBordered(!bordered)} checked={bordered} />
                </Space>
            </div>
            <Table
                {...tableProps}
                scroll={{ y: 400 }}
            />
            <br />
            <Table
                {...tableProps}
                title="虚拟化表格"
                scroll={{ y: 400, x: allColumnsWidth }}
                style={{ width: allColumnsWidth }}
                virtualized
            />
        </RTLWrapper>
    );
}

export default App;