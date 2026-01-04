import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Table, Switch, Avatar, Tooltip } from '../../../index';

function Demo() {
    const rowKey = record => `${record.city && record.city.toLowerCase()}-${record.job && record.job.toLowerCase()}`;
    const [dynamic, setDynamic] = useState(false);
    const [times, setTimes] = useState(1);
    const { current: cache } = useRef({ times, size: 1, interval: null, intervalTimeout: 3000 });

    useEffect(() => {
        if (dynamic) {
            cache.interval = setInterval(() => {
                cache.times++;
                setTimes(cache.times);
            }, cache.intervalTimeout);
        }

        return () => {
            clearInterval(cache.interval);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dynamic]);

    const data = useMemo(() => {
        /**
         * FE => frontend engineer
         * BE => backend engineer
         * Andoird => android engineer
         * IOS => ios engineer
         * SE => software engineer
         */
        const rawData = [
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

        const start = 0;
        const end = times * cache.size;
        const newData = [];

        for (let i = start + 1; i <= end; i++) {
            newData.push(
                ...rawData.map(item => ({
                    ...item,
                    job: `${item.job } L${i}`,
                }))
            );
        }
        console.log('newData: ', newData);
        return newData;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [times]);

    const columns = [
        {
            dataIndex: 'city',
            title: 'City',
            width: 200,
            sorter: (a, b) => (a.city > b.city ? 1 : -1),
            fixed: 'left',
        },
        {
            dataIndex: 'job',
            title: 'Job',
            filters: [{ text: 'IOS', value: 'IOS' }, { text: 'Android', value: 'Android' }],
            onFilter: (value, record) => record.job && record.job.indexOf(value) === 0,
        },
        {
            dataIndex: 'department',
            title: 'Department',
            fixed: 'right',
            width: 200,
            render: text => (
                <span>
                    <Avatar src={'https://sf6-cdn-tos.douyinstatic.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/Lark20190614-154048.png'} />
                    <Tooltip content={text}>
                        <span>{text}</span>
                    </Tooltip>
                </span>
            ),
        },
    ];

    return (
        <div style={{ padding: '20px 0px', width: 600 }}>
            <div>
                <span>
                    动态增加数据：
                    <Switch checked={dynamic} onChange={checked => setDynamic(checked)} />
                </span>
            </div>
            <Table
                dataSource={data}
                rowKey={rowKey}
                groupBy={'city'}
                columns={columns}
                renderGroupSection={groupKey => <strong>Jobs in {groupKey}:</strong>}
                onGroupedRow={(group, index) => ({
                    // onMouseEnter: () => {
                    //     console.log(`Grouped row mouse enter: `, group, index);
                    // },
                    // onMouseLeave: () => {
                    //     console.log(`Grouped row mouse leave: `, group, index);
                    // },
                    onClick: () => {
                        console.log('Grouped row mouse click: ', group, index);
                    },
                })}
                style={{ width: 800, margin: 20 }}
                // bordered
                defaultExpandAllRows
                clickGroupedRowToExpand
                scroll={{
                    x: 1200,
                    y: 600,
                }}
                virtualized
                pagination={false}
            />
        </div>
    );
}

export default Demo;
