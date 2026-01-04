import React, { useRef } from 'react';
import { Table, Avatar, Button } from '@douyinfe/semi-ui';

const DAY = 24 * 60 * 60 * 1000;

const columns = [
    {
        title: '标题',
        dataIndex: 'name',
        width: 200,
        fixed: true,
        render: (text, record, index) => {
            return (
                <div>
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
    },
    {
        title: '大小',
        dataIndex: 'size',
        width: 150,
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
        fixed: 'right',
        width: 150,
        sorter: (a, b) => a.updateTime - b.updateTime > 0 ? 1 : -1,
        render: (value) => {
            return dateFns.format(new Date(value), 'yyyy-MM-dd');
        }
    }
];

const getData = () => {
    const data = [];
    for (let i = 0; i < 1000; i++) {
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

const data = getData();

function VirtualizedFixedDemo() {
    let virtualizedListRef = useRef();
    const scroll = { y: 400, x: 900 };
    const style = { width: 750, margin: '0 auto' };

    return (
        <>
            <Button onClick={() => virtualizedListRef.current.scrollToItem(100)}>Scroll to 100</Button>
            <Table
                pagination={false}
                columns={columns}
                dataSource={data}
                scroll={scroll}
                style={style}
                virtualized
                getVirtualizedListRef={ref => virtualizedListRef = ref}
            />
        </>
    );
}

render(VirtualizedFixedDemo);
