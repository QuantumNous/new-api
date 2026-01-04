import React, { useState, useEffect, useRef } from 'react';
import { Table, Button } from '../../../index';

function Demo() {
    const rowKey = record => `${record.city && record.city.toLowerCase()}-${record.job && record.job.toLowerCase()}`;
    const tableRef = useRef();
    const [data, setData] = useState([]);

    useEffect(() => {
        /**
         * FE => frontend engineer
         * BE => backend engineer
         * Andoird => android engineer
         * IOS => ios engineer
         * SE => software engineer
         */
        const data = [
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
        setData(data);
    }, []);

    const columns = [
        { dataIndex: 'city', title: 'City', width: 400, sorter: (a, b) => (a.city > b.city ? 1 : -1) },
        {
            dataIndex: 'job',
            title: 'Job',
            width: 200,
            filters: [{ text: 'IOS', value: 'IOS' }, { text: 'Android', value: 'Android' }],
            onFilter: (value, record) => record.job && record.job.indexOf(value) === 0,
        },
        { dataIndex: 'department', title: 'Department' },
    ];

    return (
        <div style={{ padding: '20px 0px' }}>
            <div>
                <Button onClick={() => console.log(tableRef.current && tableRef.current.getCurrentPageData())}>
                    打印当前页数据
                </Button>
            </div>
            <Table
                dataSource={data}
                rowKey={rowKey}
                groupBy={'city'}
                columns={columns}
                renderGroupSection={groupKey => <strong>Jobs in {groupKey}:</strong>}
                onGroupedRow={(group, index) => {
                    return {
                        // onMouseEnter: () => {
                        //     console.log(`Grouped row mouse enter: `, group, index);
                        // },
                        // onMouseLeave: () => {
                        //     console.log(`Grouped row mouse leave: `, group, index);
                        // },
                        onClick: () => {
                            console.log(`Grouped row mouse click: `, group, index);
                        },
                    };
                }}
                defaultExpandAllRows
                clickGroupedRowToExpand
                onExpand={(...args) => console.log('onExpand', args)}
                onExpandedRowsChange={(...args) => console.log('onExpandedRowsChange', args)}
                scroll={{ y: 480 }}
                ref={tableRef}
            />
        </div>
    );
}

export default Demo;
