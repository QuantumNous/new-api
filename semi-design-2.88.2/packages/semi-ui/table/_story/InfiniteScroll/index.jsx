import React from 'react';
import { Table, Tag, Tooltip } from '../../../index';

class InfiniteScrollDemo extends React.Component {
    constructor(props = {}) {
        super(props);

        this.state = {
            data: [],
        };

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

        this.rowSelection = {
            fixed: true,
        };

        this.scroll = { y: 600, x: 1600 };
        this.style = { width: 800 };

        const itemSize = 56;
        this.virtualized = {
            itemSize,
            onScroll: ({ scrollDirection, scrollOffset, scrollUpdateWasRequested }) => {
                const { data } = this.state;

                if (
                    scrollDirection === 'forward' &&
                    scrollOffset >= (data.length - Math.ceil(this.scroll.y / itemSize) * 1.5) * itemSize &&
                    !scrollUpdateWasRequested
                ) {
                    this.loadMore();
                }
            },
        };

        this.loadMore = this.loadMore.bind(this);
    }

    loadMore() {
        const pageSize = 20; // load 20 records every time
        const data = [...this.state.data];
        const currentLenght = data.length;
        for (let i = currentLenght; i < currentLenght + pageSize; i++) {
            let age = (i * 1000) % 149 ;
            let name = `Edward King ${i}`;
            data.push({
                key: '' + i,
                name,
                age,
                address: `London, Park Lane no. ${i}`,
                description: `My name is ${name}, I am ${age} years old, living in New York No. ${i + 1} Lake Park.`,
            });
        }
        this.setState({ data });
    }

    componentDidMount() {
        this.loadMore();
    }

    render() {
        return (
            <Table
                pagination={false}
                columns={this.columns}
                dataSource={this.state.data}
                scroll={this.scroll}
                style={this.style}
                rowSelection={this.rowSelection}
                virtualized={this.virtualized}
            />
        );
    }
}

export default InfiniteScrollDemo;
