import React, { useMemo, useState, useCallback } from "react";
import { get, union, pullAll } from "lodash-es";
import { Table } from "@douyinfe/semi-ui";

const childrenRecordName = "children";
const rowKey = "key";
const getKey = (record) => get(record, rowKey, "key");

const Demo = () => {
    const [selectedRowKeys, setSelectedRowKeys] = useState([]);

    const columns = useMemo(
        () => [
            {
                title: "Key",
                dataIndex: "dataKey",
                key: "dataKey"
            },
            {
                title: "名称",
                dataIndex: "name",
                key: "name",
                width: 200
            },
            {
                title: "数据类型",
                dataIndex: "type",
                key: "type",
                width: 400
            },
            {
                title: "描述",
                dataIndex: "description",
                key: "description"
            },
            {
                title: "默认值",
                dataIndex: "default",
                key: "default",
                width: 100
            }
        ],
        []
    );

    const data = useMemo(
        () => [
            {
                key: 1,
                dataKey: "videos_info",
                name: "视频信息",
                type: "Object 对象",
                description: "视频的元信息",
                default: "无",
                children: [
                    {
                        key: 11,
                        dataKey: "status",
                        name: "视频状态",
                        type: "Enum <Integer> 枚举",
                        description: "视频的可见、推荐状态",
                        default: "1"
                    },
                    {
                        key: 12,
                        dataKey: "vid",
                        name: "视频 ID",
                        type: "String 字符串",
                        description: "标识视频的唯一 ID",
                        default: "无",
                        children: [
                            {
                                key: 121,
                                dataKey: "video_url",
                                name: "视频地址",
                                type: "String 字符串",
                                description: "视频的唯一链接",
                                default: "无"
                            }
                        ]
                    }
                ]
            },
            {
                key: 2,
                dataKey: "text_info",
                name: "文本信息",
                type: "Object 对象",
                description: "视频的元信息",
                default: "无",
                children: [
                    {
                        key: 21,
                        dataKey: "title",
                        name: "视频标题",
                        type: "String 字符串",
                        description: "视频的标题",
                        default: "无"
                    },
                    {
                        key: 22,
                        dataKey: "video_description",
                        name: "视频描述",
                        type: "String 字符串",
                        description: "视频的描述",
                        default: "无"
                    }
                ]
            }
        ],
        []
    );

    // 自定义禁用逻辑
    const isRecordDisabled = (record) => {
        return false;
    };

    const traverse = (data, res) => {
        for (let record of data) {
            const children = get(record, "children");
            const disabled = isRecordDisabled(record);
            if (!disabled) {
                const key = getKey(record);
                res.push(key);
            }
            if (Array.isArray(children)) {
                traverse(children, res);
            }
        }
    };

    const getAllRowKeys = (data) => {
        const allRowKeys = [];
        traverse(data, allRowKeys);
        console.log("allRowKeys", allRowKeys);
        return allRowKeys;
    };

    const findShouldSelectRowKeys = (record, selected) => {
        let shouldSelectRowKeys;
        const children = get(record, "children");
        let childrenRowKeys = [];
        if (Array.isArray(children)) {
            traverse(children, childrenRowKeys);
        }

        const key = getKey(record);
        if (!selected) {
            shouldSelectRowKeys = [...selectedRowKeys];
            pullAll(shouldSelectRowKeys, [key, ...childrenRowKeys]);
        } else {
            shouldSelectRowKeys = union(selectedRowKeys, [key, ...childrenRowKeys]);
        }
        return shouldSelectRowKeys;
    };

    // 选中一行时需要选中自己可选行
    const doSelect = useCallback(
        (record, selected) => {
            const rowKeys = findShouldSelectRowKeys(record, selected);
            setSelectedRowKeys(rowKeys);
            console.log("select", record, rowKeys);
        },
        [selectedRowKeys, rowKey, childrenRecordName]
    );

    // 找出所有可选的行
    const doSelectAll = useCallback((selected, selectedRows) => {
        console.log(selected);
        let rowKeys = [];
        if (selected) {
            rowKeys = getAllRowKeys(data);
        }
        setSelectedRowKeys(rowKeys);
    }, []);

    const rowSelection = useMemo(
        () => ({
            selectedRowKeys,
            onSelect: doSelect,
            onSelectAll: doSelectAll
        }),
        [selectedRowKeys, doSelect, doSelectAll]
    );

    return (
        <Table
            columns={columns}
            rowKey={rowKey}
            resizable
            childrenRecordName={childrenRecordName}
            rowSelection={rowSelection}
            dataSource={data}
            pagination={false}
        />
    );
};

export default Demo;
