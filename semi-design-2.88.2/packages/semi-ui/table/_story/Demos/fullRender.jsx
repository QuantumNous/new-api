import React, { useState, useEffect, useMemo } from 'react';
import { Table, Avatar } from '@douyinfe/semi-ui';

const DAY = 24 * 60 * 60 * 1000;
const figmaIconUrl = 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/figma-icon.png';

const columns = [
    {
        title: ({ sorter, filter, selection }) => (
            <span style={{ display: 'inline-flex', alignItems: 'center', paddingLeft: 20 }}>
                {selection}
                <span style={{ marginLeft: 8 }}>Name</span>
                {sorter}
                {filter}
            </span>
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
        useFullRender: true,
        // 此处从render的第四个形参中解构出 展开按钮、选择按钮、文本等内容
        render: (text, record, index, { expandIcon, selection, indentText }) => {
            return (
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    {indentText}
                    {expandIcon}
                    {selection}
                    <span style={{ marginLeft: 8 }}>
                        <Avatar size="small" shape="square" src={figmaIconUrl} style={{ marginRight: 12 }}></Avatar>
                        {text}
                    </span>
                </span>
            );
        },
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

    },
    {
        title: '更新日期',
        dataIndex: 'updateTime',
        sorter: (a, b) => a.updateTime - b.updateTime > 0 ? 1 : -1,
        render: (value) => {
            return dateFns.format(new Date(value), 'yyyy-MM-dd');
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
            updateTime: new Date().valueOf() + randomNumber * DAY,
            avatarBg: isSemiDesign ? 'grey' : 'red'
        });
    }
    return data;
};

function Demo() {
    const [dataSource, setDataSource] = useState([]);
    const total = 46;
    const pagination = useMemo(() => ({
        pageSize: 12,
    }), []);

    const rowSelection = useMemo(() => {
        return {
            hidden: true,
            fixed: 'left',
        };
    }, []);

    useEffect(() => {
        const data = getData(total);
        setDataSource(data);
    }, [total]);

    return (
        <Table
            pagination={pagination}
            rowSelection={rowSelection}
            columns={columns}
            dataSource={dataSource}
            onChange={(...args) => console.log(...args)}
            expandedRowRender={record => <article>{record.name}</article>}
        />
    );
}

render(Demo);
