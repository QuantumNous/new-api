import React, { useState } from 'react';
import { Table } from '@douyinfe/semi-ui';
import { ChangeInfo } from '@douyinfe/semi-ui/table';

const data = [
    {
        key: 'a',
        group: 'yes',
        count: 3,
    },
    {
        key: 'b',
        group: 'no',
        count: 3,
    },
    {
        key: 'c',
        group: 'no',
        count: 1,
    },
    {
        key: 'd',
        group: 'yes',
        count: 1,
    },
    {
        key: 'e',
        group: 'no',
        count: 2,
    },
    {
        key: 'f',
        group: 'yes',
        count: 2,
    }
];

Demo.storyName = 'fixed sorter';
/**
 * 保持分组顺序不变的排序方式
 */
function Demo() {
    const [filtered, setFiltered] = useState([...data]);
    console.log(filtered);
    const columns = [
        {
            title: 'ID',
            dataIndex: 'key',
        },
        {
            title: 'group',
            dataIndex: 'Group',
            sorter: (a, b) => a.group === 'yes' ? -1 : 1,
            // sortOrder: 'ascend'
        },
        {
            title: 'Count',
            dataIndex: 'count',
            // sorter: true
            sorter: (a, b) => a.count - b.count > 0 ? 1 : -1,
        },
    ];

    const onTableChange = ({ sorter }: ChangeInfo<any>) => {
        if (sorter) {
            const { dataIndex, sortOrder } = sorter;
            setFiltered(prev => [...prev].sort((a, b) => {
                if (a.group !== b.group) {
                    return a.group === 'yes' ? -1 : 1;
                }

                let ascendValue = -1;
                if (dataIndex === 'count') {
                    ascendValue = a.count - b.count > 0 ? 1 : -1;
                }

                return sortOrder === 'ascend' ? ascendValue : -ascendValue;
            }));
        }
    };


    return (
        <div style={{ padding: '20px 0px' }}>
            <Table
                dataSource={filtered}
                onChange={onTableChange}
                rowKey="key"
                groupBy="group"
                columns={columns}
                renderGroupSection={groupKey => <strong>分组 {groupKey}</strong>}
                expandAllGroupRows
                scroll={{ y: 480 }}
                pagination={{ pageSize: 4 }}
            />
        </div>
    );
}

export default Demo;