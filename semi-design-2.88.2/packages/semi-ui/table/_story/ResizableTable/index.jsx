import React from 'react';
import { Table, Tooltip, Tag } from '@douyinfe/semi-ui';

/**
 * test with cypress, don't modify
 */
export default class ResizableDemo extends React.Component {
    constructor() {
        super();
        this.columns = [
            {
                title: 'Name',
                dataIndex: 'name',
                width: 150,
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
                onHeaderCell: (column, columnIndex) => ({
                    className: `test-${columnIndex}`,
                })
            },
            {
                title: 'Age',
                dataIndex: 'age',
                width: 150,
                sorter: (a, b) => (a.age - b.age > 0 ? 1 : -1),
                onHeaderCell: (column, columnIndex) => ({
                    className: `test-${columnIndex}`,
                })
            },
            {
                title: 'Address',
                width: 200,
                dataIndex: 'address',
            },
            {
                render: (text, record) => (
                    <Tooltip content={record.description}><Tag color="green">Show Info</Tag></Tooltip>
                )
            }
        ];
        this.state = {
            selectedRowKeys: []
        };
        this.data = [];

        this.rowSelection = {
            onChange: (selectedRowKeys, selectedRows) => {
                // console.log(`selectedRowKeys: ${selectedRowKeys}`, 'selectedRows: ', selectedRows);
                this.setState({ selectedRowKeys });
            },
            getCheckboxProps: record => ({
                disabled: record.name === 'Michael James', // Column configuration not to be checked
                name: record.name,
            }),
        };

        for (let i = 0; i < 46; i++) {
            let age = (i * 1000) % 149 ;
            let name = `Edward King ${i}`;
            this.data.push({
                key: `${ i}`,
                name,
                age,
                address: `London, Park Lane no. ${i}`,
                description: `My name is ${name}, I am ${age} years old, living in New York No. ${i + 1} Lake Park.`,
            });
        }
    }

    render() {
        const { selectedRowKeys } = this.state;
        return (
            <Table
                columns={this.columns}
                dataSource={this.data}
                rowSelection={{
                    ...this.rowSelection,
                    selectedRowKeys,
                }}
                resizable
                bordered
            />
        );
    }
}
