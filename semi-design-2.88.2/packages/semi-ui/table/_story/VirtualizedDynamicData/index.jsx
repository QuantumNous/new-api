import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Table, Tooltip, Tag, Avatar } from '../../../index';

Demo.parameters = {
    chromatic: { disableSnapshot: true },
};

export default function Demo() {
    const [counter, setCounter] = useState(1);
    const scrollingRef = useRef(false);

    const columns = [
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
            render: text => (
                <span>
                    <Avatar src={'https://sf6-cdn-tos.douyinstatic.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/Lark20190614-154048.png'} />
                    {text}
                </span>
            ),
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
    ];

    const dataSource = useMemo(() => {
        const data = [];
        for (let i = 0; i < 10 * counter; i++) {
            let age = 40 + Math.ceil(i / 3);
            let name = `Edward King ${i}`;
            data.push({
                key: `${ i}`,
                name,
                age,
                address: `London, Park Lane no. ${i}`,
                description: `My name is ${name}, I am ${age} years old, living in New York No. ${i + 1} Lake Park.`,
            });
        }

        return data;
    }, [counter]);

    useEffect(() => {
        const timer = setInterval(() => {
            if (!scrollingRef.current) {
                console.log('new data added');
                setCounter(counter + 1);
            }
        }, 2000);

        return () => clearInterval(timer);
    }, [counter]);

    return (
        <Table
            style={{ width: 800 }}
            scroll={{ y: 600, x: 1500 }}
            dataSource={dataSource}
            columns={columns}
            virtualized={
                {
                    // onScroll: () => (scrollingRef.current = true),
                }
            }
            pagination={false}
        />
    );
}
