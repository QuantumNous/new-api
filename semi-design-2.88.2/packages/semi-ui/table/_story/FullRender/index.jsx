import React, { useState, useEffect, useMemo } from 'react';
import { Table, Button } from '../../../index';

export default function Demo(props = {}) {
    const [dataSource, setDataSource] = useState([]);
    const [useFullRender, setUseFullRender] = useState(true);
    const total = 46;
    const scroll = {
        // x: '160%',
        // y: 600,
    };
    const pagination = {
        pageSize: 12,
    };

    const rowSelection = useMemo(() => ({
        hidden: useFullRender,
        fixed: 'left',
    }), [useFullRender]);

    useEffect(() => {
        const data = [];
        for (let i = 0; i < total; i++) {
            const no = i + 1;
            const age = (i * 1000) % 149 ;
            const name = `Edward King ${i}`;
            const childrenCount = i % 4;
            const children = [];
            for (let j = 0; j < childrenCount; j++) {
                children.push({
                    key: `${i}-${j}`,
                    name: `Jr. Edward King ${i}-${j}`,
                    age: age - j * 3,
                    address: `Beijing, Zhong Guan Cun No. ${no}`,
                    description: `My name is ${name}, I am ${age} years old, living in Zhong Guan Cun No. ${no}.`,
                });
            }
            data.push({
                key: i,
                name,
                age,
                address: `Beijing, Zhong Guan Cun No. ${no}`,
                description: `My name is ${name}, I am ${age} years old, living in Zhong Guan Cun No. ${no}.`,
                children,
            });
        }

        setDataSource(data);
    }, [total]);

    const columns = useMemo(() => {
        const columns = [
            {
                title: ({ sorter, filter, selection }) => (
                    <span style={{ paddingLeft: 20, display: 'inline-flex', alignItems: 'center' }}>
                        {selection}
                        <span style={{ marginLeft: 8 }}>Name</span>
                        {sorter}
                        {filter}
                    </span>
                ),
                dataIndex: 'name',
                filters: [
                    {
                        text: '名字包含"1"',
                        value: '1',
                    },
                    {
                        text: '名字包含"2"',
                        value: '2',
                    },
                ],
                onFilter: (value, record) => record.name.indexOf(value) > -1,
                sorter: (a, b) => a.name.length - b.name.length,
                useFullRender,
                render: (text, record, index, { expandIcon, selection, indentText }) => (
                    useFullRender ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                            {indentText}
                            {expandIcon}
                            {selection}
                            <span style={{ marginLeft: 8 }}>{text}</span>
                        </span>
                    ) : (
                        text
                    )
                ),
                width: 250,
            },
            {
                title: 'Age',
                dataIndex: 'age',
                sorter: (a, b) => (a.age - b.age > 0 ? 1 : -1),
            },
            {
                title: 'Address',
                dataIndex: 'address',
                filters: [
                    {
                        text: 'London',
                        value: 'London',
                    },
                    {
                        text: 'New York',
                        value: 'New York',
                    },
                ],
                filterMultiple: false,
                onFilter: (value, record) => record.address.indexOf(value) === 0,
                sorter: (a, b) => a.address.length - b.address.length,
            },
        ];
        return columns;
    }, [useFullRender]);

    return (
        <div style={{ width: 800 }}>
            <Button onClick={() => setUseFullRender(!useFullRender)}>
                {useFullRender ? '非自定义渲染' : '自定义渲染'}
            </Button>
            <Table
                pagination={pagination}
                // scroll={scroll}
                rowSelection={rowSelection}
                columns={columns}
                dataSource={dataSource}
                onChange={(...args) => console.log(...args)}
                // expandedRowRender={record => <article>{record.description}</article>}
            />
        </div>
    );
}
