import React, { useState, useMemo, useEffect } from 'react';
import { Table, Avatar, Space } from '@douyinfe/semi-ui';
import * as dateFns from 'date-fns';
import { IconChevronDown, IconChevronUp } from '@douyinfe/semi-icons';
import { SortOrder } from '../../../interface';

export default function App() {
    const [dataSource, setData] = useState([]);

    const DAY = 24 * 60 * 60 * 1000;
    const figmaIconUrl = 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/figma-icon.png';

    function SortIcon(props: { sortOrder: SortOrder }) {
        const { sortOrder } = props;
        const isUpOn = sortOrder === "ascend";
        const isDownOn = sortOrder === "descend";
        return (
            <Space vertical spacing={0}>
                <IconChevronUp style={{ color: isUpOn ? "var(--semi-color-primary)" : undefined, transform: 'translateY(3px)' }} />
                <IconChevronDown style={{ color: isDownOn ? "var(--semi-color-primary)" : undefined, transform: 'translateY(-3px)' }} />
            </Space>
        );
    }

    const columns = [
        {
            title: '标题',
            dataIndex: 'name',
            width: 400,
            render: (text, record, index) => {
                return (
                    <div>
                        <Avatar size="small" shape="square" src={figmaIconUrl} style={{ marginRight: 12 }}></Avatar>
                        {text}
                    </div>
                );
            },
            filters: [
                {
                    text: 'Semi Design 设计稿',
                    value: 'Semi Design 设计稿',
                },
                {
                    text: 'Semi D2C 设计稿',
                    value: 'Semi D2C 设计稿',
                },
            ],
            onFilter: (value, record) => record.name.includes(value),
            sorter: (a, b) => (a.name.length - b.name.length > 0 ? 1 : -1),
        },
        {
            title: '大小',
            dataIndex: 'size',
            sorter: (a, b) => (a.size - b.size > 0 ? 1 : -1),
            sortIcon: SortIcon,
            render: text => `${text} KB`,
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
            sorter: (a, b) => (a.updateTime - b.updateTime > 0 ? 1 : -1),
            render: value => {
                return dateFns.format(new Date(value), 'yyyy-MM-dd');
            },
        },
    ];

    const rowSelection = useMemo(
        () => ({
            onChange: (selectedRowKeys, selectedRows) => {
                console.log(`selectedRowKeys: ${selectedRowKeys}`, 'selectedRows: ', selectedRows);
            },
            getCheckboxProps: record => ({
                disabled: record.name === 'Michael James', // Column configuration not to be checked
                name: record.name,
            }),
        }),
        []
    );
    const scroll = useMemo(() => ({ y: 300 }), []);

    const getData = () => {
        const data = [];
        for (let i = 0; i < 46; i++) {
            const isSemiDesign = i % 2 === 0;
            const randomNumber = (i * 1000) % 199;
            data.push({
                key: '' + i,
                name: isSemiDesign ? `Semi Design 设计稿${i}.fig` : `Semi D2C 设计稿${i}.fig`,
                owner: isSemiDesign ? '姜鹏志' : '郝宣',
                size: randomNumber,
                updateTime: new Date('2023-12-22').valueOf() + randomNumber * DAY,
                avatarBg: isSemiDesign ? 'grey' : 'red',
            });
        }
        return data;
    };

    useEffect(() => {
        const data = getData();
        setData(data);
    }, []);

    return <Table columns={columns} dataSource={dataSource} rowSelection={rowSelection} scroll={scroll} />;
}
