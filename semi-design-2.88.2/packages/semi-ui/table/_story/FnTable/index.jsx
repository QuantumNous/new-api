import { Table } from '@douyinfe/semi-ui';
import React from 'react';

class App extends React.Component {
    constructor() {
        super();
        this.state = {
            sortColumns: [
                { title: 'other', dataIndex: 'other' },
                {
                    title: 'Name',
                    dataIndex: 'name',
                    filters: [
                        {
                            text: 'Joe',
                            value: 'Joe',
                        },
                        {
                            text: 'Jim',
                            value: 'Jim',
                        },
                        {
                            text: 'Alex',
                            value: 'Alex',
                        }
                    ],
                    onFilter: (value, record) => record.name.indexOf(value) === 0,
                    sorter: (a, b) => a.name.length - b.name.length,
                },
                {
                    title: 'Age',
                    dataIndex: 'age',
                    sorter: (a, b) => (a.age - b.age > 0 ? 1 : -1),
                },
                {
                    title: 'Address',
                    dataIndex: 'address',
                    filters: [
                        {
                            text: 'London',
                            value: 'London',
                        },
                        {
                            text: 'New York',
                            value: 'New York',
                        },
                    ],
                    filterMultiple: false,
                    onFilter: (value, record) => record.address.indexOf(value) === 0,
                    sorter: (a, b) => a.address.length - b.address.length,
                },
            ],
            sortData: [
                {
                    key: '1',
                    other: 'other',
                    name: 'John Brown',
                    age: 32,
                    address: 'New York No. 1 Lake Park',
                },
                {
                    key: '2',
                    other: 'other',
                    name: 'Jim Green',
                    age: 42,
                    address: 'London No. 1 Lake Park',
                },
                {
                    key: '3',
                    other: 'other',
                    name: 'Joe Black',
                    age: 32,
                    address: 'Sidney No. 1 Lake Park',
                },
                {
                    key: '4',
                    other: 'other',
                    name: 'Jim Red',
                    age: 32,
                    address: 'London No. 2 Lake Park',
                },
            ],
        };

        this.onChange = (...args) => {
            console.log('Table changed to:', ...args);
        };
    }

    render() {
        const { sortColumns, sortData } = this.state;
        return (
            <Table
                columns={sortColumns}
                dataSource={sortData}
                onChange={this.onChange}
                className="data table"
            />
        );
    }
}

export default App;
