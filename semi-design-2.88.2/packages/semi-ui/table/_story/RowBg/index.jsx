import React from 'react';
import { Table } from '@douyinfe/semi-ui';


class RowBg extends React.Component {
    constructor(props = {}) {
        super(props);
  
        this.columns = [
            {
                title: 'Name',
                dataIndex: 'name',
                width: 150,
                fixed: 'left',
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
                filterDropdownProps: {
                    showTick: true,
                }
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
                    <span color="green">Info</span>
                ),
            },
        ];
  
  
        const onHeaderCell = () => {
            return {
                style: { background: 'rgba(var(--semi-grey-1), 1)' },
            };
        };
        this.columns.forEach((item) => (item.onHeaderCell = onHeaderCell));
  
        this.data = [];
  
        for (let i = 0; i < 46; i++) {
            let age = 40 + (Math.random() > 0.5 ? 1 : -1) * Math.ceil(i / 3);
            let name = `Edward King ${i}`;
            this.data.push({
                key: '' + i,
                name,
                age,
                address: `London, Park Lane no. ${i}`,
                description: `My name is ${name}, I am ${age} years old, living in New York No. ${i + 1} Lake Park.`,
            });
        }
        this.handleRow = (record, index) => {
            // 给偶数行设置斑马纹
            if (index % 2 === 0) {
                return {
                    style: {
                        background: 'var(--semi-color-fill-0)',
                    },
                };
            } else {
                return {};
            }
        };
  
        this.scroll = { y: 400, x: '150%' };
    }
  
    render() {
        return <Table columns={this.columns} dataSource={this.data} onRow={this.handleRow} scroll={this.scroll} />;
    }
}

export default RowBg;
  