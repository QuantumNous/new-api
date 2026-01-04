import React, { useMemo } from 'react';
import { Table } from '@douyinfe/semi-ui';
import { VariableSizeGrid as Grid } from 'react-window';

const Demo = () => {
    const dataTotalSize = 100;
    const scroll = {
        x: 1200,
        y: 600,
    };
    const expandColumns = [
        {
            title: 'Name',
            dataIndex: 'name',
            width: 250,
            fixed: 'left',
            key: 'name',
            render: (text, record, index, { expandIcon: realExpandIcon }) => {
                return (
                    <>
                        {/* {record.description ? realExpandIcon : null} */}
                        {text}
                    </>
                );
            },
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
    }, [dataTotalSize]);

    return (
        <Table
            style={{ width: 800 }}
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
            onRow={(record, index) => {
                return {
                    onClick: () => {
                        console.log(`Row ${index} clicked: `, record);
                    },
                };
            }}
            // hideExpandedColumn={false}
            expandCellFixed={true}
            dataSource={data}
            scroll={scroll}
            pagination={false}
            components={{
                body: {
                    outer: 'div',
                    wrapper: 'div',
                    row: 'div',
                    cell: 'div',
                    colgroup: {
                        wrapper: 'div',
                        col: 'div',
                    },
                },
            }}
        />
    );
};

export default Demo;
