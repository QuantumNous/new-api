import React from 'react';
import TreeSelect, { TreeSelectProps } from '../index';

const Demo = (props: TreeSelectProps): React.ReactElement => {
    const treeData = [
        {
            label: 'Asia',
            value: 'Asia',
            key: '0',
            children: [
                {
                    label: 'China',
                    value: 'China',
                    key: '0-0',
                    children: [
                        {
                            label: 'Beijing',
                            value: 'Beijing',
                            key: '0-0-0',
                        },
                        {
                            label: 'Shanghai',
                            value: 'Shanghai',
                            key: '0-0-1',
                        },
                    ],
                },
                {
                    label: 'Japan',
                    value: 'Japan',
                    key: '0-1',
                    children: [
                        {
                            label: 'Osaka',
                            value: 'Osaka',
                            key: '0-1-0'
                        }
                    ]
                },
            ],
        },
        {
            label: 'North America',
            value: 'North America',
            key: '1',
            children: [
                {
                    label: 'United States',
                    value: 'United States',
                    key: '1-0'
                },
                {
                    label: 'Canada',
                    value: 'Canada',
                    key: '1-1'
                }
            ]
        }
    ];
    return (
        <div>
            <TreeSelect
                style={{ width: 300 }}
                dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
                treeData={treeData}
                filterTreeNode
                placeholder="单选可搜索的"
            />
            <TreeSelect
                style={{ width: 300 }}
                dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
                treeData={treeData}
                multiple
                filterTreeNode
                maxTagCount={2}
                placeholder="多选可搜索的"
                searchPlaceholder="请输入关键字开始搜索"
            />
        </div>
    );
};

export default Demo;