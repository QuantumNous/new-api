import React, { ReactNode, useMemo } from 'react';
import { storiesOf } from '@storybook/react';
import { IllustrationConstruction } from '@douyinfe/semi-illustrations';

import { Fixed, ColumnProps, OnRow, OnHeaderRow, OnGroupedRow, RowKey } from '../interface';
import JSXColumnsNest from './JSXColumnsNest';
import DefaultSortOrder from './DefaultSortOrder';
import BetterScrollbar from './BetterScrollbar';
import Empty from '../../empty';
import Table from '../index';
import FixAllColumnsWithoutWidth from './FixAllColumnsWithoutWidth';
import WarnColumnWithoutDataIndex from './WarnColumnWithoutDataIndex';

const stories = storiesOf('Table', module);

interface MyData {
    title?: string;
    dataIndex?: string;
    width?: number;
    render?: Function;
    key?: string;
    name?: string;
    age?: number;
    address?: string;
}

const columns: ColumnProps<MyData>[] = [
    {
        title: 'Name',
        dataIndex: 'name',
        width: 200,
        render: (text: ReactNode) => <a>{text}</a>,
        onCell: (record: MyData, index) => {
            console.log(record.title, index);
            return {};
        },
    },
    {
        title: 'Age',
        width: 200,
        dataIndex: 'age',
    },
    {
        title: 'Address',
        dataIndex: 'address',
    },
];
const data: MyData[] = [
    {
        key: '1',
        name: 'John Brown',
        age: 32,
        address: 'New York No. 1 Lake Park, New York No. 1 Lake Park',
    },
    {
        key: '2',
        name: 'Jim Green',
        age: 42,
        address: 'London No. 1 Lake Park',
    },
    {
        key: '3',
        name: 'Joe Black',
        age: 32,
        address: 'Sidney No. 1 Lake Park',
    },
    {
        key: '4',
        name: 'Disabled User',
        age: 99,
        address: 'Sidney No. 1 Lake Park',
    },
];

stories.add('basic table', () => <Table bordered resizable columns={columns} dataSource={data} />);

stories.add(`jsx table`, () => (
    <Table dataSource={data} pagination={false}>
        <Table.Column
            title="Name"
            dataIndex="name"
            key="name"
            render={(text: string) => <a>{text}</a>}
            filters={[
                {
                    text: 'London',
                    value: 'London',
                },
                {
                    text: 'New York',
                    value: 'New York',
                },
            ]}
        />
        <Table.Column title="Age" dataIndex="age" key="age" />
        <Table.Column title="Address" dataIndex="address" key="address" />
    </Table>
));

stories.add(`jsx nested cloumn`, () => <JSXColumnsNest />);

stories.add(`header merge table`, () => {
    const data = useMemo(() => {
        const data = [];
        for (let i = 0; i < 100; i++) {
            let age = (i * 1000) % 149 ;
            let name = `Edward King ${i}`;
            data.push({
                key: '' + i,
                company: {
                    name: 'ByteDance',
                    address: 'No. 48, Zhichun Road',
                },
                name,
                age,
                address: `No ${i + 1}, Zhongguancun Street`,
                description: `My name is ${name}, I am ${age} years old, living in No ${i + 1}, Zhongguancun Street`,
            });
        }
        return data;
    }, []);

    const columns = useMemo(
        () => [
            {
                title: 'Base Information',
                fixed: 'left' as Fixed,
                children: [
                    {
                        title: 'Name',
                        dataIndex: 'name',
                        fixed: 'left' as Fixed,
                        width: 200,
                        filters: [
                            {
                                text: 'Code 45',
                                value: '45',
                            },
                            {
                                text: 'King 4',
                                value: 'King 4',
                            },
                        ],
                        onFilter: (value: any, record: any) => record.name.includes(value),
                    },
                    {
                        title: 'Age',
                        dataIndex: 'age',
                        fixed: 'left' as Fixed,
                        width: 100,
                        sorter: (a: any, b: any) => (a.age - b.age > 0 ? 1 : -1),
                    },
                ],
            },
            {
                title: 'Company Information',
                children: [
                    {
                        title: 'Company Name',
                        dataIndex: 'company.name',
                    },
                    {
                        title: 'Company Address',
                        dataIndex: 'company.address',
                    },
                ],
            },
            {
                title: 'Address',
                width: 250,
                dataIndex: 'address',
                fixed: 'right' as Fixed,
            },
        ],
        []
    );

    return (
        <Table
            rowSelection={{ fixed: true, getCheckboxProps: (record) => ({ disabled: record.name === 'semi' }) }}
            expandedRowRender={(record: any) => <article>{record.description}</article>}
            dataSource={data}
            scroll={{ x: '120%', y: 400 }}
            onChange={(...args: any) => console.log(args)}
            columns={columns}
        />
    );
});

stories.add('table generic', () => (
    <Table<MyData>
        columns={columns}
        dataSource={data}
        rowExpandable={record => {
            return record.age > 30 ? true : false;
        }}
        onHeaderRow={() => ({ onClick: () => {}})}
    />
));

stories.add('table column generic', () => <Table columns={columns} dataSource={data} />);
stories.add('defaultSortOrder', () => <DefaultSortOrder />);

stories.add('expandRowByClick', () => (
    <Table<MyData>
        expandRowByClick
        onExpand={(...args) => {
            console.log('click row', ...args);
        }}
        onExpandedRowsChange={rows => {
            console.log('rows change', rows);
        }}
        expandedRowRender={() => <div>Semi Design</div>}
        columns={columns}
        dataSource={data}
    />
));

stories.add('onCell/onHeaderCell', () => {
    const columns: ColumnProps<MyData>[] = [
        {
            title: 'Name',
            dataIndex: 'name',
            width: 200,
            render: (text: ReactNode) => <a>{text}</a>,
            onCell: (record: MyData, index: number) => {
                console.log(`current record name is ${record.title}; row key is ${index}`);
                return index % 2 === 0 ? ({
                    style: { background: 'red' },
                    onClick: () => console.log(`click ${index}`),
                    onMouseEnter: () => console.log(`mouse enter ${index}`),
                    align: 'right',
                }) : ({});
            },
        },
        {
            title: 'Age',
            width: 200,
            dataIndex: 'age',
            onHeaderCell: (record: MyData, index) => {
                console.log(`current record name is ${record.title}; row key is ${index}`);
                return ({
                    style: { background: 'blue' },
                    onClick: () => console.log(`click ${index}`),
                    onMouseLeave: () => console.log(`mouse leave ${index}`),
                    className: `test-header-cell-${index}`,
                });
            },
        },
        {
            title: 'Address',
            dataIndex: 'address',
        },
    ];
    return (
        <Table columns={columns} dataSource={data} />
    )
});

stories.add('onRow/onHeaderRow', () => {
    const onRow: OnRow<any> = (record, index) => {
        if (index % 2 === 0) {
            return ({
                style: {
                    background: 'var(--semi-color-fill-2)',
                },
                onClick: () => {
                    console.log(`click row ${index}`);
                }
            });
        }
    };
    const onHeaderRow: OnHeaderRow<any> = (record, index) => {
        return ({
            onClick: () => {
                console.log(`click header row ${index}`);
            },
            className: 'test-header-row',
        });
    };
    const columns: ColumnProps<MyData>[] = [
        {
            title: 'Name',
            dataIndex: 'name',
            width: 200,
            render: (text: ReactNode) => <a>{text}</a>,
        },
        {
            title: 'Age',
            width: 200,
            dataIndex: 'age',
        },
        {
            title: 'Address',
            dataIndex: 'address',
        },
    ];
    return (
        <Table columns={columns} dataSource={data} onRow={onRow} onHeaderRow={onHeaderRow} />
    )
});

stories.add('onGroupedRow', () => {
    interface DataItem {
        city: string;
        job: string;
        department: string;
    }
    const rowKey: RowKey<DataItem> = record => `${record.city && record.city.toLowerCase()}-${record.job && record.job.toLowerCase()}`;
    const data: DataItem[] = [
        { city: 'Beijing', job: 'FE', department: 'IES' },
        { city: 'Beijing', job: 'BE', department: 'IES' },
        { city: 'Shanghai', job: 'Android', department: 'IES' },
        { city: 'Tokyo', job: 'Android', department: 'IES' },
        { city: 'Shanghai', job: 'IOS', department: 'EE' },
        { city: 'LA', job: 'SE', department: 'EE' },
        { city: 'Beijing', job: 'Android', department: 'EE' },
        { city: 'Tokyo', job: 'IOS', department: 'EE' },
        { city: 'Tokyo', job: 'SE', department: 'DATA' },
        { city: 'Shanghai', job: 'BE', department: 'DATA' },
        { city: 'LA', job: 'Android', department: 'DATA' },
        { city: 'LA', job: 'IOS', department: 'DATA' },
    ];

    const columns: ColumnProps<DataItem>[] = [
        { dataIndex: 'city', title: 'City', width: 400, sorter: (a, b) => (a.city > b.city ? 1 : -1) },
        {
            dataIndex: 'job',
            title: 'Job',
            width: 200,
            filters: [
                { text: 'IOS', value: 'IOS' },
                { text: 'Android', value: 'Android' },
            ],
            onFilter: (value, record) => record.job && record.job.indexOf(value) === 0,
        },
        { dataIndex: 'department', title: 'Department' },
    ];

    return (
        <div style={{ padding: '20px 0px' }}>
            <Table<DataItem>
                dataSource={data}
                rowKey={rowKey}
                groupBy={'city'}
                columns={columns}
                renderGroupSection={groupKey => <strong>Jobs in {groupKey}:</strong>}
                onGroupedRow={(group, index) => {
                    return {
                        onClick: e => { console.log(`Grouped row clicked: `, group, index) },
                        style: { color: 'var(--semi-color-primary)' },
                    };
                }}
                clickGroupedRowToExpand
                scroll={{ y: 480 }}
            />
        </div>
    );
});

stories.add('empty', () => {
    const empty = 'this is a empty placeholder';
    const test = (
        <div>
            <Empty
                image={<IllustrationConstruction></IllustrationConstruction>}
                title={'功能建设中'}
                description="当前功能暂未开放，敬请期待。"
            />
        </div>
    );

    return (
        <Table columns={columns} dataSource={[]} empty={test} />
    );
});

stories.add('better scrollbar', () => <BetterScrollbar />);

stories.add('fix all columns without width', () => <FixAllColumnsWithoutWidth />);

stories.add('warn if column without dataIndex', () => <WarnColumnWithoutDataIndex />);