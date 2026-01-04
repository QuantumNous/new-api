import React, { useState, useEffect, useRef } from 'react';
import { Table, Avatar, Input, Space } from '@douyinfe/semi-ui';
import type { ColumnProps } from '../../../interface';
import * as dateFns from 'date-fns';

/**
 * test with cypress, please don't modify this story
 */
export default function App() {
    const [dataSource, setData] = useState([]);
    const [filteredValue, setFilteredValue] = useState(['设计稿']);
    const compositionRef = useRef({ isComposition: false });

    const DAY = 24 * 60 * 60 * 1000;
    const figmaIconUrl = 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/figma-icon.png';

    const handleChange = (value: string) => {
        if (compositionRef.current?.isComposition) {
            return;
        }
        const newFilteredValue = value ? [value] : [];
        setFilteredValue(newFilteredValue);
    };
    const handleCompositionStart = () => {
        compositionRef.current.isComposition = true;
    };

    const handleCompositionEnd = (event: React.CompositionEvent) => {
        compositionRef.current.isComposition = false;
        const value = event.target?.value;
        const newFilteredValue = value ? [value] : [];
        setFilteredValue(newFilteredValue);
    };


    const columns: ColumnProps[] = [
        {
            title: (
                <Space>
                    <span>标题</span>
                    <Input
                        style={{ width: 200 }}
                        defaultValue={filteredValue[0]}
                        onCompositionStart={handleCompositionStart}
                        onCompositionEnd={handleCompositionEnd}
                        onChange={handleChange}
                        showClear 
                    />
                </Space>
            ),
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
            onFilter: (value, record) => record.name.includes(value),
            filteredValue,
        },
        {
            title: '大小',
            dataIndex: 'size',
            sorter: (a, b) => (a.size - b.size > 0 ? 1 : -1),
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

    const getData = () => {
        const data = [];
        for (let i = 0; i < 46; i++) {
            const isSemiDesign = i % 2 === 0;
            const randomNumber = (i * 1000) % 199;
            data.push({
                key: '' + i,
                name: isSemiDesign ? `Semi Design 设计稿${i}.fig` : `Semi D2C 首页${i}.fig`,
                owner: isSemiDesign ? '姜鹏志' : '郝宣',
                size: randomNumber,
                updateTime: new Date('2024-01-25').valueOf() + randomNumber * DAY,
                avatarBg: isSemiDesign ? 'grey' : 'red',
            });
        }
        return data;
    };

    useEffect(() => {
        const data = getData();
        setData(data);
    }, []);

    return <Table columns={columns} dataSource={dataSource} />;
}
