import React from 'react';
import { Table, Avatar } from '@douyinfe/semi-ui';

const ExpandDemo = () => {
    const expandColumns = [
        {
            title: 'Name',
            dataIndex: 'name',
            width: 250,
            fixed: 'left',
            key: 'name',
            render: (text, record, index, { expandIcon: realExpandIcon }) => (
                <>
                    {/* {record.description ? realExpandIcon : null} */}
                    {text}
                </>
            ),
        },
        { title: 'Age', dataIndex: 'age', key: 'age', width: 200 },
        { title: 'Address', dataIndex: 'address', key: 'address' },
        {
            width: 200,
            title: 'Action',
            dataIndex: '',
            key: 'x',
            render: () => <a>Delete</a>,
            fixed: 'right',
        },
    ];

    const expandData = [
        {
            key: 1,
            name: 'John Brown',
            age: 32,
            address: 'New York No. 1 Lake Park',
            description: 'My name is John Brown, I am 32 years old, living in New York No. 1 Lake Park.',
        },
        {
            key: 2,
            name: 'Jim Green',
            age: 42,
            address: 'London No. 1 Lake Park',
            // description: 'My name is Jim Green, I am 42 years old, living in London No. 1 Lake Park.',
        },
        {
            key: 3,
            name: 'Joe Black',
            age: 32,
            address: 'Sidney No. 1 Lake Park',
            description: 'My name is Joe Black, I am 32 years old, living in Sidney No. 1 Lake Park.',
        },
    ];

    return (
        <Table
            data-cy="expand"
            keepDOM
            columns={expandColumns}
            // defaultExpandAllRows
            // rowKey={'kkk'}
            expandedRowRender={(record, index, expanded) => (
                <article style={{ margin: 0 }}>
                    <p>
                        {index}: {expanded ? 'expanded' : 'unexpanded'}
                    </p>
                    <p>{record.description}</p>
                </article>
            )}
            onExpand={(expanded, expandedRow, domEvent) => {
                domEvent && domEvent.stopPropagation();
                console.log(expanded, expandedRow, domEvent);
            }}
            onRow={(record, index) => ({
                onClick: () => {
                    console.log(`Row ${index} clicked: `, record);
                },
            })}
            hideExpandedColumn={false}
            expandCellFixed={true}
            dataSource={expandData}
            scroll={{ x: '160%' }}
        />
    );
};

function TreeKeepDOM() {
    const columns = [
        {
            title: 'Key',
            dataIndex: 'dataKey',
            key: 'dataKey',
        },
        {
            title: '名称',
            dataIndex: 'name',
            key: 'name',
            width: 200,
        },
        {
            title: '数据类型',
            dataIndex: 'type',
            key: 'type',
            width: 400,
        },
        {
            title: '描述',
            dataIndex: 'description',
            key: 'description',
        },
        {
            title: '默认值',
            dataIndex: 'default',
            key: 'default',
            width: 100,
        },
    ];

    const data = [
        {
            key: 1,
            dataKey: 'videos_info',
            name: '视频信息',
            type: 'Object 对象',
            description: '视频的元信息',
            default: '无',
            children: [
                {
                    key: 11,
                    dataKey: 'status',
                    name: '视频状态',
                    type: 'Enum <Integer> 枚举',
                    description: '视频的可见、推荐状态',
                    default: '1',
                },
                {
                    key: 12,
                    dataKey: 'vid',
                    name: '视频 ID',
                    type: 'String 字符串',
                    description: '标识视频的唯一 ID',
                    default: '无',
                    children: [
                        {
                            dataKey: 'video_url',
                            name: '视频地址',
                            type: 'String 字符串',
                            description: '视频的唯一链接',
                            default: '无',
                        },
                    ],
                },
            ],
        },
        {
            key: 2,
            dataKey: 'text_info',
            name: '文本信息',
            type: 'Object 对象',
            description: '视频的元信息',
            default: '无',
            children: [
                {
                    key: 21,
                    dataKey: 'title',
                    name: '视频标题',
                    type: 'String 字符串',
                    description: '视频的标题',
                    default: '无',
                },
                {
                    key: 22,
                    dataKey: 'video_description',
                    name: '视频描述',
                    type: 'String 字符串',
                    description: '视频的描述',
                    default: '无',
                },
            ],
        },
    ];

    return <Table data-cy="tree" keepDOM columns={columns} dataSource={data} />;
}

function SectionDemo() {

    const DAY = 24 * 60 * 60 * 1000;
    const figmaIconUrl = 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/figma-icon.png';

    const columns = [
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
                    text: 'Semi D2C 设计稿',
                    value: 'Semi D2C 设计稿',
                },
            ],
            onFilter: (value, record) => record.name.includes(value),
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
        },
    ];

    const getData = () => {
        const data = [];
        for (let i = 0; i < 46; i++) {
            const isSemiDesign = i % 2 === 0;
            const randomNumber = ((i * 1000) % 19) + 100;
            data.push({
                key: '' + i,
                name: isSemiDesign ? `Semi Design 设计稿${i}.fig` : `Semi D2C 设计稿${i}.fig`,
                owner: isSemiDesign ? '姜鹏志' : '郝宣',
                size: randomNumber,
                updateTime: new Date('2023-12-07').valueOf() + (i * 1000) % 199,
                avatarBg: isSemiDesign ? 'grey' : 'red',
            });
        }
        return data;
    };

    const data = getData();

    const rowKey = record =>
        `${record.owner && record.owner.toLowerCase()}-${record.name && record.name.toLowerCase()}`;

    return (
        <div style={{ padding: '20px 0px' }}>
            <Table
                data-cy="section"
                keepDOM
                dataSource={data}
                rowKey={rowKey}
                groupBy={'size'}
                columns={columns}
                renderGroupSection={groupKey => <strong>根据文件大小分组 {groupKey} KB</strong>}
                onGroupedRow={(group, index) => {
                    return {
                        onClick: e => {
                            console.log(`Grouped row clicked: `, group, index);
                        },
                    };
                }}
                clickGroupedRowToExpand // if you want to click the entire row to expand
                scroll={{ y: 480 }}
            />
        </div>
    );
}

export default function Demo() {
    return (
        <div>
            <ExpandDemo />
            <TreeKeepDOM />
            <SectionDemo />
        </div>
    )
}
