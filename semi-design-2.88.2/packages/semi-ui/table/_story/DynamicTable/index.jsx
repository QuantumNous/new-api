import React from 'react';
import { Table, Switch, ButtonGroup, Button, Tooltip, Tag } from '@douyinfe/semi-ui';

export default class App extends React.Component {
    constructor(props) {
        super(props);
        const dataTotalSize = 46;
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
            {
                render: (text, record) => (
                    <Tooltip content={record.description}>
                        <Tag color="green">Show Info</Tag>
                    </Tooltip>
                ),
                width: 150,
            },
        ];

        const data = [];
        for (let i = 0; i < dataTotalSize; i++) {
            let age = (i * 1000) % 149 ;
            let name = `Edward King ${i}`;
            data.push({
                key: '' + i,
                name,
                age,
                address: `London, Park Lane no. ${i} Lake Park`,
                description: `My name is ${name}, I am ${age} years old, living in New York No. ${i + 1} Lake Park.`,
            });
        }
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
                                text: '姓名中包含 1',
                                value: '1',
                            },
                            {
                                text: '姓名中包含 2',
                                value: '2',
                            },
                            {
                                text: '姓名中包含 3',
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
            let defaultExpandedRowKeys = [];

            if (checked) {
                let dataSource = [...this.state.dataSource];
                defaultExpandedRowKeys.push(
                    ...dataSource.reduce((arr, data) => {
                        if (data.key) {
                            arr.push(data.key);
                        }
                        return arr;
                    }, [])
                );
                this.toggleExpandedRowRender(true);
            }
            this.setState({ defaultExpandedRowKeys });
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

        this.switchSize = size => {
            this.setState({ size });
        };

        this.state = {
            loading: false,
            columns,
            scroll: {},
            rowSelection: null,
            expandedRowRender: null,
            expandCellFixed: false,
            defaultExpandAllRows: false,
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
            defaultExpandAllRows,
            defaultExpandedRowKeys,
            size,
        } = this.state;

        const wrapStyle = { marginBottom: 15, display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap' };

        const TableSwitch = this.TableSwitch;

        return (
            <div>
                <div style={wrapStyle}>
                    <TableSwitch text="固定表头：" checked={scroll && scroll.y} onChange={this.toggleFixHeader} />
                    <TableSwitch text="隐藏表头：" onChange={this.toggleHideHeader} />
                    <TableSwitch text="显示标题：" onChange={this.toggleTitle} />
                    <TableSwitch text="显示底部：" onChange={this.toggleFooter} />
                    <TableSwitch text="固定列：" onChange={this.toggleFixColumns} />
                    <TableSwitch text="显示选择列：" onChange={this.toggleRowSelection} />
                    <TableSwitch text="显示加载状态：" onChange={this.toggleLoading} checked={loading} />
                    <TableSwitch
                        text="无数据："
                        onChange={this.toggleDataSource}
                        checked={!dataSource || !dataSource.length}
                    />
                    <TableSwitch text="开启排序功能：" onChange={this.toggleShowSorter} />
                    <TableSwitch text="开启过滤功能：" onChange={this.toggleShowFilter} />
                    <TableSwitch
                        text="开启行展开功能："
                        onChange={this.toggleExpandedRowRender}
                        checked={typeof expandedRowRender === 'function'}
                    />
                    <TableSwitch text="展开当前所有行：" onChange={this.toggleExpandedRowKeys} />
                    <TableSwitch text="显示边框：" onChange={this.toggleBordered} checked={bordered} />
                    <TableSwitch text="开启列伸缩功能：" onChange={this.toggleResizable} />
                    <TableSwitch text="尺寸：">
                        <ButtonGroup>
                            <Button onClick={() => this.switchSize('default')}>Default</Button>
                            <Button onClick={() => this.switchSize('middle')}>Middle</Button>
                            <Button onClick={() => this.switchSize('small')}>Small</Button>
                        </ButtonGroup>
                    </TableSwitch>
                    <TableSwitch text="分页控件：">
                        <ButtonGroup>
                            <Button onClick={() => this.switchPagination('bottom')}>Bottom</Button>
                            <Button onClick={() => this.switchPagination('top')}>Top</Button>
                            <Button onClick={() => this.switchPagination('both')}>Both</Button>
                            <Button onClick={() => this.switchPagination(false)}>None</Button>
                        </ButtonGroup>
                    </TableSwitch>
                </div>
                <Table
                    size={size}
                    defaultExpandedRowKeys={defaultExpandedRowKeys}
                    onExpandedRowsChange={this.onExpandedRowsChange}
                    title={title}
                    footer={footer}
                    showHeader={showHeader}
                    bordered={bordered}
                    onChange={this.onChange}
                    expandCellFixed={expandCellFixed}
                    expandedRowRender={expandedRowRender}
                    defaultExpandAllRows={defaultExpandAllRows}
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
