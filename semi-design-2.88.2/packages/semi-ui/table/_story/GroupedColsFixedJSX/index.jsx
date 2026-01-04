import React, { useMemo } from 'react';
import { Table } from '../../../index';

export default function Demo() {
    const data = useMemo(() => {
        const data = [];
        for (let i = 0; i < 100; i++) {
            let age = (i * 1000) % 149 ;
            let name = `Edward King ${i}`;
            data.push({
                key: '' + i,
                company: {
                    name: 'ByteDance',
                    address: 'No. 48, Zhichun Road',
                },
                name,
                age,
                address: `No ${i + 1}, Zhongguancun Street`,
                description: `My name is ${name}, I am ${age} years old, living in No ${i + 1}, Zhongguancun Street`,
            });
        }
        return data;
    }, []);

    const columns = useMemo(
        () => [
            {
                title: 'Base Information',
                fixed: 'left',
                children: [
                    {
                        title: 'Name',
                        dataIndex: 'name',
                        fixed: 'left',
                        width: 200,
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
                        fixed: 'left',
                        width: 100,
                        sorter: (a, b) => (a.age - b.age > 0 ? 1 : -1),
                    },
                ],
            },
            {
                title: 'Company Information',
                children: [
                    {
                        title: 'Company Name',
                        dataIndex: 'company.name',
                    },
                    {
                        title: 'Company Address',
                        dataIndex: 'company.address',
                    },
                ],
            },
            {
                title: 'Address',
                width: 250,
                dataIndex: 'address',
                fixed: 'right',
            },
        ],
        []
    );

    return (
        <Table
            rowSelection={{ fixed: true }}
            expandedRowRender={record => <article>{record.description}</article>}
            dataSource={data}
            scroll={{ x: '120%', y: 400 }}
            onChange={(...args) => console.log(...args)}
            columns={columns}
        >
            {/* <Table.Column title={'Base Information'} fixed>
                <Table.Column
                    title={'Name'}
                    dataIndex={'name'}
                    fixed
                    width={200}
                    filters={[
                        {
                            text: 'Code 45',
                            value: '45',
                        },
                        {
                            text: 'King 4',
                            value: 'King 4',
                        },
                    ]}
                    onFilter={(value, record) => record.name.includes(value)}
                />
                <Table.Column
                    title={'Age'}
                    dataIndex={'age'}
                    fixed
                    width={100}
                    sorter={(a, b) => (a.age - b.age > 0 ? 1 : -1)}
                />
            </Table.Column>
            <Table.Column title={'Company Information'}>
                <Table.Column title={'Company Name'} dataIndex={'company.name'} />
                <Table.Column title={'Company Address'} dataIndex={'company.address'} />
            </Table.Column>
            <Table.Column title={'Address'} width={250} fixed={'right'} dataIndex={'address'} /> */}
        </Table>
    );
}
