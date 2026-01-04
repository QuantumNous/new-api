import React, { useState, useMemo } from 'react';
import { Table, Avatar } from '@douyinfe/semi-ui';
import * as dateFns from 'date-fns';

const figmaIconUrl = 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/figma-icon.png';
const columns = [
    {
        title: '标题',
        dataIndex: 'name',
        width: 400,
        render: (text, record, index) => {
            const renderObject = {};
            const children = (
                <div>
                    <Avatar size="small" shape="square" src={figmaIconUrl} style={{ marginRight: 12 }}></Avatar>
                    {text}
                </div>
            );
            renderObject.children = children;
            if (index === 0) {
                renderObject.props = {
                    colSpan: 4,
                };
            }
            if (index === 1) {
                renderObject.props = {
                    rowSpan: 2,
                };
            }
            if (index === 2) {
                renderObject.props = {
                    rowSpan: 0,
                };
            }
            return renderObject;
        },
    },
    {
        title: '大小',
        dataIndex: 'size',
        render: (text, record, index) => {
            if (index === 0) {
                return {
                    children: `${text} KB`,
                    props: {
                        colSpan: 0,
                    }
                };
            }
            if (index === 1) {
                return {
                    children: `${text} KB`,
                    props: {
                        rowSpan: 2,
                    }
                };
            }
            if (index === 2) {
                return {
                    children: `${text} KB`,
                    props: {
                        rowSpan: 0,
                    }
                };
            }
            return `${text} KB`;
        }
    },
    {
        title: '所有者',
        dataIndex: 'owner',
        render: (text, record, index) => {
            const children = (
                <div>
                    <Avatar size="small" color={record.avatarBg} style={{ marginRight: 4 }}>{typeof text === 'string' && text.slice(0, 1)}</Avatar>
                    {text}
                </div>
            );
            if (index === 0) {
                return {
                    children,
                    props: {
                        colSpan: 0,
                    }
                };
            }
            return children;
        }
    },
    {
        title: '更新日期',
        dataIndex: 'updateTime',
        sorter: (a, b) => a.updateTime - b.updateTime > 0 ? 1 : -1,
        render: (value, record, index) => {
            const children = dateFns.format(new Date(value), 'yyyy-MM-dd');
            if (index === 0) {
                return {
                    children,
                    props: {
                        colSpan: 0
                    }
                };
            }
            if (index === 1) {
                return {
                    children,
                    props: {
                        rowSpan: 2
                    }
                };
            }
            if (index === 2) {
                return {
                    children,
                    props: {
                        rowSpan: 0
                    }
                };
            }
            return children;
        }
    }
];

const DAY = 24 * 60 * 60 * 1000;

function App() {
    const [dataSource, setData] = useState([]);

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

    useEffect(() => {
        const data = getData(5);
        setData(data);
    }, []);

    return <Table columns={columns} dataSource={dataSource} pagination={false} />;
}

render(App);
