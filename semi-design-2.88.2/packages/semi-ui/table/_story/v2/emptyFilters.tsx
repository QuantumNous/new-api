import React, { useState, useEffect, useMemo } from 'react';
import { Table, Avatar, Input } from '../../../index';
import { ColumnProps, ChangeInfoFilter } from '../../interface';

const DAY = 24 * 60 * 60 * 1000;
const figmaIconUrl = 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/figma-icon.png';

function App() {
    const [dataSource, setData] = useState([]);
    const [filteredValue, setFilteredValue] = useState([]);

    const scroll = useMemo(() => ({ y: 300 }), []);

    const columns: ColumnProps[] = [
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
            onFilter: (value, record) => record.name.includes(value),
            filteredValue: filteredValue,
        },
        {
            title: '大小',
            dataIndex: 'size',
            sorter: (a, b) => a.size - b.size > 0 ? 1 : -1,
            render: (text) => `${text} KB`
        },
        {
            title: '所有者',
            dataIndex: 'owner',
            render: (text, record, index) => {
                return (
                    <div>
                        <Avatar size="small" color={record.avatarBg} style={{ marginRight: 4 }}>{typeof text === 'string' && text.slice(0, 1)}</Avatar>
                        {text}
                    </div>
                );
            }

        }
    ];

    const getData = (total) => {
        const data = [];
        for (let i = 0; i < total; i++) {
            const isSemiDesign = i % 2 === 0;
            const randomNumber = (i * 1000) % 199;
            data.push({
                key: '' + i,
                name: isSemiDesign ? `Semi Design 设计稿${i}.fig` : `Semi Pro 设计稿${i}.fig`,
                owner: isSemiDesign ? '姜鹏志' : '郝宣',
                size: randomNumber,
                avatarBg: isSemiDesign ? 'grey' : 'red'
            });
        }
        return data;
    };

    const handleFilterChange = (value: string) => {
        setFilteredValue([value]);
    };

    useEffect(() => {
        const data = getData(46);
        setData(data);
    }, []);

    return (
        <div>
            <Input placeholder="筛选标题" style={{ width: 200 }} value={filteredValue[0]} onChange={handleFilterChange}></Input>
            <Table columns={columns} dataSource={dataSource} scroll={scroll} onChange={console.log} />
        </div >
    );
}

App.storyName = 'filters 空';
export default App;