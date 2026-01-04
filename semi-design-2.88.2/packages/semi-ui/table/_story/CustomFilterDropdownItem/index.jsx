import React from 'react';
import { Table, Tag, Tooltip, Dropdown } from '../../../index';

export default class CustomDropdownItem extends React.Component {
    constructor(props = {}) {
        super(props);

        this.columns = [
            {
                title: 'Name',
                dataIndex: 'name',
                width: 150,
                fixed: true,
                filterMultiple: false,
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
                renderFilterDropdownItem: ({ text, checked, onChange }) => (
                    <Dropdown.Item onClick={onChange} active={checked}>
                        {text}
                    </Dropdown.Item>
                ),
                filterDropdownProps: {
                    showTick: true,
                },
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

        this.data = [];

        this.rowSelection = {
            onChange: (selectedRowKeys, selectedRows) => {
                // console.log(`selectedRowKeys: ${selectedRowKeys}`, 'selectedRows: ', selectedRows);
            },
            getCheckboxProps: record => ({
                disabled: record.name === 'Disabled User', // Column configuration not to be checked
                name: record.name,
            }),
        };

        for (let i = 0; i < 46; i++) {
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

        this.scroll = { y: 400, x: '150%' };
    }

    render() {
        return (
            <Table
                columns={this.columns}
                dataSource={this.data}
                scroll={this.scroll}
                pagination={{ defaultCurrentPage: 2 }}
            />
        );
    }
}
