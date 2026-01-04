import React, { useState, useEffect, useMemo } from 'react';
import { Table, Avatar, Button } from '@douyinfe/semi-ui';
import * as dateFns from 'date-fns';
import { ColumnProps, ChangeInfoFilter } from '@douyinfe/semi-ui/table';

const DAY = 24 * 60 * 60 * 1000;
const figmaIconUrl = 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/figma-icon.png';

function App() {
    const [dataSource, setData] = useState([]);
    const [filteredValue, setFilteredValue] = useState(['Semi Pro 设计稿']);

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
            filters: [
                {
                    text: 'Semi Design 设计稿',
                    value: 'Semi Design 设计稿',
                },
                {
                    text: 'Semi Pro 设计稿',
                    value: 'Semi Pro 设计稿',
                },
            ],
            onFilter: (value, record) => record.name.includes(value),
            sorter: (a, b) => a.name.length - b.name.length > 0 ? 1 : -1,
            // filterMultiple: false,
            // filteredValue: filteredValue,
            defaultFilteredValue: filteredValue,
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

    const handleFilterChange = (filters: ChangeInfoFilter<any>[]) => {
        console.log('filters', filters);
        if (Array.isArray(filters) && filters.length) {
            const { filteredValue } = filters.find(filter => filter.dataIndex === 'name');
            setFilteredValue(filteredValue);
        }
    };

    const handleChange = (options) => {
        const { filters } = options;
        handleFilterChange(filters);
    };

    const toggleChangeData = () => {
        const length = dataSource.length;
        const newData = getData(length === 46 ? 25 : 46);
        setData(newData);
    };

    useEffect(() => {
        const data = getData(46);
        setData(data);
    }, []);

    return (
        <div>
            <Button onClick={toggleChangeData}>toggle change dataSource (46/25)</Button>
            <Table columns={columns} dataSource={dataSource} scroll={scroll} onChange={handleChange} />
        </div>
    );
}

App.storyName = 'defaultFilteredValue';
export default App;