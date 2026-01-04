import { SideSheet, Table, Dropdown, Tag } from '@douyinfe/semi-ui';
import React, { useMemo, useState, useCallback } from 'react';

export default function Demo(props = {}) {
    const [visible, setVisible] = useState(false);
    const dropdown = useMemo(
        () => (
            <Dropdown
                clickToHide
                render={(
                    <Dropdown.Menu>
                        <Dropdown.Item onClick={() => setVisible(true)}>Show SideSheet</Dropdown.Item>
                    </Dropdown.Menu>
                )}
            >
                <Tag>Hover Me</Tag>
            </Dropdown>
        ),
        []
    );
    const getContainer = useCallback(() => document.querySelector('.sidesheet-container'), []);
    const sideSheet = useMemo(
        () => (
            <SideSheet style={{ zIndex: 2 }} maskStyle={{ zIndex: 2 }} getPopupContainer={getContainer} title="自定义尺寸的侧边栏" visible={visible} onCancel={() => setVisible(false)}>
                <p>This is the content of a basic sidesheet.</p>
                <p>Here is more content...</p>
            </SideSheet>
        ),
        [visible]
    );

    const columns = useMemo(() => [
        {
            title: 'Name',
            dataIndex: 'name',
            // eslint-disable-next-line jsx-a11y/anchor-is-valid
            render: text => <a>{text}</a>,
            width: 200,
            fixed: 'left',
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
            width: 200,
            fixed: 'right',
        },
    ]);
    const dataTotalSize = 46;
    const data = useMemo(() => {
        const _data = [];
        for (let i = 0; i < dataTotalSize; i++) {
            let age = (i * 1000) % 149 ;
            let name = `Edward King ${i}`;
            _data.push({
                key: `${ i}`,
                name,
                age,
                address: `London, Park Lane no. ${i} Lake Park`,
                description: `My name is ${name}, I am ${age} years old, living in New York No. ${i + 1} Lake Park.`,
            });
        }
        return _data;
    }, [dataTotalSize]);

    const scroll = useMemo(() => ({ y: 300 }), []);

    return (
        <>
            <div className="sidesheet-container" style={{ position: 'relative', height: 500 }}>
                <Table columns={columns} dataSource={data} scroll={scroll} />
            </div>
            {sideSheet}
        </>
    );
}
