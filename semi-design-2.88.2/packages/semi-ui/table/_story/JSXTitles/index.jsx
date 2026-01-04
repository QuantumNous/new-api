import React from 'react';
import { Table, Tooltip, Tag } from '@douyinfe/semi-ui';

const Title = ({ title }) => <span style={{ fontSize: '12px', color: '#333', wordBreak: 'keep-all' }}>{title}</span>;

const dataTotalSize = 46;
const data = (() => {
    const _data = [];
    for (let i = 0; i < dataTotalSize; i++) {
        let age = (i * 1000) % 149 ;
        let name = `Edward King ${i}`;
        _data.push({
            key: '' + i,
            name,
            age,
            address: `London, Park Lane no. ${i} Lake Park`,
            description: `My name is ${name}, I am ${age} years old, living in New York No. ${i + 1} Lake Park.`,
        });
    }
    return _data;
})();

const Demo = () => {
    const columns = [
        {
            title: <Title title="Name" />,
            dataIndex: 'name',
            width: 150,
            render: (text, record) => text,
        },
        {
            title: <Title title="Age" />,
            dataIndex: 'age',
            width: 150,
            render: (text, record) => text,
        },
        {
            title: <Title title="Address" />,
            dataIndex: 'address',
            render: (text, record) => text,
        },
        {
            render: (text, record) => (
                <Tooltip content={record.description}>
                    <Tag color="green">Show Info</Tag>
                </Tooltip>
            ),
            width: 150,
        },
    ];

    return <Table columns={columns} dataSource={data} />;
};

export default Demo;
