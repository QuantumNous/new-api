import React, { useMemo, useCallback } from 'react';
import { Table } from '@douyinfe/semi-ui';
import bigJson from '../data/big.json';

const Demo = () => {
    const dataTotalSize = 200;
    const childrenRecordName = 'children';
    const rowKey = 'key';
    const authPoint = 'auth_point_list';
    const checkName = 'role_perm';
    const columns = [
        {
            title: 'NAME',
            dataIndex: 'en_name',
            width: 250,
            fixed: 'left',
            key: 'en_name',
            align: 'right',
            render: (text, record, index, { expandIcon: realExpandIcon }) => {
                return (
                    <>
                        {/* {record.description ? realExpandIcon : null} */}
                        {text}
                    </>
                );
            },
        },
        { title: 'APP_ID', dataIndex: 'app_id', key: 'app_id', width: 200 },
        { title: 'RESOURCE_POINT_CODE', dataIndex: 'resource_point_code', key: 'resource_point_code' },
        {
            width: 200,
            title: 'Action',
            dataIndex: '',
            key: 'x0',
            render: () => <a>Delete</a>,
            fixed: 'right',
        },
        {
            width: 200,
            title: 'Action',
            dataIndex: '',
            key: 'x1',
            render: () => <a>Delete</a>,
            fixed: 'right',
        },
    ];

    const scroll = {
        // x: columns.reduce((prev, col) => (col.width ? col.width + prev : prev), 200),
        x: 1200,
        y: 600,
    };
    const style = { width: 800, margin: 20 };

    const requestData = useCallback(() => {
        const tableData = bigJson.data;
        const allKeys = [];
        for (let i = 0, len = tableData.length; i < len; ++i) {
            const key = `${i}`;
            tableData[i][rowKey] = key;
            allKeys.push(key);
        }
        const queue = [...tableData];
        while (queue.length) {
            const curNode = queue.shift();
            const someSelected = curNode[authPoint].some(item => item[checkName]);
            const everySelected = curNode[authPoint].every(item => item[checkName]);
            curNode.checkAll = {
                checked: curNode[authPoint] && curNode[authPoint].length && everySelected,
                indeterminate: someSelected,
            };
            const parentKey = curNode[rowKey];
            if (curNode.children.length) {
                for (let i = 0, len = curNode.children.length; i < len; ++i) {
                    const key = `${parentKey}.${childrenRecordName}.${i}`;
                    curNode.children[i][rowKey] = key;
                    allKeys.push(key);
                }
                queue.push(...curNode.children);
            }
        }

        return {
            data: tableData,
            allKeys,
        };
    }, []);

    const data = useMemo(() => {
        const res = requestData();
        return res.data;
    }, []);

    return (
        <Table
            style={style}
            columns={columns}
            childrenRecordName={childrenRecordName}
            defaultExpandAllRows
            rowKey={rowKey}
            // expandedRowRender={(record, index, expanded) => (
            //     <article style={{ margin: 0 }}>
            //         <p>
            //             {index}: {expanded ? 'expanded' : 'unexpanded'}
            //         </p>
            //         <p>{record.description}</p>
            //     </article>
            // )}
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
            // rowSelection={true}
            // hideExpandedColumn={false}
            // expandCellFixed={true}
            dataSource={data}
            scroll={scroll}
            pagination={false}
            virtualized
            size={'middle'}
        />
    );
};

export default Demo;
