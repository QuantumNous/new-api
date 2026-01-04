import React, { useMemo } from 'react';
import Table from '../index';
import { DataType } from '../Table';

const JSXColumnsNest: React.FunctionComponent = () => {
    const data = useMemo(() => {
        const _data = [];
        for (let i = 0; i < 100; i++) {
            const age = (i * 1000) % 149 ;
            const name = `Edward King ${i}`;
            _data.push({
                key: `${ i}`,
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
        return _data;
    }, []);

    return (
        <Table
            rowSelection={{ fixed: true }}
            expandedRowRender={(record: DataType): React.ReactNode => <article>{record.description}</article>}
            dataSource={data}
            scroll={{ x: '120%', y: 400 }}
            onChange={(...args: Array<unknown>): void => console.log(args)}
        >
            <Table.Column title={'Base Information'} fixed>
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
                    onFilter={(value, record): boolean => record.name.includes(value)}
                />
                {
                    // 这样做是为了查看是否符合类型定义
                    (Math.random() > 0.5) ? (
                        <Table.Column
                            title={'Age'}
                            dataIndex={'age'}
                            fixed
                            width={100}
                            sorter={(a: DataType, b: DataType): number => (a.age - b.age > 0 ? 1 : -1)}
                        />
                    ) : null
                }
            </Table.Column>
            <Table.Column title={'Company Information'}>
                <Table.Column title={'Company Name'} dataIndex={'company.name'} />
                <Table.Column title={'Company Address'} dataIndex={'company.address'} />
            </Table.Column>
            <Table.Column title={'Address'} width={250} fixed={'right'} dataIndex={'address'} />
        </Table>
    );
};

export default JSXColumnsNest;