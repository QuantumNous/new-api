import React, { useState, useEffect } from 'react';
import { Table } from '@douyinfe/semi-ui';

const { Column } = Table;

const TableApp = () => {
    const [data, setData] = useState([]);
    useEffect(() => {
        setTimeout(() => {
            setData([
                {
                    key: '1',
                    name: 'John Brown',
                    age: 32,
                    address: 'New York No. 1 Lake Park, New York No. 1 Lake Park',
                },
                {
                    key: '2',
                    name: 'Jim Green',
                    age: 42,
                    address: 'London No. 1 Lake Park',
                },
                {
                    key: '3',
                    name: 'Joe Black',
                    age: 32,
                    address: 'Sidney No. 1 Lake Park',
                },
                {
                    key: '4',
                    name: 'Michael James',
                    age: 99,
                    address: 'Sidney No. 1 Lake Park',
                },
            ]);
        }, 2000);
    }, []);
    return (
        <Table dataSource={data}>
            <Column title="Name" dataIndex="name" key="name" render={(text, record, index) => <a>{text}</a>} />
            <Column title="Age" dataIndex="age" key="age" />
            <Column title="Address" dataIndex="address" key="address" />
        </Table>
    );
};

export default TableApp;
