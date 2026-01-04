import { Table, Button } from '@douyinfe/semi-ui';
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';

function App() {
    const [total, setTotal] = useState(406);
    const [pageSize, setPageSize] = useState(10);
    const [dataSource, setDataSource] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [paginationHidden, setPaginationHidden] = useState(false);
    const tableRef = useRef();

    const pagination = useMemo(() => {
        if (paginationHidden) {
            return false;
        }
        return {
            showSizeChanger: true,
            pageSize,
            // currentPage,
            total,
            // onPageChange: currentPage => setCurrentPage(currentPage),
            formatPageText: ({ currentStart, currentEnd, total }) => `${currentStart} - ${currentEnd}， 共 ${total} 条`,
            onPageSizeChange: pageSize => setPageSize(pageSize),
        };
    }, [pageSize, paginationHidden]);

    const randomTotal = useCallback(() => {
        setTotal(Math.ceil(Math.random() * 100) + 40);
    });

    const columns = useMemo(() => [
        {
            title: 'Name',
            dataIndex: 'name',
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
        },
        {
            title: 'Age',
            dataIndex: 'age',
            sorter: (a, b) => (a.age - b.age > 0 ? 1 : -1),
        },
        {
            title: 'Address',
            dataIndex: 'address',
            filters: [
                {
                    text: 'London',
                    value: 'London',
                },
                {
                    text: 'New York',
                    value: 'New York',
                },
            ],
            filterMultiple: false,
            onFilter: (value, record) => record.address.indexOf(value) === 0,
            sorter: (a, b) => a.address.length - b.address.length,
        },
    ]);

    useEffect(() => {
        const data = [];
        const currentPage = 1;
        for (let i = 0; i < total; i++) {
            data.push({
                key: '' + i,
                name: `Edward King ${i}`,
                age: 32,
                address: `London, Park Lane no. ${i}`,
            });
        }

        setDataSource(data);
        setCurrentPage(1);
    }, [total]);

    useEffect(() => {
        if (dataSource.length) {
        }
    }, [currentPage]);

    const togglePagination = useCallback(() => {
        setPaginationHidden(!paginationHidden);
    }, [paginationHidden]);

    const randomPageSize = () => setPageSize(pageSize + Math.floor(10 * Math.random()));

    return (
        <div>
            <Button onClick={randomTotal}>随机数据总数</Button>
            <Button onClick={togglePagination}>{pagination ? '关闭' : '显示'}分页区域</Button>
            <Button onClick={randomPageSize}>随机页容量</Button>
            <Button
                onClick={() =>
                    tableRef.current && console.log('CurrentPageData: ', tableRef.current.getCurrentPageData())
                }
            >
                打印当前页数据
            </Button>
            <Table
                columns={columns}
                dataSource={dataSource}
                pagination={pagination}
                onChange={(...args) => console.log(...args)}
                ref={tableRef}
                scroll={{ y: 400, scrollToFirstRowOnChange: true }}
            />
        </div>
    );
}

export default App;
