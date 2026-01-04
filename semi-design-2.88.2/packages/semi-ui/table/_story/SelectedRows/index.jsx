import { Table, Button } from '@douyinfe/semi-ui';
import React, { useMemo, useState, useEffect } from 'react';

function App() {
    const [dataTotalSize, setTotalSize] = useState(46);
    const [pagination, setPagination] = useState({ pageSize: 12, total: dataTotalSize, currentPage: 1 });

    const [dataSource, setDataSource] = useState([]);
    const defaultSelectedRowKeys = useMemo(() => ['1', '8', '17'], []);
    const [selectedRowKeys, setSelectedRowKeys] = useState(defaultSelectedRowKeys);
    const footerText = useMemo(() => `当前选中 ${selectedRowKeys.length} 项`, [selectedRowKeys]);

    const randomTotalSize = () => {
        setTotalSize(40 + Math.round(Math.random() * 100));
    };

    const columns = useMemo(() => [
        {
            title: 'Name',
            dataIndex: 'name',
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
        {
            render: () => (
                <input
                    type="checkbox"
                    onClick={(...args) => {
                        console.log('onClick: ', ...args);
                    }}
                    onChange={(...args) => {
                        console.log('onChange: ', ...args);
                    }}
                />
            ),
        },
    ]);

    const data = useMemo(() => {
        const _data = [];
        for (let i = 0; i < dataTotalSize; i++) {
            let age = (i * 1000) % 149 ;
            let name = `Edward King ${i}`;
            _data.push({
                key: '' + i,
                name,
                age,
                address: `London, Park Lane no. ${i} Lake Park`,
                description: `My name is ${name}, I am ${age} years old, living in New York No. ${i + 1} Lake Park.`,
            });
        }
        return _data;
    }, [dataTotalSize]);

    useEffect(() => {
        setPagination({ ...pagination, total: dataTotalSize });
    }, [dataTotalSize]);

    useEffect(() => {
        const dataSource = [];
        const { pageSize } = pagination;
        dataSource.push(...data.slice(0, pageSize));
        setDataSource(dataSource);
    }, [data]);

    const rowSelection = {
        onChange: (selectedRowKeys, selectedRows) => {
            console.log(
                `rowSelection.onChanged: selectedRowKeys: ${JSON.stringify(selectedRowKeys)}`,
                'selectedRows: ',
                selectedRows
            );
            setSelectedRowKeys(selectedRowKeys);
        },
        onSelectAll: (selected, selectedRows, changedRows) => {
            console.log(
                `rowSelection.onSelectAll: selected :${selected}, selectedRows: ${selectedRows}, changedRows: ${changedRows}`
            );
        },
        getCheckboxProps: record => ({
            // disabled: record.name === 'Michael James', // Column configuration not to be checked
            disabled: true,
            name: record.name,
            onClick: (...args) => {
                console.log('Clicked checkbox: ', ...args);
            },
        }),
        onSelect: (record, selected) => {
            console.log('onSelect: ', record, selected);
        },
        disabled: true,
        selectedRowKeys,
        defaultSelectedRowKeys,
    };

    const onChange = (props = {}) => {
        const { pagination = {} } = props;
        const { currentPage, pageSize, total } = pagination;

        // console.log(`Table changed to: `, data);
        setDataSource(data.slice((currentPage - 1) * pageSize, currentPage * pageSize));
        setPagination({ currentPage, pageSize, total });
    };

    return (
        <div>
            <div>
                <Button onClick={randomTotalSize}>随机数据量</Button>
            </div>
            <Table
                rowKey={record => record.key}
                columns={columns}
                dataSource={dataSource}
                rowSelection={rowSelection}
                pagination={pagination}
                onChange={onChange}
                footer={footerText}
                onRow={(record, index) => {
                    return {
                        onClick: () => {
                            console.log(`onRow.onClick: `, record, index);
                        },
                    };
                }}
            />
        </div>
    );
}

export default App;
