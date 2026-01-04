import React from 'react';
import { Table } from '@douyinfe/semi-ui';

function App() {
    const columns = [
        {
            title: 'Name',
            dataIndex: 'name',
            fixed: 'left',
            render: text => <a>{text}</a>,
        },
        {
            title: 'Age',
            dataIndex: 'age',
        },
        {
            title: 'Address',
            dataIndex: 'address',
        },
    ];

    const data = [
        {
            key: '1',
            name: 'John Brown',
            age: 32,
            age1: 23,
            age2: 11,
            address: 'New York No. 1 Lake Park, New York No. 1 Lake Park',
        },
        {
            key: '2',
            name: 'Jim Green',
            age: 42,
            age1: 23,
            age2: 11,
            address: 'London No. 1 Lake Park',
        },
        {
            key: '3',
            name: 'Joe Black',
            age: 32,
            age1: 23,
            age2: 11,
            address: 'Sidney No. 1 Lake Park',
        },
        {
            key: '4',
            name: 'Disabled User',
            age: 99,
            age1: 23,
            age2: 11,
            address: 'Sidney No. 1 Lake Park',
        },
    ];
    return (
        <>
            <Table
                expandRowByClick
                onExpand={(...args) => {
                    console.log('click row', ...args);
                }}
                onExpandedRowsChange={rows => {
                    console.log('rows change', rows);
                }}
                onRow={() => ({
                    onClick: (...args) => console.log('onRow click', ...args),
                })}
                expandedRowRender={() => <div>Semi Design</div>}
                columns={columns}
                dataSource={data}
            />
        </>
    );
}

export default App;
