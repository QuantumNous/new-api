import React from 'react';
import { Table } from '../../../../index';

class PerfVirtualized extends React.Component {
    constructor(props = {}) {
        super(props);

        this.columns = [
            {
                title: 'A',
                dataIndex: 'key',
                key: 'a',
                width: 150,
            },
            {
                title: 'B',
                dataIndex: 'key',
                key: 'b',
            },
            {
                title: 'C',
                dataIndex: 'key',
                key: 'c',
            },
            {
                title: 'D',
                dataIndex: 'key',
                key: 'd',
            },
            {
                title: 'E',
                dataIndex: 'key',
                width: 200,
                key: 'e',
            },
            {
                title: 'F',
                dataIndex: 'key',
                width: 100,
                key: 'f'
            },
        ];

        this.data = Array.from(
            {
                length: 100000,
            },
            (_, key) => ({
                key,
            })
        );

        this.scroll = { y: 300, x: '100vw' };
    }

    render() {
        return (
            <Table
                title="10万条数据"
                size={'small'}
                pagination={false}
                columns={this.columns}
                dataSource={this.data}
                scroll={this.scroll}
                virtualized
            />
        );
    }
}

export default PerfVirtualized;
