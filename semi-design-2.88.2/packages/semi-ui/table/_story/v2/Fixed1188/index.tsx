import React, { useState, useEffect, useMemo } from 'react';

import { Table, Avatar } from '@douyinfe/semi-ui';
import { ColumnProps } from '@douyinfe/semi-ui/table';

const figmaIconUrl = 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/figma-icon.png';

App.storyName = 'fixed github 1188';
/**
 * fix https://github.com/DouyinFE/semi-design/issues/1188
 */
function App() {
    const [dataSource, setData] = useState([]);
    const [filteredValue, setFilteredValue] = useState(['Semi Pro 设计稿']);

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
            defaultFilteredValue: filteredValue,
        },
        {
            title: '大小',
            dataIndex: 'size',
            sorter: (a, b) => a.size - b.size > 0 ? 1 : -1,
            defaultSortOrder: 'ascend',
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
        console.log('onChange', options);
    };

    useEffect(() => {
        const data = getData(46);
        setData(data);
    }, []);

    return (
        <div>
            <Table columns={columns} dataSource={dataSource} onChange={handleChange} />
        </div>
    );
}

export default App;