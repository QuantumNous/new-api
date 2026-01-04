import BaseTable from '../Table';
import Table from '../index';
import Column from '../Column';
import {Tag, Tooltip} from '../../index';
import {
    getColumns,
    getData,
    getGroupColumns,
    getGroupData,
    getJSXColumns,
    getNestColumns,
    getNestData,
    getRandomNumber,
    getTreeData,
    mount,
    sleep,
} from '../../_test_/utils';
import {BASE_CLASS_PREFIX} from '../../../semi-foundation/base/constants';
import {IconStar} from '@douyinfe/semi-icons';

/**
 * Table 需要测试的使用场景
 * ✅ JSX 写法
 * ✅ 行选择
 * ✅ 分页
 * ✅ 固定列
 * ✅ 排序
 * ✅ 筛选
 * ✅ 展开
 * ✅ 树形展示
 * ✅ 自定义行或单元格
 * ✅ 分组
 * ✅ 表头合并
 * ✅ 更新数据
 * ✅ 完全自定义渲染
 * ✅ 行列合并
 * ❌ 可伸缩列（不好测试）
 * ❌ 拖拽排序（不好测试）
 * ❌ 虚拟化
 */

const dataTotalSize = 46;
const data = getData(dataTotalSize);
const columns = getColumns();

function testAppearance(demo, params) {
    const {onRow, myCls, myClsIndex} = params; // check table wrapper

    expect(demo.find(`.${BASE_CLASS_PREFIX}-table-wrapper`).length).toBe(1); // check if has header

    expect(demo.find(`.${BASE_CLASS_PREFIX}-table-title`).length).toBe(1); // check if has footer

    expect(demo.find(`.${BASE_CLASS_PREFIX}-table-footer`).length).toBe(1); // check onRow

    expect(onRow.called).toBe(true);
    expect(
        demo
            .find(`.${BASE_CLASS_PREFIX}-table-tbody .${BASE_CLASS_PREFIX}-table-row`)
            .at(0)
            .hasClass(myCls)
    ).toBe(false);
    expect(
        demo.find(`.${BASE_CLASS_PREFIX}-table-tbody .${BASE_CLASS_PREFIX}-table-row`).reduce((prev, item, index) => {
            if (item.hasClass(myCls)) {
                return index;
            } else {
                return prev;
            }
        }, -1)
    ).toBe(myClsIndex); // check pagination

    expect(demo.find(`.${BASE_CLASS_PREFIX}-table-pagination-outer`).length).toBe(1); // click page 2

    const curPage = 2;
    demo.find(`.${BASE_CLASS_PREFIX}-page li`)
        .at(curPage)
        .simulate('click');
    expect(demo.find(BaseTable).state('pagination')).toHaveProperty('currentPage', curPage);
}

describe(`Table`, () => {
    it(`test jsx columns appearance`, async () => {
        const myCls = `my-tr-class`;
        const myClsIndex = 2;
        const onRow = sinon.spy((record, index) => ({
            className: index === myClsIndex ? myCls : '',
        }));
        const columns = getJSXColumns();
        const demo = mount(
            <Table
                dataSource={data}
                onRow={onRow}
                title={() => 'Table Title'}
                footer={() => 'Table Footer'}
                children={columns}
            />
        );
        testAppearance(demo, {
            onRow,
            myCls,
            myClsIndex,
        });
        const newColumns = getJSXColumns();
        demo.setProps({
            children: newColumns,
        });
        testAppearance(demo, {
            onRow,
            myCls,
            myClsIndex,
        });
        demo.unmount();
    });
    it(`test object columns appearance`, async () => {
        const myCls = `my-tr-class`;
        const myClsIndex = 2;
        const onRow = sinon.spy((record, index) => ({
            className: index === myClsIndex ? myCls : '',
        }));
        const columns = getColumns();
        const demo = mount(
            <Table
                dataSource={data}
                onRow={onRow}
                title={() => 'Table Title'}
                footer={() => 'Table Footer'}
                columns={columns}
            />
        );
        testAppearance(demo, {
            onRow,
            myCls,
            myClsIndex,
        });
        const newColumns = getColumns();
        demo.setProps({
            columns: newColumns,
        });
        testAppearance(demo, {
            onRow,
            myCls,
            myClsIndex,
        });
    });
    it(`test dataSource change appearance`, async () => {
        const myCls = `my-tr-class`;
        const myClsIndex = 2;
        const onRow = sinon.spy((record, index) => ({
            className: index === myClsIndex ? myCls : '',
        }));
        const columns = getColumns();
        const data = getData(25);
        const demo = mount(
            <Table
                dataSource={data}
                onRow={onRow}
                title={() => 'Table Title'}
                footer={() => 'Table Footer'}
                columns={columns}
            />
        );
        testAppearance(demo, {
            onRow,
            myCls,
            myClsIndex,
        });
        const dataNum = getRandomNumber(100, 40);
        const newData = getData(dataNum);
        demo.setProps({
            dataSource: newData,
        });
        testAppearance(demo, {
            onRow,
            myCls,
            myClsIndex,
        });
    });
    it(`test selection`, async () => {
        const columns = getColumns();
        const selectedRowKeys = ['0'];
        const rowKey = 'key';
        const disabledKeys = ['4'];
        let rowSelection = {
            onChange: sinon.spy((selectedRowKeys, selectedRows) => {
                rowSelection = {...rowSelection, selectedRowKeys: [...selectedRowKeys]};
                demo.setProps({
                    rowSelection,
                });
            }),
            onSelectAll: sinon.spy((selected, selectedRows, changedRows) => {
                rowSelection = {...rowSelection, selectedRowKeys: selected ? [...selectedRowKeys] : []};
                demo.setProps({
                    rowSelection,
                });
            }),
            getCheckboxProps: sinon.spy(record => ({
                disabled: disabledKeys.includes(record[rowKey]),
                // Column configuration not to be checked
                name: record.name,
            })),
            onSelect: sinon.spy((record, selected) => {
            }),
            selectedRowKeys: ['3'],
            defaultSelectedRowKeys: ['0', '1'],
        };
        const demo = mount(<Table rowKey={rowKey} dataSource={data} columns={columns} rowSelection={rowSelection}/>);
        expect(demo.find(`.${BASE_CLASS_PREFIX}-checkbox`).length).toBeGreaterThan(0);
        expect(demo.find(`.${BASE_CLASS_PREFIX}-table-row .${BASE_CLASS_PREFIX}-checkbox-inner-checked`).length).toBe(
            rowSelection.selectedRowKeys.length
        );
        expect(demo.find(`.${BASE_CLASS_PREFIX}-table-thead .${BASE_CLASS_PREFIX}-checkbox-indeterminate`).length).toBe(
            1
        );
        expect(
            demo
                .find(`.${BASE_CLASS_PREFIX}-table-tbody .${BASE_CLASS_PREFIX}-checkbox`)
                .map(el => el)
                .every((el, index) =>
                    disabledKeys.includes(index.toString())
                        ? el.hasClass(`${BASE_CLASS_PREFIX}-checkbox-disabled`)
                        : true
                )
        ).toBeTruthy(); // click disabled checkbox

        demo.find(`.${BASE_CLASS_PREFIX}-table-row .${BASE_CLASS_PREFIX}-checkbox-disabled`).simulate('click');
        expect(rowSelection.onSelect.notCalled).toBeTruthy(); // click first row checkbox

        demo.find(`.${BASE_CLASS_PREFIX}-table-tbody .${BASE_CLASS_PREFIX}-table-row .${BASE_CLASS_PREFIX}-checkbox`)
            .at(0)
            .simulate('click');
        expect(rowSelection.onSelect.calledOnce).toBeTruthy(); // click table header checkbox and select all

        demo.find(
            `.${BASE_CLASS_PREFIX}-table-thead .${BASE_CLASS_PREFIX}-table-column-selection .${BASE_CLASS_PREFIX}-checkbox`
        ).simulate('click');
        expect(rowSelection.onSelectAll.calledOnce).toBeTruthy();
        expect(demo.find(BaseTable).state('rowSelection')).toHaveProperty(
            'selectedRowKeys',
            rowSelection.selectedRowKeys
        );
        expect(demo.find(`.${BASE_CLASS_PREFIX}-table-thead .${BASE_CLASS_PREFIX}-checkbox-inner-checked`).length).toBe(
            1
        ); // click table header checkbox and deselect all

        demo.find(
            `.${BASE_CLASS_PREFIX}-table-thead .${BASE_CLASS_PREFIX}-table-column-selection .${BASE_CLASS_PREFIX}-checkbox`
        ).simulate('click');
        expect(rowSelection.onSelectAll.calledTwice).toBeTruthy();
        expect(demo.find(BaseTable).state('rowSelection')).toHaveProperty('selectedRowKeys', []);
        expect(demo.find(`.${BASE_CLASS_PREFIX}-table-thead .${BASE_CLASS_PREFIX}-checkbox-inner-checked`).length).toBe(
            0
        );
        expect(demo.find(`.${BASE_CLASS_PREFIX}-table-thead .${BASE_CLASS_PREFIX}-checkbox-indeterminate`).length).toBe(
            0
        );
    });
    it(`test selection after data change`, async () => {
        const columns = getColumns();
        const selectedRowKeys = ['0'];
        const rowKey = 'key';
        const disabledKeys = ['4'];
        let rowSelection = {
            onSelectAll: sinon.spy((selected, selectedRows, changedRows) => {
                rowSelection = {...rowSelection, selectedRowKeys: selected ? [...selectedRowKeys] : []};
                demo.setProps({
                    rowSelection,
                });
            }),
            getCheckboxProps: sinon.spy(record => ({
                disabled: disabledKeys.includes(record[rowKey]),
                // Column configuration not to be checked
                name: record.name,
            })),
            onSelect: sinon.spy((record, selected) => {
            }),
        };
        const demo = mount(<Table rowKey={rowKey} dataSource={data} columns={columns} rowSelection={rowSelection}/>);
        const newData = getData(50);
        demo.setProps({
            dataSource: newData,
        }); // click disabled checkbox

        demo.find(`.${BASE_CLASS_PREFIX}-table-row .${BASE_CLASS_PREFIX}-checkbox-disabled`).simulate('click');
        expect(rowSelection.onSelect.notCalled).toBeTruthy(); // click first row checkbox

        demo.find(`.${BASE_CLASS_PREFIX}-table-tbody .${BASE_CLASS_PREFIX}-table-row .${BASE_CLASS_PREFIX}-checkbox`)
            .at(0)
            .simulate('click');
        expect(rowSelection.onSelect.calledOnce).toBeTruthy(); // click table header checkbox and select all

        demo.find(
            `.${BASE_CLASS_PREFIX}-table-thead .${BASE_CLASS_PREFIX}-table-column-selection .${BASE_CLASS_PREFIX}-checkbox`
        ).simulate('click');
        expect(rowSelection.onSelectAll.calledOnce).toBeTruthy(); // click table header checkbox and deselect all

        demo.find(
            `.${BASE_CLASS_PREFIX}-table-thead .${BASE_CLASS_PREFIX}-table-column-selection .${BASE_CLASS_PREFIX}-checkbox`
        ).simulate('click');
        expect(rowSelection.onSelectAll.calledTwice).toBeTruthy();
    });
    it(`test expandedRowRender and fixed`, async () => {
        const columns = getColumns();
        const rowKey = 'key';

        const expandedRowRender = (record, index, expanded) => (
            <article
                style={{
                    margin: 0,
                }}
            >
                <p>{record.description}</p>
            </article>
        );

        const unexpandableKey = '2';
        const demo = mount(
            <Table
                scroll={{
                    x: '160%',
                    y: 320,
                }}
                defaultExpandAllRows
                rowKey={rowKey}
                expandedRowRender={expandedRowRender}
                hideExpandedColumn={false}
                expandCellFixed={true}
                dataSource={data}
                columns={columns}
                rowExpandable={record => record[rowKey] !== unexpandableKey}
            />
        );
        const leftFixedCells = demo.find(`.${BASE_CLASS_PREFIX}-table-cell-fixed-left`);
        const rightFixedCells = demo.find(`.${BASE_CLASS_PREFIX}-table-cell-fixed-right`);
        expect(leftFixedCells.length).toBeGreaterThan(0);
        expect(rightFixedCells.length).toBeGreaterThan(0);
        expect(
            demo.find(`.${BASE_CLASS_PREFIX}-table-cell-fixed-left.${BASE_CLASS_PREFIX}-table-column-expand`).length
        ).toBeGreaterThan(0);
        const newData = getData(50);
        demo.setProps({
            dataSource: newData,
        });
        expect(
            demo.find(`.${BASE_CLASS_PREFIX}-table-cell-fixed-left.${BASE_CLASS_PREFIX}-table-column-expand`).length
        ).toBeGreaterThan(0);
    });
    it(`test tree data`, async () => {
        const rowKey = 'key';
        const childrenRecordName = 'children';
        const childrenData = getTreeData();
        let expandedRowKeys = [1];
        const onExpand = sinon.spy((expanded, record) => {
            const keySet = new Set([...expandedRowKeys]);

            if (expanded) {
                keySet.add(record[rowKey]);
            } else {
                keySet.delete(record[rowKey]);
            }

            expandedRowKeys = Array.from(keySet);
            demo.setProps({
                expandedRowKeys,
            });
        });
        const demo = mount(
            <Table
                rowKey={rowKey}
                childrenRecordName={childrenRecordName}
                expandedRowKeys={expandedRowKeys}
                columns={columns}
                dataSource={childrenData}
                onExpand={onExpand}
            />
        );
        const table = demo.find(BaseTable);
        expect(demo.find(`.${BASE_CLASS_PREFIX}-table-tbody .${BASE_CLASS_PREFIX}-table-row`).length).toBe(
            childrenData[0].children.length + childrenData.length
        ); // click 3rd row to expand row

        table
            .find(
                `.${BASE_CLASS_PREFIX}-table-body .${BASE_CLASS_PREFIX}-table-row .${BASE_CLASS_PREFIX}-table-expand-icon`
            )
            .at(1)
            .simulate('click');
        expect(onExpand.calledOnce).toBeTruthy();
        expect(table.state(`expandedRowKeys`)).toEqual(expandedRowKeys); // click first expand button to collapse row

        table
            .find(
                `.${BASE_CLASS_PREFIX}-table-body .${BASE_CLASS_PREFIX}-table-row .${BASE_CLASS_PREFIX}-table-expand-icon`
            )
            .at(0)
            .simulate('click');
        expect(table.state('expandedRowKeys')).toEqual(expandedRowKeys);
    });
    it(`test grouped data`, async () => {
        const rowKey = record =>
            `${record.city && record.city.toLowerCase()}-${record.job && record.job.toLowerCase()}`;

        const data = [
            {
                city: 'Beijing',
                job: 'FE',
                department: 'IES',
            },
            {
                city: 'Beijing',
                job: 'BE',
                department: 'IES',
            },
            {
                city: 'Shanghai',
                job: 'Android',
                department: 'IES',
            },
            {
                city: 'Tokyo',
                job: 'Android',
                department: 'IES',
            },
            {
                city: 'Shanghai',
                job: 'IOS',
                department: 'EE',
            },
            {
                city: 'LA',
                job: 'SE',
                department: 'EE',
            },
            {
                city: 'Beijing',
                job: 'Android',
                department: 'EE',
            },
            {
                city: 'Tokyo',
                job: 'IOS',
                department: 'EE',
            },
            {
                city: 'Tokyo',
                job: 'SE',
                department: 'DATA',
            },
            {
                city: 'Shanghai',
                job: 'BE',
                department: 'DATA',
            },
            {
                city: 'LA',
                job: 'Android',
                department: 'DATA',
            },
            {
                city: 'LA',
                job: 'IOS',
                department: 'DATA',
            },
        ];
        const columns = [
            {
                dataIndex: 'city',
                title: 'City',
                width: 400,
                sorter: (a, b) => (a.city > b.city ? 1 : -1),
            },
            {
                dataIndex: 'job',
                title: 'Job',
                width: 200,
                filters: [
                    {
                        text: 'IOS',
                        value: 'IOS',
                    },
                    {
                        text: 'Android',
                        value: 'Android',
                    },
                ],
                onFilter: (value, record) => record.job && record.job.indexOf(value) === 0,
            },
            {
                dataIndex: 'department',
                title: 'Department',
            },
        ];
        const groupedRowClick = sinon.spy();
        const demo = mount(
            <Table
                dataSource={data}
                rowKey={rowKey}
                groupBy={'city'}
                columns={columns}
                renderGroupSection={groupKey => <strong>Jobs in {groupKey}:</strong>}
                onGroupedRow={(group, index) => ({
                    onClick: groupedRowClick,
                })}
                clickGroupedRowToExpand
                scroll={{
                    y: 480,
                }}
            />
        );
        expect(demo.find(`.${BASE_CLASS_PREFIX}-table-row-section`).length).toBe(4);
        expect(demo.find(`.${BASE_CLASS_PREFIX}-table-body .${BASE_CLASS_PREFIX}-table-row`).length).toBe(0);
        demo.find(`.${BASE_CLASS_PREFIX}-table-row-section`)
            .at(0)
            .simulate('click');
        expect(demo.find(`.${BASE_CLASS_PREFIX}-table-row`).length).toBeGreaterThan(0);
    });
    it(`test events: page, filter, sort`, async () => {
        const columns = [
            {
                title: 'Name',
                dataIndex: 'name',
                width: 150,
                filters: [
                    {
                        text: '名字包含"1"',
                        value: '1',
                    },
                    {
                        text: '名字包含"2"',
                        value: '2',
                    },
                ],
                onFilter: (value, record) => record.name.indexOf(value) > -1,
            },
            {
                title: 'Age',
                dataIndex: 'age',
                width: 150,
                sorter: (a, b) => (a.age - b.age > 0 ? 1 : -1),
            },
            {
                title: 'Address',
                dataIndex: 'address',
            },
            {
                render: (text, record) => (
                    <Tooltip content={record.description}>
                        <Tag color="green">Show Info</Tag>
                    </Tooltip>
                ),
                width: 150,
            },
        ];
        let onChangeCalledCount = 0;
        const onChange = sinon.spy();
        const demo = mount(<Table dataSource={data} columns={columns} onChange={onChange}/>);
        demo.find(`.${BASE_CLASS_PREFIX}-table-thead .${BASE_CLASS_PREFIX}-table-column-filter`).simulate('click');
        expect(demo.find(`.${BASE_CLASS_PREFIX}-dropdown`).length).toBe(1);
        expect(onChange.callCount).toBe(onChangeCalledCount); // click first filter

        demo.find(`.${BASE_CLASS_PREFIX}-dropdown .${BASE_CLASS_PREFIX}-dropdown-item`)
            .at(0)
            .find(`.${BASE_CLASS_PREFIX}-checkbox`)
            .simulate('click', {
                nativeEvent: null,
            });
        expect(onChange.callCount).toBe(++onChangeCalledCount); // click first filter again

        demo.find(`.${BASE_CLASS_PREFIX}-dropdown .${BASE_CLASS_PREFIX}-dropdown-item`)
            .at(0)
            .find(`.${BASE_CLASS_PREFIX}-checkbox`)
            .simulate('click', {
                nativeEvent: null,
            });
        expect(onChange.callCount).toBe(++onChangeCalledCount); // to page 2

        demo.find(`.${BASE_CLASS_PREFIX}-page .${BASE_CLASS_PREFIX}-page-item`)
            .at(2)
            .simulate('click', {
                nativeEvent: null,
            });
        expect(onChange.callCount).toBe(++onChangeCalledCount); // to page 1

        demo.find(`.${BASE_CLASS_PREFIX}-page .${BASE_CLASS_PREFIX}-page-item`)
            .at(1)
            .simulate('click', {
                nativeEvent: null,
            });
        expect(onChange.callCount).toBe(++onChangeCalledCount); // sort

        demo.find(`.${BASE_CLASS_PREFIX}-table-thead .${BASE_CLASS_PREFIX}-table-column-sorter`).simulate('click', {
            nativeEvent: null,
        });
        expect(onChange.callCount).toBe(++onChangeCalledCount);
    });
    it(`test filter, and update dataSource with exist filter`, () => {
        const columns = [
            {
                className: 'name-col',
                title: 'Name',
                dataIndex: 'name',
                width: 150,
                filters: [
                    {
                        text: '名字包含"1"',
                        value: '1',
                    },
                    {
                        text: '名字包含"2"',
                        value: '2',
                    },
                ],
                onFilter: (value, record) => record.name.indexOf(value) > -1,
            },
            {
                title: 'Age',
                dataIndex: 'age',
                width: 150,
                sorter: (a, b) => (a.age - b.age > 0 ? 1 : -1),
            },
            {
                title: 'Address',
                dataIndex: 'address',
            },
        ];
        const demo = mount(<Table dataSource={data} columns={columns} pagination={false}/>);
        demo.find(`.${BASE_CLASS_PREFIX}-table-thead .${BASE_CLASS_PREFIX}-table-column-filter`).simulate('click'); // click first filter

        demo.find(`.${BASE_CLASS_PREFIX}-dropdown .${BASE_CLASS_PREFIX}-dropdown-item`)
            .at(0)
            .find(`.${BASE_CLASS_PREFIX}-checkbox`)
            .simulate('click', {
                nativeEvent: null,
            });
        const nameColList = demo.find('.semi-table-tbody .name-col');
        const filteredData = data.filter(item => item.name.indexOf('1') > -1);
        expect(nameColList.length).toBe(filteredData.length); // update dataSource with exist filter

        const newData = getData(10);
        const newFilteredData = newData.filter(item => item.name.indexOf('1') > -1);
        demo.setProps({
            dataSource: newData,
        });
        demo.update();
        const newNameColList = demo.find('.semi-table-tbody .name-col');
        expect(newNameColList.length).toBe(newFilteredData.length);
    });
    it(`test controlled dataSource and columns`, async () => {
        let pagination = {
            currentPage: 1,
            total: data.length,
            pageSize: 10,
        };

        const getPageData = () =>
            data.slice(
                (pagination.currentPage - 1) * pagination.pageSize,
                pagination.currentPage * pagination.pageSize
            );

        let currentData = getPageData();
        let columns = [
            {
                title: 'Name',
                dataIndex: 'name',
                width: 150,
                filters: [
                    {
                        text: '名字包含"1"',
                        value: '1',
                    },
                    {
                        text: '名字包含"2"',
                        value: '2',
                    },
                ],
                onFilter: (value, record) => record.name.indexOf(value) > -1,
            },
            {
                title: 'Age',
                dataIndex: 'age',
                width: 150,
                sorter: true,
            },
            {
                title: 'Address',
                dataIndex: 'address',
            },
            {
                render: (text, record) => (
                    <Tooltip content={record.description}>
                        <Tag color="green">Show Info</Tag>
                    </Tooltip>
                ),
                width: 150,
            },
        ];
        const onChange = sinon.spy(({pagination: tablePagination, filters: tableFilters, sorters: tableSorters}) => {
            if (tablePagination && tablePagination.currentPage !== pagination.currentPage) {
                pagination.currentPage = tablePagination.currentPage;
                currentData = getPageData();
                columns = [...columns];
                demo.setProps({
                    dataSource: currentData,
                    columns,
                    pagination,
                });
            }
        });
        const demo = mount(
            <Table onChange={onChange} dataSource={currentData} pagination={pagination} columns={columns}/>
        );
        const table = demo.find(BaseTable);
        demo.find(`.${BASE_CLASS_PREFIX}-page .${BASE_CLASS_PREFIX}-page-item`)
            .at(2)
            .simulate('click', {
                nativeEvent: null,
            });
        expect(onChange.called).toBe(true);
        expect(
            demo
                .find(`.${BASE_CLASS_PREFIX}-page .${BASE_CLASS_PREFIX}-page-item`)
                .at(2)
                .hasClass(`${BASE_CLASS_PREFIX}-page-item-active`)
        ).toBe(true);
    });
    it(`test resizable table`, async () => {
        let columns = [
            {
                title: 'Name',
                dataIndex: 'name',
                width: 150,
                filters: [
                    {
                        text: '名字包含"1"',
                        value: '1',
                    },
                    {
                        text: '名字包含"2"',
                        value: '2',
                    },
                ],
                onFilter: (value, record) => record.name.indexOf(value) > -1,
            },
            {
                title: 'Age',
                dataIndex: 'age',
                width: 150,
                sorter: true,
            },
            {
                title: 'Address',
                dataIndex: 'address',
                width: 300,
            },
            {
                render: (text, record) => (
                    <Tooltip content={record.description}>
                        <Tag color="green">Show Info</Tag>
                    </Tooltip>
                ),
            },
        ];

        const expandedRowRender = (record, index, expanded) => (
            <article
                style={{
                    margin: 0,
                }}
            >
                <p>{record.description}</p>
            </article>
        );

        const demo = mount(
            <Table columns={columns} dataSource={data} resizable expandedRowRender={expandedRowRender}/>
        );
        expect(demo.find(`.${BASE_CLASS_PREFIX}-table-thead .react-resizable-handle`).length).toBe(
            columns.reduce((count, col) => (typeof col.width === 'number' ? count + 1 : count), 0)
        );
    });
    it('test table sortOrder descend', async () => {
        const sortColumns = [
            {
                title: 'Name',
                dataIndex: 'name',
                sorter: (a, b) => a.name.length - b.name.length,
                sortOrder: 'descend',
            },
            {
                title: 'Age',
                dataIndex: 'age',
            },
            {
                title: 'Address',
                dataIndex: 'address',
            },
        ];
        const sortData = [
            {
                key: '1',
                name: 'John Brown',
                age: 32,
                address: 'New York No. 1 Lake Park',
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
                name: 'Jim Red',
                age: 32,
                address: 'London No. 2 Lake Park',
            },
        ];
        const targetData = sortData.reduce((a, b) => (a.name.length > b.name.length ? a : b));
        const {name} = targetData;
        const sortTable = mount(<Table columns={sortColumns} dataSource={sortData}/>);
        const firstCell = sortTable.find('.semi-table-tbody .semi-table-row .semi-table-row-cell').at(0); // console.log(sortTable.debug({ ignoreProps: true }));

        expect(firstCell.text()).toBe(name);
    });
    it('test table sortOrder ascend', async () => {
        const sortColumns = [
            {
                title: 'Name',
                dataIndex: 'name',
                sorter: (a, b) => a.name.length - b.name.length,
                sortOrder: 'ascend',
            },
            {
                title: 'Age',
                dataIndex: 'age',
            },
            {
                title: 'Address',
                dataIndex: 'address',
            },
        ];
        const sortData = [
            {
                key: '1',
                name: 'John Brown',
                age: 32,
                address: 'New York No. 1 Lake Park',
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
                name: 'Jim Red',
                age: 32,
                address: 'London No. 2 Lake Park',
            },
        ];
        const targetData = sortData.reduce((a, b) => (a.name.length < b.name.length ? a : b));
        const {name} = targetData;
        const sortTable = mount(<Table columns={sortColumns} dataSource={sortData}/>);
        const firstCell = sortTable.find('.semi-table-tbody .semi-table-row .semi-table-row-cell').at(0);
        expect(firstCell.text()).toBe(name);
    });
    it('test controlled sortOrder', async () => {
        const sortColumns = [
            {
                title: 'Name',
                dataIndex: 'name',
                sorter: (a, b) => a.name.length - b.name.length,
                sortOrder: 'descend',
            },
            {
                title: 'Age',
                dataIndex: 'age',
            },
            {
                title: 'Address',
                dataIndex: 'address',
            },
        ];
        const sortData = [
            {
                key: '1',
                name: 'long name',
                age: 32,
                address: 'New York No. 1 Lake Park',
            },
            {
                key: '2',
                name: 'longest name',
                age: 42,
                address: 'London No. 1 Lake Park',
            },
            {
                key: '3',
                name: 'longer name',
                age: 32,
                address: 'Sidney No. 1 Lake Park',
            },
            {
                key: '4',
                name: 'short',
                age: 32,
                address: 'London No. 2 Lake Park',
            },
        ];
        const targetData = sortData.reduce((a, b) => (a.name.length > b.name.length ? a : b));
        const {name} = targetData;
        const sortTable = mount(<Table columns={sortColumns} dataSource={sortData}/>);
        const firstCell = sortTable.find('.semi-table-tbody .semi-table-row .semi-table-row-cell').at(0);
        expect(firstCell.text()).toBe(name);
        const ascendOrderColumns = [
            {
                title: 'Name',
                dataIndex: 'name',
                sorter: (a, b) => a.name.length - b.name.length,
                sortOrder: 'ascend',
            },
            {
                title: 'Age',
                dataIndex: 'age',
            },
            {
                title: 'Address',
                dataIndex: 'address',
            },
        ]; // test sortOrder: ascend

        sortTable.setProps({
            columns: ascendOrderColumns,
        });
        sortTable.update();
        const ascendTargetData = sortData.reduce((a, b) => (a.name.length < b.name.length ? a : b));
        const {name: ascendTargetName} = ascendTargetData;
        const ascendFirstCell = sortTable.find('.semi-table-tbody .semi-table-row .semi-table-row-cell').at(0);
        expect(ascendFirstCell.text()).toBe(ascendTargetName); // test sortOrder: false, expect order as given data

        const defaultOrderColumns = [
            {
                title: 'Name',
                dataIndex: 'name',
                sorter: (a, b) => a.name.length - b.name.length,
                sortOrder: false,
            },
            {
                title: 'Age',
                dataIndex: 'age',
            },
            {
                title: 'Address',
                dataIndex: 'address',
            },
        ];
        sortTable.setProps({
            columns: defaultOrderColumns,
        });
        sortTable.update();
        const defaultTargetData = sortData[0];
        const {name: defaultTargetName} = defaultTargetData;
        const defaultFirstCell = sortTable.find('.semi-table-tbody .semi-table-row .semi-table-row-cell').at(0);
        expect(defaultFirstCell.text()).toBe(defaultTargetName);
    });
    it('test table select all when disabled all rows', async () => {
        const columns = [
            {
                title: 'Name',
                dataIndex: 'name',
                width: 150,
            },
            {
                title: 'Age',
                dataIndex: 'age',
                width: 150,
            },
            {
                title: 'Address',
                dataIndex: 'address',
            },
        ];
        const rowSelection = {
            onSelectAll: sinon.spy(() => {
            }),
            getCheckboxProps: sinon.spy(record => ({
                disabled: true,
                // disabled all
                name: record.name,
            })),
        };
        const demo = mount(<Table columns={columns} dataSource={data} rowSelection={rowSelection}/>);
        demo.find(
            `.${BASE_CLASS_PREFIX}-table-thead .${BASE_CLASS_PREFIX}-table-column-selection .${BASE_CLASS_PREFIX}-checkbox`
        ).simulate('click'); // should select 0 rows

        expect(rowSelection.onSelectAll.getCall(0).args[1].length).toBe(0);
    });
    it('test jsx async data', async () => {
        const asyncData = [
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
                name: 'Michael James',
                age: 99,
                address: 'Sidney No. 1 Lake Park',
            },
        ];
        const demo = mount(
            <Table dataSource={[]}>
                <Column title="Name" dataIndex="name" key="name" render={(text, record, index) => <a>{text}</a>}/>
                <Column title="Age" dataIndex="age" key="age"/>
                <Column title="Address" dataIndex="address" key="address"/>
            </Table>
        );
        setTimeout(() => {
            demo.setProps({
                dataSource: asyncData,
            });
        }, 2000);
        await sleep(3000);
        const baseTable = demo.find(BaseTable);
        expect(baseTable.state('cachedColumns').length).toEqual(3);
        expect(baseTable.state('dataSource').length).toEqual(4);
    });
    it('test cell align', async () => {
        const columns = getColumns();
        const alignRightColumns = columns.map(column => {
            column.align = 'right';
            return column;
        });
        const demo = mount(<Table dataSource={data} columns={alignRightColumns}/>);
        const titleAlignCells = demo.find(`.${BASE_CLASS_PREFIX}-table-align-right`);
        expect(titleAlignCells.length).toBeGreaterThan(0);
        const bodyAlignCells = document.querySelectorAll(`.${BASE_CLASS_PREFIX}-table-row-cell`);
        bodyAlignCells.forEach(cell => {
            expect(cell.style.textAlign).toEqual('right');
        });
    });
    it('test column className', async () => {
        const columns = getColumns();
        const alignRightColumns = columns.map(column => {
            column.className = 'test';
            return column;
        });
        const demo = mount(<Table dataSource={data} columns={alignRightColumns}/>);
        const titleAlignCells = demo.find(`.${BASE_CLASS_PREFIX}-table-row-head`);
        const bodyAlignCells = demo.find(`.${BASE_CLASS_PREFIX}-table-row-cell`);
        titleAlignCells.forEach(cell => {
            expect(cell.hasClass('test')).toBeTruthy();
        });
        bodyAlignCells.forEach(cell => {
            expect(cell.hasClass('test')).toBeTruthy();
        });
    });
    it('test header appearance', async () => {
        // object column
        const columns = getColumns();
        const demo = mount(
            <Table
                dataSource={data}
                columns={columns}
                scroll={{
                    y: 500,
                }}
            />
        );
        expect(demo.find('.semi-table-thead').length).toEqual(1);
        demo.setProps({
            showHeader: false,
        });

        const jsxColumns = getJSXColumns();
        const demo1 = mount(<Table dataSource={data}>{jsxColumns}</Table>);
        expect(demo1.find('.semi-table-thead').length).toEqual(1);
        demo1.setProps({
            showHeader: false,
        });
        expect(demo1.find('.semi-table-thead').length).toEqual(0);
    });
    it('test ref getCurrentPageData', async () => {
        // object column
        const pageSize = 10;
        const refObj = {
            current: null,
        };
        const columns = getColumns();
        const demo = mount(
            <Table
                dataSource={data}
                ref={refObj}
                columns={columns}
                pagination={{
                    pageSize,
                }}
            />
        );
        const {dataSource} = refObj.current.getCurrentPageData();
        expect(dataSource.length).toEqual(pageSize); // jsx column

        const jsxColumns = getJSXColumns();
        const jsxRefObj = {
            current: null,
        };
        const jsxDemo = mount(
            <Table
                dataSource={data}
                ref={jsxRefObj}
                pagination={{
                    pageSize,
                }}
            >
                {jsxColumns}
            </Table>
        );
        const {dataSource: jsxData} = jsxRefObj.current.getCurrentPageData();
        expect(jsxData.length).toEqual(pageSize);
    });
    it('test render expandIcon', async () => {
        const expandedRowRender = () => <div>Semi Design</div>;

        const columns = getColumns();
        const demo = mount(
            <Table
                dataSource={data}
                columns={columns}
                expandedRowRender={expandedRowRender}
                expandIcon={<IconStar size="small"/>}
            />
        );
        expect(demo.find('.semi-icon-star').length).toBeGreaterThan(0);
        const demo2 = mount(
            <Table
                dataSource={data}
                columns={columns}
                expandedRowRender={expandedRowRender}
                defaultExpandAllRows
                expandIcon={expanded => <div>{expanded && <IconStar size="small"/>}</div>}
            />
        );
        expect(demo2.find('.semi-icon-star').length).toBeGreaterThan(0);
    });
    it(`test onRow/onCell`, async () => {
        const onRowClick = sinon.spy(() => {
        });
        const onHeaderRowClick = sinon.spy(() => {
        });
        const onCellClick = sinon.spy(() => {
        });
        const onHeaderCellClick = sinon.spy(() => {
        });
        const onRow = sinon.spy((record, index) => ({
            className: 'test-row',
            onClick: onRowClick,
        }));
        const onHeaderRow = sinon.spy((record, index) => ({
            className: 'test-row',
            onClick: onHeaderRowClick,
        }));
        const columns = getColumns();
        const onCellColumns = columns.map((column, index) => {
            const style =
                index === 0
                    ? {
                        width: 200,
                        height: 60,
                    }
                    : {};

            column.onCell = () => ({
                onClick: onCellClick,
                onCellClick,
                style,
            });

            column.onHeaderCell = () => ({
                onClick: onHeaderCellClick,
                style,
            });

            return column;
        });
        const demo = mount(<Table dataSource={data} onRow={onRow} onHeaderRow={onHeaderRow} columns={onCellColumns}/>);
        const tableCells = demo.find('.semi-table-body .semi-table-row-cell');
        const tableHeaderCells = demo.find('.semi-table-thead .semi-table-row-head'); // cell style

        expect(tableCells.at(0).instance().style.width).toEqual('200px');
        expect(tableCells.at(0).instance().style.height).toEqual('60px');
        expect(tableHeaderCells.at(0).instance().style.width).toEqual('200px');
        expect(tableHeaderCells.at(0).instance().style.height).toEqual('60px'); // body click

        tableCells.at(0).simulate('click');
        expect(onCellClick.called).toBeTruthy();
        const tableRows = demo.find('.semi-table-body .semi-table-row');
        tableRows.at(0).simulate('click');
        expect(onRowClick.called).toBeTruthy(); // header click

        tableHeaderCells.at(0).simulate('click');
        expect(onHeaderCellClick.called).toBeTruthy();
        const tableHeaderRows = demo.find('.semi-table-thead .semi-table-row');
        tableHeaderRows.at(0).simulate('click');
        expect(onHeaderRowClick.called).toBeTruthy();
    });
    it('test header merge', async () => {
        // 测试头部合并
        function testHeaderMerge(demo, params) {
            const rows = demo.find('.semi-table-thead .semi-table-row');
            expect(rows.length).toEqual(2);
            const firstRow = rows.at(0);
            const secondRow = rows.at(1);
            expect(firstRow.childAt(0).instance().colSpan).toEqual(2);
            expect(firstRow.childAt(1).instance().colSpan).toEqual(2);
            expect(firstRow.childAt(2).instance().colSpan).toEqual(1);
            expect(firstRow.childAt(2).instance().rowSpan).toEqual(2);
            expect(secondRow.childAt(0).instance().colSpan).toEqual(1);
            expect(secondRow.childAt(1).instance().colSpan).toEqual(1);
            expect(secondRow.childAt(2).instance().colSpan).toEqual(1);
            expect(secondRow.childAt(3).instance().colSpan).toEqual(1);
        }

        const nestData = getNestData();
        const filters = [
            {
                text: 'Code 45',
                value: '45',
            },
            {
                text: 'King 4',
                value: 'King 4',
            },
        ];
        const jsxDemo = mount(
            <Table dataSource={nestData}>
                <Column title={'Base Information'} dataIndex={'base'} fixed="left">
                    <Column
                        title={'Name'}
                        dataIndex={'name'}
                        fixed="left"
                        width={200}
                        filters={filters}
                        onFilter={(value, record) => record.name.includes(value)}
                    />
                    <Column
                        title={'Age'}
                        dataIndex={'age'}
                        width={100}
                        fixed="left"
                        sorter={(a, b) => (a.age - b.age > 0 ? 1 : -1)}
                    />
                </Column>
                <Column title={'Company Information'} dataIndex={'company'}>
                    <Column title={'Company Name'} dataIndex={'company.name'}/>
                    <Column title={'Company Address'} dataIndex={'company.address'}/>
                </Column>
                <Column title={'Address'} dataIndex={'address'} width={250} fixed="right"/>
            </Table>
        );
        const columns = getNestColumns();
        const demo = mount(<Table dataSource={nestData} columns={columns}/>);
        testHeaderMerge(jsxDemo);
        testHeaderMerge(demo);
    });
    it('test without columns', async () => {
        const jsxDemo = mount(<Table dataSource={data}></Table>);
        const demo = mount(<Table dataSource={data} columns={[]}/>);
        expect(jsxDemo.find('.semi-table-row-head').length).toBe(0);
        expect(jsxDemo.find('.semi-table-row-cell').length).toBe(0);
        expect(demo.find('.semi-table-row-head').length).toBe(0);
        expect(demo.find('.semi-table-row-cell').length).toBe(0);
    });
    it('test useFullRender', async () => {
        const columns = [
            {
                dataIndex: 'name',
                width: 250,
                filters: [
                    {
                        text: '名字包含"1"',
                        value: '1',
                    },
                    {
                        text: '名字包含"2"',
                        value: '2',
                    },
                ],
                onFilter: (value, record) => record.name.indexOf(value) > -1,
                sorter: (a, b) => a.name.length - b.name.length,
                // 此处将useFullRender设置为true开启完全自定义渲染
                useFullRender: true,
                // 此处从render的第四个形参中解构出 展开按钮、选择按钮、文本等内容
                render: (text, record, index, {expandIcon, selection, indentText}) => {
                    return (
                        <span
                            className="custom-render"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            {indentText}
                            {expandIcon}
                            {selection}
                            <span
                                style={{
                                    marginLeft: 8,
                                }}
                            >
                                {text}
                            </span>
                        </span>
                    );
                },
                title: ({sorter, filter, selection}) => (
                    <span
                        className="custom-title"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            paddingLeft: 20,
                        }}
                    >
                        {selection}
                        <span
                            style={{
                                marginLeft: 8,
                            }}
                        >
                            Name
                        </span>
                        {sorter}
                        {filter}
                    </span>
                ),
            },
            {
                title: 'Age',
                dataIndex: 'age',
            },
            {
                title: 'Address',
                dataIndex: 'address',
            },
        ];
        const rowSelection = {
            hidden: true,
            fixed: 'left',
        };
        const demo = mount(
            <Table
                rowSelection={rowSelection}
                columns={columns}
                dataSource={data}
                expandedRowRender={record => <article>{record.description}</article>}
            />
        );
        const node = demo.find('.custom-render').at(0);
        expect(node.children().length).toEqual(3);
        expect(node.childAt(0).exists('.semi-table-expand-icon')).toBeTruthy();
        expect(node.childAt(1).exists('.semi-table-selection-wrap')).toBeTruthy();
        const title = demo.find('.custom-title').at(0);
        expect(title.children().length).toEqual(4);
        expect(title.childAt(0).exists('.semi-table-selection-wrap')).toBeTruthy();
        expect(title.childAt(1).text()).toEqual('Name');
        expect(title.childAt(2).exists('.semi-table-column-sorter')).toBeTruthy();
        expect(title.childAt(3).exists('.semi-table-column-filter')).toBeTruthy();
    });
    it('test defaultExpandedRowKeys changed', async () => {
        const expandedRowRender = (record, index) => <div>{`Semi Design ${index}`}</div>;

        const pageSize = 20;
        const defaultExpandedRowKeys = Array.from({
            length: getRandomNumber(pageSize),
        }).map((_, i) => String(i));
        const newDefaultExpandedRowKeys = Array.from({
            length: getRandomNumber(pageSize),
        }).map((_, i) => String(i));
        const columns = getColumns();
        const demo = mount(
            <Table
                dataSource={data}
                columns={columns}
                expandedRowRender={expandedRowRender}
                defaultExpandedRowKeys={defaultExpandedRowKeys}
                pagination={{
                    pageSize,
                }}
            />
        );
        expect(demo.find(BaseTable).state('expandedRowKeys').length).toEqual(defaultExpandedRowKeys.length);
        demo.setProps({
            defaultExpandedRowKeys: newDefaultExpandedRowKeys,
        });
        // 2.x defaultExpandedRowKeys 不再响应变化
        expect(demo.find(BaseTable).state('expandedRowKeys').length).toEqual(defaultExpandedRowKeys.length);
    });
    it('test getCheckboxProps changed', async () => {
        const defaultGetCheckboxProps = record => ({
            disabled: record.key === '1',
        });

        const newGetCheckboxProps = record => ({
            disabled: ['0', '1'].includes(record.key),
        });

        const columns = getColumns();
        const demo = mount(
            <Table
                dataSource={getData(20)}
                columns={columns}
                pagination={false}
                rowSelection={{
                    getCheckboxProps: defaultGetCheckboxProps,
                }}
            />
        );
        expect(demo.find(BaseTable).state('disabledRowKeys').length).toEqual(1);
        demo.setProps({
            rowSelection: {
                getCheckboxProps: newGetCheckboxProps,
            },
        });
        expect(demo.find(BaseTable).state('disabledRowKeys').length).toEqual(2);
    });
    /**
     * 分页受控场景，更新数据后查看分页器是否保持当前页
     */
    it('test controlled pagination reset when dataSource change', async () => {
        const total = 100;
        const pagination = {
            pageSize: 10,
            currentPage: 2,
        };
        const columns = getColumns();
        const demo = mount(<Table dataSource={getData(total)} columns={columns} pagination={pagination}/>);

        const dataNum = getRandomNumber(100, 40);
        const newData = getData(dataNum);
        demo.setProps({
            dataSource: newData,
        });
        await sleep(2000);
        expect(
          demo
            .find(`.${BASE_CLASS_PREFIX}-page .${BASE_CLASS_PREFIX}-page-item-active`)
            .getDOMNode().innerHTML
        ).toBe('2');
    });

    /**
     * 分页非受控场景，更新数据后查看分页器是否重置
     */
    it('test uncontrolled pagination reset when dataSource change', async () => {
        const total = 100;
        const columns = getColumns();
        const demo = mount(<Table dataSource={getData(total)} columns={columns}/>);
        demo.find(`.${BASE_CLASS_PREFIX}-page .${BASE_CLASS_PREFIX}-page-item`)
          .at(2)
          .simulate('click');
        const dataNum = getRandomNumber(100, 40);
        const newData = getData(dataNum);
        demo.setProps({
            dataSource: newData,
        });
        await sleep(2000);
        demo.update();
        expect(demo.find(`.semi-page .semi-page-item-active`).getDOMNode().innerHTML).toBe('1');
        expect(demo.find(BaseTable).state('pagination')).toHaveProperty('currentPage', 1);
    });

    it('test pagination changed', async () => {
        const total = 100;
        const pagination = {
            pageSize: 10,
            currentPage: 2,
        };
        const newPagination = {
            pageSize: 5,
            currentPage: 1,
        };
        const columns = getColumns();
        const demo = mount(<Table dataSource={getData(total)} columns={columns} pagination={pagination}/>);
        const paginationProps = demo.find(BaseTable).state('pagination');
        expect(paginationProps.total).toEqual(total);
        expect(paginationProps.pageSize).toEqual(pagination.pageSize);
        expect(paginationProps.currentPage).toEqual(pagination.currentPage);
        demo.setProps({
            pagination: newPagination,
        });
        await sleep(2000);
        const newPaginationProps = demo.find(BaseTable).state('pagination');
        expect(newPaginationProps.pageSize).toEqual(newPagination.pageSize);
        expect(newPaginationProps.currentPage).toEqual(newPagination.currentPage);
    });
    it(`test grouped data change dataSource`, async () => {
        const data = getGroupData();
        const columns = getGroupColumns();
        const groupedRowClick = sinon.spy();

        const rowKey = record =>
            `${record.city && record.city.toLowerCase()}-${record.job && record.job.toLowerCase()}`;

        const demo = mount(
            <Table
                dataSource={data}
                rowKey={rowKey}
                groupBy={'city'}
                columns={columns}
                renderGroupSection={groupKey => <strong>Jobs in {groupKey}:</strong>}
                onGroupedRow={(group, index) => ({
                    onClick: groupedRowClick,
                })}
                clickGroupedRowToExpand
                scroll={{
                    y: 480,
                }}
            />
        );
        const newData = [
            {
                city: 'Tianjin',
                job: 'FE',
                department: 'IES',
            },
            {
                city: 'Tianjin',
                job: 'Android',
                department: 'IES',
            },
            {
                city: 'Wuhan',
                job: 'Android',
                department: 'IES',
            },
            {
                city: 'Wuhan',
                job: 'SE',
                department: 'EE',
            },
            {
                city: 'Chengdu',
                job: 'Android',
                department: 'EE',
            },
            {
                city: 'Chengdu',
                job: 'IOS',
                department: 'EE',
            },
            {
                city: 'Xiamen',
                job: 'SE',
                department: 'DATA',
            },
            {
                city: 'Xiamen',
                job: 'IOS',
                department: 'DATA',
            },
        ];
        demo.setProps({
            dataSource: newData,
        });
        expect(demo.find(`.${BASE_CLASS_PREFIX}-table-row-section`).length).toBe(4);
        expect(demo.find(`.${BASE_CLASS_PREFIX}-table-body .${BASE_CLASS_PREFIX}-table-row`).length).toBe(0);
        demo.find(`.${BASE_CLASS_PREFIX}-table-row-section`)
            .at(0)
            .simulate('click');
        expect(demo.find(`.${BASE_CLASS_PREFIX}-table-row`).length).toBeGreaterThan(0);
    });
    it(`test given object columns and children`, async () => {
        const demo = mount(
            <Table dataSource={data} columns={columns}>
                <Table.Column title="Age" dataIndex="age" key="age"/>
            </Table>
        );
        const test = demo.find(BaseTable); // 同时传columns与children时，columns优先

        expect(test.state('cachedColumns')).toEqual(columns);
        expect(test.state('queries').length).toEqual(columns.length);
    });
    it('test header colSpan', async () => {
        const columns = [
            {
                title: 'Name',
                dataIndex: 'name',
            },
            {
                title: 'Age',
                dataIndex: 'age',
            },
            {
                title: 'Home phone',
                colSpan: 2,
                dataIndex: 'tel',
            },
            {
                title: 'Phone',
                colSpan: 0,
                dataIndex: 'phone',
            },
            {
                title: 'Address',
                dataIndex: 'address',
            },
        ];
        const data = [
            {
                key: '1',
                name: 'ZhangSan',
                age: 50,
                tel: '010-20000000',
                phone: 10010,
                address: 'BeiJing No.1 High School',
            },
            {
                key: '2',
                name: 'LiSi',
                tel: '010-30000000',
                phone: 10086,
                age: 40,
                address: 'ShangHai No. 1 High School',
            },
            {
                key: '3',
                name: 'WangWu',
                age: 60,
                tel: '010-40000000',
                phone: 10011,
                address: 'NaiJing No.1 High School',
            },
            {
                key: '4',
                name: 'XiaoMing',
                age: 20,
                tel: '010-50000000',
                phone: 12580,
                address: 'ShiJiaZhuang No.1 High School',
            },
            {
                key: '5',
                name: 'XiaoHong',
                age: 40,
                tel: '010-60000000',
                phone: 12530,
                address: 'TaiBei No.2 High School',
            },
        ];
        const demo = mount(<Table dataSource={data} columns={columns}/>);
        expect(demo.find('.semi-table-row .semi-table-row-head').length).toBe(columns.length - 1);
    });

    it('test expandAllRows', async () => {
        const expandedRowRender = () => <div>Semi Design</div>
        const initData = [];

        const columns = getColumns();
        const demo = mount(<Table
            dataSource={initData}
            columns={columns}
            expandedRowRender={expandedRowRender}
            pagination={false}
            expandAllRows
        />);

        const newData = getData(20);
        demo.setProps({dataSource: newData});
        demo.update();
        const expandedRows = demo.find(`.${BASE_CLASS_PREFIX}-table-tbody .${BASE_CLASS_PREFIX}-table-row-expanded`)
        expect(expandedRows.length).toEqual(newData.length);
        // 动态切换 expandAllRows
        demo.setProps({expandAllRows: false});
        demo.update();
        const newExpandedRows = demo.find(`.${BASE_CLASS_PREFIX}-table-tbody .${BASE_CLASS_PREFIX}-table-row-expanded`)
        expect(newExpandedRows.length).toEqual(0);
    });

    it(`test defaultExpandAllGroupRows`, async () => {
        const data = getGroupData();
        const columns = getGroupColumns();
        const rowKey = record => `${record.city && record.city.toLowerCase()}-${record.job && record.job.toLowerCase()}`;
        const groupSize = new Set(data.map(item => item.city)).size;

        const demo = mount(
            <Table
                dataSource={data}
                rowKey={rowKey}
                groupBy={'city'}
                columns={columns}
                renderGroupSection={groupKey => <strong>Jobs in {groupKey}:</strong>}
                scroll={{y: 480}}
                defaultExpandAllGroupRows
            />
        );

        expect(demo.find(`.${BASE_CLASS_PREFIX}-table-tbody .${BASE_CLASS_PREFIX}-table-row-section.on`).length).toBe(groupSize);
    });

    it(`test expandAllGroupRows`, async () => {
        const data = getGroupData();
        const groupSize = new Set(data.map(item => item.city)).size;
        const columns = getGroupColumns();
        const rowKey = record => `${record.city && record.city.toLowerCase()}-${record.job && record.job.toLowerCase()}`;

        const demo = mount(
            <Table
                dataSource={[]}
                rowKey={rowKey}
                groupBy={'city'}
                columns={columns}
                renderGroupSection={groupKey => <strong>Jobs in {groupKey}:</strong>}
                scroll={{y: 480}}
                expandAllGroupRows={true}
            />
        );

        demo.setProps({dataSource: data});
        demo.update();
        expect(demo.find(`.${BASE_CLASS_PREFIX}-table-tbody .${BASE_CLASS_PREFIX}-table-row-section.on`).length).toBe(groupSize);
        demo.setProps({expandAllGroupRows: false});
        demo.update();
        expect(demo.find(`.${BASE_CLASS_PREFIX}-table-tbody .${BASE_CLASS_PREFIX}-table-row-section.on`).length).toBe(0);
    });

    it('test defaultSortOrder descend', async () => {
        const sortColumns = [
            {
                title: 'Name',
                dataIndex: 'name',
                sorter: (a, b) => a.name.length - b.name.length,
                defaultSortOrder: 'descend',
            },
            {
                title: 'Age',
                dataIndex: 'age',
            },
            {
                title: 'Address',
                dataIndex: 'address',
            }
        ];
        const sortData = [
            {
                key: '1',
                name: 'long name',
                age: 32,
                address: 'New York No. 1 Lake Park',
            },
            {
                key: '2',
                name: 'longest name',
                age: 42,
                address: 'London No. 1 Lake Park',
            },
            {
                key: '3',
                name: 'longer name',
                age: 32,
                address: 'Sidney No. 1 Lake Park',
            },
            {
                key: '4',
                name: 'short',
                age: 32,
                address: 'London No. 2 Lake Park',
            },
        ];
        const onChange = sinon.spy(() => {
        });

        // test default descend
        const targetData = sortData.reduce((a, b) => a.name.length > b.name.length ? a : b);
        const {name} = targetData;
        const sortTable = mount(<Table columns={sortColumns} dataSource={sortData} onChange={onChange}/>);
        const firstCell = sortTable.find('.semi-table-tbody .semi-table-row .semi-table-row-cell').at(0);
        expect(firstCell.text()).toBe(name);

        sortTable.unmount();
    });

    it('test defaultSortOrder descend', async () => {
        const ascendOrderColumns = [
            {
                title: 'Name',
                dataIndex: 'name',
                sorter: (a, b) => a.name.length - b.name.length,
                defaultSortOrder: 'ascend',
            },
            {
                title: 'Age',
                dataIndex: 'age',
            },
            {
                title: 'Address',
                dataIndex: 'address',
            }
        ];
        const sortData = [
            {
                key: '1',
                name: 'long name',
                age: 32,
                address: 'New York No. 1 Lake Park',
            },
            {
                key: '2',
                name: 'longest name',
                age: 42,
                address: 'London No. 1 Lake Park',
            },
            {
                key: '3',
                name: 'longer name',
                age: 32,
                address: 'Sidney No. 1 Lake Park',
            },
            {
                key: '4',
                name: 'short',
                age: 32,
                address: 'London No. 2 Lake Park',
            },
        ];
        const onChange = sinon.spy(() => {
        });

        const sortTable = mount(<Table columns={ascendOrderColumns} dataSource={sortData} onChange={onChange}/>);

        const ascendTargetData = sortData.reduce((a, b) => a.name.length < b.name.length ? a : b);
        const {name: ascendTargetName} = ascendTargetData;
        const ascendFirstCell = sortTable.find('.semi-table-tbody .semi-table-row .semi-table-row-cell').at(0);
        expect(ascendFirstCell.text()).toBe(ascendTargetName);
        sortTable.unmount();
    });

    it('test defaultSortOrder false', async () => {
        const sortColumns = [
            {
                title: 'Name',
                dataIndex: 'name',
                sorter: (a, b) => a.name.length - b.name.length,
                defaultSortOrder: false,
            },
            {
                title: 'Age',
                dataIndex: 'age',
            },
            {
                title: 'Address',
                dataIndex: 'address',
            }
        ];
        const sortData = [
            {
                key: '1',
                name: 'long name',
                age: 32,
                address: 'New York No. 1 Lake Park',
            },
            {
                key: '2',
                name: 'longest name',
                age: 42,
                address: 'London No. 1 Lake Park',
            },
            {
                key: '3',
                name: 'longer name',
                age: 32,
                address: 'Sidney No. 1 Lake Park',
            },
            {
                key: '4',
                name: 'short',
                age: 32,
                address: 'London No. 2 Lake Park',
            },
        ];
        const onChange = sinon.spy(() => {
        });

        const sortTable = mount(<Table columns={sortColumns} dataSource={sortData} onChange={onChange}/>);

        // test default false
        const defaultTargetData = sortData[0]
        const {name: defaultTargetName} = defaultTargetData;
        const defaultFirstCell = sortTable.find('.semi-table-tbody .semi-table-row .semi-table-row-cell').at(0);
        expect(defaultFirstCell.text()).toBe(defaultTargetName);

        // test click sorter
        sortTable.find(`.${BASE_CLASS_PREFIX}-table-thead .${BASE_CLASS_PREFIX}-table-column-sorter`).at(0).simulate('click', {nativeEvent: null});
        expect(onChange.callCount).toBe(1);
        expect(onChange.getCall(0).args[0].sorter.sortOrder).toBe('ascend');
        sortTable.find(`.${BASE_CLASS_PREFIX}-table-thead .${BASE_CLASS_PREFIX}-table-column-sorter`).at(0).simulate('click', {nativeEvent: null});
        expect(onChange.callCount).toBe(2);
        expect(onChange.getCall(1).args[0].sorter.sortOrder).toBe('descend');

        // test change data
        const newData = [
            {
                key: '1',
                name: 'longest name',
                age: 18,
                address: 'New York No. 1 Lake Park',
            },
            {
                key: '2',
                name: 'long name',
                age: 20,
                address: 'London No. 1 Lake Park',
            },
            {
                key: '3',
                name: 'longer name',
                age: 16,
                address: 'Sidney No. 1 Lake Park',
            },
            {
                key: '4',
                name: 'short',
                age: 33,
                address: 'London No. 2 Lake Park',
            },
        ];
        sortTable.setProps({dataSource: newData});
        sortTable.update()
        const newDescendTargetData = newData.reduce((a, b) => a.name.length > b.name.length ? a : b);
        const {name: newDescendTargetName} = newDescendTargetData;
        const newDataFirstCell = sortTable.find('.semi-table-tbody .semi-table-row .semi-table-row-cell').at(0);
        expect(newDataFirstCell.text()).toBe(newDescendTargetName);
        sortTable.unmount();
    });

    it(`test expandRowByClick`, async () => {
        const onExpand = sinon.spy();
        const onExpandedRowsChange = sinon.spy();

        const demo = mount(
            <Table
                columns={columns}
                dataSource={data}
                onExpand={onExpand}
                onExpandedRowsChange={onExpandedRowsChange}
                expandedRowRender={() => <div>Semi Design</div>}
                expandRowByClick
            />
        );

        const table = demo.find(BaseTable);

        const rows = demo.find(`.${BASE_CLASS_PREFIX}-table-tbody .${BASE_CLASS_PREFIX}-table-row`);
        rows.at(0).simulate('click');
        rows.at(1).simulate('click');
        expect(onExpand.calledTwice).toBeTruthy();
        expect(onExpandedRowsChange.calledTwice).toBeTruthy();
        expect(onExpand.getCall(1).args[0]).toEqual(true);
        expect(onExpand.getCall(1).args[1]).toEqual(data[1]);
        expect(onExpand.getCall(1).args[2].constructor.name).toBe('SyntheticEvent');
        expect(onExpandedRowsChange.getCall(1).args[0].length).toEqual(2);
        expect(table.state(`expandedRowKeys`)).toEqual(['0', '1']);
        const expandedRows = demo.find(`.${BASE_CLASS_PREFIX}-table-tbody .${BASE_CLASS_PREFIX}-table-row-expanded`);
        expandedRows.at(0).simulate('click');
        // 查看点击第二次是否折叠
        const newExpandedRows = demo.find(`.${BASE_CLASS_PREFIX}-table-tbody .${BASE_CLASS_PREFIX}-table-row-expanded`)
        expect(newExpandedRows.length).toEqual(1);
        expect(table.state(`expandedRowKeys`)).toEqual(['1']);
    });

    it(`test expanded row re-render`, () => {
        const expandedRowRender = sinon.spy(() => <div>Semi Design</div>);
        const demo = mount(
            <Table
                columns={columns}
                dataSource={data}
                expandedRowRender={expandedRowRender}
            />
        );

        const table = demo.find(BaseTable);

        const expandIcons = demo.find(`.semi-table-tbody .semi-table-row .semi-table-expand-icon`);
        expandIcons.at(0).simulate('click');
        expandIcons.at(1).simulate('click');
        expect(expandedRowRender.calledTwice).toBeTruthy();
    });

    it('test defaultFilteredValue is in onChange when click sorter', () => {
        const columns = [
            {
                title: '标题',
                dataIndex: 'name',
                width: 400,
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
                defaultFilteredValue: ['Semi Pro 设计稿'],
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

        const data = getData(25);

        const onChange = sinon.spy(() => {
        });

        const tableNode = mount(<Table columns={columns} dataSource={data} onChange={onChange}/>);
        tableNode.find('.semi-table-column-sorter').simulate('click');
        expect(onChange.calledOnce).toBe(true);
        const arg = onChange.getCall(0).args[0];
        expect(arg.filters.length).toBe(1);
        expect(arg.filters[0].defaultFilteredValue).toEqual(['Semi Pro 设计稿']);
        expect(arg.filters[0].filteredValue).toEqual(['Semi Pro 设计稿']);
        tableNode.unmount();
    });

    it('test defaultSortOrder is in onChange when click filter', () => {
        const defaultSortOrder = 'ascend';
        const columns = [
            {
                title: '标题',
                dataIndex: 'name',
                width: 400,
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
                defaultFilteredValue: ['Semi Pro 设计稿'],
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

        const data = getData(25);

        const onChange = sinon.spy(() => {
        });

        const tableNode = mount(<Table columns={columns} dataSource={data} onChange={onChange}/>);
        tableNode.find('.semi-table-column-filter').simulate('click');
        const filterNode = Array.from(document.querySelectorAll('.semi-checkbox-addon')).filter(node => node.textContent === 'Semi Design 设计稿');
        filterNode[0].click();
        expect(onChange.calledOnce).toBe(true);
        const arg = onChange.getCall(0).args[0];
        expect(arg.sorter.defaultSortOrder).toBe(defaultSortOrder);
        expect(arg.sorter.sortOrder).toBe(defaultSortOrder);
        tableNode.unmount();
    });
});
