import React, { useEffect, useState } from 'react';
import { Tabs, Tooltip, Tag, Table } from '@douyinfe/semi-ui';

const { TabPane } = Tabs;

function AsyncTable(props = {}) {
    const dataTotalSize = 46;

    const [columns, setColumns] = useState([
        {
            title: <span>Name</span>,
            dataIndex: 'name',
            width: 150,
        },
        {
            title: 'Age',
            dataIndex: 'age',
            width: 150,
        },
        {
            title: 'Address',
            dataIndex: 'address',
        },
        {
            render: (text, record) => (
                <Tooltip content={record.description}>
                    <Tag color="green">Show Info</Tag>
                </Tooltip>
            ),
            width: 150,
        },
    ]);

    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        setTimeout(() => {
            const _data = [];
            for (let i = 0; i < dataTotalSize; i++) {
                let age = (i * 1000) % 149 ;
                let name = `Edward King ${i}`;
                _data.push({
                    key: '' + i,
                    name,
                    age,
                    address: `London, Park Lane no. ${i} Lake Park`,
                    description: `My name is ${name}, I am ${age} years old, living in New York No. ${i +
                        1} Lake Park.`,
                });
            }

            setData(_data);
            setLoading(false);
        }, 1000);
    }, []);

    return <Table columns={columns} dataSource={data} loading={loading} />;
}

function TabsTable(props = {}) {
    return (
        <Tabs>
            {Array(10)
                .fill(1)
                .map((ee, e) => (
                    <TabPane itemKey={e + ''} tab={e} key={e}>
                        <Table dataSource={[]}>
                            <Table.Column title={<span>1</span>} />
                        </Table>
                    </TabPane>
                ))}
        </Tabs>
    );
}

export default TabsTable;
