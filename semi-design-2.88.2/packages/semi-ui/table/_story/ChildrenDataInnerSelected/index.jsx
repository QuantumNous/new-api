import { Checkbox, Table } from '@douyinfe/semi-ui';
import React, { useCallback, useMemo, useState } from 'react';
import * as _ from 'lodash';

const getKey = (record, rowKey) => (typeof rowKey === 'function' ? rowKey(rowKey) : _.get(record, rowKey));

const storeKeys = (parent = null, dataSource = [], map = {}, rowKey = 'key', childrenRecordName = 'children') => {
    if (Array.isArray(dataSource) && dataSource.length) {
        dataSource.forEach(record => {
            const key = getKey(record, rowKey);
            const children = _.get(record, childrenRecordName);

            if (Array.isArray(children) && children.length) {
                storeKeys(record, children, map, rowKey, childrenRecordName);
            }

            if (parent) {
                if (Array.isArray(map[key])) {
                    map[key].push(parent);
                } else {
                    map[key] = [parent];
                }
            }
        });
    }

    return map;
};

function ChildrenDataSelectedDemo(props = {}) {
    const childrenRecordName = 'children';
    const rowKey = 'key';
    const [expandedRowKeys, setExpandedRowKeys] = useState([1, 2]);
    const [selectedRowKeys, setSelectedRowKeys] = useState([]);
    const getRecordKey = useCallback(record => getKey(record, rowKey), [rowKey]);
    const disabledRecord = useCallback(
        record => {
            const children = _.get(record, childrenRecordName);
            return !(Array.isArray(children) && children.length);
        },
        [childrenRecordName]
    );

    const data = useMemo(
        () => [
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
        ],
        []
    );
    const keysMap = useMemo(() => storeKeys(null, data, {}, rowKey, childrenRecordName), [
        data,
        rowKey,
        childrenRecordName,
    ]);

    const doSelect = (record, selected) => {
        const key = getRecordKey(record, rowKey);

        const children = _.get(record, childrenRecordName, []);
        const parents = _.get(keysMap, key);
        const set = new Set([...selectedRowKeys]);

        if (selected) {
            set.add(key);
        } else {
            set.delete(key);
        }

        const selectChildren = (selected = false, children = []) => {
            if (typeof disabledRecord === 'function') {
                children = _.filter(children, child => !disabledRecord(child));
            }
            if (Array.isArray(children) && children.length) {
                _.each(children, child => {
                    const key = getKey(child, rowKey);
                    const curChildren = _.get(child, childrenRecordName);

                    if (selected) {
                        set.add(key);
                    } else {
                        set.delete(key);
                    }
                    selectChildren(selected, curChildren);
                });
            }
        };

        selectChildren(selected, children);

        _.each(parents, parent => {
            const childrenKeys = _.get(parent, childrenRecordName, [])
                .filter(parentChild => !disabledRecord(parentChild))
                .map(getRecordKey);

            const allSelected = childrenKeys.length && childrenKeys.every(key => set.has(key));
            const parentKey = getRecordKey(parent);

            if (allSelected) {
                set.add(parentKey);
            } else {
                set.delete(parentKey);
            }
            return false;
        });

        setSelectedRowKeys(Array.from(set));
    };

    const doSelectAll = useCallback((selected, selectedRows) => {
        const keys = selected ? _.map(selectedRows, row => getRecordKey(row, rowKey)) : [];
        setSelectedRowKeys(keys);
    }, []);

    const columns = useMemo(
        () => [
            {
                title: 'Name',
                dataIndex: 'name',
                key: 'name',
                width: 300,
                render: (text, record) => (
                    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                        {_.size(_.get(record, childrenRecordName)) ? (
                            <Checkbox
                                checked={selectedRowKeys.includes(_.get(record, rowKey))}
                                onChange={e => doSelect(record, e.target.checked)}
                                style={{ display: 'inline-flex', marginRight: 5 }}
                            />
                        ) : null}
                        {text}
                    </span>
                ),
            },
            {
                title: 'Age',
                dataIndex: 'age',
                key: 'age',
                width: 150,
            },
            {
                title: 'Address',
                dataIndex: 'address',
                key: 'address',
            },
        ],
        [selectedRowKeys]
    );
    return (
        <Table
            columns={columns}
            rowKey={rowKey}
            childrenRecordName={childrenRecordName}
            expandedRowKeys={expandedRowKeys}
            onExpandedRowsChange={rows => setExpandedRowKeys(rows.map(item => item[rowKey]))}
            dataSource={data}
        />
    );
}

export default ChildrenDataSelectedDemo;
