import React, { useMemo, useCallback } from 'react';
import { Table, Tag, Tooltip } from '../../../index';

class VirtualizedFixedDemo extends React.Component {
    constructor(props = {}) {
        super(props);
        this.virtualizedListRef = React.createRef();
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

        this.rowSelection = {
            fixed: true,
        };

        for (let i = 0; i < 10000; i++) {
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

        this.scroll = { y: 600, x: 1600, scrollToFirstRowOnChange: true };
        this.style = { width: 800 };
    }

    render() {
        return (
            <>
                <div onClick={() => this.virtualizedListRef.current.scrollToItem(100)}>
                    scroll to 100
                </div>
                <Table
                    size={'small'}
                    pagination={false}
                    columns={this.columns}
                    dataSource={this.data}
                    scroll={this.scroll}
                    style={this.style}
                    rowSelection={this.rowSelection}
                    virtualized
                    getVirtualizedListRef={ref => this.virtualizedListRef = ref}
                />
            </>
        );
    }
}

export default VirtualizedFixedDemo;
