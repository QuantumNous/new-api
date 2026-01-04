import React, { useMemo } from 'react';
import { Table, Avatar } from '@douyinfe/semi-ui/';

const DAY = 24 * 60 * 60 * 1000;
const figmaIconUrl = 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/figma-icon.png';

function EventTable(props = {}) {
    const columns = useMemo(
        () => [
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
        ],
        []
    );

    const data = useMemo(() => {
        const _data = [];
        for (let i = 0; i < 46; i++) {
            const isSemiDesign = i % 2 === 0;
            const randomNumber = (i * 1000) % 199;
            _data.push({
                key: '' + i,
                name: isSemiDesign ? `Semi Design 设计稿${i}.fig` : `Semi Pro 设计稿${i}.fig`,
                owner: isSemiDesign ? '姜鹏志' : '郝宣',
                size: randomNumber,
                updateTime: new Date().valueOf() + randomNumber * DAY,
                avatarBg: isSemiDesign ? 'grey' : 'red'
            });
        }
        return _data;
    }, []);

    const onRow = useMemo(
        () => (record, index) => {
            const props = {
                className: 'my-tr-class',
            };

            if (index === 2) {
                return {
                    ...props,
                    onClick: e => console.log('mouse click: ', record, index),
                };
            } else {
                return {
                    ...props,
                };
            }
        },
        []
    );
    const onHeaderRow = useMemo(
        () => (columns, index) => {
            return {
                onMouseEnter: e => console.log('mouse enter: ', columns, index),
                onMouseLeave: e => console.log('mouse leave: ', columns, index),
            };
        },
        []
    );

    return <Table columns={columns} dataSource={data} onRow={onRow} onHeaderRow={onHeaderRow} />;
}

render(EventTable);
