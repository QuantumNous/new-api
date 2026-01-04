import React from 'react';
import Table from '../';

export default class App extends React.Component {
    constructor(props) {
        super(props);
        this.columns = [
            {
                title: 'Name',
                dataIndex: 'name',
                render: (text, record, index) => (<a>{text}</a>),
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
        this.data = [
            {
                key: '1',
                name: 'John Brown',
                age: 32,
                address: 'New York No. 1 Lake Park, New York No. 1 Lake Park',
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
                name: 'Michael James',
                age: 99,
                address: 'Sidney No. 1 Lake Park',
            },
        ];
    }

    render() {
        return (
            <Table columns={this.columns} dataSource={this.data} pagination={false}>
                <Table.Column title="Age" dataIndex="age" key="age" />
            </Table>
        );
    }
}
