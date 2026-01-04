import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Table, Button } from '@douyinfe/semi-ui';

const Demo = props => {
    console.log(props);
    const [total, setTotal] = useState(406);
    const [pageSize, setPageSize] = useState(props.pageSize || 10);
    const [currentPage, setCurrentPage] = useState(props.currentPage || 1);
    useEffect(() => {
        console.log(`didUpdate`, props.pageSize, props.currentPage);
        setPageSize(props.pageSize);
        setCurrentPage(props.currentPage);
    }, [props.pageSize, props.currentPage]);
    const pagination = useMemo(() => {
        console.log('pagination', pageSize, currentPage);
        return {
            showSizeChanger: true,
            pageSize,
            // currentPage,
            total,
            onPageChange: currentPage => setCurrentPage(currentPage),
            onPageSizeChange: pageSize => setPageSize(pageSize),
        };
    }, [pageSize, currentPage]);
    // const pagination = {
    //     showSizeChanger: true,
    //     pageSize,
    //     // currentPage,
    //     total,
    //     onPageChange: currentPage => setCurrentPage(currentPage),
    //     onPageSizeChange: pageSize => setPageSize(pageSize),
    // };
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
    const data = useMemo(() => {
        const data = [];
        for (let i = pageSize * (currentPage - 1); i < Math.min(total, currentPage * pageSize); i++) {
            data.push({
                key: '' + i,
                name: `Edward King ${i}`,
                age: 32,
                address: `London, Park Lane no. ${i}`,
            });
        }
        return data;
    }, [total]);
    return (
        <div>
            <Table
                columns={columns}
                dataSource={data}
                pagination={pagination}
                onChange={(...args) => console.log(...args)}
            />
        </div>
    );
};

export default function App() {
    const demo = props => {
        console.log(props);
        const [total, setTotal] = useState(406);
        // const [pageSize, setPageSize] = useState(10);
        // const [currentPage, setCurrentPage] = useState(1);
        const [pageSize, setPageSize] = useState(props.pageSize || 10);
        const [currentPage, setCurrentPage] = useState(props.currentPage || 1);
        const [pagination, setPagination] = useState({});
        const [dataSource, setDataSource] = useState([]);
        useEffect(() => {
            setPageSize(props.pageSize);
            setCurrentPage(props.currentPage);
            setPagination({
                pageSize: props.pageSize,
                currentPage: props.currentPage,
                total,
                onPageChange: currentPage => setCurrentPage(currentPage),
                onPageSizeChange: pageSize => setPageSize(pageSize),
                showSizeChanger: true,
            });
        }, [props.pageSize, props.currentPage]);
        useEffect(() => {
            const data = [];
            for (let i = pageSize * (currentPage - 1); i < Math.min(total, currentPage * pageSize); i++) {
                data.push({
                    key: '' + i,
                    name: `Edward King ${i}`,
                    age: 32,
                    address: `London, Park Lane no. ${i}`,
                });
            }
            setDataSource(data);
        }, [pagination]);
        // const pagination = useMemo(() => {
        //     console.log('pagination', pageSize, currentPage);
        //     return {
        //         showSizeChanger: true,
        //         pageSize,
        //         currentPage,
        //         total,
        //         onPageChange: currentPage => setCurrentPage(currentPage),
        //         onPageSizeChange: pageSize => setPageSize(pageSize),
        //     };
        // }, [pageSize, currentPage]);
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
        // const data = useMemo(() => {
        //     const data = [];
        //     for (let i = pageSize * (currentPage - 1); i < Math.min(total, currentPage * pageSize); i++) {
        //         data.push({
        //             key: '' + i,
        //             name: `Edward King ${i}`,
        //             age: 32,
        //             address: `London, Park Lane no. ${i}`,
        //         });
        //     }
        //     return data;
        // }, [total, currentPage, pageSize]);
        return (
            <div>
                <Table
                    columns={columns}
                    dataSource={dataSource}
                    pagination={pagination}
                    onChange={(...args) => console.log(...args)}
                />
            </div>
        );
    };
    const [config, setConfig] = useState({ pageSize: 10, currentPage: 5 });
    const [pageSize, setPageSize] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const onClick = () => {
        const arr = [
            { pageSize: 5, currentPage: 3 },
            { pageSize: 10, currentPage: 8 },
            { pageSize: 20, currentPage: 10 },
            { pageSize: 50, currentPage: 12 },
            { pageSize: 100, currentPage: 15 },
        ];
        const num = Math.floor(Math.random() * 10) % arr.length;

        setConfig(arr[num]);
    };
    return (
        <div>
            <Button onClick={onClick}>更新Pagination参数</Button>
            {demo(config)}
        </div>
    );
}
