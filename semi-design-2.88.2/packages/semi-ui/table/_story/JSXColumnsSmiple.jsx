import React from 'react';
import Table from '..';

export default class JSXColumnsSimple extends React.Component {
    constructor(props) {
        super(props);
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
                name: 'Disabled User',
                age: 99,
                address: 'Sidney No. 1 Lake Park',
            },
        ];
    }

    render() {
        return (
            <Table
                dataSource={this.data}
                pagination={false}
                onRow={(record, index) => ({ className: index === 2 ? 'my-tr-class' : '' })}
            >
                <Table.Column
                    title="Name"
                    dataIndex="name"
                    key="name"
                    render={(text, record, index) => <a>{text}</a>}
                />
                <Table.Column title="Age" dataIndex="age" key="age" />
                <Table.Column title="Address" dataIndex="address" key="address" />
            </Table>
        );
    }
}
