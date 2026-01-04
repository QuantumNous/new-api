import { Table, Tooltip, Popconfirm, Popover, Tag } from '@douyinfe/semi-ui/';
import React, { useMemo } from 'react';

function EventTable(props = {}) {
    const dataTotalSize = 46;

    const columns = useMemo(
        () => [
            {
                title: 'Name',
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
                    <Popconfirm content={record.description}>
                        <Tag color="green" onClick={e => console.log('tag clicked')}>
                            Show Info
                        </Tag>
                    </Popconfirm>
                ),
                width: 150,
            },
        ],
        []
    );

    const data = useMemo(() => {
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
    }, []);

    const onRow = (record, index) => {
        const props = {};

        return {
            onClick: () => {
                console.log('row clicked');
            },
            className: index === 2 ? 'my-tr-class' : '',
        };
    };
    const onHeaderRow = useMemo(
        () => (columns, index) => {
            return {
                onMouseEnter: e => console.log('mouse enter: ', columns, index),
                onMouseLeave: e => console.log('mouse leave: ', columns, index),
            };
        },
        []
    );

    return <Table columns={columns} dataSource={data} onRow={onRow} onHeaderRow={onHeaderRow} />;
}

export default EventTable;
