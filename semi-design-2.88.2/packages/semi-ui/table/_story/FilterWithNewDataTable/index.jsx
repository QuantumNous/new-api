import React from 'react';
import { Table, Button } from '@douyinfe/semi-ui';
import copy from 'fast-copy';

export default class FilterWithNewDataTable extends React.Component {
    constructor(p) {
        super(p);
        this.state = {
            sortColumns: [
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
                    ],
                    onFilter: (value, record) => record.name.indexOf(value) === 0,
                    sorter: (a, b) => a.name.length - b.name.length,
                },
                {
                    title: 'Age',
                    dataIndex: 'age',
                    sorter: (a, b) => a.age - b.age,
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
            ]
        };

        this.onChange = (...args) => {
        };
    }

    render() {
        const { sortColumns, sortData } = this.state;
        return (
            <div>
                <Button onClick={() => {
                    let _new = copy(this.state);
                    _new.sortData = [];
                    _new.sortData.push({
                        key: '5',
                        name: 'Jim Red2',
                        age: 33,
                        address: 'London No. 2 Lake Park',
                    });
                    _new.sortData.push({
                        key: '6',
                        name: 'Ji3m Red2',
                        age: 33,
                        address: 'London No. 2 Lake Park',
                    });
                    this.setState(_new);
                }}>
                    update
                </Button>
                <Table columns={sortColumns} dataSource={sortData} onChange={this.onChange} />
            </div>
        );
    }
}