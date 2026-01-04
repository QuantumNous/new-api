import React from 'react';
import { Table, Dropdown } from '@douyinfe/semi-ui/';

import Tooltip from '../..';

export default function InTableDemo(props = {}) {
    const getPopupContainer = () => document.querySelector('#dropdown-wrap');

    const columns = [
        {
            title: 'Name',
            dataIndex: 'name',
            width: '30%',
            render: text => {
                return (
                    <div id="dropdown-wrap" style={{ position: 'relative' }}>
                        <Dropdown
                            // getPopupContainer={getPopupContainer}
                            position="rightTop"
                            trigger="click"
                            render={
                                <Dropdown.Menu>
                                    <Dropdown
                                        // getPopupContainer={getPopupContainer}
                                        position="rightTop"
                                        render={
                                            <Dropdown.Menu>
                                                <Dropdown.Item>Menu Item 1</Dropdown.Item>
                                                <Dropdown.Item>Menu Item 2</Dropdown.Item>
                                                <Dropdown.Item>Menu Item 3</Dropdown.Item>
                                            </Dropdown.Menu>
                                        }
                                    >
                                        <Dropdown.Item>Menu Item 1</Dropdown.Item>
                                    </Dropdown>
                                    <Dropdown.Item>Menu Item 2</Dropdown.Item>
                                    <Dropdown.Item>Menu Item 3</Dropdown.Item>
                                </Dropdown.Menu>
                            }
                        >
                            <a href="javascript:;">{text}</a>
                        </Dropdown>
                    </div>
                );
            },
        },
        {
            title: 'Age',
            width: '20%',
            dataIndex: 'age',
        },
        {
            title: 'Address',
            width: '50%',
            dataIndex: 'address',
        },
    ];
    const data = [
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

    return <Table columns={columns} dataSource={data} />;
}
