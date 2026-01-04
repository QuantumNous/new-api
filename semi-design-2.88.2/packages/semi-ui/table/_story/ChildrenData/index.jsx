import React, { useState } from 'react';
import { Button, Table } from '@douyinfe/semi-ui/';
import { IconArrowDown, IconArrowUp } from '@douyinfe/semi-icons';

/**
 * Aligned to Ant Design APIs for migration, see [antd-demo](https://codesandbox.io/s/great-mcclintock-14fl7).
 */
const Demo = () => {
    const childrenRecordName = 'children';
    const rowKey = 'key';
    const [expandedRowKeys, setExpandedRowKeys] = useState([1]);
    const [data, setData] = useState([
        {
            key: 1,
            name: 'ZhangSan',
            age: 30,
            address: 'bytedance 1',
            children: [
                {
                    key: 11,
                    name: 'LiSi',
                    age: 40,
                    address: 'bytedance 2',
                },
                {
                    key: 12,
                    name: 'WangWu',
                    age: 30,
                    address: 'bytedance 2',
                    children: [
                        {
                            key: 121,
                            name: 'XiaoMing',
                            age: 50,
                            address: 'bytedance 3',
                        },
                    ],
                },
                {
                    key: 13,
                    name: 'XiaoZhang',
                    age: 60,
                    address: 'bytedance 4',
                    children: [
                        {
                            key: 131,
                            name: 'XiaoLi',
                            age: 50,
                            address: 'bytedance 5',
                            children: [
                                {
                                    key: 1311,
                                    name: 'XiaoGuo',
                                    age: 40,
                                    address: 'bytedance 6',
                                },
                                {
                                    key: 1312,
                                    name: 'XiaoHong',
                                    age: 30,
                                    address: 'bytedance 7',
                                },
                            ],
                        },
                    ],
                },
            ],
        },
        {
            key: 2,
            name: 'XiaoGang',
            age: 80,
            address: 'bytedance 8',
        },
    ]);

    const switchRecord = (key1, key2) => {
        const newData = [...data];

        if (key1 != null && key2 != null) {
            const item1 = findRecordByKey(key1, newData);
            const item2 = findRecordByKey(key2, newData);

            // you have to copy item1 and item2 first
            const copiedItem1 = { ...item1 };
            const copiedItem2 = { ...item2 };

            coverRecord(item1, copiedItem2);
            coverRecord(item2, copiedItem1);

            setData(newData);
        }
    };

    const findRecordByKey = (key, data) => {
        if (Array.isArray(data) && data.length && key != null) {
            for (let item of data) {
                if (item[rowKey] === key) {
                    return item;
                }

                const children = item[childrenRecordName];
                if (Array.isArray(children) && children.length) {
                    const item = findRecordByKey(key, children);

                    if (item != null) {
                        return item;
                    }
                }
            }
        }
    };

    const coverRecord = (obj, srcObj) => {
        if (obj && typeof obj === 'object' && srcObj && typeof srcObj === 'object') {
            const srcKeys = Object.keys(srcObj);
            const copied = { ...srcObj };

            Object.assign(obj, copied);

            Object.keys(obj).forEach(key => {
                if (!srcKeys.includes(key)) {
                    delete obj[key];
                }
            });
        }

        return obj;
    };

    const getSameLevelRecords = (key, data = []) => {
        if (key != null && Array.isArray(data) && data.length) {
            if (data.find(item => item[rowKey] === key)) {
                return data;
            }
            for (let item of data) {
                const records = getSameLevelRecords(key, item[childrenRecordName]);

                if (records.length) {
                    return records;
                }
            }
        }
        return [];
    };

    const columns = [
        {
            title: 'Name',
            dataIndex: 'name',
            key: 'name',
            width: 300,
            fixed: 'left',
        },
        {
            title: 'Age',
            dataIndex: 'age',
            key: 'age',
            width: 150,
            filterChildrenRecord: true,
            filters: [
                { text: 'age < 30', value: 30 },
                { text: 'age < 20', value: 20 },
                { text: 'age < 10', value: 10 },
            ],
            onFilter: (filteredValue, record) => {
                // console.log(`filteredValue: `, filteredValue, ` record: `, record);
                return record.age < filteredValue;
            },
            sorter: (v1, v2) => {
                return v1.age < v2.age ? -1 : 1;
            },
            sortChildrenRecord: true,
        },
        {
            title: 'Address',
            dataIndex: 'address',
            key: 'address',
            width: 300,
        },
        {
            key: 'operation',
            render: record => {
                const records = getSameLevelRecords(record[rowKey], data);
                const index = records.findIndex(item => item[rowKey] === record[rowKey]);
                const upProps = {};
                const downProps = {};

                if (index > 0) {
                    const upRow = records[index - 1];
                    upProps.onClick = () => switchRecord(record[rowKey], upRow[rowKey]);
                } else {
                    upProps.disabled = true;
                }

                if (index < records.length - 1) {
                    const downRow = records[index + 1];
                    downProps.onClick = () => switchRecord(record[rowKey], downRow[rowKey]);
                } else {
                    downProps.disabled = true;
                }

                return (
                    <>
                        <Button icon={<IconArrowUp/>} {...upProps} />
                        <Button icon={<IconArrowDown/>} {...downProps} />
                    </>
                );
            },
        },
    ];

    return (
        <Table
            columns={columns}
            rowKey={rowKey}
            childrenRecordName={childrenRecordName}
            expandedRowKeys={expandedRowKeys}
            onExpand={(expanded, row, event) => {
                console.log([expanded, row, event]);

                if (event) {
                    event.stopPropagation();
                }
            }}
            onRow={(record, index) => {
                return {
                    onClick: () => {
                        console.log(`Clicked row ${index}: `, record);
                    },
                };
            }}
            onExpandedRowsChange={rows => setExpandedRowKeys(rows.map(item => item[rowKey]))}
            rowSelection={{
                getCheckboxProps: record => ({
                    disabled: record.name && record.name.includes('Jimmy'), // Column configuration not to be checked
                }),
                fixed: 'left',
            }}
            dataSource={data}
            // indentSize={0}
            // expandIcon={false}
            scroll={{
                x: '160%',
                y: 480,
            }}
        />
    );
};

export default Demo;
