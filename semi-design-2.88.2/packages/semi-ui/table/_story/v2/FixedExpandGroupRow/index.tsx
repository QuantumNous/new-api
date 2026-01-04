import React, { useEffect, useState } from 'react';
import { pull, union } from 'lodash';
import { Table, Avatar, Descriptions, Tag } from '@douyinfe/semi-ui';
import { IconMore } from '@douyinfe/semi-icons';

import { OnExpand } from '../../../interface';

export default function App() {
    const [data, setData] = useState([]);
    const [expandData, setExpandedData] = useState<any>(undefined);
    const [allGroupKeys, setAllGroupKeys] = useState([]);
    const [expandedRowKeys, setExpandedRowKeys] = useState([]);

    const columns = [
        {
            title: '标题',
            width: 500,
            dataIndex: 'name',
            render: (text, record, index) => {
                return (
                    <span>
                        <Avatar size="small" shape="square" src={record.nameIconSrc} style={{ marginRight: 12 }}></Avatar>
                        {text}
                    </span>
                );
            },
        },
        {
            title: '大小',
            dataIndex: 'size',
        },
        {
            title: '所有者',
            dataIndex: 'owner',
            render: (text, record, index) => {
                return (
                    <div>
                        <Avatar size="small" color={record.avatarBg} style={{ marginRight: 4 }}>
                            {typeof text === 'string' && text.slice(0, 1)}
                        </Avatar>
                        {text}
                    </div>
                );
            },
        },
        {
            title: '更新日期',
            dataIndex: 'updateTime',
        },
        {
            title: '',
            dataIndex: 'operate',
            render: () => {
                return <IconMore />;
            },
        },
    ];

    useEffect(() => {
        const data = [
            {
                key: '1',
                name: 'Semi Design 设计稿.fig',
                nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/figma-icon.png',
                size: '2M',
                owner: '姜鹏志',
                updateTime: '2020-02-02 05:13',
                avatarBg: 'grey',
            },
            {
                key: '2',
                name: 'Semi Design 分享演示文稿',
                nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png',
                size: '2M',
                owner: '郝宣',
                updateTime: '2020-01-17 05:31',
                avatarBg: 'red',
            },
            {
                key: '3',
                name: '设计文档',
                nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png',
                size: '34KB',
                owner: 'Zoey Edwards',
                updateTime: '2020-01-26 11:01',
                avatarBg: 'light-blue',
            },
        ];
        const expandData = {
            '0': [
                { key: '实际用户数量', value: '1,480,000' },
                { key: '7天留存', value: '98%' },
                { key: '安全等级', value: '3级' },
                { key: '垂类标签', value: <Tag style={{ margin: 0 }}>设计</Tag> },
                { key: '认证状态', value: '未认证' },
            ],
            '1': [
                { key: '实际用户数量', value: '2,480,000' },
                { key: '7天留存', value: '90%' },
                { key: '安全等级', value: '1级' },
                { key: '垂类标签', value: <Tag style={{ margin: 0 }}>模板</Tag> },
                { key: '认证状态', value: '已认证' },
            ],
            '2': [
                { key: '实际用户数量', value: '2,920,000' },
                { key: '7天留存', value: '98%' },
                { key: '安全等级', value: '2级' },
                { key: '垂类标签', value: <Tag style={{ margin: 0 }}>文档</Tag> },
                { key: '认证状态', value: '已认证' },
            ],
        };
        const allGroupKeys = Array.from(new Set(data.map(item => item.size)));
        setData(data);
        setExpandedData(expandData);
        setAllGroupKeys(allGroupKeys);
        setExpandedRowKeys([...allGroupKeys, data[0].name]);
    }, []);
    
    
    const expandRowRender = (record, index) => {
        return <Descriptions align="justify" data={expandData[index]} />;
    };

    const handleExpand: OnExpand<typeof data[0]> = (expanded, record) => {
        console.log('onExpand', expanded, record);
        let newExpandedRowKeys = [...expandedRowKeys];

        if ('groupKey' in record) {
            if (!expanded) {
                newExpandedRowKeys = pull(newExpandedRowKeys, record.groupKey);
            } else {
                newExpandedRowKeys = [...pull(newExpandedRowKeys, ...allGroupKeys), record.groupKey];
            }
        } else {
            console.log('record.name', record.name);
            if (!expanded) {
                newExpandedRowKeys = pull(newExpandedRowKeys, record.name);
            } else {
                newExpandedRowKeys = union(newExpandedRowKeys, [record.name]);
            }
        }

        console.log('newExpandedRowKeys', newExpandedRowKeys);

        setExpandedRowKeys(newExpandedRowKeys);
    };
    
    return (
        <div>
            <h4>controlled expandedRowKeys</h4>
            <Table
                columns={columns}
                dataSource={data}
                rowKey="name"
                expandedRowKeys={expandedRowKeys}
                expandedRowRender={expandRowRender}
                pagination={false}
                groupBy={'size'}
                // defaultExpandAllGroupRows
                renderGroupSection={groupKey => <strong>根据文件大小分组 {groupKey} KB</strong>}
                onExpand={handleExpand}
            />
        </div>
    );
}