import { Table } from '@douyinfe/semi-ui';
import React from 'react';
import datsJson from './data.json';

class App extends React.Component {
    constructor() {
        super();
        const labels = [
            { text: '测试数据0', value: 4 },
            { text: '测试数据1', value: 18 },
            { text: '测试数据2', value: 3 },
            { text: '测试数据3', value: 1427 },
            { text: '测试数据4', value: 1 },
            { text: '测试数据5', value: 1406 },
            { text: '测试数据6', value: 1404 },
            { text: '测试数据7', value: 1401 },
            { text: '测试数据8', value: 1397 },
            { text: '测试数据9', value: 1396 },
            { text: '测试数据10', value: 2 },
            { text: '测试数据11', value: 24 },
            { text: '测试数据12', value: 23 },
        ];
        this.state = {
            data: datsJson,

            columns: [
                {
                    title: 'Name',
                    dataIndex: 'username',
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
                    filterDropdownProps: {
                        position: 'top',
                        autoAdjustOverflow: false,
                    },
                },
                {
                    title: '标签',
                    dataIndex: 'labelIds',
                    filters: labels,
                    filterMultiple: true,
                    onFilter: (value, record) => {
                        const labelIdsArr = record.labelIds.split(',').map(l => Number(l));
                        console.log('record ==> ', value, labelIdsArr, labelIdsArr.includes(value));
                        return labelIdsArr.includes(value);
                    },
                    render: (text, record) => (
                        <span>
                            {record.labels.map((l, i) => `${l.name} ${record.labels.length - 1 !== i ? ' / ' : ''}`)}
                        </span>
                    ),
                },
            ],
        };

        this.onChange = ({ filters }) => {
            console.log(filters);

            // this.setState({ data: [{ name: '1' }] });
        };
    }

    render() {
        return (
            <Table rowKey={'id'} columns={this.state.columns} dataSource={this.state.data} onChange={this.onChange} />
        );
    }
}

export default App;
