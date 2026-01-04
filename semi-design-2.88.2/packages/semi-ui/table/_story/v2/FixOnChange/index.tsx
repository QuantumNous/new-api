import React, { useState, useEffect, useMemo } from 'react';
import { Table, Avatar } from '@douyinfe/semi-ui';
import { ColumnProps } from '../../../interface';

/**
 * 修复第一列 onFilter 未传时，点击第二列的 sorter，onChange filters 为空问题
 */
function App() {
    const [dataSource, setData] = useState([]);

    const scroll = useMemo(() => ({ y: 300 }), []);

    const columns: ColumnProps[] = [
        {
            title: '标题',
            dataIndex: 'name',
            width: 400,
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
            // onFilter: (value, record) => record.name.includes(value),
            sorter: (a, b) => a.name.length - b.name.length > 0 ? 1 : -1,
            defaultFilteredValue: ['Semi Pro 设计稿'],
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

    const handleChange = (options) => {
        // do not modify console
        // test with Cypress
        console.log(options.filters.length);
    };

    useEffect(() => {
        const data = getData(46);
        setData(data);
    }, []);

    return (
        <div>
            <Table columns={columns} dataSource={dataSource} scroll={scroll} onChange={handleChange} />
        </div>
    );
}

App.storyName = 'fix onChange #1572';
export default App;