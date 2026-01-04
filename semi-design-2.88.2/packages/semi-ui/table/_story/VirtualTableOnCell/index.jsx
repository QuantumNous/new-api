import React from 'react';
import { Table, Tag, Tooltip } from '@douyinfe/semi-ui';

export default class VirtualizedFixedDemo extends React.Component {
    constructor(props = {}) {
        super(props);

        this.columns = [
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
                onCell: (record, index) => {
                    return {
                        style: { color: 'red' },
                        className: 'test-red'
                    };
                }
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

        this.data = [];

        for (let i = 0; i < 1000; i++) {
            let age = (i * 1000) % 149 ;
            let name = `Edward King ${i}`;
            this.data.push({
                key: '' + i,
                name,
                age,
                address: `London, Park Lane no. ${i}`,
                description: `My name is ${name}, I am ${age} years old, living in New York No. ${i + 1} Lake Park.`,
            });
        }

        this.scroll = { y: 400, x: 800 };
        this.style = { width: 750, margin: '0 auto' };
    }

    render() {
        return (
            <Table
                pagination={false}
                columns={this.columns}
                dataSource={this.data}
                scroll={this.scroll}
                style={this.style}
                virtualized
            />
        );
    }
}
