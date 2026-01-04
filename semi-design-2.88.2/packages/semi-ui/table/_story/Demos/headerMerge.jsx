import React, { useMemo } from 'react';
import { Table, Avatar } from '@douyinfe/semi-ui';
import { IconMore } from '@douyinfe/semi-icons';

const DAY = 24 * 60 * 60 * 1000;
const figmaIconUrl = 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/figma-icon.png';

const columns = [
    {
        title: '基本信息',
        fixed: 'left',
        children: [
            {
                title: '标题',
                dataIndex: 'name',
                width: 300,
                fixed: true,
                render: (text, record, index) => {
                    return (
                        <span>
                            <Avatar size="small" shape="square" src={figmaIconUrl} style={{ marginRight: 12 }}></Avatar>
                            {text}
                        </span>
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
                width: 100,
                fixed: true,
                sorter: (a, b) => a.size - b.size > 0 ? 1 : -1,
                render: (text) => `${text} KB`
            },
        ]
    },
    {
        title: '其他信息',
        children: [
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
        ]
    },
    {
        title: '更多',
        fixed: 'right',
        width: 100,
        align: 'center',
        dataIndex: 'operate',
        render: () => {
            return <IconMore />;
        }
    },
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
    const data = useMemo(() => {
        const _data = getData(46);
        return _data;
    }, []);

    return (
        <Table
            rowSelection={{ fixed: true }}
            expandedRowRender={record => <article>{record.name}</article>}
            dataSource={data}
            scroll={{ y: 400 }}
            onChange={(...args) => console.log(...args)}
            columns={columns}
        />
    );
}

render(Demo);