---
localeCode: en-US
order: 80
category: Show
title: Table
subTitle: Table
icon: doc-table
dir: column
brief: Tables are used to present structured data content, usually accompanied by the ability to manipulate the data (sort, search, paginate...).
---

## How to Use

Into the header. `columns` And data. `DataSource` To render.

> Please provide a "key" for each data item in the dataSource that is different from the value of the other data items, or use the row Key parameter to specify an attribute name as the primary key, alternative row operation functions such as row selection and expansion of the table.

```jsx noInline=true import
import React from 'react';
import { Table } from '@douyinfe/semi-ui';

function App() {
    const columns = [
        {
            title: 'Title',
            dataIndex: 'name',
        },
        {
            title: 'Size',
            dataIndex: 'size',
        },
        {
            title: 'Owner',
            dataIndex: 'owner',
        },
        {
            title: 'Update',
            dataIndex: 'updateTime',
        },
    ];
    const data = [
        {
            key: '1',
            name: 'Semi Design design draft.fig',
            nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/figma-icon.png',
            size: '2M',
            owner: 'Jiang Pengzhi',
            updateTime: '2020-02-02 05:13',
            avatarBg: 'grey',
        },
        {
            key: '2',
            name: 'Semi Design share docs',
            nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png',
            size: '2M',
            owner: 'Hao Xuan',
            updateTime: '2020-01-17 05:31',
            avatarBg: 'red',
        },
        {
            key: '3',
            name: 'Design docs',
            nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png',
            size: '34KB',
            owner: 'Zoey Edwards',
            updateTime: '2020-01-26 11:01',
            avatarBg: 'light-blue',
        },
    ];

    return <Table columns={columns} dataSource={data} pagination={false} />;
}
```

## Demos

### Basic Table

For tables, the two most basic parameters are `dataSource` and `columns`, the former is the data item, the latter is the configuration of each column, both are array types.

```jsx live=true noInline=true dir="column"
import React from 'react';
import { Table, Avatar } from '@douyinfe/semi-ui';
import { IconMore } from '@douyinfe/semi-icons';

function App() {
    const columns = [
        {
            title: 'Title',
            dataIndex: 'name',
            render: (text, record, index) => {
                return (
                    <div>
                        <Avatar
                            size="small"
                            shape="square"
                            src={record.nameIconSrc}
                            style={{ marginRight: 12 }}
                        ></Avatar>
                        {text}
                    </div>
                );
            },
        },
        {
            title: 'Size',
            dataIndex: 'size',
        },
        {
            title: 'Owner',
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
            title: 'Update',
            dataIndex: 'updateTime',
        },
        {
            title: '',
            dataIndex: 'operate',
            render: () => {
                return <IconMore />;
            },
        },
    ];
    const data = [
        {
            key: '1',
            name: 'Semi Design design draft.fig',
            nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/figma-icon.png',
            size: '2M',
            owner: 'Jiang Pengzhi',
            updateTime: '2020-02-02 05:13',
            avatarBg: 'grey',
        },
        {
            key: '2',
            name: 'Semi Design share docs',
            nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png',
            size: '2M',
            owner: 'Hao Xuan',
            updateTime: '2020-01-17 05:31',
            avatarBg: 'red',
        },
        {
            key: '3',
            name: 'Design docs',
            nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png',
            size: '34KB',
            owner: 'Zoey Edwards',
            updateTime: '2020-01-26 11:01',
            avatarBg: 'light-blue',
        },
    ];

    return <Table columns={columns} dataSource={data} pagination={false} />;
}

render(App);
```

### JSX Writing

You can also use JSX syntax definitions `columns`, note that Table only supports `columns` JSX syntax definition. You cannot use any component package `Table.Column`.

> Note: JSX-written tables are not supported the parameter `Resizable`.

<Notice type="primary" title="Notice">
    <div>When columns are written in JSX, please do not use it at the same time as the configuration method; if used at the same time, only the configuration method will take effect, and no aggregation operation will be performed.</div>
</Notice>

```jsx live=true noInline=true dir="column"
import React from 'react';
import { Table, Avatar } from '@douyinfe/semi-ui';
import { IconMore } from '@douyinfe/semi-icons';

const { Column } = Table;

function App() {
    const data = [
        {
            key: '1',
            name: 'Semi Design design draft.fig',
            nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/figma-icon.png',
            size: '2M',
            owner: 'Jiang Pengzhi',
            updateTime: '2020-02-02 05:13',
            avatarBg: 'grey',
        },
        {
            key: '2',
            name: 'Semi Design share docs',
            nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png',
            size: '2M',
            owner: 'Hao Xuan',
            updateTime: '2020-01-17 05:31',
            avatarBg: 'red',
        },
        {
            key: '3',
            name: 'Design docs',
            nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png',
            size: '34KB',
            owner: 'Zoey Edwards',
            updateTime: '2020-01-26 11:01',
            avatarBg: 'light-blue',
        },
    ];

    const renderName = (text, record, index) => {
        return (
            <div>
                <Avatar size="small" shape="square" src={record.nameIconSrc} style={{ marginRight: 12 }}></Avatar>
                {text}
            </div>
        );
    };

    const renderOwner = (text, record, index) => {
        return (
            <div>
                <Avatar size="small" color={record.avatarBg} style={{ marginRight: 4 }}>
                    {typeof text === 'string' && text.slice(0, 1)}
                </Avatar>
                {text}
            </div>
        );
    };

    return (
        <Table dataSource={data} pagination={false}>
            <Column title="Title" dataIndex="name" key="name" render={renderName} />
            <Column title="Size" dataIndex="size" key="size" />
            <Column title="Owner" dataIndex="owner" key="owner" render={renderOwner} />
            <Column title="Update" dataIndex="updateTime" key="updateTime" />
            <Column title="" dataIndex="operate" key="operate" render={() => <IconMore />} />
        </Table>
    );
}

render(App);
```

### Row Selection Operation

This feature can be turned on by passing in `rowSelection`.

-   Click the selection box in the header, and all rows in the `dataSource` that are not in the state of `disabled` will be selected. The callback function for selecting all rows is `onSelectAll`;
-   Clicking on the row selection box will select the current row. Its callback function is `onSelect`;

<Notice title='注意事项'>
    <div>1. Be sure to provide a "key" for each row of data that is different from other row values, or use the rowKey parameter to specify a property name as the primary key.</div>
    <div>2. If you encounter the problem of returning to the first page after clicking a row selection on the second page, please check whether component rendering triggers "dataSource" update (shallow equal). After the "dataSource" is updated, the uncontrolled page turner will return to the first page. Please put "dataSource" inside state. </div>
</Notice>

```jsx live=true noInline=true dir="column"
import React from 'react';
import { Table, Avatar } from '@douyinfe/semi-ui';
import { IconMore } from '@douyinfe/semi-icons';

function App() {
    const [selectedKeys, setSelectedKeys] = useState([]);
    const columns = useMemo(() => [
        {
            title: 'Title',
            dataIndex: 'name',
            width: 400,
            render: (text, record, index) => {
                return (
                    <div>
                        <Avatar
                            size="small"
                            shape="square"
                            src={record.nameIconSrc}
                            style={{ marginRight: 12 }}
                        ></Avatar>
                        {text}
                    </div>
                );
            },
        },
        {
            title: 'Size',
            dataIndex: 'size',
        },
        {
            title: 'Owner',
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
            title: 'Update',
            dataIndex: 'updateTime',
        },
        {
            title: '',
            dataIndex: 'operate',
            render: () => {
                return <IconMore />;
            },
        },
    ], []);
    const data = useMemo(() => [
        {
            key: '1',
            name: 'Semi Design design draft.fig',
            nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/figma-icon.png',
            size: '2M',
            owner: 'Jiang Pengzhi',
            updateTime: '2020-02-02 05:13',
            avatarBg: 'grey',
        },
        {
            key: '2',
            name: 'Semi Design share docs',
            nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png',
            size: '2M',
            owner: 'Hao Xuan',
            updateTime: '2020-01-17 05:31',
            avatarBg: 'red',
        },
        {
            key: '3',
            name: 'Design docs',
            nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png',
            size: '34KB',
            owner: 'Zoey Edwards',
            updateTime: '2020-01-26 11:01',
            avatarBg: 'light-blue',
        },
        {
            key: '4',
            name: 'Semi D2C design draft.fig',
            nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/figma-icon.png',
            size: '2M',
            owner: 'Jiang Pengzhi',
            updateTime: '2020-02-02 05:13',
            avatarBg: 'grey',
        },
        {
            key: '5',
            name: 'Semi D2C share docs',
            nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png',
            size: '2M',
            owner: 'Hao Xuan',
            updateTime: '2020-01-17 05:31',
            avatarBg: 'red',
        },
        {
            key: '6',
            name: 'Semi D2C Design docs',
            nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png',
            size: '34KB',
            owner: 'Zoey Edwards',
            updateTime: '2020-01-26 11:01',
            avatarBg: 'light-blue',
        },
    ], []);
    const rowSelection = {
        getCheckboxProps: record => ({
            disabled: record.name === 'Design docs', // Column configuration not to be checked
            name: record.name,
        }),
        onSelect: (record, selected) => {
            console.log(`select row: ${selected}`, record);
        },
        onSelectAll: (selected, selectedRows) => {
            console.log(`select all rows: ${selected}`, selectedRows);
        },
        onChange: (selectedRowKeys, selectedRows) => {
            console.log(`selectedRowKeys: ${selectedRowKeys}`, 'selectedRows: ', selectedRows);
            setSelectedKeys(selectedRowKeys);
        },
    };

    const pagination = useMemo(
        () => ({
            pageSize: 3,
        }),
        []
    );

    return <Table columns={columns} dataSource={data} rowSelection={rowSelection} pagination={pagination} />;
}

render(App);
```

### Custom Rendering

Users can use Column.render to customize the rendering of a column of cells, which is suitable for rendering more complex cell content.

```jsx live=true noInline=true dir="column"
import React from 'react';
import { Table, Avatar, Button, Empty, Typography } from '@douyinfe/semi-ui';
import { IconDelete } from '@douyinfe/semi-icons';
import { IllustrationNoResult, IllustrationNoResultDark } from '@douyinfe/semi-illustrations';
const { Text } = Typography;

const raw = [
    {
        key: '1',
        name: 'Semi Design design draft title may be a bit long Tooltip should be displayed at this time.fig',
        nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/figma-icon.png',
        size: '2M',
        owner: 'Jiang Pengzhi',
        updateTime: '2020-02-02 05:13',
        avatarBg: 'grey',
    },
    {
        key: '2',
        name: 'Semi Design share docs',
        nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png',
        size: '2M',
        owner: 'Hao Xuan',
        updateTime: '2020-01-17 05:31',
        avatarBg: 'red',
    },
    {
        key: '3',
        name: 'Design docs',
        nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png',
        size: '34KB',
        owner: 'Zoey Edwards',
        updateTime: '2020-01-26 11:01',
        avatarBg: 'light-blue',
    },
    {
        key: '4',
        name: 'Semi D2C design draft title may be a bit long Tooltip should be displayed at this time.fig',
        nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png',
        size: '34KB',
        owner: 'Jiang Qi',
        updateTime: '2020-01-26 11:01',
        avatarBg: 'green',
    },
];

function App() {
    const [dataSource, setData] = useState(raw);

    const removeRecord = key => {
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
            title: 'Title',
            dataIndex: 'name',
            width: 400,
            render: (text, record, index) => {
                return (
                    <span style={{ display: 'flex', alignItems: 'center' }}>
                        <Avatar
                            size="small"
                            shape="square"
                            src={record.nameIconSrc}
                            style={{ marginRight: 12 }}
                        ></Avatar>
                        {/* The width calculation method is the cell setting width minus the non-text content width */}
                        <Text ellipsis={{ showTooltip: true }} style={{ width: 'calc(400px - 76px)' }}>
                            {text}
                        </Text>
                    </span>
                );
            },
        },
        {
            title: 'Size',
            dataIndex: 'size',
            width: 150,
        },
        {
            title: 'Owner',
            dataIndex: 'owner',
            width: 300,
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
            title: 'Update',
            dataIndex: 'updateTime',
            width: 200,
        },
        {
            title: '',
            dataIndex: 'operate',
            render: (text, record) => (
                <Button icon={<IconDelete />} theme="borderless" onClick={() => removeRecord(record.key)} />
            ),
        },
    ];

    const empty = (
        <Empty
            image={<IllustrationNoResult />}
            darkModeImage={<IllustrationNoResultDark />}
            description={'No result'}
        />
    );

    return (
        <>
            <Button onClick={resetData} style={{ marginBottom: 10 }}>
                Reset
            </Button>
            <Table
                style={{ minHeight: 350 }}
                columns={columns}
                dataSource={dataSource}
                pagination={false}
                empty={empty}
            />
        </>
    );
}

render(App);
```

### Table With Pagination

Table paging currently supports two modes: controlled and uncontrolled.

-   In controlled mode, the paging state is passed entirely externally, depending on whether the pagination .currentPage field is passed. In general, the controlled mode is suitable for remotely pulling data and rendering.
-   In uncontrolled mode, Table passes the incoming dataSource length as total to the Pagination component by default, and of course you can also pass a total field to overwrite the value of the Table component, but we do not recommend users to pass this field in uncontrolled paging mode.

> Note: The custom `pagination.total` field passed in uncontrolled conditions is supported only after version 0.25.0.

```jsx live=true noInline=true dir="column"
import React, { useState, useMemo } from 'react';
import { Table, Avatar } from '@douyinfe/semi-ui';
import * as dateFns from 'date-fns';

const figmaIconUrl = 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/figma-icon.png';
const columns = [
    {
        title: 'Title',
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
                text: 'Semi Design design draft',
                value: 'Semi Design design draft',
            },
            {
                text: 'Semi D2C design draft',
                value: 'Semi D2C design draft',
            },
        ],
        onFilter: (value, record) => record.name.includes(value),
    },
    {
        title: 'Size',
        dataIndex: 'size',
        sorter: (a, b) => (a.size - b.size > 0 ? 1 : -1),
        render: text => `${text} KB`,
    },
    {
        title: 'Owner',
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
        title: 'Update',
        dataIndex: 'updateTime',
        sorter: (a, b) => (a.updateTime - b.updateTime > 0 ? 1 : -1),
        render: value => {
            return dateFns.format(new Date(value), 'yyyy-MM-dd');
        },
    },
];

const DAY = 24 * 60 * 60 * 1000;

function App() {
    const [dataSource, setData] = useState([]);

    const rowSelection = useMemo(
        () => ({
            onChange: (selectedRowKeys, selectedRows) => {
                console.log(`selectedRowKeys: ${selectedRowKeys}`, 'selectedRows: ', selectedRows);
            },
            getCheckboxProps: record => ({
                disabled: record.name === 'Michael James', // Column configuration not to be checked
                name: record.name,
            }),
        }),
        []
    );
    const scroll = useMemo(() => ({ y: 300 }), []);

    const getData = () => {
        const data = [];
        for (let i = 0; i < 46; i++) {
            const isSemiDesign = i % 2 === 0;
            const randomNumber = (i * 1000) % 199;
            data.push({
                key: '' + i,
                name: isSemiDesign ? `Semi Design design draft${i}.fig` : `Semi D2C design draft${i}.fig`,
                owner: isSemiDesign ? 'Jiang Pengzhi' : 'Hao Xuan',
                size: randomNumber,
                updateTime: new Date().valueOf() + randomNumber * DAY,
                avatarBg: isSemiDesign ? 'grey' : 'red',
            });
        }
        return data;
    };

    useEffect(() => {
        const data = getData();
        setData(data);
    }, []);

    return <Table columns={columns} dataSource={dataSource} rowSelection={rowSelection} scroll={scroll} />;
}

render(App);
```

### Pull Remote Data

Under normal circumstances, the data is often not obtained at one time. We will retrieve the data from the interface when clicking on the page number, filter or sort button. In this case, please use **Controlled mode** To handle pagination. The user needs to pass in the `pagination.currentPage` field, where the rendering of the pagination component depends entirely on the incoming pagination object.

<Notice type="primary" title="Notice">
    <div>1. When pagination is an object type, literal is not recommended because it causes the table to render to its original state (it looks like the pager is not working). Please try to define reference type parameters outside the render method. If hooks are used, please use useMemo or useState for storage.</div>
    <div>2. In the controlled mode, Table will not paginate dataSource, please pass in current page data to dataSource</div>
</Notice>

```jsx live=true noInline=true dir="column"
import React, { useState, useMemo } from 'react';
import { Table, Avatar } from '@douyinfe/semi-ui';
import * as dateFns from 'date-fns';

const DAY = 24 * 60 * 60 * 1000;
const figmaIconUrl = 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/figma-icon.png';
const pageSize = 5;

const columns = [
    {
        title: 'Title',
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
                text: 'Semi Design design draft',
                value: 'Semi Design design draft',
            },
            {
                text: 'Semi D2C design draft',
                value: 'Semi D2C design draft',
            },
        ],
        onFilter: (value, record) => record.name.includes(value),
    },
    {
        title: 'Size',
        dataIndex: 'size',
        sorter: (a, b) => (a.size - b.size > 0 ? 1 : -1),
        render: text => `${text} KB`,
    },
    {
        title: 'Owner',
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
        title: 'Update',
        dataIndex: 'updateTime',
        sorter: (a, b) => (a.updateTime - b.updateTime > 0 ? 1 : -1),
        render: value => {
            return dateFns.format(new Date(value), 'yyyy-MM-dd');
        },
    },
];

const getData = () => {
    const data = [];
    for (let i = 0; i < 46; i++) {
        const isSemiDesign = i % 2 === 0;
        const randomNumber = (i * 1000) % 199;
        data.push({
            key: '' + i,
            name: isSemiDesign ? `Semi Design design draft${i}.fig` : `Semi D2C design draft${i}.fig`,
            owner: isSemiDesign ? 'Jiang Pengzhi' : 'Hao Xuan',
            size: randomNumber,
            updateTime: new Date().valueOf() + randomNumber * DAY,
            avatarBg: isSemiDesign ? 'grey' : 'red',
        });
    }
    return data;
};

const data = getData();

function App() {
    const [dataSource, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [currentPage, setPage] = useState(1);

    const fetchData = (currentPage = 1) => {
        setLoading(true);
        setPage(currentPage);
        return new Promise((res, rej) => {
            setTimeout(() => {
                const data = getData();
                let dataSource = data.slice((currentPage - 1) * pageSize, currentPage * pageSize);
                res(dataSource);
            }, 300);
        }).then(dataSource => {
            setLoading(false);
            setData(dataSource);
        });
    };

    const handlePageChange = page => {
        fetchData(page);
    };

    useEffect(() => {
        fetchData();
    }, []);

    return (
        <Table
            columns={columns}
            dataSource={dataSource}
            pagination={{
                currentPage,
                pageSize: 5,
                total: data.length,
                onPageChange: handlePageChange,
            }}
            loading={loading}
        />
    );
}

render(App);
```

### Fixed Column or Head

You can fix the column by setting the Fixed attribute of the column and scroll.x, and fix the header by setting scroll.y.

> -   It is recommended to specify scroll.x as a **fixed value** or percentage greater than the width of the table. If it is a fixed value, set it to >= the sum of all fixed column widths + the sum of all table column widths.
> -   Make sure that all elements inside the table do not affect the height of the cells after rendering (e.g. containing unloaded pictures, etc.). In this case, give the stator element a definite height to ensure that the left and right Fixed columns of cells are not deranged.
> -   If the column header is not aligned with the content or there is a column duplication or when the fixed column fails, specify the width width of the fixed column, if still not effective, try to recommend leaving a column with no width to accommodate the elastic layout, or check for ultra-long continuous fields to destroy the layout.

```jsx live=true noInline=true dir="column"
import React, { useState, useMemo } from 'react';
import { Table, Avatar } from '@douyinfe/semi-ui';
import { IconMore } from '@douyinfe/semi-icons';
import * as dateFns from 'date-fns';

const DAY = 24 * 60 * 60 * 1000;
const figmaIconUrl = 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/figma-icon.png';

const columns = [
    {
        title: 'Title',
        dataIndex: 'name',
        fixed: true,
        width: 250,
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
                text: 'Semi Design design draft',
                value: 'Semi Design design draft',
            },
            {
                text: 'Semi D2C design draft',
                value: 'Semi D2C design draft',
            },
        ],
        onFilter: (value, record) => record.name.includes(value),
    },
    {
        title: 'Size',
        dataIndex: 'size',
        width: 200,
        sorter: (a, b) => (a.size - b.size > 0 ? 1 : -1),
        render: text => `${text} KB`,
    },
    {
        title: 'Owner',
        dataIndex: 'owner',
        width: 200,
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
        title: 'Update',
        dataIndex: 'updateTime',
        width: 200,
        sorter: (a, b) => (a.updateTime - b.updateTime > 0 ? 1 : -1),
        render: value => {
            return dateFns.format(new Date(value), 'yyyy-MM-dd');
        },
    },
    {
        title: '',
        dataIndex: 'operate',
        fixed: 'right',
        align: 'center',
        width: 100,
        render: () => {
            return <IconMore />;
        },
    },
];

function App() {
    const [dataSource, setData] = useState([]);

    const scroll = useMemo(() => ({ y: 300, x: 1200 }), []);
    const rowSelection = useMemo(
        () => ({
            onChange: (selectedRowKeys, selectedRows) => {
                console.log(`selectedRowKeys: ${selectedRowKeys}`, 'selectedRows: ', selectedRows);
            },
            getCheckboxProps: record => ({
                disabled: record.name === 'Michael James', // Column configuration not to be checked
                name: record.name,
            }),
            fixed: true,
        }),
        []
    );

    const getData = () => {
        const data = [];
        for (let i = 0; i < 46; i++) {
            const isSemiDesign = i % 2 === 0;
            const randomNumber = (i * 1000) % 199;
            data.push({
                key: '' + i,
                name: isSemiDesign ? `Semi Design design draft${i}.fig` : `Semi D2C design draft${i}.fig`,
                owner: isSemiDesign ? 'Jiang Pengzhi' : 'Hao Xuan',
                size: randomNumber,
                updateTime: new Date().valueOf() + randomNumber * DAY,
                avatarBg: isSemiDesign ? 'grey' : 'red',
            });
        }
        return data;
    };

    useEffect(() => {
        const data = getData();
        setData(data);
    }, []);

    return <Table columns={columns} dataSource={dataSource} rowSelection={rowSelection} scroll={scroll} />;
}

render(App);
```

The header can be fixed to the top of the page with the `sticky` property. v2.21 version support. When passing `top`, you can control the distance from the scroll container.

After turning on sticky, Table will automatically turn on the fixed layout, and the column width will be determined by `column.width`. Columns without a given width are automatically assigned by the browser.

<StickyHeaderTable />

```jsx live=false noInline=true dir="column"
import React, { useState, useMemo } from 'react';
import { Table, Avatar } from '@douyinfe/semi-ui';
import { IconMore } from '@douyinfe/semi-icons';
import * as dateFns from 'date-fns';

const DAY = 24 * 60 * 60 * 1000;
const figmaIconUrl = 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/figma-icon.png';

const columns = [
    {
        title: '标题',
        dataIndex: 'name',
        fixed: true,
        width: 250,
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
        width: 200,
        sorter: (a, b) => (a.size - b.size > 0 ? 1 : -1),
        render: text => `${text} KB`,
    },
    {
        title: '所有者',
        dataIndex: 'owner',
        width: 200,
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
        width: 200,
        sorter: (a, b) => (a.updateTime - b.updateTime > 0 ? 1 : -1),
        render: value => {
            return dateFns.format(new Date(value), 'yyyy-MM-dd');
        },
    },
    {
        title: '',
        dataIndex: 'operate',
        fixed: 'right',
        align: 'center',
        width: 100,
        render: () => {
            return <IconMore />;
        },
    },
];

function App() {
    const [dataSource, setData] = useState([]);

    const scroll = useMemo(() => ({ y: 300, x: 1200 }), []);
    const rowSelection = useMemo(
        () => ({
            onChange: (selectedRowKeys, selectedRows) => {
                console.log(`selectedRowKeys: ${selectedRowKeys}`, 'selectedRows: ', selectedRows);
            },
            getCheckboxProps: record => ({
                disabled: record.name === 'Michael James', // Column configuration not to be checked
                name: record.name,
            }),
            fixed: true,
        }),
        []
    );

    const getData = () => {
        const data = [];
        for (let i = 0; i < 46; i++) {
            const isSemiDesign = i % 2 === 0;
            const randomNumber = (i * 1000) % 199;
            data.push({
                key: '' + i,
                name: isSemiDesign ? `Semi Design 设计稿${i}.fig` : `Semi D2C 设计稿${i}.fig`,
                owner: isSemiDesign ? '姜鹏志' : '郝宣',
                size: randomNumber,
                updateTime: new Date().valueOf() + randomNumber * DAY,
                avatarBg: isSemiDesign ? 'grey' : 'red',
            });
        }
        return data;
    };

    useEffect(() => {
        const data = getData();
        setData(data);
    }, []);

    return (
        <Table
            sticky={{ top: 60 }}
            columns={columns}
            dataSource={dataSource}
            rowSelection={rowSelection}
            scroll={scroll}
        />
    );
}

render(App);
```

### Table Header With Sorting and Filtering Function

Filters and sorting controls are integrated inside the table, and users can pass in the sorter display of the sorter open header by passing filters in Column and the filter control display of the onFilter open header.

> Note: Be sure to provide a "key" for each row of data that is different from other row values, or use the rowKey parameter to specify a property name as the primary key.

> Note: Sorting and filtering columns must set independent "dataIndex"

```jsx live=true noInline=true dir="column"
import React, { useState, useMemo } from 'react';
import { Table, Avatar } from '@douyinfe/semi-ui';
import * as dateFns from 'date-fns';

const DAY = 24 * 60 * 60 * 1000;
const figmaIconUrl = 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/figma-icon.png';

const columns = [
    {
        title: 'Title',
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
                text: 'Semi Design design draft',
                value: 'Semi Design design draft',
            },
            {
                text: 'Semi D2C design draft',
                value: 'Semi D2C design draft',
            },
        ],
        onFilter: (value, record) => record.name.includes(value),
        sorter: (a, b) => (a.name.length - b.name.length > 0 ? 1 : -1),
    },
    {
        title: 'Size',
        dataIndex: 'size',
        sorter: (a, b) => (a.size - b.size > 0 ? 1 : -1),
        render: text => `${text} KB`,
    },
    {
        title: 'Owner',
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
        title: 'Update',
        dataIndex: 'updateTime',
        sorter: (a, b) => (a.updateTime - b.updateTime > 0 ? 1 : -1),
        render: value => {
            return dateFns.format(new Date(value), 'yyyy-MM-dd');
        },
    },
];

function App() {
    const [dataSource, setData] = useState([]);

    const rowSelection = useMemo(
        () => ({
            onChange: (selectedRowKeys, selectedRows) => {
                console.log(`selectedRowKeys: ${selectedRowKeys}`, 'selectedRows: ', selectedRows);
            },
            getCheckboxProps: record => ({
                disabled: record.name === 'Michael James', // Column configuration not to be checked
                name: record.name,
            }),
        }),
        []
    );
    const scroll = useMemo(() => ({ y: 300 }), []);

    const getData = () => {
        const data = [];
        for (let i = 0; i < 46; i++) {
            const isSemiDesign = i % 2 === 0;
            const randomNumber = (i * 1000) % 199;
            data.push({
                key: '' + i,
                name: isSemiDesign ? `Semi Design design draft${i}.fig` : `Semi D2C design draft${i}.fig`,
                owner: isSemiDesign ? 'Jiang Pengzhi' : 'Hao Xuan',
                size: randomNumber,
                updateTime: new Date().valueOf() + randomNumber * DAY,
                avatarBg: isSemiDesign ? 'grey' : 'red',
            });
        }
        return data;
    };

    useEffect(() => {
        const data = getData();
        setData(data);
    }, []);

    return <Table columns={columns} dataSource={dataSource} rowSelection={rowSelection} scroll={scroll} />;
}

render(App);
```

When sorter is a function type, the sortOrder status can be obtained through the third parameter of the function. The function type is `(a?: RecordType, b?: RecordType, sortOrder?: 'ascend' | 'descend') => number`. Supported by version v2.47.

You can control whether to display the sorting tip through the `showSortTip` attribute. It is supported since v2.65 and defaults to `false`. When the tip is turned on, when there is only sorting function, the sorting prompt will be displayed when the mouse is moved to the table header; in other cases, the sorting prompt will be displayed only when the mouse is moved to the sorting icon.

**Note**: When using the `sortOrder` attribute for controlled sorting, since the next sort order cannot be predicted, `showSortTip` does not take effect and the prompt will not be displayed.

```jsx live=true noInline=true dir="column"
import React from 'react';
import { Table, Avatar } from '@douyinfe/semi-ui';
import * as dateFns from 'date-fns';

function App() {
    const columns = [
        {
            title: 'Title',
            dataIndex: 'name',
            width: 400,
            render: (text, record, index) => {
                return (
                    <div>
                        <Avatar size="small" shape="square" src={figmaIconUrl} style={{ marginRight: 12 }}></Avatar>
                        {text}
                    </div>
                );
            }
        },
        {
            title: 'Size',
            dataIndex: 'size',
            sorter: (r1, r2, order) => {
                const a = r1.size;
                const b = r2.size;
                if (typeof a === "number" && typeof b === "number") {
                    return a - b;
                } else if (typeof a === "undefined") {
                    return order === "ascend" ? 1 : -1;
                } else if (typeof b === "undefined") {
                    return order === "ascend" ? -1 : 1;
                } else {
                    return 0;
                }
            },
            render: text => text ? `${text} KB` : 'Unknown',
        },
        {
            title: 'Owner',
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
            title: 'Update',
            dataIndex: 'updateTime',
            render: value => {
                return dateFns.format(new Date(value), 'yyyy-MM-dd');
            },
        },
    ];

    const figmaIconUrl = 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/figma-icon.png';
    const docIconUrl = 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png';

    const dataSource = [
        {
            key: '1',
            name: 'Semi Design draft.fig',
            nameIconSrc: figmaIconUrl,
            size: 3,
            owner: 'Jiang',
            updateTime: '2020-02-02 05:13',
            avatarBg: 'grey',
        },
        {
            key: '2',
            name: 'Semi D2C draft',
            nameIconSrc: docIconUrl,
            size: undefined,
            owner: 'Hao',
            updateTime: '2020-01-17 05:31',
            avatarBg: 'red',
        },
        {
            key: '3',
            name: 'Semi D2C doc 3',
            nameIconSrc: docIconUrl,
            size: 1,
            owner: 'Zoey Edwards',
            updateTime: '2020-01-26 11:01',
            avatarBg: 'light-blue',
        },
        {
            key: '4',
            name: 'Semi Design doc 4',
            nameIconSrc: docIconUrl,
            size: 5,
            owner: 'Zoey Edwards',
            updateTime: '2020-01-26 11:01',
            avatarBg: 'light-blue',
        },
        {
            key: '5',
            name: 'Semi D2C doc 5',
            nameIconSrc: docIconUrl,
            size: undefined,
            owner: 'Zoey Edwards',
            updateTime: '2020-01-26 11:01',
            avatarBg: 'light-blue',
        },
        {
            key: '6',
            name: 'Semi Design doc 6',
            nameIconSrc: docIconUrl,
            size: 2,
            owner: 'Zoey Edwards',
            updateTime: '2020-01-26 11:01',
            avatarBg: 'light-blue',
        },
    ];

    return <Table columns={columns} dataSource={dataSource} />;
}

render(App);
```

### Custom Header Filtering

If you need to display the filter input box in the table header, you can pass ReactNode in the `title` and use it with `filteredValue`.

```jsx live=true noInline=true dir="column"
import React, { useState, useEffect, useRef } from 'react';
import { Table, Avatar, Input, Space } from '@douyinfe/semi-ui';
import * as dateFns from 'date-fns';

function App() {
    const [dataSource, setData] = useState([]);
    const [filteredValue, setFilteredValue] = useState([]);
    const compositionRef = useRef({ isComposition: false });

    const DAY = 24 * 60 * 60 * 1000;
    const figmaIconUrl = 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/figma-icon.png';


    const handleChange = (value) => {
        if (compositionRef.current.isComposition) {
            return;
        }
        const newFilteredValue = value ? [value] : [];
        setFilteredValue(newFilteredValue);
    };
    const handleCompositionStart = () => {
        compositionRef.current.isComposition = true;
    };

    const handleCompositionEnd = (event) => {
        compositionRef.current.isComposition = false;
        const value = event.target.value;
        const newFilteredValue = value ? [value] : [];
        setFilteredValue(newFilteredValue);
    };


    const columns = [
        {
            title: (
                <Space>
                    <span>Title</span>
                    <Input
                        placeholder="Input filter value"
                        style={{ width: 200 }}
                        onCompositionStart={handleCompositionStart}
                        onCompositionEnd={handleCompositionEnd}
                        onChange={handleChange}
                        showClear 
                    />
                </Space>
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
            onFilter: (value, record) => record.name.includes(value),
            filteredValue,
        },
        {
            title: 'Size',
            dataIndex: 'size',
            sorter: (a, b) => (a.size - b.size > 0 ? 1 : -1),
            render: text => `${text} KB`,
        },
        {
            title: 'Owner',
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
            title: 'Update',
            dataIndex: 'updateTime',
            sorter: (a, b) => (a.updateTime - b.updateTime > 0 ? 1 : -1),
            render: value => {
                return dateFns.format(new Date(value), 'yyyy-MM-dd');
            },
        },
    ];

    const getData = () => {
        const data = [];
        for (let i = 0; i < 46; i++) {
            const isSemiDesign = i % 2 === 0;
            const randomNumber = (i * 1000) % 199;
            data.push({
                key: '' + i,
                name: isSemiDesign ? `Semi Design design draft${i}.fig` : `Semi D2C design draft${i}.fig`,
                owner: isSemiDesign ? 'Jiang Pengzhi' : 'Hao Xuan',
                size: randomNumber,
                updateTime: new Date().valueOf() + randomNumber * DAY,
                avatarBg: isSemiDesign ? 'grey' : 'red',
            });
        }
        return data;
    };

    useEffect(() => {
        const data = getData();
        setData(data);
    }, []);

    return <Table columns={columns} dataSource={dataSource} />;
}

render(App);
```



### Custom Filter Rendering

Use `renderFilterDropdown` to customize the render filter panel. v2.52 supported.

You can call `setTempFilteredValue` to store the filter value when the user enters the filter value, and call `confirm` to trigger the actual filtering after the filter value is entered. You can also filter directly through `confirm({ filteredValue })`.

The reason for setting `tempFilteredValue` is that in scenarios where temporary filtered values need to be stored, there is no need to declare a state to save this temporary filtered value.

```typescript
type RenderFilterDropdown = (props: RenderFilterDropdownProps) => React.ReactNode;
interface RenderFilterDropdownProps {
     /** Temporary filter value, the initial value is `filteredValue` or `defaultFilteredValue` */
     tempFilteredValue: any[];
     /** Set temporary filter value */
     setTempFilteredValue: (tempFilteredValue: any[]) => void;
     /** `confirm` will assign `tempFilteredValue` to `filteredValue` by default and trigger the `onChange` event. You can also set the filter value directly by passing in `filteredValue` */
     confirm: (props?: { closeDropdown?: boolean; filteredValue?: any[] }) => void;
     /** Clear filter values and temporary filter values */
     clear: (props?: { closeDropdown?: boolean }) => void;
     /** Close dropdown */
     close: () => void;
     /** Filter configuration items, do not pass if not required */
     filters?: RenderDropdownProps['filters']
}
```


```jsx live=true noInline=true dir="column"
import React, { useState, useEffect, useRef } from 'react';
import { Table, Avatar, Input, Button, Space } from '@douyinfe/semi-ui';
import * as dateFns from 'date-fns';

function App() {
    const [dataSource, setData] = useState([]);
    const inputRef = useRef();

    const DAY = 24 * 60 * 60 * 1000;
    const figmaIconUrl = 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/figma-icon.png';

    const columns = [
        {
            title: 'Title',
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
            onFilter: (value, record) => record.name.includes(value),
            renderFilterDropdown: (props) => {
                console.log('renderFilterDropdown', props);
                const { tempFilteredValue, setTempFilteredValue, confirm, clear, close } = props;

                const handleChange = value => {
                    const filteredValue = value ? [value] : [];
                    setTempFilteredValue(filteredValue);
                    // You can also filter directly when the input value changes
                    // confirm({ filteredValue });
                };

                return (
                    <Space vertical align='start' style={{ padding: 8 }}>
                        <Input ref={inputRef} value={tempFilteredValue[0]} onChange={handleChange}/>
                        <Space>
                            <Button onClick={() => confirm({ closeDropdown: true })}>Filter+Close</Button>
                            <Button onClick={() => clear({ closeDropdown: true })}>Clear+Close</Button>
                            <Button onClick={() => close()}>Close</Button>
                        </Space>
                    </Space>
                );
            },
            onFilterDropdownVisibleChange: (visible) => {
                console.log('inputRef', visible, inputRef);
                if (inputRef.current && inputRef.current.focus) {
                    inputRef.current.focus();
                }
            }
        },
        {
            title: 'Size',
            dataIndex: 'size',
            sorter: (a, b) => (a.size - b.size > 0 ? 1 : -1),
            render: text => `${text} KB`,
        },
        {
            title: 'Owner',
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
            onFilter: (value, record) => record.owner.includes(value),
            defaultFilteredValue: ['Jiang Pengzhi'],
            renderFilterDropdown: (props) => {
                console.log('renderFilterDropdown', props);
                const { tempFilteredValue, setTempFilteredValue, confirm, clear, close } = props;

                const handleChange = (value) => {
                    if (value) {
                        setTempFilteredValue([value]);
                    } else {
                        setTempFilteredValue([]);
                    }
                };

                return (
                    <Space vertical align='start' style={{ padding: 8 }}>
                        <Input value={tempFilteredValue[0]} onChange={handleChange}/>
                        <Space>
                            <Button onClick={() => confirm({ closeDropdown: false })}>Filter+Close</Button>
                            <Button onClick={() => clear({ closeDropdown: false })}>Clear+Close</Button>
                            <Button onClick={() => close()}>Close</Button>
                        </Space>
                    </Space>
                );
            },
        },
        {
            title: 'Update',
            dataIndex: 'updateTime',
            sorter: (a, b) => (a.updateTime - b.updateTime > 0 ? 1 : -1),
            render: value => {
                return dateFns.format(new Date(value), 'yyyy-MM-dd');
            },
        },
    ];

    const getData = () => {
        const data = [];
        for (let i = 0; i < 46; i++) {
            const isSemiDesign = i % 2 === 0;
            const randomNumber = (i * 1000) % 199;
            data.push({
                key: '' + i,
                name: isSemiDesign ? `Semi Design design draft${i}.fig` : `Semi D2C design draft${i}.fig`,
                owner: isSemiDesign ? 'Jiang Pengzhi' : 'Hao Xuan',
                size: randomNumber,
                updateTime: new Date().valueOf() + randomNumber * DAY,
                avatarBg: isSemiDesign ? 'grey' : 'red',
            });
        }
        return data;
    };

    useEffect(() => {
        const data = getData();
        setData(data);
    }, []);

    return <Table columns={columns} dataSource={dataSource} />;
}

render(App);
```

### Custom Filter Item Rendering

Since the **1.1.0** version, it is supported to pass in `renderFilterDropdownItem` to customize the rendering method of each filter item.

This method accepts an `Object` input parameter, and the meaning of each attribute is as follows:

-   `onChange: e => void` current filter item selection/reverse selection event;
-   `text: ReactNode` copy of the current screening item;
-   `value: any` the value of the current filter item;
-   `checked: boolean` whether the current filter item has been selected;
-   `filteredValue: any[]` all currently filtered values;
-   `level: number` is the level of the current filter item, if it is a nested filter item, the value will be >= 1;
-   `filterMultiple: boolean` whether the current filter item is multi-select.

```jsx live=true noInline=true dir="column"
import React, { useState, useMemo } from 'react';
import { Table, Avatar, Dropdown } from '@douyinfe/semi-ui';
import * as dateFns from 'date-fns';

const DAY = 24 * 60 * 60 * 1000;
const figmaIconUrl = 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/figma-icon.png';

const columns = [
    {
        title: 'Title',
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
                text: 'Semi Design design draft',
                value: 'Semi Design design draft',
            },
            {
                text: 'Semi D2C design draft',
                value: 'Semi D2C design draft',
            },
        ],
        onFilter: (value, record) => record.name.includes(value),
        renderFilterDropdownItem: ({ text, checked, onChange }) => (
            <Dropdown.Item onClick={onChange} active={checked}>
                {text}
            </Dropdown.Item>
        ),
        filterDropdownProps: {
            showTick: true,
        },
        sorter: (a, b) => (a.name.length - b.name.length > 0 ? 1 : -1),
    },
    {
        title: 'Size',
        dataIndex: 'size',
        sorter: (a, b) => (a.size - b.size > 0 ? 1 : -1),
        render: text => `${text} KB`,
    },
    {
        title: 'Owner',
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
        title: 'Update',
        dataIndex: 'updateTime',
        sorter: (a, b) => (a.updateTime - b.updateTime > 0 ? 1 : -1),
        render: value => {
            return dateFns.format(new Date(value), 'yyyy-MM-dd');
        },
    },
];

function App() {
    const [dataSource, setData] = useState([]);

    const rowSelection = useMemo(
        () => ({
            onChange: (selectedRowKeys, selectedRows) => {
                console.log(`selectedRowKeys: ${selectedRowKeys}`, 'selectedRows: ', selectedRows);
            },
            getCheckboxProps: record => ({
                disabled: record.name === 'Michael James', // Column configuration not to be checked
                name: record.name,
            }),
        }),
        []
    );
    const scroll = useMemo(() => ({ y: 300 }), []);

    const getData = () => {
        const data = [];
        for (let i = 0; i < 46; i++) {
            const isSemiDesign = i % 2 === 0;
            const randomNumber = (i * 1000) % 199;
            data.push({
                key: '' + i,
                name: isSemiDesign ? `Semi Design design draft${i}.fig` : `Semi D2C design draft${i}.fig`,
                owner: isSemiDesign ? 'Jiang Pengzhi' : 'Hao Xuan',
                size: randomNumber,
                updateTime: new Date().valueOf() + randomNumber * DAY,
                avatarBg: isSemiDesign ? 'grey' : 'red',
            });
        }
        return data;
    };

    useEffect(() => {
        const data = getData();
        setData(data);
    }, []);

    return <Table columns={columns} dataSource={dataSource} rowSelection={rowSelection} scroll={scroll} />;
}

render(App);
```

### A Table That Can Be Expanded

<Notice type="primary" title="Note">
    <div>1.  Since version `0.27.0`, the unfold button will be rendered in the same cell as the first column, and you can open a separate column of rendering by passing in `hideExpandedColumn = {false}`.</div>
    <div>2. Be sure to provide a "key" for each row of data that is different from the other row values, or use the rowKey parameter to specify an attribute name as the primary key.</div>
</Notice>

#### A Common Table That Can Be Expanded

If you need to render a table that can be expanded, in addition to the need to pass `expandedRowRender` In addition to this method, you must specify `rowKey`(by default `key`), Table will be based on `rowKey` Gets a row unique identifier.

-   If `rowKey` is a Function, the result of `rowKey(record)` is taken as the row unique ID
-   If `rowKey` is a string type, you take `record[rowKey]` as the row unique ID

```jsx live=true noInline=true dir="column"
import React from 'react';
import { Table, Avatar, Descriptions, Tag } from '@douyinfe/semi-ui';
import { IconMore } from '@douyinfe/semi-icons';

const columns = [
    {
        title: 'Title',
        width: 500,
        dataIndex: 'name',
        render: (text, record, index) => {
            return (
                <span>
                    <Avatar size="small" shape="square" src={record.nameIconSrc} style={{ marginRight: 12 }}></Avatar>
                    {text}
                </span>
            );
        },
    },
    {
        title: 'Size',
        dataIndex: 'size',
    },
    {
        title: 'Owner',
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
        title: 'Update',
        dataIndex: 'updateTime',
    },
    {
        title: '',
        dataIndex: 'operate',
        render: () => {
            return <IconMore />;
        },
    },
];

const data = [
    {
        key: '1',
        name: 'Semi Design design draft.fig',
        nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/figma-icon.png',
        size: '2M',
        owner: 'Jiang Pengzhi',
        updateTime: '2020-02-02 05:13',
        avatarBg: 'grey',
    },
    {
        key: '2',
        name: 'Semi Design share docs',
        nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png',
        size: '2M',
        owner: 'Hao Xuan',
        updateTime: '2020-01-17 05:31',
        avatarBg: 'red',
    },
    {
        key: '3',
        name: 'Design docs',
        nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png',
        size: '34KB',
        owner: 'Zoey Edwards',
        updateTime: '2020-01-26 11:01',
        avatarBg: 'light-blue',
    },
];

const expandData = {
    '0': [
        { key: 'DAU', value: '1,480,000' },
        { key: 'Day7 Retention Ratio', value: '98%' },
        { key: 'Security Level', value: '3 级' },
        { key: 'Vertical label', value: <Tag style={{ margin: 0 }}>Designer</Tag> },
        { key: 'Certification', value: 'No Verified' },
    ],
    '1': [
        { key: 'DAU', value: '2,480,000' },
        { key: 'Day7 Retention Ratio', value: '90%' },
        { key: 'Security Level', value: '1 级' },
        { key: 'Vertical label', value: <Tag style={{ margin: 0 }}>Template</Tag> },
        { key: 'Certification', value: 'Verified' },
    ],
    '2': [
        { key: 'DAU', value: '2,920,000' },
        { key: 'Day7 Retention Ratio', value: '98%' },
        { key: 'Security Level', value: '2 级' },
        { key: 'Vertical label', value: <Tag style={{ margin: 0 }}>Docs</Tag> },
        { key: 'Certification', value: 'Verified' },
    ],
};

function App() {
    const expandRowRender = (record, index) => {
        return <Descriptions align="justify" data={expandData[index]} />;
    };

    const rowSelection = {
        getCheckboxProps: record => ({
            disabled: record.name === 'Design docs', // Column configuration not to be checked
            name: record.name,
        }),
        onSelect: (record, selected) => {
            console.log(`select row: ${selected}`, record);
        },
        onSelectAll: (selected, selectedRows) => {
            console.log(`select all rows: ${selected}`, selectedRows);
        },
        onChange: (selectedRowKeys, selectedRows) => {
            console.log(`selectedRowKeys: ${selectedRowKeys}`, 'selectedRows: ', selectedRows);
        },
    };

    return (
        <Table
            rowKey="name"
            columns={columns}
            dataSource={data}
            expandedRowRender={expandRowRender}
            rowSelection={rowSelection}
            pagination={false}
        />
    );
}

render(App);
```

#### The Unfold Button Is Rendered In a Separated Column

**Version: >= 0.27.0**

By default, the expansion button will be rendered in the same cell as the first copy, and you can enter `hideExpandedColumn={false}` to render as a separate column:

```jsx live=true noInline=true dir="column"
import React from 'react';
import { Table, Avatar, Descriptions, Tag } from '@douyinfe/semi-ui';
import { IconMore } from '@douyinfe/semi-icons';

const columns = [
    {
        title: 'Title',
        width: 500,
        dataIndex: 'name',
        render: (text, record, index) => {
            return (
                <span>
                    <Avatar size="small" shape="square" src={record.nameIconSrc} style={{ marginRight: 12 }}></Avatar>
                    {text}
                </span>
            );
        },
    },
    {
        title: 'Size',
        dataIndex: 'size',
    },
    {
        title: 'Owner',
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
        title: 'Update',
        dataIndex: 'updateTime',
    },
    {
        title: '',
        dataIndex: 'operate',
        render: () => {
            return <IconMore />;
        },
    },
];

const data = [
    {
        key: '1',
        name: 'Semi Design design draft.fig',
        nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/figma-icon.png',
        size: '2M',
        owner: 'Jiang Pengzhi',
        updateTime: '2020-02-02 05:13',
        avatarBg: 'grey',
    },
    {
        key: '2',
        name: 'Semi Design share docs',
        nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png',
        size: '2M',
        owner: 'Hao Xuan',
        updateTime: '2020-01-17 05:31',
        avatarBg: 'red',
    },
    {
        key: '3',
        name: 'Design docs',
        nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png',
        size: '34KB',
        owner: 'Zoey Edwards',
        updateTime: '2020-01-26 11:01',
        avatarBg: 'light-blue',
    },
];

const expandData = {
    '0': [
        { key: 'DAU', value: '1,480,000' },
        { key: 'Day7 Retention Ratio', value: '98%' },
        { key: 'Security Level', value: '3 级' },
        { key: 'Vertical label', value: <Tag style={{ margin: 0 }}>Designer</Tag> },
        { key: 'Certification', value: 'No Verified' },
    ],
    '1': [
        { key: 'DAU', value: '2,480,000' },
        { key: 'Day7 Retention Ratio', value: '90%' },
        { key: 'Security Level', value: '1 级' },
        { key: 'Vertical label', value: <Tag style={{ margin: 0 }}>Template</Tag> },
        { key: 'Certification', value: 'Verified' },
    ],
    '2': [
        { key: 'DAU', value: '2,920,000' },
        { key: 'Day7 Retention Ratio', value: '98%' },
        { key: 'Security Level', value: '2 级' },
        { key: 'Vertical label', value: <Tag style={{ margin: 0 }}>Docs</Tag> },
        { key: 'Certification', value: 'Verified' },
    ],
};

function App() {
    const expandRowRender = (record, index) => {
        return <Descriptions align="justify" data={expandData[index]} />;
    };

    const rowSelection = {
        getCheckboxProps: record => ({
            disabled: record.name === 'Design docs', // Column configuration not to be checked
            name: record.name,
        }),
        onSelect: (record, selected) => {
            console.log(`select row: ${selected}`, record);
        },
        onSelectAll: (selected, selectedRows) => {
            console.log(`select all rows: ${selected}`, selectedRows);
        },
        onChange: (selectedRowKeys, selectedRows) => {
            console.log(`selectedRowKeys: ${selectedRowKeys}`, 'selectedRows: ', selectedRows);
        },
    };

    return (
        <Table
            rowKey="name"
            columns={columns}
            dataSource={data}
            expandedRowRender={expandRowRender}
            hideExpandedColumn={false}
            rowSelection={rowSelection}
            pagination={false}
        />
    );
}

render(App);
```

#### Turn Off Rendering of Expandable Button of a Row

**Version: > = 0.27.0**

You can pass the row Expandable method, enter the reference as record, and determine whether the return value is false to close the rendering of the expandable button on a row.

```jsx live=true noInline=true dir="column"
import React from 'react';
import { Table, Avatar, Descriptions, Tag } from '@douyinfe/semi-ui';
import { IconMore } from '@douyinfe/semi-icons';

const columns = [
    {
        title: 'Title',
        width: 500,
        dataIndex: 'name',
        render: (text, record, index) => {
            return (
                <span>
                    <Avatar size="small" shape="square" src={record.nameIconSrc} style={{ marginRight: 12 }}></Avatar>
                    {text}
                </span>
            );
        },
    },
    {
        title: 'Size',
        dataIndex: 'size',
    },
    {
        title: 'Owner',
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
        title: 'Update',
        dataIndex: 'updateTime',
    },
    {
        title: '',
        dataIndex: 'operate',
        render: () => {
            return <IconMore />;
        },
    },
];

const data = [
    {
        key: '1',
        name: 'Semi Design design draft.fig',
        nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/figma-icon.png',
        size: '2M',
        owner: 'Jiang Pengzhi',
        updateTime: '2020-02-02 05:13',
        avatarBg: 'grey',
    },
    {
        key: '2',
        name: 'Semi Design share docs',
        nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png',
        size: '2M',
        owner: 'Hao Xuan',
        updateTime: '2020-01-17 05:31',
        avatarBg: 'red',
    },
    {
        key: '3',
        name: 'Design docs',
        nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png',
        size: '34KB',
        owner: 'Zoey Edwards',
        updateTime: '2020-01-26 11:01',
        avatarBg: 'light-blue',
    },
];

const expandData = {
    '0': [
        { key: 'DAU', value: '1,480,000' },
        { key: 'Day7 Retention Ratio', value: '98%' },
        { key: 'Security Level', value: '3 级' },
        { key: 'Vertical label', value: <Tag style={{ margin: 0 }}>Designer</Tag> },
        { key: 'Certification', value: 'No Verified' },
    ],
    '1': [
        { key: 'DAU', value: '2,480,000' },
        { key: 'Day7 Retention Ratio', value: '90%' },
        { key: 'Security Level', value: '1 级' },
        { key: 'Vertical label', value: <Tag style={{ margin: 0 }}>Template</Tag> },
        { key: 'Certification', value: 'Verified' },
    ],
    '2': [
        { key: 'DAU', value: '2,920,000' },
        { key: 'Day7 Retention Ratio', value: '98%' },
        { key: 'Security Level', value: '2 级' },
        { key: 'Vertical label', value: <Tag style={{ margin: 0 }}>Docs</Tag> },
        { key: 'Certification', value: 'Verified' },
    ],
};

function App() {
    const expandRowRender = (record, index) => {
        return <Descriptions align="justify" data={expandData[index]} />;
    };

    const rowSelection = {
        getCheckboxProps: record => ({
            disabled: record.name === 'Design docs', // Column configuration not to be checked
            name: record.name,
        }),
        onSelect: (record, selected) => {
            console.log(`select row: ${selected}`, record);
        },
        onSelectAll: (selected, selectedRows) => {
            console.log(`select all rows: ${selected}`, selectedRows);
        },
        onChange: (selectedRowKeys, selectedRows) => {
            console.log(`selectedRowKeys: ${selectedRowKeys}`, 'selectedRows: ', selectedRows);
        },
    };

    return (
        <Table
            rowKey="name"
            columns={columns}
            dataSource={data}
            expandedRowRender={expandRowRender}
            rowExpandable={record => record.name !== 'Design docs'}
            hideExpandedColumn={false}
            rowSelection={rowSelection}
            pagination={false}
        />
    );
}

render(App);
```

### Tree Data Display

**Version: > = 0.27.0**

The table supports the display of tree data and is automatically displayed as a tree table when there are children fields in the data. If you do not need or use other fields, you can configure it with the childrenRecordName. In addition, you can control the indent width of each layer by setting indent Size.

> Note: Be sure to provide a "key" for each row of data that is different from the other row values, or use the `rowKey` parameter to specify a property name as the primary key.

#### Simple example of tree data

```jsx live=true noInline=true dir="column"
import React from 'react';
import { Table } from '@douyinfe/semi-ui';

function App() {
    const columns = [
        {
            title: 'Key',
            dataIndex: 'dataKey',
            key: 'dataKey',
        },
        {
            title: 'Name',
            dataIndex: 'name',
            key: 'name',
            width: 200,
        },
        {
            title: 'Data Type',
            dataIndex: 'type',
            key: 'type',
            width: 400,
        },
        {
            title: 'Description',
            dataIndex: 'description',
            key: 'description',
        },
        {
            title: 'Default',
            dataIndex: 'default',
            key: 'default',
            width: 100,
        },
    ];

    const data = [
        {
            key: 1,
            dataKey: 'videos_info',
            name: 'Video Info',
            type: 'Object',
            description: 'Meta info of video',
            default: 'None',
            children: [
                {
                    key: 11,
                    dataKey: 'status',
                    name: 'Video Status',
                    type: 'Enum <Integer>',
                    description: 'Viewable and recommended status of the video',
                    default: '1',
                },
                {
                    key: 12,
                    dataKey: 'vid',
                    name: 'Video ID',
                    type: 'String',
                    description: 'Unique ID that identifies the video',
                    default: 'None',
                    children: [
                        {
                            dataKey: 'video_url',
                            name: 'Video url',
                            type: 'String',
                            description: 'Unique link to the video',
                            default: 'None',
                        },
                    ],
                },
            ],
        },
        {
            key: 2,
            dataKey: 'text_info',
            name: 'Text Info',
            type: 'Object',
            description: 'Meta info of video',
            default: 'None',
            children: [
                {
                    key: 21,
                    dataKey: 'title',
                    name: 'Video Title',
                    type: 'String',
                    description: 'Title of video',
                    default: 'None',
                },
                {
                    key: 22,
                    dataKey: 'video_description',
                    name: 'Video Description',
                    type: 'String',
                    description: 'Description of video',
                    default: 'None',
                },
            ],
        },
    ];

    return <Table columns={columns} defaultExpandAllRows dataSource={data} />;
}

render(App);
```

#### Rows of Interchangeable Tree Data

**Version: > = 0.27.0**

You can do row switching by changing the order of the dataSource elements.

```jsx live=true noInline=true dir="column"
import React, { useState } from 'react';
import { Table, Button } from '@douyinfe/semi-ui';
import { IconArrowUp, IconArrowDown } from '@douyinfe/semi-icons';

const raw = [
    {
        key: 1,
        dataKey: 'videos_info',
        name: 'Video Info',
        type: 'Object',
        description: 'Meta info of video',
        default: 'None',
        children: [
            {
                key: 11,
                dataKey: 'status',
                name: 'Video Status',
                type: 'Enum <Integer>',
                description: 'Viewable and recommended status of the video',
                default: '1',
            },
            {
                key: 12,
                dataKey: 'vid',
                name: 'Video ID',
                type: 'String',
                description: 'Unique ID that identifies the video',
                default: 'None',
                children: [
                    {
                        dataKey: 'video_url',
                        name: 'Video url',
                        type: 'String',
                        description: 'Unique link to the video',
                        default: 'None',
                    },
                ],
            },
        ],
    },
    {
        key: 2,
        dataKey: 'text_info',
        name: 'Text Info',
        type: 'Object',
        description: 'Meta info of video',
        default: 'None',
        children: [
            {
                key: 21,
                dataKey: 'title',
                name: 'Video Title',
                type: 'String',
                description: 'Title of video',
                default: 'None',
            },
            {
                key: 22,
                dataKey: 'video_description',
                name: 'Video Description',
                type: 'String',
                description: 'Description of video',
                default: 'None',
            },
        ],
    },
];

const rowKey = 'key';
const childrenRecordName = 'children';

function App() {
    const [expandedRowKeys, setExpandedRowKeys] = useState([1, 2]);
    const [data, setData] = useState(raw);

    const switchRecord = (key1, key2) => {
        const newData = [...data];

        if (key1 != null && key2 != null) {
            const item1 = findRecordByKey(key1, newData);
            const item2 = findRecordByKey(key2, newData);

            // you have to copy item1 and item2 first
            const copiedItem1 = { ...item1 };
            const copiedItem2 = { ...item2 };

            coverRecord(item1, copiedItem2);
            coverRecord(item2, copiedItem1);

            setData(newData);
        }
    };

    const findRecordByKey = (key, data) => {
        if (Array.isArray(data) && data.length && key != null) {
            for (let item of data) {
                if (item[rowKey] === key) {
                    return item;
                }

                const children = item[childrenRecordName];
                if (Array.isArray(children) && children.length) {
                    const item = findRecordByKey(key, children);

                    if (item != null) {
                        return item;
                    }
                }
            }
        }
    };

    const coverRecord = (obj, srcObj) => {
        if (obj && typeof obj === 'object' && srcObj && typeof srcObj === 'object') {
            const srcKeys = Object.keys(srcObj);
            const copied = { ...srcObj };

            Object.assign(obj, copied);

            Object.keys(obj).forEach(key => {
                if (!srcKeys.includes(key)) {
                    delete obj[key];
                }
            });
        }

        return obj;
    };

    const getSameLevelRecords = (key, data = []) => {
        if (key != null && Array.isArray(data) && data.length) {
            if (data.find(item => item[rowKey] === key)) {
                return data;
            }
            for (let item of data) {
                const records = getSameLevelRecords(key, item[childrenRecordName]);

                if (records.length) {
                    return records;
                }
            }
        }
        return [];
    };

    const columns = [
        {
            title: 'Key',
            dataIndex: 'dataKey',
            key: 'dataKey',
        },
        {
            title: 'Name',
            dataIndex: 'name',
            key: 'name',
            width: 200,
        },
        {
            title: 'Data Type',
            dataIndex: 'type',
            key: 'type',
        },
        {
            title: 'Description',
            dataIndex: 'description',
            key: 'description',
        },
        {
            title: 'Default',
            dataIndex: 'default',
            key: 'default',
            width: 100,
        },
        {
            key: 'operation',
            render: record => {
                const records = getSameLevelRecords(record[rowKey], data);
                const index = records.findIndex(item => item[rowKey] === record[rowKey]);
                const upProps = {};
                const downProps = {};

                if (index > 0) {
                    const upRow = records[index - 1];
                    upProps.onClick = () => switchRecord(record[rowKey], upRow[rowKey]);
                } else {
                    upProps.disabled = true;
                }

                if (index < records.length - 1) {
                    const downRow = records[index + 1];
                    downProps.onClick = () => switchRecord(record[rowKey], downRow[rowKey]);
                } else {
                    downProps.disabled = true;
                }

                return (
                    <>
                        <Button icon={<IconArrowUp />} {...upProps} />
                        <Button icon={<IconArrowDown />} {...downProps} />
                    </>
                );
            },
        },
    ];

    return (
        <Table
            columns={columns}
            dataSource={data}
            rowKey={rowKey}
            childrenRecordName={childrenRecordName}
            expandedRowKeys={expandedRowKeys}
            onExpandedRowsChange={rows => setExpandedRowKeys(rows.map(item => item[rowKey]))}
        />
    );
}

render(App);
```

#### Tree Selection

**Version: >=0.27.0**

By default, the row selection of the table is independent. You can simulate a tree selection by defining selectedRowKeys.

```jsx live=true noInline=true dir="column"
import React, { useMemo, useState, useCallback } from 'react';
import { get, union, pullAll } from 'lodash-es';
import { Table } from '@douyinfe/semi-ui';

const childrenRecordName = 'children';
const rowKey = 'key';
const getKey = record => get(record, rowKey, 'key');

const ChildrenDataSelectedDemo = () => {
    const [selectedRowKeys, setSelectedRowKeys] = useState([]);

    const columns = useMemo(
        () => [
            {
                title: 'Key',
                dataIndex: 'dataKey',
                key: 'dataKey',
            },
            {
                title: 'Name',
                dataIndex: 'name',
                key: 'name',
                width: 200,
            },
            {
                title: 'Data Type',
                dataIndex: 'type',
                key: 'type',
                width: 400,
            },
            {
                title: 'Description',
                dataIndex: 'description',
                key: 'description',
            },
            {
                title: 'Default',
                dataIndex: 'default',
                key: 'default',
                width: 100,
            },
        ],
        []
    );

    const data = useMemo(
        () => [
            {
                key: 1,
                dataKey: 'videos_info',
                name: 'Video Info',
                type: 'Object',
                description: 'Meta info of video',
                default: 'None',
                children: [
                    {
                        key: 11,
                        dataKey: 'status',
                        name: 'Video Status',
                        type: 'Enum <Integer>',
                        description: 'Viewable and recommended status of the video',
                        default: '1',
                    },
                    {
                        key: 12,
                        dataKey: 'vid',
                        name: 'Video ID',
                        type: 'String',
                        description: 'Unique ID that identifies the video',
                        default: 'None',
                        children: [
                            {
                                key: 121,
                                dataKey: 'video_url',
                                name: 'Video url',
                                type: 'String',
                                description: 'Unique link to the video',
                                default: 'None',
                            },
                        ],
                    },
                ],
            },
            {
                key: 2,
                dataKey: 'text_info',
                name: 'Text Info',
                type: 'Object',
                description: 'Meta info of video',
                default: 'None',
                children: [
                    {
                        key: 21,
                        dataKey: 'title',
                        name: 'Video Title',
                        type: 'String',
                        description: 'Title of video',
                        default: 'None',
                    },
                    {
                        key: 22,
                        dataKey: 'video_description',
                        name: 'Video Description',
                        type: 'String',
                        description: 'Description of video',
                        default: 'None',
                    },
                ],
            },
        ],
        []
    );

    const isRecordDisabled = record => {
        return false;
    };

    const traverse = (data, res) => {
        for (let record of data) {
            const children = get(record, 'children');
            const disabled = isRecordDisabled(record);
            if (!disabled) {
                const key = getKey(record);
                res.push(key);
            }
            if (Array.isArray(children)) {
                traverse(children, res);
            }
        }
    };

    const getAllRowKeys = data => {
        const allRowKeys = [];
        traverse(data, allRowKeys);
        console.log('allRowKeys', allRowKeys);
        return allRowKeys;
    };

    const findShouldSelectRowKeys = (record, selected) => {
        let shouldSelectRowKeys;
        const children = get(record, 'children');
        let childrenRowKeys = [];
        if (Array.isArray(children)) {
            traverse(children, childrenRowKeys);
        }

        const key = getKey(record);
        if (!selected) {
            shouldSelectRowKeys = [...selectedRowKeys];
            pullAll(shouldSelectRowKeys, [key, ...childrenRowKeys]);
        } else {
            shouldSelectRowKeys = union(selectedRowKeys, [key, ...childrenRowKeys]);
        }
        return shouldSelectRowKeys;
    };

    const doSelect = useCallback(
        (record, selected) => {
            const rowKeys = findShouldSelectRowKeys(record, selected);
            setSelectedRowKeys(rowKeys);
            console.log('select', record, rowKeys);
        },
        [selectedRowKeys, rowKey, childrenRecordName]
    );

    const doSelectAll = useCallback((selected, selectedRows) => {
        console.log(selected);
        let rowKeys = [];
        if (selected) {
            rowKeys = getAllRowKeys(data);
        }
        setSelectedRowKeys(rowKeys);
    }, []);

    const rowSelection = useMemo(
        () => ({
            selectedRowKeys,
            onSelect: doSelect,
            onSelectAll: doSelectAll,
        }),
        [selectedRowKeys, doSelect, doSelectAll]
    );

    return (
        <Table
            columns={columns}
            rowKey={rowKey}
            childrenRecordName={childrenRecordName}
            rowSelection={rowSelection}
            dataSource={data}
            pagination={false}
        />
    );
};

render(ChildrenDataSelectedDemo);
```

### Custom Row or Cell Events and Properties

-   The incoming `onRow` / `onHeaderRow` can define the native event or property of a table or table header line.
-   The incoming `Column.onCell` / `Column.onHeaderCell` can define a table or header cell native event or property.

In principle, the properties or events supported on tr / td / th can be defined. For example:

-   The tr at the head of the watch defines onMouseEnter / onMouseLeave
-   The tr of the table defines className
-   The third line of the table defines onClick.

```jsx live=true noInline=true dir="column"
import React, { useMemo } from 'react';
import { Table, Avatar } from '@douyinfe/semi-ui/';
import * as dateFns from 'date-fns';

const DAY = 24 * 60 * 60 * 1000;
const figmaIconUrl = 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/figma-icon.png';

function EventTable(props = {}) {
    const columns = useMemo(
        () => [
            {
                title: 'Title',
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
                        text: 'Semi Design design draft',
                        value: 'Semi Design design draft',
                    },
                    {
                        text: 'Semi D2C design draft',
                        value: 'Semi D2C design draft',
                    },
                ],
                onFilter: (value, record) => record.name.includes(value),
            },
            {
                title: 'Size',
                dataIndex: 'size',
                sorter: (a, b) => (a.size - b.size > 0 ? 1 : -1),
                render: text => `${text} KB`,
            },
            {
                title: 'Owner',
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
                title: 'Update',
                dataIndex: 'updateTime',
                sorter: (a, b) => (a.updateTime - b.updateTime > 0 ? 1 : -1),
                render: value => {
                    return dateFns.format(new Date(value), 'yyyy-MM-dd');
                },
            },
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
                name: isSemiDesign ? `Semi Design design draft${i}.fig` : `Semi D2C design draft${i}.fig`,
                owner: isSemiDesign ? 'Jiang Pengzhi' : 'Hao Xuan',
                size: randomNumber,
                updateTime: new Date().valueOf() + randomNumber * DAY,
                avatarBg: isSemiDesign ? 'grey' : 'red',
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
```

### Zebra Pattern Table

Use `OnRow` to set a background color for each row to create a zebra stripped table.

```jsx live=true noInline=true dir="column"
import React from 'react';
import { Table, Avatar } from '@douyinfe/semi-ui';
import { IconMore } from '@douyinfe/semi-icons';

function App() {
    const columns = [
        {
            title: 'Title',
            dataIndex: 'name',
            width: 400,
            render: (text, record, index) => {
                return (
                    <div>
                        <Avatar
                            size="small"
                            shape="square"
                            src={record.nameIconSrc}
                            style={{ marginRight: 12 }}
                        ></Avatar>
                        {text}
                    </div>
                );
            },
        },
        {
            title: 'Size',
            dataIndex: 'size',
        },
        {
            title: 'Owner',
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
            title: 'Update',
            dataIndex: 'updateTime',
        },
        {
            title: '',
            dataIndex: 'operate',
            render: () => {
                return <IconMore />;
            },
        },
    ];
    const data = [
        {
            key: '1',
            name: 'Semi Design design draft.fig',
            nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/figma-icon.png',
            size: '2M',
            owner: 'Jiang Pengzhi',
            updateTime: '2020-02-02 05:13',
            avatarBg: 'grey',
        },
        {
            key: '2',
            name: 'Semi Design share docs',
            nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png',
            size: '2M',
            owner: 'Hao Xuan',
            updateTime: '2020-01-17 05:31',
            avatarBg: 'red',
        },
        {
            key: '3',
            name: 'Design docs',
            nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png',
            size: '34KB',
            owner: 'Zoey Edwards',
            updateTime: '2020-01-26 11:01',
            avatarBg: 'light-blue',
        },
        {
            key: '4',
            name: 'Semi D2C design draft.fig',
            nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/figma-icon.png',
            size: '2M',
            owner: 'Jiang Pengzhi',
            updateTime: '2020-02-02 05:13',
            avatarBg: 'grey',
        },
        {
            key: '5',
            name: 'Semi D2C share docs',
            nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png',
            size: '2M',
            owner: 'Hao Xuan',
            updateTime: '2020-01-17 05:31',
            avatarBg: 'red',
        },
        {
            key: '6',
            name: 'Semi D2C Design docs',
            nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png',
            size: '34KB',
            owner: 'Zoey Edwards',
            updateTime: '2020-01-26 11:01',
            avatarBg: 'light-blue',
        },
    ];

    const handleRow = (record, index) => {
        if (index % 2 === 0) {
            return {
                style: {
                    background: 'var(--semi-color-fill-0)',
                },
            };
        } else {
            return {};
        }
    };

    return <Table columns={columns} dataSource={data} onRow={handleRow} pagination={false} />;
}

render(App);
```

### Column Ellipsis

Use `ellipsis` to make cells automatically clipped. v2.34.0 support.

```jsx live=true noInline=true dir="column"
import React from 'react';
import { Table } from '@douyinfe/semi-ui';
import { IconMore } from '@douyinfe/semi-icons';

function App() {
    const columns = [
        {
            title: 'Title',
            dataIndex: 'name',
            fixed: true,
            width: 250,
            filters: [
                {
                    text: 'Semi Design',
                    value: 'Semi Design',
                },
                {
                    text: 'Semi D2C',
                    value: 'Semi D2C',
                },
            ],
            onFilter: (value, record) => record.name.includes(value),
            sorter: (a, b) => (a.name.length - b.name.length > 0 ? 1 : -1),
            ellipsis: true,
        },
        {
            title: 'Owner',
            dataIndex: 'owner',
            width: 200,
            ellipsis: true,
            filters: [
                {
                    text: 'Semi Design',
                    value: 'Semi Design',
                },
                {
                    text: 'Semi D2C',
                    value: 'Semi D2C',
                },
            ],
            onFilter: (value, record) => record.name.includes(value),
            sorter: (a, b) => (a.name.length - b.name.length > 0 ? 1 : -1),
        },
        {
            title: 'Size',
            dataIndex: 'size',
            sorter: (a, b) => (a.name.length - b.name.length > 0 ? 1 : -1),
            ellipsis: true,
        },
        {
            title: 'Update time',
            dataIndex: 'updateTime',
            width: 200,
            ellipsis: true,
        },
        {
            title: '',
            dataIndex: 'operate',
            fixed: 'right',
            align: 'center',
            width: 100,
            render: () => {
                return <IconMore />;
            },
        },
    ];
    const data = [
        {
            key: '1',
            name: 'Maintained by the Douyin front-end and UED teams, an easy-to-customize modern design system that helps designers and developers create high-quality products.',
            nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/figma-icon.png',
            size: '2M',
            owner: 'Pengzhi Jiang Pengzhi Jiang Pengzhi Jiang Pengzhi Jiang',
            updateTime: '2020-02-02 05:13',
            avatarBg: 'grey',
        },
        {
            key: '2',
            name: 'Semi is designed based on FA architecture, and the main logic is extracted as Foundation package, which is easy to migrate to other frameworks',
            nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png',
            size: '2M',
            owner: 'Xuan Hao Xuan Hao Xuan Hao Xuan Hao Xuan Hao Xuan Hao',
            updateTime: '2020-02-02 05:13',
            avatarBg: 'red',
        },
        {
            key: '3',
            nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png',
            name: 'Maintained by the Douyin front-end and UED teams, an easy-to-customize modern design system that helps designers and developers create high-quality products.',
            size: '34KB',
            owner: 'Pengzhi Jiang Pengzhi Jiang Pengzhi Jiang Pengzhi Jiang',
            updateTime: '2020-02-02 05:13',
            avatarBg: 'light-blue',
        },
        {
            key: '4',
            name: 'Semi is designed based on FA architecture, and the main logic is extracted as Foundation package, which is easy to migrate to other frameworks',
            nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png',
            size: '34KB',
            owner: 'Xuan Hao Xuan Hao Xuan Hao Xuan Hao Xuan Hao Xuan Hao',
            updateTime: '2020-02-02 05:13',
            avatarBg: 'light-blue',
        },
    ];

    return <Table scroll={{ x: 1200 }} columns={columns} dataSource={data} pagination={false} />;
}

render(App);
```

Set `ellipsis.showTitle` to false to hide the default native HTML title. With `column.render` you can customize the content prompt.

```jsx live=true noInline=true dir="column"
import React from 'react';
import { Table, Typography } from '@douyinfe/semi-ui';
import { IconMore } from '@douyinfe/semi-icons';

function App() {
    const columns = [
        {
            title: 'Title',
            dataIndex: 'name',
            fixed: true,
            width: 250,
            filters: [
                {
                    text: 'Semi Design',
                    value: 'Semi Design',
                },
                {
                    text: 'Semi D2C',
                    value: 'Semi D2C',
                },
            ],
            onFilter: (value, record) => record.name.includes(value),
            sorter: (a, b) => (a.name.length - b.name.length > 0 ? 1 : -1),
            ellipsis: { showTitle: false },
            render: (text) => <Typography.Text ellipsis={{ showTooltip: true }}>{text}</Typography.Text>,
        },
        {
            title: 'Owner',
            dataIndex: 'owner',
            width: 200,
            filters: [
                {
                    text: 'Semi Design',
                    value: 'Semi Design',
                },
                {
                    text: 'Semi D2C',
                    value: 'Semi D2C',
                },
            ],
            onFilter: (value, record) => record.name.includes(value),
            sorter: (a, b) => (a.name.length - b.name.length > 0 ? 1 : -1),
            ellipsis: { showTitle: false },
            render: (text) => <Typography.Text ellipsis={{ showTooltip: true }}>{text}</Typography.Text>,
        },
        {
            title: 'Size',
            dataIndex: 'size',
            sorter: (a, b) => (a.name.length - b.name.length > 0 ? 1 : -1),
            ellipsis: true,
        },
        {
            title: 'Update time',
            dataIndex: 'updateTime',
            width: 200,
            ellipsis: true,
        },
        {
            title: '',
            dataIndex: 'operate',
            fixed: 'right',
            align: 'center',
            width: 100,
            render: () => {
                return <IconMore />;
            },
        },
    ];
    const data = [
        {
            key: '1',
            name: 'Maintained by the Douyin front-end and UED teams, an easy-to-customize modern design system that helps designers and developers create high-quality products.',
            nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/figma-icon.png',
            size: '2M',
            owner: 'Pengzhi Jiang Pengzhi Jiang Pengzhi Jiang Pengzhi Jiang',
            updateTime: '2020-02-02 05:13',
            avatarBg: 'grey',
        },
        {
            key: '2',
            name: 'Semi is designed based on FA architecture, and the main logic is extracted as Foundation package, which is easy to migrate to other frameworks',
            nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png',
            size: '2M',
            owner: 'Xuan Hao Xuan Hao Xuan Hao Xuan Hao Xuan Hao Xuan Hao',
            updateTime: '2020-02-02 05:13',
            avatarBg: 'red',
        },
        {
            key: '3',
            nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png',
            name: 'Maintained by the Douyin front-end and UED teams, an easy-to-customize modern design system that helps designers and developers create high-quality products.',
            size: '34KB',
            owner: 'Pengzhi Jiang Pengzhi Jiang Pengzhi Jiang Pengzhi Jiang',
            updateTime: '2020-02-02 05:13',
            avatarBg: 'light-blue',
        },
        {
            key: '4',
            name: 'Semi is designed based on FA architecture, and the main logic is extracted as Foundation package, which is easy to migrate to other frameworks',
            nameIconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png',
            size: '34KB',
            owner: 'Xuan Hao Xuan Hao Xuan Hao Xuan Hao Xuan Hao Xuan Hao',
            updateTime: '2020-02-02 05:13',
            avatarBg: 'light-blue',
        },
    ];

    return <Table scroll={{ x: 1200 }} columns={columns} dataSource={data} pagination={false} />;
}

render(App);
```

### Resizable Column

Version > = 0.15.0

#### Basic Resizable Column

For some columns with more content, you can choose to turn on the telescopic column function and pull and pull at the head to realize the real-time change of column width.

But you need to pay attention to some parameters:

-   `resizable` is set to `true` or an `object`
-   Any column in `columns` that requires a telescopic function should specify the `width`field (if not passed, the column does not have a telescopic function and its column width will be automatically adjusted by the browser)
-   `column.resize` can take effect after resizable is enabled. After setting to false, the column no longer supports scaling. v2.42 support


> When used with fixed columns, you need to specify a column without setting the width

> It is not recommended to use it with `scroll.x` at the same time. scroll.x specifies that the table has a width range, and stretching columns will expand the column width, which may cause the table to be misaligned

```jsx live=true noInline=true dir="column"
import React, { useMemo } from 'react';
import { Table, Avatar } from '@douyinfe/semi-ui';
import * as dateFns from 'date-fns';

const DAY = 24 * 60 * 60 * 1000;
const figmaIconUrl = 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/figma-icon.png';

function ResizableDemo() {
    const columns = [
        {
            title: 'Title',
            dataIndex: 'name',
            width: 300,
            resize: false,
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
                    text: 'Semi Design design draft',
                    value: 'Semi Design design draft',
                },
                {
                    text: 'Semi D2C design draft',
                    value: 'Semi D2C design draft',
                },
            ],
            onFilter: (value, record) => record.name.includes(value),
        },
        {
            title: 'Size',
            dataIndex: 'size',
            width: 200,
            sorter: (a, b) => (a.size - b.size > 0 ? 1 : -1),
            render: text => `${text} KB`,
        },
        {
            title: 'Owner',
            width: 200,
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
            title: 'Update',
            dataIndex: 'updateTime',
            sorter: (a, b) => (a.updateTime - b.updateTime > 0 ? 1 : -1),
            render: value => {
                return dateFns.format(new Date(value), 'yyyy-MM-dd');
            },
        },
        {
            title: 'Operate',
            dataIndex: 'operate',
            fixed: 'right',
            width: 100,
            resize: false,
            render: () => {
                return <IconMore />;
            },
        },
    ];

    const data = useMemo(() => {
        const _data = [];
        for (let i = 0; i < 46; i++) {
            const isSemiDesign = i % 2 === 0;
            const randomNumber = (i * 1000) % 199;
            _data.push({
                key: '' + i,
                name: isSemiDesign ? `Semi Design design draft${i}.fig` : `Semi D2C design draft${i}.fig`,
                owner: isSemiDesign ? 'Jiang Pengzhi' : 'Hao Xuan',
                size: randomNumber,
                updateTime: new Date().valueOf() + randomNumber * DAY,
                avatarBg: isSemiDesign ? 'grey' : 'red',
            });
        }
        return _data;
    }, []);

    return <Table columns={columns} dataSource={data} resizable bordered />;
}

render(ResizableDemo);
```

#### Advanced Telescopic Columns

`resizable` can also be an `object`, including three event methods:

-   onResize
-   onResizeStart
-   onResizeStop

These three callback will be triggered on `changing column width`, `start changing column width` and `stop changing column width` respectively. Developers can choose to modify the column at this time, such as adding a vertical line effect when dragging, as shown below.

```jsx live=true noInline=true dir="column"
import React, { useMemo } from 'react';
import { Table, Avatar } from '@douyinfe/semi-ui';
import * as dateFns from 'date-fns';

const DAY = 24 * 60 * 60 * 1000;
const figmaIconUrl = 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/figma-icon.png';
const pagination = { pageSize: 5 };

function ResizableDemo() {
    const columns = [
        {
            title: 'Title',
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
                    text: 'Semi Design design draft',
                    value: 'Semi Design design draft',
                },
                {
                    text: 'Semi D2C design draft',
                    value: 'Semi D2C design draft',
                },
            ],
            onFilter: (value, record) => record.name.includes(value),
        },
        {
            title: 'Size',
            dataIndex: 'size',
            width: 200,
            sorter: (a, b) => (a.size - b.size > 0 ? 1 : -1),
            render: text => `${text} KB`,
        },
        {
            title: 'Owner',
            width: 200,
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
            title: 'Update',
            dataIndex: 'updateTime',
            sorter: (a, b) => (a.updateTime - b.updateTime > 0 ? 1 : -1),
            render: value => {
                return dateFns.format(new Date(value), 'yyyy-MM-dd');
            },
        },
    ];

    const data = useMemo(() => {
        const _data = [];
        for (let i = 0; i < 46; i++) {
            const isSemiDesign = i % 2 === 0;
            const randomNumber = (i * 1000) % 199;
            _data.push({
                key: '' + i,
                name: isSemiDesign ? `Semi Design design draft${i}.fig` : `Semi D2C design draft${i}.fig`,
                owner: isSemiDesign ? 'Jiang Pengzhi' : 'Hao Xuan',
                size: randomNumber,
                updateTime: new Date().valueOf() + randomNumber * DAY,
                avatarBg: isSemiDesign ? 'grey' : 'red',
            });
        }
        return _data;
    }, []);

    const resizable = {
        onResizeStart: curColumn => {
            const className = addClass(curColumn.className, 'my-resizing');

            return { className };
        },
        onResizeStop: curColumn => {
            const className = removeClass(curColumn.className, 'my-resizing');

            return { className };
        },
    };

    return (
        <div id="components-table-demo-resizable-column">
            <Table columns={columns} dataSource={data} resizable={resizable} pagination={pagination} bordered />
        </div>
    );
}

render(ResizableDemo);
```

The CSS style definition used in this example:

```css
#components-table-demo-resizable-column .my-resizing {
    border-right: 2px solid red;
}

#components-table-demo-resizable-column .react-resizable-handle:hover {
    background-color: red;
}

#components-table-demo-resizable-column .my-resizing:hover .react-resizable-handle {
    background-color: inherit;
}
```

### Drag Sorting

Use [dnd-kit](https://github.com/clauderic/dnd-kit/tree/master) with the [`components`](https://github.com/DouyinFE/semi-design/blob/340c93e4e1612a879be869c43ad7a9a85ab5a302/packages/semi-ui/table/interface.ts#L200) API to easily implement drag-and-drop sorting. Supported in version 2.58

```jsx live=true dir="column" noInline=true hideInDSM
import React, { useEffect, useMemo, useState } from 'react';
import { Table, Avatar } from '@douyinfe/semi-ui';
import * as dateFns from 'date-fns';
import { DndContext, PointerSensor, useSensors, useSensor } from '@dnd-kit/core'; // based on @dnd-kit/core v6
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { CSS as cssDndKit } from '@dnd-kit/utilities';
import classNames from 'classnames';

function App() {
    const pageSize = 10;
    const [dataSource, setData] = useState([]);
    const [pageData, setPageData] = useState([]);
    const columns = useMemo(
        () => [
            {
                title: 'Title',
                dataIndex: 'name',
                width: 400,
                render: (text, record, index) => {
                    return (
                        <div>
                            <Avatar
                                size="small"
                                shape="square"
                                src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/figma-icon.png"
                                style={{ marginRight: 12 }}
                            ></Avatar>
                            {text}
                        </div>
                    );
                },
                filters: [
                    {
                        text: 'Semi Design Draft',
                        value: 'Semi Design Draft',
                    },
                    {
                        text: 'Semi D2C Draft',
                        value: 'Semi D2C Draft',
                    },
                ],
                onFilter: (value, record) => record.name.includes(value),
            },
            {
                title: 'Size',
                dataIndex: 'size',
                sorter: (a, b) => (a.size - b.size > 0 ? 1 : -1),
                render: text => `${text} KB`,
            },
            {
                title: 'Owner',
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
                title: 'Update',
                dataIndex: 'updateTime',
                sorter: (a, b) => (a.updateTime - b.updateTime > 0 ? 1 : -1),
                render: value => {
                    return dateFns.format(new Date(value), 'yyyy-MM-dd');
                },
            },
        ],
        []
    );

    useEffect(() => {
        const getData = () => {
            const data = [];
            for (let i = 0; i < 46; i++) {
                const isSemiDesign = i % 2 === 0;
                const randomNumber = (i * 1000) % 199;
                data.push({
                    key: '' + i,
                    name: isSemiDesign ? `Semi Design Draft${i}.fig` : `Semi D2C Draft${i}.fig`,
                    owner: isSemiDesign ? 'Jiang Pengzhi' : 'Hao Xuan',
                    size: randomNumber,
                    updateTime: new Date().valueOf() + randomNumber,
                    avatarBg: isSemiDesign ? 'grey' : 'red',
                });
            }
            return data;
        };
        const data = getData();
        setData(data);
    }, []);
    const [pageNum, setPageNum] = useState(1);

    useEffect(() => {
        const currentPageData = dataSource.slice((pageNum - 1) * pageSize, pageNum * pageSize);
        setPageData(currentPageData);
    }, [dataSource, pageNum]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 1 },
        })
    );

    const handleDragEnd = event => {
        const { active, over } = event;
        if (active && over && active.id !== over.id) {
            setPageData(prev => {
                const activeIndex = prev.findIndex(data => data.key === active.id);
                const overIndex = prev.findIndex(data => data.key === over.id);
                return arrayMove(prev, activeIndex, overIndex);
            });
        }
    };

    const handleChange = ({ pagination }) => {
        const { currentPage } = pagination;
        setPageNum(currentPage);
    };

    const SortableRow = (props) => {
        const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({
            id: props['data-row-key'],
        });
        const style = {
            ...props.style,
            transform: cssDndKit.Transform.toString(transform),
            transition,
            cursor: 'grabbing',
            ...(isDragging ? { zIndex: 999, position: 'relative' } : {}),
        };
        const rowCls = classNames(props.className,
            {
                ['isDragging']: isDragging,
                ['isOver']: isOver,
            }
        );
        const onPointerDown = (event) => {
            event.persist();
            console.log('props', event);
            listeners.onPointerDown(event);
        };

        return <tr {...props} className={rowCls} ref={setNodeRef} style={style} {...attributes} {...listeners} onPointerDown={onPointerDown}></tr>;
    };

    return (
        <DndContext
            // https://docs.dndkit.com/api-documentation/context-provider#autoscroll
            autoScroll={true}
            sensors={sensors}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
        >
            <SortableContext items={pageData.map(data => data.key)} strategy={verticalListSortingStrategy}>
                <Table
                    components={{
                        body: {
                            row: SortableRow,
                        },
                    }}
                    rowKey="key"
                    columns={columns}
                    dataSource={pageData}
                    pagination={{ currentPage: pageNum, pageSize: pageSize, total: dataSource.length }}
                    onChange={handleChange}
                />
            </SortableContext>
        </DndContext>
    );
}

render(App);
```

### Table Grouping

For some tables whose data needs to be displayed in groups, you can pass in `groupBy` to define the grouping rules, and use `renderGroupSection` to define the rendering of the grouping table header.

> Note: Be sure to provide a "key" for each row of data that is different from other row values, or use the rowKey parameter to specify a property name as the primary key.

```jsx live=true noInline=true dir="column"
import React from 'react';
import { Table, Avatar } from '@douyinfe/semi-ui';
import * as dateFns from 'date-fns';

const DAY = 24 * 60 * 60 * 1000;
const figmaIconUrl = 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/figma-icon.png';

const columns = [
    {
        title: 'Title',
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
                text: 'Semi Design design draft',
                value: 'Semi Design design draft',
            },
            {
                text: 'Semi D2C design draft',
                value: 'Semi D2C design draft',
            },
        ],
        onFilter: (value, record) => record.name.includes(value),
    },
    {
        title: 'Size',
        dataIndex: 'size',
        sorter: (a, b) => (a.size - b.size > 0 ? 1 : -1),
        render: text => `${text} KB`,
    },
    {
        title: 'Owner',
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
        title: 'Update',
        dataIndex: 'updateTime',
        sorter: (a, b) => (a.updateTime - b.updateTime > 0 ? 1 : -1),
        render: value => {
            return dateFns.format(new Date(value), 'yyyy-MM-dd');
        },
    },
];

const getData = () => {
    const data = [];
    for (let i = 0; i < 46; i++) {
        const isSemiDesign = i % 2 === 0;
        const randomNumber = ((i * 1000) % 19) + 100;
        data.push({
            key: '' + i,
            name: isSemiDesign ? `Semi Design design draft${i}.fig` : `Semi D2C design draft${i}.fig`,
            owner: isSemiDesign ? 'Jiang Pengzhi' : 'Hao Xuan',
            size: randomNumber,
            updateTime: new Date().valueOf() + randomNumber * DAY,
            avatarBg: isSemiDesign ? 'grey' : 'red',
        });
    }
    return data;
};

const data = getData();

function Demo() {
    const rowKey = record =>
        `${record.owner && record.owner.toLowerCase()}-${record.name && record.name.toLowerCase()}`;

    return (
        <div style={{ padding: '20px 0px' }}>
            <Table
                dataSource={data}
                rowKey={rowKey}
                groupBy={'size'}
                columns={columns}
                renderGroupSection={groupKey => <strong>Group by file size {groupKey} KB</strong>}
                onGroupedRow={(group, index) => {
                    return {
                        // onMouseEnter: () => {
                        //     console.log(`Grouped row mouse enter: `, group, index);
                        // },
                        // onMouseLeave: () => {
                        //     console.log(`Grouped row mouse leave: `, group, index);
                        // },
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

render(Demo);
```

### Virtualized Table

Virtualization can be used for scenes that need to render large-scale data. You can enable this feature by configuring the `virtualized` parameter. have to be aware of is:

-   Must pass `scroll.y` (number) and`style.width` (number);
-   Need to pass the height of each line `virtualized.itemSize` (when not transmitting, the normal line height defaults to `56`, and the group head line height defaults to `56`), can be of the following types:
    -   `number`
    -   `(index, { sectionRow?: boolean, expandedRow?: boolean }) => number`
-   Table grouping virtualization requires version >= `0.37.0`.

The following is an example of rendering 1000 pieces of data.

```jsx live=true noInline=true dir="column"
import React, { useRef } from 'react';
import { Table, Avatar, Button } from '@douyinfe/semi-ui';
import * as dateFns from 'date-fns';

const DAY = 24 * 60 * 60 * 1000;

const columns = [
    {
        title: 'Title',
        dataIndex: 'name',
        width: 200,
        fixed: true,
        render: (text, record, index) => {
            return <div>{text}</div>;
        },
        filters: [
            {
                text: 'Semi Design design draft',
                value: 'Semi Design design draft',
            },
            {
                text: 'Semi D2C design draft',
                value: 'Semi D2C design draft',
            },
        ],
        onFilter: (value, record) => record.name.includes(value),
    },
    {
        title: 'Size',
        dataIndex: 'size',
        width: 150,
        sorter: (a, b) => (a.size - b.size > 0 ? 1 : -1),
        render: text => `${text} KB`,
    },
    {
        title: 'Owner',
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
        title: 'Update',
        dataIndex: 'updateTime',
        fixed: 'right',
        width: 150,
        sorter: (a, b) => (a.updateTime - b.updateTime > 0 ? 1 : -1),
        render: value => {
            return dateFns.format(new Date(value), 'yyyy-MM-dd');
        },
    },
];

const getData = () => {
    const data = [];
    for (let i = 0; i < 1000; i++) {
        const isSemiDesign = i % 2 === 0;
        const randomNumber = (i * 1000) % 199;
        data.push({
            key: '' + i,
            name: isSemiDesign ? `Semi Design design draft${i}.fig` : `Semi D2C design draft${i}.fig`,
            owner: isSemiDesign ? 'Jiang Pengzhi' : 'Hao Xuan',
            size: randomNumber,
            updateTime: new Date().valueOf() + randomNumber * DAY,
            avatarBg: isSemiDesign ? 'grey' : 'red',
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
                getVirtualizedListRef={ref => (virtualizedListRef = ref)}
            />
        </>
    );
}

render(VirtualizedFixedDemo);
```

### Infinite Scroll

Based on the virtualization feature, we can achieve infinite scroll loading data by passing in `virtualized.onScroll`.

```jsx live=true noInline=true dir="column" hideInDSM
import React, { useRef } from 'react';
import { Table, Avatar, Button } from '@douyinfe/semi-ui';
import * as dateFns from 'date-fns';

const DAY = 24 * 60 * 60 * 1000;

const columns = [
    {
        title: 'Title',
        dataIndex: 'name',
        width: 200,
        fixed: true,
        render: (text, record, index) => {
            return <div>{text}</div>;
        },
        filters: [
            {
                text: 'Semi Design design draft',
                value: 'Semi Design design draft',
            },
            {
                text: 'Semi D2C design draft',
                value: 'Semi D2C design draft',
            },
        ],
        onFilter: (value, record) => record.name.includes(value),
    },
    {
        title: 'Size',
        dataIndex: 'size',
        width: 150,
        sorter: (a, b) => (a.size - b.size > 0 ? 1 : -1),
        render: text => `${text} KB`,
    },
    {
        title: 'Owner',
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
        title: 'Update',
        dataIndex: 'updateTime',
        fixed: 'right',
        width: 150,
        sorter: (a, b) => (a.updateTime - b.updateTime > 0 ? 1 : -1),
        render: value => {
            return dateFns.format(new Date(value), 'yyyy-MM-dd');
        },
    },
];

function InfiniteScrollDemo() {
    const [data, setData] = useState([]);

    const scroll = { y: 600, x: 1000 };
    const style = { width: 750, margin: '0 auto' };

    const loadMore = () => {
        const pageSize = 20; // load 20 records every time
        const newData = [...data];
        const currentLength = data.length;
        for (let i = currentLength; i < currentLength + pageSize; i++) {
            const isSemiDesign = i % 2 === 0;
            const randomNumber = (i * 1000) % 199;
            newData.push({
                key: '' + i,
                name: isSemiDesign ? `Semi Design design draft${i}.fig` : `Semi D2C design draft${i}.fig`,
                owner: isSemiDesign ? 'Jiang Pengzhi' : 'Hao Xuan',
                size: randomNumber,
                updateTime: new Date().valueOf() + randomNumber * DAY,
                avatarBg: isSemiDesign ? 'grey' : 'red',
            });
        }
        setData(newData);
    };

    const itemSize = 56;
    const virtualized = {
        itemSize,
        onScroll: ({ scrollDirection, scrollOffset, scrollUpdateWasRequested }) => {
            if (
                scrollDirection === 'forward' &&
                scrollOffset >= (data.length - Math.ceil(scroll.y / itemSize) * 1.5) * itemSize &&
                !scrollUpdateWasRequested
            ) {
                loadMore();
            }
        },
    };

    useEffect(() => {
        loadMore();
    }, []);

    return (
        <Table
            pagination={false}
            columns={columns}
            dataSource={data}
            scroll={scroll}
            style={style}
            virtualized={virtualized}
        />
    );
}

render(InfiniteScrollDemo);
```

### Controlled Dynamic Tables

```jsx live=true noInline=true dir="column" hideInDSM
import React from 'react';
import { Table, Switch, ButtonGroup, Button, Avatar, Space } from '@douyinfe/semi-ui';
import * as dateFns from 'date-fns';

const DAY = 24 * 60 * 60 * 1000;
const figmaIconUrl = 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/figma-icon.png';

class App extends React.Component {
    constructor(props) {
        super(props);
        const dataTotalSize = 46;
        const columns = [
            {
                title: 'Title',
                dataIndex: 'name',
                width: 400,
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
                        text: 'Semi Design design draft',
                        value: 'Semi Design design draft',
                    },
                    {
                        text: 'Semi D2C design draft',
                        value: 'Semi D2C design draft',
                    },
                ],
                onFilter: (value, record) => record.name.includes(value),
            },
            {
                title: 'Size',
                dataIndex: 'size',
                sorter: (a, b) => (a.size - b.size > 0 ? 1 : -1),
                render: text => `${text} KB`,
            },
            {
                title: 'Owner',
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
                title: 'Update',
                dataIndex: 'updateTime',
                sorter: (a, b) => (a.updateTime - b.updateTime > 0 ? 1 : -1),
                render: value => {
                    return dateFns.format(new Date(value), 'yyyy-MM-dd');
                },
            },
        ];

        this.getData = () => {
            const data = [];
            for (let i = 0; i < dataTotalSize; i++) {
                const isSemiDesign = i % 2 === 0;
                const randomNumber = (i * 1000) % 199;
                data.push({
                    key: '' + i,
                    name: isSemiDesign ? `Semi Design design draft${i}.fig` : `Semi D2C design draft${i}.fig`,
                    owner: isSemiDesign ? 'Jiang Pengzhi' : 'Hao Xuan',
                    size: randomNumber,
                    updateTime: new Date().valueOf() + randomNumber * DAY,
                    avatarBg: isSemiDesign ? 'grey' : 'red',
                });
            }
            return data;
        };

        const data = this.getData();
        this.data = data;

        this.mergeColumns = (column, columns, keys = ['dataIndex']) => {
            columns = [...columns];
            columns.forEach((curColumn, index) => {
                let isTarget = !!(keys && keys.length);

                for (let key of keys) {
                    if (column[key] !== curColumn[key]) {
                        isTarget = false;
                        break;
                    }
                }

                if (isTarget) {
                    columns[index] = { ...curColumn, ...column };
                }
            });

            return columns;
        };

        this.filterData = (filters, dataSource) => {
            dataSource = [...dataSource];
            filters.forEach(filter => {
                let filteredValue = filter.filteredValue;
                let dataIndex = filter.dataIndex;
                if (Array.isArray(filteredValue) && filteredValue.length && dataIndex) {
                    dataSource = dataSource.filter(
                        data => filteredValue.filter(value => String(data[dataIndex]).indexOf(value) > -1).length
                    );
                }
            });

            return dataSource;
        };

        this.getSelfSorterColumn = columns => {
            columns = columns || this.state.columns;
            return columns.filter(column => !!column.sorter)[0];
        };

        this.getSelfFilterColumns = columns => {
            columns = columns || this.state.columns;
            return columns.filter(column => Array.isArray(column.filteredValue) && column.filteredValue.length);
        };

        this.sortData = (sortObj, dataSource) => {
            let { sorter, sortOrder, dataIndex } = sortObj;

            if (sorter && sortOrder && typeof sorter !== 'function') {
                sorter = (a, b) => (a[dataIndex] > b[dataIndex] ? 1 : -1);
            }

            if (typeof sorter === 'function') {
                dataSource = [...dataSource].sort(sorter);

                if (sortOrder === 'descend') {
                    dataSource = dataSource.reverse();
                }
            }

            return dataSource;
        };

        this.fetchData = (currentPage = 1, sorter = {}, filters = []) => {
            // console.log(`FetchData currentPage: `, currentPage);
            let pagination = { ...this.state.pagination, currentPage };
            return new Promise((res, rej) => {
                setTimeout(() => {
                    let data = [...this.data];
                    data = this.sortData(sorter, data);
                    data = this.filterData(filters, data);
                    let dataSource = data.slice(
                        (currentPage - 1) * pagination.pageSize,
                        currentPage * pagination.pageSize
                    );
                    pagination.total = data.length;
                    res({
                        dataSource,
                        pagination,
                        sorter,
                        filters,
                    });
                }, 1500);
            });
        };

        this.setPage = (currentPage, sorter, filters) => {
            if (this.state.loading) {
                return;
            }
            if (typeof currentPage !== 'number') {
                currentPage = (this.state.pagination && this.state.pagination.currentPage) || 1;
            }

            sorter = sorter || this.getSelfSorterColumn();
            filters = filters || this.getSelfFilterColumns();

            this.setState({ loading: true });
            this.fetchData(currentPage, sorter, filters)
                .then(({ dataSource, pagination, sorter, filters }) => {
                    let columns = [...this.state.columns];
                    columns = this.mergeColumns(sorter, columns);
                    for (let filterObj of filters) {
                        columns = this.mergeColumns(filterObj, columns);
                    }
                    this.setState({
                        loading: false,
                        pagination,
                        dataSource,
                        columns,
                    });
                })
                .catch(err => {
                    console.error(err);
                    this.setState({ loading: false });
                });
        };

        this.toggleFixHeader = checked => {
            let scroll = { ...this.state.scroll };

            if (checked) {
                scroll.y = 300;
            } else {
                scroll.y = null;
            }

            this.setState({ scroll });
        };

        this.toggleFixColumns = checked => {
            let columns = [...this.state.columns];
            let scroll = { ...this.state.scroll };
            let expandCellFixed = this.state.expandCellFixed;
            let rowSelection = this.state.rowSelection;

            if (checked) {
                columns[0].fixed = true;

                if (rowSelection) {
                    rowSelection = { ...rowSelection, fixed: true };
                }
                if (columns.length > 1) {
                    columns[columns.length - 1].fixed = 'right';
                }
                scroll.x = '150%';
                expandCellFixed = true;
            } else {
                columns.forEach(column => {
                    column.fixed = false;
                });
                scroll.x = null;
                expandCellFixed = false;

                if (rowSelection) {
                    rowSelection = { ...rowSelection, fixed: false };
                }
            }

            this.setState({
                rowSelection,
                expandCellFixed,
                columns,
                scroll,
            });
        };

        this.toggleRowSelection = checked => {
            let rowSelection = this.state.rowSelection;
            // const anyColumnFixed = this.state.columns.some(column => !!column.fixed);

            if (checked) {
                rowSelection = {
                    width: 48,
                    fixed: true,
                    onChange: (selectedRowKeys, selectedRows) =>
                        console.log(
                            'Selection changed, selectedRowKeys: ',
                            selectedRowKeys,
                            'selectedRows: ',
                            selectedRows
                        ),
                };
            } else {
                rowSelection = null;
            }

            this.setState({ rowSelection });
        };

        this.toggleLoading = checked => {
            let loading = this.state.loading;

            if (checked) {
                loading = true;
            } else {
                loading = false;
            }

            this.setState({ loading });
        };

        this.toggleExpandedRowRender = checked => {
            let expandedRowRender = this.state.expandedRowRender;

            if (checked) {
                expandedRowRender = record => {
                    return {
                        children: <p>{record.description}</p>,
                        fixed: 'left',
                    };
                };
            } else {
                expandedRowRender = null;
            }

            this.setState({ expandedRowRender });
        };

        this.toggleShowSorter = checked => {
            let columns = [...this.state.columns];

            if (checked) {
                columns.forEach(column => column.dataIndex === 'age' && (column.sorter = true));
            } else {
                columns.forEach(column => (column.sorter = null));
            }

            this.setState({ columns });
        };

        this.toggleShowFilter = checked => {
            let columns = [...this.state.columns];

            if (checked) {
                columns.forEach(column => {
                    if (column.dataIndex === 'name') {
                        column.filters = [
                            {
                                text: 'Name contains 1',
                                value: '1',
                            },
                            {
                                text: 'Name contains 2',
                                value: '2',
                            },
                            {
                                text: 'Name contains 3',
                                value: '3',
                            },
                        ];
                        column.filteredValue = [];
                    }
                });
            } else {
                columns.forEach(column => {
                    column.filters = null;
                    column.filteredValue = null;
                });
            }

            this.setState({ columns });

            if (!checked) {
                this.setPage(null, null, []);
            }
        };

        this.onChange = (data = {}) => {
            console.log('Table changed: ', data);
            let { pagination, sorter, filters } = data;
            this.setPage(pagination.currentPage, sorter, filters);
        };

        this.onExpandedRowsChange = rows => {
            console.log('Expanded rows changed to: ', rows);

            const expandedRowKeys = (Array.isArray(rows) && rows.map(row => row.key)) || [];

            this.setState({ expandedRowKeys });
        };

        this.toggleExpandedRowKeys = checked => {
            let expandedRowKeys = [];

            if (checked) {
                let dataSource = [...this.state.dataSource];
                expandedRowKeys.push(
                    ...dataSource.reduce((arr, data) => {
                        if (data.key) {
                            arr.push(data.key);
                        }
                        return arr;
                    }, [])
                );
                this.toggleExpandedRowRender(true);
            }
            this.setState({ expandedRowKeys });
        };

        this.toggleBordered = checked => {
            let bordered = false;

            if (checked) {
                bordered = true;
            }

            this.setState({ bordered });
        };

        this.toggleResizable = checked => {
            let resizable = !!checked || false;

            this.setState({ resizable, bordered: resizable });
        };

        this.toggleHideHeader = checked => {
            let showHeader = true;

            if (checked) {
                showHeader = false;
            }

            this.setState({ showHeader });
        };

        this.toggleFooter = checked => {
            const footer = checked ? dataSource => <p style={{ margin: 0 }}>This is footer.</p> : null;

            this.setState({ footer });
        };

        this.toggleTitle = checked => {
            const title = checked ? 'This is title.' : null;

            this.setState({ title });
        };

        this.toggleHidePagination = checked => {
            let pagination = checked
                ? false
                : {
                      currentPage: 1,
                      pageSize: 8,
                      total: data.length,
                      onPageChange: page => this.setPage(page),
                  };

            this.setState({ pagination });
        };

        this.toggleDataSource = checked => {
            if (checked) {
                this.setState({ dataSource: [] });
            } else {
                this.setPage();
            }
        };

        this.switchPagination = position => {
            let pagination = this.state.pagination;

            const defaultPagination = {
                currentPage: 1,
                pageSize: 8,
                total: data.length,
                onPageChange: page => this.setPage(page),
            };

            const positions = ['bottom', 'top', 'both'];

            if (position === true || position === false) {
                pagination = position ? { ...defaultPagination, ...pagination } : false;
            } else if (positions.includes(position)) {
                pagination = { ...defaultPagination, ...pagination, position };
            }

            this.setState({ pagination });
        };

        this.state = {
            loading: false,
            columns,
            scroll: {},
            rowSelection: null,
            expandedRowRender: null,
            expandCellFixed: false,
            defaultExpandedRowKeys: [],
            title: null,
            footer: null,
            expandedRowKeys: [],
            showHeader: true,
            resizable: false,
            pagination: {
                currentPage: 1,
                pageSize: 8,
                total: data.length,
                onPageChange: page => this.setPage(page),
            },
            dataSource: [],
        };

        this.TableSwitch = function TableSwitch({
            text,
            children,
            checked,
            onChange,
            style = { display: 'inline-flex', alignItems: 'center', margin: 5 },
        }) {
            const switchProps = { onChange };

            if (checked != null) {
                switchProps.checked = !!checked;
            }
            return (
                <span style={style}>
                    <span>{text}</span>
                    {children != null ? children : <Switch size="small" {...switchProps} />}
                </span>
            );
        };
    }

    componentDidMount() {
        this.setPage(1);
    }

    render() {
        let {
            columns,
            dataSource,
            pagination,
            loading,
            scroll,
            rowSelection,
            expandedRowRender,
            expandCellFixed,
            expandedRowKeys,
            bordered,
            resizable,
            title,
            footer,
            showHeader,
            defaultExpandedRowKeys,
        } = this.state;

        const wrapStyle = { marginBottom: 15, display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap' };

        const TableSwitch = this.TableSwitch;

        return (
            <div>
                <Space style={wrapStyle} wrap>
                    <TableSwitch text="Fixed Header:" checked={scroll && scroll.y} onChange={this.toggleFixHeader} />
                    <TableSwitch text="Hidden Header:" onChange={this.toggleHideHeader} />
                    <TableSwitch text="Show Header:" onChange={this.toggleTitle} />
                    <TableSwitch text="Show Footer:" onChange={this.toggleFooter} />
                    <TableSwitch text="Fixed Column:" onChange={this.toggleFixColumns} />
                    <TableSwitch text="Show Selection Column:" onChange={this.toggleRowSelection} />
                    <TableSwitch text="Show Loading:" onChange={this.toggleLoading} checked={loading} />
                    <TableSwitch
                        text="Empty Content:"
                        onChange={this.toggleDataSource}
                        checked={!dataSource || !dataSource.length}
                    />
                    <TableSwitch text="Column Sorter:" onChange={this.toggleShowSorter} />
                    <TableSwitch text="Column Filter:" onChange={this.toggleShowFilter} />
                    <TableSwitch
                        text="Row Expandable:"
                        onChange={this.toggleExpandedRowRender}
                        checked={typeof expandedRowRender === 'function'}
                    />
                    <TableSwitch text="Expand All Rows:" onChange={this.toggleExpandedRowKeys} />
                    <TableSwitch text="Show Border:" onChange={this.toggleBordered} checked={bordered} />
                    <TableSwitch text="Column Resizable:" onChange={this.toggleResizable} />
                    <TableSwitch text="Show Pagination:">
                        <ButtonGroup>
                            <Button onClick={() => this.switchPagination('bottom')}>Bottom</Button>
                            <Button onClick={() => this.switchPagination('top')}>Top</Button>
                            <Button onClick={() => this.switchPagination('both')}>Both</Button>
                            <Button onClick={() => this.switchPagination(false)}>None</Button>
                        </ButtonGroup>
                    </TableSwitch>
                </Space>
                <Table
                    defaultExpandedRowKeys={defaultExpandedRowKeys}
                    onExpandedRowsChange={this.onExpandedRowsChange}
                    title={title}
                    footer={footer}
                    showHeader={showHeader}
                    bordered={bordered}
                    onChange={this.onChange}
                    expandCellFixed={expandCellFixed}
                    expandedRowRender={expandedRowRender}
                    expandedRowKeys={expandedRowKeys}
                    rowSelection={rowSelection}
                    scroll={scroll}
                    columns={columns}
                    dataSource={dataSource}
                    pagination={pagination}
                    loading={loading}
                    resizable={resizable}
                />
            </div>
        );
    }
}

render(App);
```

### Fully custom rendering

**Version:** >=0.34.0

Generally, you can use `Column.render`, but you can also pass`Column.useFullRender = true` to enable full custom rendering mode. At this time, the components such as checkbox button, expand button, indent will be Pass through to the `Column.title` and`Column.render` methods, you can further define the rendering method of the header and cell content.

The input parameters accepted by `Column.title` are:

```tsx
{
    filter: ReactNode, // Filter button
    sorter: ReactNode, // Sort button
    selection: ReactNode, // Select button
}
```

`Column.render` The fourth input parameter is:

```tsx
{
    expandIcon: ReactNode, // Expand button
    selection: ReactNode, // Select button
    indentTex: ReactNode, // Indentation
}
```

> The example below renders the checkbox and content into the same cell and header.

```jsx live=true noInline=true dir="column"
import React, { useState, useEffect, useMemo } from 'react';
import { Table, Avatar } from '@douyinfe/semi-ui';
import * as dateFns from 'date-fns';

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
                text: 'Semi Design design draft',
                value: 'Semi Design design draft',
            },
            {
                text: 'Semi D2C design draft',
                value: 'Semi D2C design draft',
            },
        ],
        onFilter: (value, record) => record.name.includes(value),
        useFullRender: true,
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
        title: 'Size',
        dataIndex: 'size',
        sorter: (a, b) => (a.size - b.size > 0 ? 1 : -1),
        render: text => `${text} KB`,
    },
    {
        title: 'Owner',
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
        title: 'Update',
        dataIndex: 'updateTime',
        sorter: (a, b) => (a.updateTime - b.updateTime > 0 ? 1 : -1),
        render: value => {
            return dateFns.format(new Date(value), 'yyyy-MM-dd');
        },
    },
];

const getData = total => {
    const data = [];
    for (let i = 0; i < total; i++) {
        const isSemiDesign = i % 2 === 0;
        const randomNumber = (i * 1000) % 199;
        data.push({
            key: '' + i,
            name: isSemiDesign ? `Semi Design design draft${i}.fig` : `Semi D2C design draft${i}.fig`,
            owner: isSemiDesign ? 'Jiang Pengzhi' : 'Hao Xuan',
            size: randomNumber,
            updateTime: new Date().valueOf() + randomNumber * DAY,
            avatarBg: isSemiDesign ? 'grey' : 'red',
        });
    }
    return data;
};

function Demo() {
    const [dataSource, setDataSource] = useState([]);
    const total = 46;
    const pagination = useMemo(
        () => ({
            pageSize: 12,
        }),
        []
    );

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
```

### Header Merge

**Version: >=1.1.0**

Users can use the header merge function to group the header. The header merge can be combined with fixed column, virtualization, data grouping, column scaling and other functions. It also supports JSX or configurable writing.

#### Combined Header Configuration Writing

```jsx live=true noInline=true dir="column"
import React, { useMemo } from 'react';
import { Table, Avatar } from '@douyinfe/semi-ui';
import { IconMore } from '@douyinfe/semi-icons';
import * as dateFns from 'date-fns';

const DAY = 24 * 60 * 60 * 1000;
const figmaIconUrl = 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/figma-icon.png';

const columns = [
    {
        title: 'Basic Info',
        fixed: 'left',
        children: [
            {
                title: 'Title',
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
                        text: 'Semi Design design draft',
                        value: 'Semi Design design draft',
                    },
                    {
                        text: 'Semi D2C design draft',
                        value: 'Semi D2C design draft',
                    },
                ],
                onFilter: (value, record) => record.name.includes(value),
            },
            {
                title: 'Size',
                dataIndex: 'size',
                width: 100,
                fixed: true,
                sorter: (a, b) => (a.size - b.size > 0 ? 1 : -1),
                render: text => `${text} KB`,
            },
        ],
    },
    {
        title: 'Others Info',
        children: [
            {
                title: 'Owner',
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
                title: 'Update',
                dataIndex: 'updateTime',
                sorter: (a, b) => (a.updateTime - b.updateTime > 0 ? 1 : -1),
                render: value => {
                    return dateFns.format(new Date(value), 'yyyy-MM-dd');
                },
            },
        ],
    },
    {
        title: 'More',
        fixed: 'right',
        width: 100,
        align: 'center',
        dataIndex: 'operate',
        render: () => {
            return <IconMore />;
        },
    },
];

const getData = total => {
    const data = [];
    for (let i = 0; i < total; i++) {
        const isSemiDesign = i % 2 === 0;
        const randomNumber = (i * 1000) % 199;
        data.push({
            key: '' + i,
            name: isSemiDesign ? `Semi Design design draft${i}.fig` : `Semi D2C design draft${i}.fig`,
            owner: isSemiDesign ? 'Jiang Pengzhi' : 'Hao Xuan',
            size: randomNumber,
            updateTime: new Date().valueOf() + randomNumber * DAY,
            avatarBg: isSemiDesign ? 'grey' : 'red',
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
```

#### Merge Header JSX Writing

```jsx live=true noInline=true dir="column"
import React, { useMemo } from 'react';
import { Table, Avatar } from '@douyinfe/semi-ui';
import { IconMore } from '@douyinfe/semi-icons';
import * as dateFns from 'date-fns';

const DAY = 24 * 60 * 60 * 1000;
const figmaIconUrl = 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/figma-icon.png';
const Column = Table.Column;

const getData = total => {
    const data = [];
    for (let i = 0; i < total; i++) {
        const isSemiDesign = i % 2 === 0;
        const randomNumber = (i * 1000) % 199;
        data.push({
            key: '' + i,
            name: isSemiDesign ? `Semi Design design draft${i}.fig` : `Semi D2C design draft${i}.fig`,
            owner: isSemiDesign ? 'Jiang Pengzhi' : 'Hao Xuan',
            size: randomNumber,
            updateTime: new Date().valueOf() + randomNumber * DAY,
            avatarBg: isSemiDesign ? 'grey' : 'red',
        });
    }
    return data;
};

function Demo() {
    const data = useMemo(() => {
        const _data = getData(46);
        return _data;
    }, []);

    const nameFilters = [
        {
            text: 'Semi Design design draft',
            value: 'Semi Design design draft',
        },
        {
            text: 'Semi D2C design draft',
            value: 'Semi D2C design draft',
        },
    ];

    const renderName = (text, record, index) => {
        return (
            <span>
                <Avatar size="small" shape="square" src={figmaIconUrl} style={{ marginRight: 12 }}></Avatar>
                {text}
            </span>
        );
    };

    const renderOwner = (text, record, index) => {
        return (
            <div>
                <Avatar size="small" color={record.avatarBg} style={{ marginRight: 4 }}>
                    {typeof text === 'string' && text.slice(0, 1)}
                </Avatar>
                {text}
            </div>
        );
    };

    return (
        <Table
            rowSelection={{ fixed: true }}
            expandedRowRender={record => <article>{record.name}</article>}
            dataSource={data}
            scroll={{ y: 400 }}
            onChange={(...args) => console.log(...args)}
        >
            <Column title="Basic Info" fixed="left">
                <Column
                    title="Title"
                    dataIndex="name"
                    width={300}
                    fixed
                    render={renderName}
                    filters={nameFilters}
                    onFilter={(value, record) => record.name.includes(value)}
                />
                <Column
                    title="Size"
                    dataIndex="size"
                    width={100}
                    fixed
                    render={text => `${text} KB`}
                    sorter={(a, b) => (a.size - b.size > 0 ? 1 : -1)}
                ></Column>
            </Column>
            <Column title="Others Info">
                <Column title="Owner" dataIndex="owner" render={renderOwner} />
                <Column
                    title="Update"
                    dataIndex="updateTime"
                    sorter={(a, b) => (a.updateTime - b.updateTime > 0 ? 1 : -1)}
                    render={value => dateFns.format(new Date(value), 'yyyy-MM-dd')}
                ></Column>
            </Column>
            <Column
                title="More"
                dataIndex="operate"
                fixed="right"
                width={100}
                align="center"
                render={() => <IconMore />}
            />
        </Table>
    );
}

render(Demo);
```

### colSpan and rowSpan

-   In addition to merging the headers by writing children, you can merge the headers by setting column.colSpan.
-   Table supports row/column merging. When the cell attribute colSpan or rowSpan in render is set to 0, the set table will not be rendered.

```tsx
type Render = (
    text: string,
    record: Object,
    index: number,
    options?: RenderOptions
) => {
    children: React.ReactNode;
    props: {
        colSpan?: number;
        rowSpan?: number;
    };
    [x: string]: any;
};

interface RenderOptions {
    expandIcon?: React.ReactNode;
}
```

```jsx live=true noInline=true dir="column"
import React, { useState, useMemo } from 'react';
import { Table, Avatar } from '@douyinfe/semi-ui';
import * as dateFns from 'date-fns';

const figmaIconUrl = 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/figma-icon.png';
const columns = [
    {
        title: 'Title',
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
        title: 'Size',
        dataIndex: 'size',
        render: (text, record, index) => {
            if (index === 0) {
                return {
                    children: `${text} KB`,
                    props: {
                        colSpan: 0,
                    },
                };
            }
            if (index === 1) {
                return {
                    children: `${text} KB`,
                    props: {
                        rowSpan: 2,
                    },
                };
            }
            if (index === 2) {
                return {
                    children: `${text} KB`,
                    props: {
                        rowSpan: 0,
                    },
                };
            }
            return `${text} KB`;
        },
    },
    {
        title: 'Owner',
        dataIndex: 'owner',
        render: (text, record, index) => {
            const children = (
                <div>
                    <Avatar size="small" color={record.avatarBg} style={{ marginRight: 4 }}>
                        {typeof text === 'string' && text.slice(0, 1)}
                    </Avatar>
                    {text}
                </div>
            );
            if (index === 0) {
                return {
                    children,
                    props: {
                        colSpan: 0,
                    },
                };
            }
            return children;
        },
    },
    {
        title: 'Update',
        dataIndex: 'updateTime',
        sorter: (a, b) => (a.updateTime - b.updateTime > 0 ? 1 : -1),
        render: (value, record, index) => {
            const children = dateFns.format(new Date(value), 'yyyy-MM-dd');
            if (index === 0) {
                return {
                    children,
                    props: {
                        colSpan: 0,
                    },
                };
            }
            if (index === 1) {
                return {
                    children,
                    props: {
                        rowSpan: 2,
                    },
                };
            }
            if (index === 2) {
                return {
                    children,
                    props: {
                        rowSpan: 0,
                    },
                };
            }
            return children;
        },
    },
];

const DAY = 24 * 60 * 60 * 1000;

function App() {
    const [dataSource, setData] = useState([]);

    const getData = total => {
        const data = [];
        for (let i = 0; i < total; i++) {
            const isSemiDesign = i % 2 === 0;
            const randomNumber = (i * 1000) % 199;
            data.push({
                key: '' + i,
                name: isSemiDesign ? `Semi Design design draft${i}.fig` : `Semi D2C design draft${i}.fig`,
                owner: isSemiDesign ? 'Jiang Pengzhi' : 'Hao Xuan',
                size: randomNumber,
                updateTime: new Date().valueOf() + randomNumber * DAY,
                avatarBg: isSemiDesign ? 'grey' : 'red',
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
```

## API Reference

## Table

| Properties | Instructions                                                                                                              | Type | Default | Version |
| --- |---------------------------------------------------------------------------------------------------------------------------| --- | --- | --- |
| bordered | Whether to display outer and column borders                                                                               | boolean | false |
| className | Outermost style name                                                                                                      | string |  |
| clickGroupedRowToExpand | Group content expands or collapses when the group header row is clicked                                                   | boolean |  | **0.29.0** |
| columns | For a configuration description of the table column, see [Column](#Column)                                                | Column [] | [] |
| components | Override the elements of Table, such as table, body, row, td, th, etc.                                                    | <a target="_blank" href="https://github.com/DouyinFE/semi-design/blob/340c93e4e1612a879be869c43ad7a9a85ab5a302/packages/semi-ui/table/interface.ts#L200">TableComponents</a> |  |
| dataSource | Data. **An independent key of each data record is need, or use rowKey to specify an attribute name as the primary key**                                                                                                             | RecordType[] | [] |
| defaultExpandAllRows | All rows are expanded by default                                                                                          | boolean | false |
| defaultExpandAllGroupRows | All grouped rows are expanded by default                                                                                  | boolean | false | **1.30.0** |
| defaultExpandedRowKeys | Default expansion of row key array                                                                                        | Array <\*> | [] |
| empty | Content displayed when there is no data                                                                                   | ReactNode | ReactNode | 'No data yet. ' |
| expandCellFixed | Whether the column of the expansion icon is fixed or not, the same value as the fixed value in Column                     | boolean\|string | false |
| expandIcon | Custom expansion icon, hidden when it is `false`                                                                          | boolean <br/>\|ReactNode <br/>\| (expanded: boolean) => ReactNode |  |
| expandedRowKeys | Expanded rows, the row expansion function will be controlled when this parameter is introduced.                           | (string \| number)[] |  |
| expandedRowRender | Extra unfolding lines. **An independent key of each data record is need**                                                                                                     | (record: object, index: number, expanded: boolean) => ReactNode |  |
| expandAllRows | All rows are expanded                                                                                                     | boolean | false | **1.30.0** |
| expandAllGroupRows | All grouped rows are expanded                                                                                             | boolean | false | **1.30.0** |
| expandRowByClick | Expand row when click row                                                                                                 | boolean | false | **1.31.0** |
| footer | End of form                                                                                                               | string<br/>\|ReactNode<br/>\|(pageData: object) => string\|ReactNode |  |
| groupBy | Grouping basis, generally a method of a key name or a return value of a string or number in the dataSource element        | string\|number<br/>\|(record: any) => string\|number |  | **0.29.0** |
| hideExpandedColumn | Whether to hide the expansion button column and turn off the rendering of the expansion button when it is turned on       | boolean | true |
| indentSize | indent size of TableCell                                                                                                  | number | 20 |
| keepDOM | Whether to not destroy the collapsed DOM when folding a row                                                               | boolean | false |
| loading | Table is loading or not                                                                                                   | boolean | false |
| pagination | Paging component configuration                                                                                            | boolean\|TablePaginationProps | true |
| prefixCls | Style name prefix                                                                                                         | string |  |
| renderGroupSection | Header rendering method                                                                                                   | (groupKey?: string \| number, group?: string[] \| number[]) => ReactNode |  | **0.29.0** |
| renderPagination | Customize the rendering method of pagination.                                                                             | (paginationProps?: TablePaginationProps) => ReactNode |  | **1.13.0** |
| resizable | Whether to turn on the telescopic column function, the column that needs to be telescopic must provide the value of width | boolean\|[Resizable](#Resizable) | false |
| rowExpandable | Whether the row can be expanded, turning off the rendering of the expandable button when the value is false               | (record: RecordType): => boolean | () => true | **0.27.0** |
| rowKey | The value of the table row key, which can be a string or a function.                                                      | string \| (record: RecordType) => string | 'key' |
| rowSelection | See [rowSelection](#rowSelection)                                                                                         | object | null |
| scroll | Whether the table is scrollable, configure the width or height of the scroll area, see [scroll](#scroll)                  | object | - |
| showHeader | Does it show the header?                                                                                                  | boolean | true |
| size | Table size, will effect the `padding` of the rows                                                                         | "default"\|"middle"\|"small" | "default" | **1.0.0** |
| sticky | fixed header                                                                                                              | boolean \| { top: number } | false | **2.21.0** |
| title | Table Title                                                                                                               | string<br/>\|ReactNode<br/>\|(pageData: RecordType[]) => string\|ReactNode |  |
| virtualized | Virtualization settings                                                                                                   | Virtualized | false | **0.33.0** |
| virtualized.itemSize | Row height                                                                                                                | number\|(index: number) => number | 56 | **0.33.0** |
| virtualized.onScroll | Virtualization scroll callback method                                                                                     | ( scrollDirection?: 'forward' \| 'backward', scrollOffset?: number, scrollUpdateWasRequested?: boolean ) => void |  | **0.33.0** |
| onChange | Trigger when paging, sorting, filtering changes. extra.changeType is supported in v2.72                                                                           | ({ pagination: TablePaginationProps, <br/>filters: Array<\*>, sorter: object, extra: { changeType: 'sorter' \| 'filter' \| 'pagination' } }) => void |  |
| onExpand | Trigger when clicking on the row expansion icon                                                                           | (expanded: boolean, record: RecordType, DOMEvent: MouseEvent) => void |  | The third parameter DOMEvent requires version **>=0.28.0** |
| onExpandedRowsChange | Triggers when unfolding row changes                                                                                       | (rows: RecordType[]) => void |  |
| onGroupedRow | Similar to onRow, but this parameter is used to define the row attribute of the grouping header alone                     | (record: RecordType, index: number) => object |  | **0.29.0** |
| onHeaderRow | Set the header row property, and the returned object is merged to the header line                                         | (columns: Column[], index: number) => object |  |
| onRow | Set the row property, and the returned object is merged to the table row                                                  | (record: RecordType, index: number) => object |  |

Some of the type definitions used above:

```typescript
// PaginationProps is the props supported by the Pagination component
interface TablePaginationProps extends PaginationProps {
    position?: PaginationPosition;
    formatPageText?: FormatPageText;
}

type VirtualizedItemSizeFn = (index?: number) => number;
type VirtualizedOnScrollArgs = {
    scrollDirection?: 'forward' | 'backward';
    scrollOffset?: number;
    scrollUpdateWasRequested?: boolean;
};
type VirtualizedOnScroll = (object: VirtualizedOnScrollArgs) => void;

type Virtualized =
    | boolean
    | {
          itemSize?: number | VirtualizedItemSizeFn;
          onScroll?: VirtualizedOnScroll;
      };
```

RecordType is a generic parameter of Table and Column, and the default is object type. You can use RecordType like this:

```typescript
import { ColumnProps } from 'table/interface';

interface Record {
    title?: string;
    dataIndex?: string;
    width?: number;
    render?: Function;
    key?: string;
    name?: string;
    age?: number;
    address?: string;
}

const columns: ColumnProps<Record>[] = [
    {
        title: 'Name',
        dataIndex: 'name',
        width: 200,
    },
    // ...
];

const data: Record[] = [
    {
        key: '1',
        name: 'John Brown',
        age: 32,
        address: 'New York No. 1 Lake Park, New York No. 1 Lake Park',
    },
    // ...
];

function App() {
    return <Table<Record> columns={columns} dataSource={data} />;
}
```

## onRow/onHeaderRow Usage

> Also in `column.onCell` `column.onHeaderCell` Properties or events supported by td / th can also be returned.

```jsx noInline=true
import React from 'react';
import { Table } from '@douyinfe/semi-ui';

() => (
    <Table
        onRow={(record, index) => {
            return {
                onClick: event => {},
                onMouseEnter: event => {},
                onMouseLeave: event => {},
                className: '',
                // ...
                // Other attributes or events that can be applied to tr
            };
        }}
        onHeaderRow={(columns, index) => {
            return {
                onClick: event => {},
                onMouseEnter: event => {},
                onMouseLeave: event => {},
                className: '',
                // ...
                // Other attributes or events that can be applied to th
            };
        }}
    />
);
```

## Column

| Parameters | Instructions | Type | Default | Version |
| --- | --- | --- | --- | --- |
| align | Setting the alignment of columns | 'left '\| 'right '\| 'center' | 'left' |
| children | Settings for sub-columns when the header is merged | Column[] |  |
| className | Column style name | string |  |
| colSpan | When header columns merge, set to 0, do not render | number |  |
| dataIndex | The key corresponding to the column data in the data item. It is required when using sorter or filter. | string |  |
| defaultFilteredValue | Default value of the filter, the filter state of the external control column with a value of the screened value array | any[] |  | **2.5.0** |
| defaultSortOrder | The default value of sortOrder, one of 'ascend'\|'descend'\|false | boolean\| string | false | **1.31.0** |
| direction | RTL, LTR direction, the default value is equal to ConfigProvider direction, you can configure the direction of the Table separately here | 'ltr' \| 'rtl' |  | **2.31.0** |
| ellipsis | Ellipsis Text, table-layout will automatically switch to fixed after it is turned on | boolean\| { showTitle: boolean } | false | **2.34.0** |
| filterChildrenRecord | Whether the child data needs to be filtered locally. If this function is enabled, if the child meets the filtering criteria, the parent will retain it even if it does not meet the criteria. | boolean |  | **0.29.0** |
| filterDropdown | You can customize the filter menu. This function is only responsible for rendering the layer and needs to write a variety of interactions. | ReactNode |  |
| filterDropdownProps | Props passing to Dropdown, see more in [Dropdown API](/en-US/show/dropdown#Dropdown) | object |  |
| filterDropdownVisible | Visible of Dropdown, see more in [Dropdown API](/en-US/show/dropdown#Dropdown) | boolean |  |
| filterIcon | Custom filter icon | boolean\|ReactNode\|(filtered: boolean) => ReactNode |  |
| filterMultiple | Whether to choose more | boolean | true |
| filteredValue | Controlled property of the filter, the filter state of the external control column with a value of the screened value array | any[] |  |
| filters | Filter menu items for the header | Filter[] |  |
| fixed | Whether the column is fixed, optional true (equivalent to left) 'left' 'right' | boolean\|string | false |
| key | The key required by React, if a unique dataIndex has been set, can ignore this property | string |  |
| render | A rendering function that generates complex data, the parameters are the value of the current row, the current row data, the row index, and the table row / column merge can be set in return object | (text: any, record: RecordType, index: number, { expandIcon?: ReactNode, selection?: ReactNode, indentText?: ReactNode }) => React\|object |  |
| renderFilterDropdown | Custom filter dropdown panel, for usage details, see [Custom Filter Rendering](#Custom-Filter-Rendering) | (props?: RenderFilterDropdownProps) => React.ReactNode; | - | **2.52.0** |
| renderFilterDropdownItem | Customize the rendering method of each filter item. For usage details, see [Custom Filter Item Rendering](#Custom-Filter-Item-Rendering) | ({ value: any, text: any, onChange: Function, level: number, ...otherProps }) => ReactNode | - | **1.1.0** |
| resize | Whether to enable resize mode, this property will take effect only after Table resizable is enabled | boolean |  | **2.42.0** |
| showSortTip | Whether to display sorting tips, If sortOrder is set and sorting is controlled, this parameter will not take effect | boolean | false | **2.65.0** |
| sortChildrenRecord | Whether to sort child data locally | boolean |  | **0.29.0** |
| sortOrder | The controlled property of the sorting, the sorting of this control column can be set to 'ascend'\|'descended '\|false | boolean | false |
| sorter | Sorting function, local sorting uses a function (refer to the compareFunction of Array.sort), requiring a server-side sorting can be set to true. **An independent dataIndex must be set for the sort column, and an independent key must be set for each data item in the dataSource** | boolean\|(r1: RecordType, r2: RecordType, sortOrder: 'ascend' \| 'descend') => number | true |
| sortIcon |Customize the sort icon. The returned node controls the entire sort button, including ascending and descending buttons. Need to control highlighting behavior based on sortOrder | (props: { sortOrder }) => ReactNode | | **2.50.0** |
| shouldCellUpdate | Self control whether cell should be updated | (props: TableCellProps, prevProps: TableCellProps) => boolean | | **2.71.0** |
| title | Column header displays text. When a function is passed in, title will use the return value of the function; when other types are passed in, they will be aggregated with sorter and filter. It needs to be used with useFullRender to obtain parameters such as filter in the function type | string \| ReactNode\|({ filter: ReactNode, sorter: ReactNode, selection: ReactNode }) => ReactNode. |  | Function type requires **0.34.0** |
| useFullRender | Whether to completely customize the rendering, see [Full Custom Rendering](#Fully-custom-rendering) for usage details, enabling this feature will cause a certain performance loss | boolean | false | **0.34.0** |
| width | Column width | string \| number |  |
| onCell | Set cell properties | (record: RecordType, rowIndex: number) => object |  |
| onFilter | Determine the running function of the filter in local mode. **An independent dataIndex must be set for the filter column, and an independent key must be set for each data item in the dataSource** | (filteredValue: any, record: RecordType) => boolean |  |
| onFilterDropdownVisibleChange | A callback when a custom filter menu is visible | (visible: boolean) => void |  |
| onHeaderCell | Set the head cell property | (column: RecordType, columnIndex: number) => object |  |

Some of the type definitions used above:

```typescript
// RecordType is a generic parameter of Table and Column, the default is object type

type Filter = {
    value: any;
    text: React.ReactNode;
    children?: Filter[];
};
```

## rowSelection

| Parameters | Instructions | Type | Default | Version |
| --- | --- | --- | --- | --- |
| className | Style name listed | string |  |
| disabled | Disabled `Checkbox` in `Table` header or not. | boolean | false | **0.32.0** |
| fixed | Secure the selection box column to the left. | boolean | false |
| getCheckboxProps | Default property configuration for the selection box | (record: RecordType) => object |  |  |
| hidden | Hide selection column or not | boolean | false | **0.34.0** |
| selectedRowKeys | Specifies the key array of the selected item, which needs to work with onChange | string [] |  |  |
| shouldCellUpdate | Self control whether cell should be updated | (props: TableCellProps, prevProps: TableCellProps) => boolean | | **2.71.0** |
| renderCell         | Custom rendering checkbox                                                                                 | ({ selected: boolean, record: RecordType, originNode: JSX.Element, inHeader: boolean, disabled: boolean, indeterminate: boolean, index?: number, selectRow?: (selected: boolean, e: Event) => void, selectAll?: (selected: boolean, e: Event) => void }) => ReactNode |        |      **2.52.0**      |
| width | Custom list selection box width | string | number |  |
| onChange | A callback in the event of a change in the selected item. The first parameter will save the row keys selected last time, even if you do paging control or update the dataSource [FAQ](#faq) | (selectedRowKeys: number[]\|string[], selectedRows: RecordType[]) => void |  |  |
| onHeaderCell | Set the head cell property | (column: RecordType, columnIndex: number) => object |  |
| onSelect | Callback when the user manually clicks the selection box of a row | (record: RecordType, selected: boolean, selectedRows: RecordType[], nativeEvent: MouseEvent) => void |  |  |
| onSelectAll | The user manually clicks the callback of the header selection box, and all optional rows in the dataSource will be selected/unselected | (selected: boolean, selectedRows: RecordType[], changedRows: RecordType[]) => void |  |  |

## scroll

| Parameters               | Instructions                                                                                         | Type           | Default | Version |
|--------------------------|------------------------------------------------------------------------------------------------------|----------------|---------|---------|
| scrollToFirstRowOnChange | Whether to automatically scroll to the top of the table after paging, sorting, and filtering changes | boolean        | false   | 1.1.0   |
| x                        | Set the width of the horizontal scroll area, which can be pixel value, percentage, or 'max-content'  | string\|number |         |         |
| y                        | Set the height of the vertical scroll area, which can be a pixel value                               | number         |         |         |

## pagination

Page-turning component configuration. Pagination suggests not to use literal value.

Note: After pagination.onChange is set, Table onChange no longer responds to pagination changes.

| Parameters         | Instructions                                                                                                                                                                                                                                                | Type                                                                                         | Default | Version     |
|--------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------|---------|-------------|
| currentPage        | Current page number                                                                                                                                                                                                                                         | number                                                                                       | -       |             |
| defaultCurrentPage | Default current page number                                                                                                                                                                                                                                 | number                                                                                       | 1       | **>=1.1.0** |
| formatPageText     | Page-turning area copywriting custom formatting, pass false to close copywriting display; This item affects the copy display on the left of the page turning area of the form. It is different from the `showTotal` parameter of the`Pagination` component. | boolean\| ({ currentStart: number, currentEnd: number, total: number }) => string\|ReactNode | true    | **0.27.0**  |
| pageSize           | Number of entries per page                                                                                                                                                                                                                                  | number                                                                                       | 10      |             |
| position | Location | 'bottom '\|'top '\|'both' | 'bottom' |
| total | Total number of entries | number | 0 | **>=0.25.0** |

For other configurations, see [Pagination](/en-US/navigation/pagination#API-Reference)

## Resizable

The parameters of the resizable object type, which mainly include event methods when the table column is scaled. These event methods can return an object that merges with the final column.

| Parameters    | Instructions                                               | Type                                             | Default |
|---------------|------------------------------------------------------------|--------------------------------------------------|---------|
| onResize      | Triggers when the table column changes its width           | (column: [Column](#Column)) => [Column](#Column) |         |
| onResizeStart | Triggers when the table column starts to change the width. | (column: [Column](#Column)) => [Column](#Column) |         |
| onResizeStop  | Triggers when the table column stops changing the width    | (column: [Column](#Column)) => [Column](#Column) |         |

## Methods

Some internal methods provided by Table can be accessed through ref:

```jsx noInline=true
import React, { useRef, useEffect } from 'react';
import { Table } from '@douyinfe/semi-ui';

function Demo() {
    const ref = useRef();

    useEffect(() => {
        ref.getCurrentPageData(); // => { dataSource: [/*...*/], groups: /*...*/ }
    }, []);

    return (
        <Table
            columns={
                [
                    /*...*/
                ]
            }
            dataSource={
                [
                    /*...*/
                ]
            }
            ref={ref}
        />
    );
}
```

| Parameters           | Instructions                                                                                                                         | Version |
|----------------------|--------------------------------------------------------------------------------------------------------------------------------------|---------|
| getCurrentPageData() | Returns the data object of the current page: { dataSource: RecordType[], groups: Map<{groupKey: string, recordKeys: Set<string\>}> } | 0.37.0  |

## Accessibility

### ARIA

-   The role of the table is grid, and the role of the tree table is treegrid
-   the row's role is row, and the cell's role is gridcell
-   Added aria-rowcount and aria-colcount attributes to the table to indicate the number of rows and columns
-   The row has added aria-rowindex to indicate which row it currently belongs to, and the first row is 1
-   The row of the tree table has aria-level representing the tree level of the current row, the first level is 1
-   Expandable table rows have the aria-expanded attribute, indicating whether the current row is expanded
-   The new aria-colindex of the cell indicates which column the current grid belongs to, and the first column is 1
-   Added aria-label to column filter and sort buttons, and added aria-label attribute to row select buttons

## RTL/LTR

- RTL default value of Table is controlled by [ConfigProvider](/zh-CN/other/configprovider)
- The align and fixed properties of the Table column will be automatically switched in RTL, left <-> right. The RTL function of fixed columns is supported in v2.31
- Table tree data does not support RTL ([Chrome and Safari browsers behave differently from Firefox](https://codesandbox.io/s/table-rtl-treedata-uy7gzl?file=/src/App.jsx ))

## Content Guidelines

-   Table title
    -   The title of the table should clearly make the user perceive the purpose of the table;
    -   Add descriptions to complex tables to provide users with more contextual information about the table;
    -   use sentence case;
-   Column headers
    -   Keep column headings concise, it is recommended to use 1-2 words as column headings;
    -   When the column header is long, it is recommended to display it in 2 lines, and the remaining text is abbreviated and displayed completely in the Tooltip;
    -   Adopt the capitalization rules of Sentence case;
    -   Use sentence case for column headings;
-   Table operation area
    -   You can follow [Button's content Guidelines](/en-US/input/button)

## Design Tokens

<DesignToken/>

## FAQ

- **Clicking the row selection button on the second page will jump to the first page? **

     After the Table's dataSource is updated, the page number will be reset to the initial state. Please check if the data source changed when the component was rendered.

     ```typescript
     function App() {
         const [dataSource, setDataSource] = useState([]);

         useEffect(() => {
             // ✅ Correct
             const getData = () => {
                 // fetch data
                 const newData = fetch(/**/);
                 // set data
                 setDataSource(dataSource);
             };

             getData();
         }, []);

         // ❌ Error
         const data = [];

         return <Table dataSource={data} columns={[/*...*/]} />;
     }
     ```

-   **The number of filtered data is wrong?**

    Please check that your filter columns and data sources are configured correctly.

    The filter column needs to set an independent `dataIndex`, and the dataSource needs to set an independent `key`. Please refer to the `dataSource` API. Otherwise the filtering function will not work properly.

-   **Why is the table data not updated?**  
     At present, all parameters of the table component are shallow comparison. That is to say, if the parameter value type is an array or object, you need to manually change its reference to trigger the update. Similarly, if you don't want to trigger additional updates, try not to use literal values when passing parameters directly or define reference parameter values in the render process:

    ```text
    // ...render() {
        <Table dataSource={[/*...*/]} columns={[/*...*/]} />
    // }
    ```

    The above writing method will trigger the update of data in the table every time render (the current selected row will be cleared and the row key array will be expanded, etc.). In order to improve performance and avoid some exceptions, please define some reference type parameters outside the render method as far as possible (if hooks are used, please use useMemo or useState for storage).\*\*

-   **Why can't my form line be selected and expanded?**

    Please specify a rowKey or set a different "key" attribute for each item of the dataSource. **All rows related operations in the table need to be used.**

-   **How to implement custom sorting or pass parameters to the server for sorting when clicking the sort button?**

    The input parameters of the onChange method include pagination, filters, and sorter. Users can customize the sorting of the dataSource according to the sorter.

-   **How to add className to a row?**

    Use onRow or onHeaderRow.

-   **How to style the table cell?**

    It can be controlled by column.onHeaderCell and column.onCell.

-   **Why cache the previously selected keys for the first parameter of `rowSelection` `onChange`?**

    This is for the scenario where the selected row keys are lost when data is selected on the first page during paging, and then the data is selected on the second page. If you don't want to use the cached keys, you can filter it from the current dataSource or use the second parameter of `rowSelection` `onChange`.

-   **Does it support single row selection?**

    Table currently does not support single-row selection function, and users can implement single selection in a custom way. Please check the FAQ.

-   **How is Table implemented, I want to know more details?**

    Please click <a href="https://bytedance.feishu.cn/docs/doccnqLgNefWGMZHFz7j70GKqpY" target="_blank">Semi Table component design</a>

See more Table FAQ and demos, please click <a href="https://bytedance.feishu.cn/docs/doccnsYk1qUmsIDP1ihJ9zjG0Ch" target="_blank">Table FAQ</a>

<!-- ## Related Material
```material
196,110,104,113,226
``` -->
