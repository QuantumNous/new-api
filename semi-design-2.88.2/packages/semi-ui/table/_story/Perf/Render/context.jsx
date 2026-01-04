import React from 'react';
import { Table, Button } from '../../../../index';

class App extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            count: 1,
        };
        this.columns = [
            {
                title: 'Name',
                dataIndex: 'name',
                render: (text, record, index) => {
                    console.log(text, record, index);
                    return <a>{text}</a>;
                },
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
        const { count } = this.state;
        return (
            <>
                <div>{`count: ${count}`}</div>
                <Table columns={this.columns} dataSource={this.data} pagination={false} />
                <Button onClick={() => {
                    this.setState({ count: count + 1 });
                }}>
                    Click
                </Button>
            </>
        );
    }
}

export default App;
