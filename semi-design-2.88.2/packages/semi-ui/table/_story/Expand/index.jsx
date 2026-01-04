import React from 'react';
import { Table } from '@douyinfe/semi-ui';

const Demo = () => {
    const expandColumns = [
        {
            title: 'Name',
            dataIndex: 'name',
            width: 250,
            fixed: 'left',
            key: 'name',
            render: (text, record, index, { expandIcon: realExpandIcon }) => (
                <>
                    {/* {record.description ? realExpandIcon : null} */}
                    {text}
                </>
            ),
        },
        { title: 'Age', dataIndex: 'age', key: 'age', width: 200 },
        { title: 'Address', dataIndex: 'address', key: 'address' },
        {
            width: 200,
            title: 'Action',
            dataIndex: '',
            key: 'x',
            render: () => <a>Delete</a>,
            fixed: 'right',
        },
    ];

    const expandData = [
        {
            key: 1,
            name: 'John Brown',
            age: 32,
            address: 'New York No. 1 Lake Park',
            description: 'My name is John Brown, I am 32 years old, living in New York No. 1 Lake Park.',
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
    ];

    return (
        <Table
            columns={expandColumns}
            // defaultExpandAllRows
            // rowKey={'kkk'}
            expandedRowRender={(record, index, expanded) => (
                <article style={{ margin: 0 }}>
                    <p>
                        {index}: {expanded ? 'expanded' : 'unexpanded'}
                    </p>
                    <p>{record.description}</p>
                </article>
            )}
            onExpand={(expanded, expandedRow, domEvent) => {
                domEvent && domEvent.stopPropagation();
                console.log(expanded, expandedRow, domEvent);
            }}
            onRow={(record, index) => ({
                onClick: () => {
                    console.log(`Row ${index} clicked: `, record);
                },
            })}
            hideExpandedColumn={false}
            expandCellFixed={true}
            dataSource={expandData}
            scroll={{ x: '160%' }}
        />
    );
};

export default Demo;
