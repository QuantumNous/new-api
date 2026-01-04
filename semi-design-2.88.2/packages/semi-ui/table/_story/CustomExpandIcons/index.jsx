import React, { useState, useCallback } from 'react';
import { Table } from '../../../index';

const Demo = () => {
    const columns = [
        {
            title: 'Name',
            dataIndex: 'name',
            width: 250,
            key: 'name',
        },
        { title: 'Age', dataIndex: 'age', key: 'age', width: 200 },
        { title: 'Address', dataIndex: 'address', key: 'address' },
    ];
    const childrenRecordName = 'children';
    const [data, setData] = useState([
        {
            key: 1,
            name: 'John Brown',
            age: 32,
            address: 'New York No. 1 Lake Park',
            description: 'My name is John Brown, I am 32 years old, living in New York No. 1 Lake Park.',
            [childrenRecordName]: [],
        },
        {
            key: 2,
            name: 'Jim Green',
            age: 42,
            address: 'London No. 1 Lake Park',
            // description: 'My name is Jim Green, I am 42 years old, living in London No. 1 Lake Park.',
        },
        {
            key: 3,
            name: 'Joe Black',
            age: 32,
            address: 'Sidney No. 1 Lake Park',
            description: 'My name is Joe Black, I am 32 years old, living in Sidney No. 1 Lake Park.',
        },
    ]);
    const [loading, setLoading] = useState();

    const fetchChildrenData = useCallback(
        async key => {
            setLoading(true);
            await new Promise((resolve, reject) => {
                setTimeout(() => {
                    setLoading(false);
                    const newData = [...data];
                    const objRecord = newData.find(item => item.key);
                    if (objRecord) {
                        objRecord.children = [
                            {
                                key: 11,
                                name: 'Jr. John Brown',
                                age: 32,
                                address: 'New York No. 11 Lake Park',
                                description:
                                    'My name is John Brown, I am 32 years old, living in New York No. 11 Lake Park.',
                            },
                        ];
                        setData(newData);
                    }
                }, 2000);
            });
        },
        [data]
    );

    return (
        <Table
            loading={loading}
            childrenRecordName={childrenRecordName}
            columns={columns}
            onExpand={(expanded, record, domEvent) => {
                domEvent && domEvent.stopPropagation();
                console.log(`onExpand: `, expanded, record, domEvent);
                if (expanded && Array.isArray(record.children) && !record.children.length) {
                    fetchChildrenData(record.key);
                }
            }}
            onExpandedRowsChange={rows => {
                console.log(`onExpandedRowsChange: `, rows);
            }}
            onRow={(record, index) => {
                return {
                    onClick: () => {
                        console.log(`onRow clicked, index: ${index} , record: `, record);
                    },
                };
            }}
            rowExpandable={record => Array.isArray(record.children)}
            dataSource={data}
        />
    );
};

export default Demo;
