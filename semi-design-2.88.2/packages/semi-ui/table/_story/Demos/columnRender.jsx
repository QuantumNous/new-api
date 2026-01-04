import React from 'react';
import { Table, Avatar, Button, Empty, Typography } from '@douyinfe/semi-ui';
import { IconDelete } from '@douyinfe/semi-icons';
import { IllustrationNoResult, IllustrationNoResultDark } from '@douyinfe/semi-illustrations';
const { Text } = Typography;

const raw = [
    {
        key: '1',
        name: 'Semi Design 设计稿标题可能有点长这时候应该显示 Tooltip.fig',
        nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/figma-icon.png',
        size: '2M',
        owner: '姜鹏志',
        updateTime: '2020-02-02 05:13',
        avatarBg: 'grey'

    },
    {
        key: '2',
        name: 'Semi Design 分享演示文稿',
        nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png',
        size: '2M',
        owner: '郝宣',
        updateTime: '2020-01-17 05:31',
        avatarBg: 'red'
    },
    {
        key: '3',
        name: '设计文档',
        nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png',
        size: '34KB',
        owner: 'Zoey Edwards',
        updateTime: '2020-01-26 11:01',
        avatarBg: 'light-blue'
    },
    {
        key: '4',
        name: 'Semi Pro 设计文档可能也有点长所以也会显示Tooltip',
        nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png',
        size: '34KB',
        owner: '姜琪',
        updateTime: '2020-01-26 11:01',
        avatarBg: 'green'
    }
];

function App() {
    const [dataSource, setData] = useState(raw);

    const removeRecord = (key) => {
        let newDataSource = [...dataSource];
        if (key != null) {
            let idx = newDataSource.findIndex(data => data.key === key);

            if (idx > -1) {
                newDataSource.splice(idx, 1);
                setData(newDataSource);
            }
        }
    };
    const resetData = () => {
        const newDataSource = [...raw];
        setData(newDataSource);
    };

    const columns = [
        {
            title: '标题',
            dataIndex: 'name',
            width: 400,
            render: (text, record, index) => {
                return (
                    <span style={{ display: 'flex', alignItems: 'center' }}>
                        <Avatar size="small" shape="square" src={record.nameIconSrc} style={{ marginRight: 12 }}></Avatar>
                        {/* 宽度计算方式为单元格设置宽度 - 非文本内容宽度 */}
                        <Text ellipsis={{ showTooltip: true }} style={{ width: 'calc(400px - 76px)' }}>
                            {text}
                        </Text>
                    </span>
                );
            }
        },
        {
            title: '大小',
            dataIndex: 'size',
            width: 150,
        },
        {
            title: '所有者',
            dataIndex: 'owner',
            width: 300,
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
            width: 200,
        },
        {
            title: '',
            dataIndex: 'operate',
            render: (text, record) => <Button icon={<IconDelete />} theme='borderless' onClick={() => removeRecord(record.key)} />
        },
    ];

    const empty = (
        <Empty
            image={<IllustrationNoResult />}
            darkModeImage={<IllustrationNoResultDark />}
            description={'搜索无结果'}
        />
    );


    return (
        <>
            <Button onClick={resetData} style={{ marginBottom: 10 }}>重置</Button>
            <Table style={{ minHeight: 350 }} columns={columns} dataSource={dataSource} pagination={false} empty={empty} />
        </>
    );
}

render(App);