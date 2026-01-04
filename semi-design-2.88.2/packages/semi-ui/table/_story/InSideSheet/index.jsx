import { SideSheet, Table, Dropdown, Tag, Button } from '../../..';
import React, { useMemo, useState, useEffect } from 'react';

export default function Demo(props = {}) {
    const [visible, setVisible] = useState(false);
    const dropdown = useMemo(
        () => (
            <Dropdown
                clickToHide
                render={
                    <Dropdown.Menu>
                        <Dropdown.Item onClick={() => setVisible(true)}>Show SideSheet</Dropdown.Item>
                    </Dropdown.Menu>
                }
            >
                <Tag>Hover Me</Tag>
            </Dropdown>
        ),
        []
    );

    const columns = useMemo(() => [
        {
            title: 'Name',
            dataIndex: 'name',
            render: text => <a>{text}</a>,
            fixed: 'left',
            width: 150,
        },
        {
            title: 'Age',
            dataIndex: 'age',
        },
        {
            title: 'Address',
            dataIndex: 'address',
        },
        {
            render: () => <div>{dropdown}</div>,
            fixed: 'right',
            width: 150,
        },
    ]);
    const dataTotalSize = 46;
    const data = useMemo(() => {
        const _data = [];
        for (let i = 0; i < dataTotalSize; i++) {
            let age = (i * 1000) % 149 ;
            let name = `Edward King ${i}`;
            _data.push({
                key: '' + i,
                name,
                age,
                address: `London, Park Lane no. ${i} Lake Park`,
                description: `My name is ${name}, I am ${age} years old, living in New York No. ${i + 1} Lake Park.`,
            });
        }
        return _data;
    }, [dataTotalSize]);

    const sideSheet = useMemo(
        () => (
            <SideSheet
                title="自定义尺寸的侧边栏"
                visible={visible}
                onCancel={() => setVisible(false)}
                width={'50vw'}
                height={'100vh'}
                style={{ overflow: 'auto' }}
            >
                <Table
                    columns={columns}
                    dataSource={data}
                    scroll={{ x: '150%', y: 400 }}
                    rowSelection={{ fixed: true }}
                />
            </SideSheet>
        ),
        [visible]
    );

    return (
        <div>
            <div>
                <Button onClick={() => setVisible(true)}>Show side sheet</Button>
            </div>
            {sideSheet}
        </div>
    );
}
