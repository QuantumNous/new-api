import React, { useState } from 'react';
import { Table, Button, Space } from '../../../index';

const initData = [
    { city: 'Beijing', job: 'FE', department: 'IES' },
    { city: 'Beijing', job: 'BE', department: 'IES' },
    { city: 'Shanghai', job: 'Android', department: 'IES' },
    { city: 'Tokyo', job: 'Android', department: 'IES' },
    { city: 'Shanghai', job: 'IOS', department: 'EE' },
    { city: 'LA', job: 'SE', department: 'EE' },
    { city: 'Beijing', job: 'Android', department: 'EE' },
    { city: 'Tokyo', job: 'IOS', department: 'EE' },
    { city: 'Tokyo', job: 'SE', department: 'DATA' },
    { city: 'Shanghai', job: 'BE', department: 'DATA' },
    { city: 'LA', job: 'Android', department: 'DATA' },
    { city: 'LA', job: 'IOS', department: 'DATA' },
];

const columns = [
    { dataIndex: 'city', title: 'City', width: 400, sorter: (a, b) => (a.city > b.city ? 1 : -1) },
    {
        dataIndex: 'job',
        title: 'Job',
        width: 200,
        filters: [
            { text: 'IOS', value: 'IOS' },
            { text: 'Android', value: 'Android' },
        ],
        onFilter: (value, record) => record.job && record.job.indexOf(value) === 0,
    },
    { dataIndex: 'department', title: 'Department' },
];

const rowKey = record => `${record.city && record.city.toLowerCase()}-${record.job && record.job.toLowerCase()}`;

export default function App() {
    const [data, setData] = useState([]);
    const [expandAllGroupRows, setExpandAllGroupRows] = useState(true);
    const handleClick = () => {
        setData(Array.isArray(data) && data.length ? [] : initData);
    };
    const toggleExpandAllGroupRows = () => {
        setExpandAllGroupRows(!expandAllGroupRows);
    };

    return (
        <div style={{ padding: '20px 0px' }}>
            <Space>
                <Button onClick={handleClick}>
                    {
                        Array.isArray(data) && data.length ? '清空数据' : '加载数据'
                    }
                </Button>
                <Button onClick={toggleExpandAllGroupRows}>动态设置expandAllGroupRows</Button>
            </Space><br /><br />
            <label>defaultExpandAllGroupRows</label>
            <Table
                dataSource={data}
                rowKey={rowKey}
                groupBy={'city'}
                columns={columns}
                renderGroupSection={groupKey => <strong>Jobs in {groupKey}:</strong>}
                onGroupedRow={(group, index) => ({
                    onClick: e => {
                        console.log('Grouped row clicked: ', group, index);
                    }
                })}
                clickGroupedRowToExpand // if you want to click the entire row to expand
                scroll={{ y: 480 }}
                defaultExpandAllGroupRows
            />
            <label>expandAllGroupRows={`${expandAllGroupRows}`}</label>
            <Table
                dataSource={data}
                rowKey={rowKey}
                groupBy={'city'}
                columns={columns}
                renderGroupSection={groupKey => <strong>Jobs in {groupKey}:</strong>}
                onGroupedRow={(group, index) => ({
                    onClick: e => {
                        console.log('Grouped row clicked: ', group, index);
                    }
                })}
                clickGroupedRowToExpand // if you want to click the entire row to expand
                scroll={{ y: 480 }}
                expandAllGroupRows={expandAllGroupRows}
            />
        </div>
    );
}
