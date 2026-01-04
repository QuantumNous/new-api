import React, { useEffect, useState } from 'react';
import { Table } from '@douyinfe/semi-ui';

export default function App() {
    const [selectAll, setSelectAll] = useState(false);
    const [clueIds, setClueIds] = useState([]);
    const columns = [
        {
            title: '排行',
            dataIndex: 'index',
        },
        {
            title: 'name',
            dataIndex: 'name',
        },
    ];
    const data = Array(20)
        .fill(0)
        .map((_, index) => {
            return {
                key: index,
                name: `name ${index}`,
                index: index,
                clue_id: index,
            };
        });
    const rowSelection = {
        disabled: selectAll,
        getCheckboxProps: record => {
            if (selectAll) {
                return {
                    disabled: true,
                };
            }
            return {};
        },

        onChange: (selectedRowKeys, selectedRows) => {
            console.log(`select all onChange: ${selectedRowKeys}`, selectedRows);
            console.log(selectedRowKeys);
            setClueIds(selectedRows.map(row => row.clue_id));
        },
        selectedRowKeys: clueIds,
    };
    useEffect(() => {
        if (selectAll) {
            let newIds = data.map(row => row.clue_id);
            console.log(newIds);
            setClueIds(newIds);
        }
    }, [selectAll]);

    return (
        <div>
            <button
                onClick={() => {
                    setSelectAll(true);
                }}
            >
                点击全选
            </button>
            <Table columns={columns} dataSource={data} rowSelection={rowSelection} />
        </div>
    );
}
