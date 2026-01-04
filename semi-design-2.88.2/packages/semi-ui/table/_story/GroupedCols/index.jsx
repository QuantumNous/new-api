import React from 'react';
import { Table } from '../../../index';

export default function Demo() {
    const columns = [
        {
            title: 'Name',
            dataIndex: 'name',
            width: '30%',
            render: text => <a>{text}</a>,
        },
        {
            title: 'combine',
            width: '20%',
            dataIndex: 'test',
            children: [
                {
                    title: 'Age',
                    width: '20%',
                    children: [
                        {
                            title: 'Age1',
                            width: '20%',
                            dataIndex: 'age1',
                        },
                        {
                            title: 'Age2',
                            width: '20%',
                            dataIndex: 'age2',
                        },
                    ],
                },
                {
                    title: 'Key',
                    width: '20%',
                    dataIndex: 'key',
                },
            ],
        },
        {
            title: 'Address',
            width: '50%',
            dataIndex: 'address',
        },
    ];

    const data = [
        {
            key: '1',
            name: 'John Brown',
            age: 32,
            age1: 23,
            age2: 11,
            address: 'New York No. 1 Lake Park, New York No. 1 Lake Park',
        },
        {
            key: '2',
            name: 'Jim Green',
            age: 42,
            age1: 23,
            age2: 11,
            address: 'London No. 1 Lake Park',
        },
        {
            key: '3',
            name: 'Joe Black',
            age: 32,
            age1: 23,
            age2: 11,
            address: 'Sidney No. 1 Lake Park',
        },
        {
            key: '4',
            name: 'Disabled User',
            age: 99,
            age1: 23,
            age2: 11,
            address: 'Sidney No. 1 Lake Park',
        },
    ];

    return <Table columns={columns} dataSource={data} />;
}
