import React from 'react';
import { Table } from '@douyinfe/semi-ui';
import copy from 'fast-copy';

const ControlledSortOrder = () => {
    const [sortColumns, setSortColumns] = React.useState([]);

    const [sortData, setSortData] = React.useState([]);

    React.useEffect(() => {
        setSortData([
            {
                key: '1',
                name: 'John Brown1',
                age: 32,
                address: 'New York No. 1 Lake Park',
            },
            {
                key: '2',
                name: 'Jim Green2',
                age: 52,
                address: 'London No. 1 Lake Park',
            },
            {
                key: '3',
                name: 'Joe Black3',
                age: 62,
                address: 'Sidney No. 1 Lake Park',
            },
            {
                key: '4',
                name: 'Jim Red4',
                age: 22,
                address: 'London No. 2 Lake Park2',
            },
        ]);
    }, []);
    React.useEffect(() => {
        setSortColumns([
            {
                title: 'Name',
                dataIndex: 'name',
                sorter: (a, b) => a.name.length - b.name.length,
            },
            {
                title: 'Age',
                dataIndex: 'age',
                sortOrder: 'descend',
                sorter: (a, b) => a.age - b.age,
            },
            {
                title: 'Address',
                dataIndex: 'address',
            },
        ]);
    }, [sortData]);
    return (
        <Table
            columns={sortColumns}
            dataSource={sortData}
            onChange={({ sorter }) => {
                const cT = copy(sortColumns);
                let sortOrder;
                const sortTrend = sorter.sortOrder;
                if (!sortTrend) {
                    sortOrder = 'ascend';
                } else if (sortTrend === 'ascend') {
                    sortOrder = 'descend';
                } else {
                    sortOrder = false;
                }
                cT.forEach(c => {
                    if (c.dataIndex === sorter.dataIndex) {
                        c.sortOrder = sortOrder;
                    } else {
                        c.sortOrder = false;
                    }
                });
                setSortColumns(cT);
            }}
        />
    );
};

export default ControlledSortOrder;
