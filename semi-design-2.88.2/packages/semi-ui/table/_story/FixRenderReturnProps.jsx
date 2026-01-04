import React from 'react';
import { Table } from '../../index';

function App() {
    const columns = [
        {
            title: 'Name',
            dataIndex: 'name',
            width: 200,
            fixed: true,
            render: (text, row, index) => {
                if (index === 0) {
                    return {
                        children: <a>{text}</a>,
                        props: {
                            rowSpan: 2
                        },
                    };
                }
                if (index === 1) {
                    return {
                        children: <a>{text}</a>,
                        props: {
                            rowSpan: 0
                        },
                    };
                }
                return {
                    children: <a>{text}</a>,
                };
            },
        },
        {
            title: 'Age',
            width: 200,
            dataIndex: 'age',
        },
        {
            title: 'Home phone',
            colSpan: 2,
            width: 200,
            dataIndex: 'tel',
        },
        {
            title: 'Phone',
            colSpan: 0,
            width: 200,
            dataIndex: 'phone',
        },
        {
            title: 'Address',
            width: 200,
            dataIndex: 'address',
        },
    ];
    const data = [
        {
            key: '1',
            name: 'John Brown',
            age: 32,
            tel: '0571-22098909',
            phone: 18889898989,
            address: 'New York No. 1 Lake Park',
        },
        {
            key: '2',
            name: 'Jim Green',
            tel: '0571-22098333',
            phone: 18889898888,
            age: 42,
            address: 'London No. 1 Lake Park',
        },
        {
            key: '3',
            name: 'Joe Black',
            age: 32,
            tel: '0575-22098909',
            phone: 18900010002,
            address: 'Sidney No. 1 Lake Park',
        },
        {
            key: '4',
            name: 'Jim Red',
            age: 18,
            tel: '0575-22098909',
            phone: 18900010002,
            address: 'London No. 2 Lake Park',
        },
        {
            key: '5',
            name: 'Jake White',
            age: 18,
            tel: '0575-22098909',
            phone: 18900010002,
            address: 'Dublin No. 2 Lake Park',
        },
    ];
    return (
        <div style={{ width: 800 }}>
            <Table dataSource={data} columns={columns} />
        </div>
    );
}

export default App;