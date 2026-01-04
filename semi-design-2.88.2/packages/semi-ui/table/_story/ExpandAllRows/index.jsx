import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Table, Tag, Tooltip, Button } from '../../../index';

export default function App() {
    const [data, setData] = useState();
    const [expandAllRows, setExpandAllRows] = useState(true);
    const columns = useMemo(
        () => [
            {
                title: 'Name',
                dataIndex: 'name',
                width: 150,
                fixed: true,
                filterMultiple: false,
                filters: [
                    {
                        // text: <span style={{ display: 'inline-flex', width: '100%', height: '100%' }}></span>,
                        text: '',
                        value: '',
                    },
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
                width: 200,
                dataIndex: 'address',
            },
            {
                title: 'Description',
                // width: 400,
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
        ],
        []
    );

    const getData = () => {
        let newData = [];
        for (let i = 0; i < 46; i++) {
            let age = (i * 1000) % 149 ;
            let name = `Edward King ${i}`;
            newData.push({
                key: `${i}`,
                name,
                age,
                address: `London, Park Lane no. ${i}`,
                description: `My name is ${name}, I am ${age} years old, living in New York No. ${i + 1} Lake Park.`,
            });
        }
        return newData;
    };

    const toggleExpandAllRows = () => {
        setExpandAllRows(!expandAllRows);
    };

    useEffect(() => {
        setTimeout(() => {
            const newData = getData();
            setData(newData);
            console.log('load data');
        }, 1000);
    }, []);

    const expandRowRender = useCallback(record => {
        const { description } = record;
        return <article>{description}</article>;
    }, []);

    return (
        <div>
            <div>
                <Button onClick={toggleExpandAllRows}>动态设置expandAllRows</Button>
                <br /><br />
            </div>
            <label>expandAllRows={`${expandAllRows}`}</label>
            <Table
                // scroll={{ y: 500 }}
                columns={columns}
                dataSource={data}
                expandedRowRender={expandRowRender}
                expandAllRows={expandAllRows}
                pagination={false}
            />
        </div>
    );
}
