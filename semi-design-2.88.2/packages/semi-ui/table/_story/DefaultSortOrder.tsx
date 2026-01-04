import React, { useState } from 'react';
import { Table, Button } from '../../index';
import { ColumnProps } from '../interface';

interface Record {
    title?: string;
    age?: number;
    address?: string;
    name?: string
}

const columns: ColumnProps<Record>[] = [
    {
        title: 'Name',
        dataIndex: 'name',
        sorter: (a: Record, b: Record): number => a.name.length - b.name.length,
        defaultSortOrder: 'descend',
    },
    {
        title: 'Age',
        dataIndex: 'age',
        sorter: (a: Record, b: Record): number => (a.age - b.age > 0 ? 1 : -1),
        defaultSortOrder: 'ascend',
    },
    {
        title: 'Address',
        dataIndex: 'address',
        sorter: (a: Record, b: Record): number => a.address.length - b.address.length,
        defaultSortOrder: false,
    },
];

const data1 = [
    {
        key: '1',
        name: 'John Brown',
        age: 32,
        address: 'New York No. 1 Lake Park',
    },
    {
        key: '2',
        name: 'Jim Green',
        age: 42,
        address: 'London No. 1 Lake Park',
    },
    {
        key: '3',
        name: 'Joe Black',
        age: 32,
        address: 'Sidney No. 1 Lake Park',
    },
    {
        key: '4',
        name: 'Jim Red',
        age: 32,
        address: 'London No. 2 Lake Park',
    },
];

const data2 = [
    {
        key: '1',
        name: 'John Brown',
        age: 1,
        address: 'New York No. 1 Lake Park',
    },
    {
        key: '2',
        name: 'Jim Green',
        age: 2,
        address: 'London No. 1 Lake Park',
    },
    {
        key: '3',
        name: 'Joe Black',
        age: 4,
        address: 'Sidney No. 1 Lake Park',
    },
    {
        key: '4',
        name: 'Jim Red',
        age: 3,
        address: 'London No. 2 Lake Park',
    },
];

interface OnChangeArgs {
    filters?: unknown[];
    sorter?: unknown;
    extra?: unknown
}

function App(): React.ReactElement {
    const [data, setData] = useState(data1);
    const [flag, setFlag] = useState(false);
    const handleChange = ({ sorter }: OnChangeArgs): void => {
        console.log('table sorter changed to', sorter);
    };

    const handleClick = (): void => {
        const newData = flag ? data1 : data2;
        setData(newData);
        setFlag(!flag);
    };

    const currentData = flag ? 'data2' : ' data1';

    return (
        <div>
            <div>
                <label>defaultSortOrder=ascend</label>
                <Table columns={columns} dataSource={data} onChange={handleChange} />
            </div>
            <Button onClick={handleClick}>update data</Button>
            <div>{currentData}</div>
        </div>
    );
}

export default App;