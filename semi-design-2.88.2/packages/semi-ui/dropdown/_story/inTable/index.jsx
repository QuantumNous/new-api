import React, { useState } from 'react';
import { Table, Dropdown, Tooltip, Tag, Popover } from '@douyinfe/semi-ui/';
import { IconCaretdown, IconUser } from '@douyinfe/semi-icons';

const CREATOR_MAP = {
    ALL: {
        value: 0,
        desc: '创建者',
    },
    MINE: {
        value: 1,
        desc: '只看我的',
    },
};

function InTableDemo({}) {
    const [currentCreator, setCurrentCreator] = useState({});

    const setCreator = type => {
        if (type) {
            setCurrentCreator(CREATOR_MAP[type] || {});
        }
    };

    const onDropdownVisibleChange = (...args) => console.log('Dropdown onVisibleChange: ', ...args);

    const onPopoverVisibleChange = (...args) => console.log('Popover onVisibleChange: ', ...args);

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
            title: (
                <Dropdown
                    position={'bottomLeft'}
                    trigger="click"
                    onVisibleChange={onDropdownVisibleChange}
                    render={(
                        <Dropdown.Menu>
                            <Dropdown.Item onClick={() => setCreator('ALL')}>创建者</Dropdown.Item>
                            <Dropdown.Item onClick={() => setCreator('MINE')}>只看我的</Dropdown.Item>
                        </Dropdown.Menu>
                    )}
                >
                    <span>{'点击trigger'}</span>
                    <IconCaretdown />
                </Dropdown>
            ),
            key: 'creator',
            render: () => (
                <div>
                    <Dropdown
                        position={'bottomLeft'}
                        trigger="click"
                        onVisibleChange={onDropdownVisibleChange}
                        render={(
                            <Dropdown.Menu>
                                <Dropdown.Item onClick={() => setCreator('ALL')}>创建者</Dropdown.Item>
                                <Dropdown.Item onClick={() => setCreator('MINE')}>只看我的</Dropdown.Item>
                            </Dropdown.Menu>
                        )}
                    >
                        <span>
                            <span>{currentCreator.desc}</span>
                            <IconCaretdown />
                        </span>
                    </Dropdown>
                    <span
                        style={{
                            marginLeft: 10,
                        }}
                    >
                        <Popover
                            trigger="click"
                            onVisibleChange={onPopoverVisibleChange}
                            content={(
                                <article
                                    style={{
                                        padding: 20,
                                    }}
                                >
                                    123
                                </article>
                            )}
                        >
                            <IconUser />
                        </Popover>
                    </span>
                </div>
            ),
            width: 168,
        },
        {
            title: (
                <Dropdown
                    position={'bottomLeft'}
                    trigger="hover"
                    onVisibleChange={onDropdownVisibleChange}
                    render={(
                        <Dropdown.Menu>
                            <Dropdown.Item onClick={() => setCreator('ALL')}>创建者</Dropdown.Item>
                            <Dropdown.Item onClick={() => setCreator('MINE')}>只看我的</Dropdown.Item>
                        </Dropdown.Menu>
                    )}
                >
                    <span>{'hover trigger'}</span>
                    <IconCaretdown />
                </Dropdown>
            ),
            key: 'hover-creator',
            render: () => (
                <div>
                    <Dropdown
                        position={'bottomLeft'}
                        trigger="hover"
                        onVisibleChange={onDropdownVisibleChange}
                        render={(
                            <Dropdown.Menu>
                                <Dropdown.Item onClick={() => setCreator('ALL')}>创建者</Dropdown.Item>
                                <Dropdown.Item onClick={() => setCreator('MINE')}>只看我的</Dropdown.Item>
                            </Dropdown.Menu>
                        )}
                    >
                        <span>
                            <span>{currentCreator.desc}</span>
                            <IconCaretdown />
                        </span>
                    </Dropdown>
                    <span
                        style={{
                            marginLeft: 10,
                        }}
                    >
                        <Popover
                            trigger="hover"
                            onVisibleChange={onPopoverVisibleChange}
                            content={(
                                <article
                                    style={{
                                        padding: 20,
                                    }}
                                >
                                    123
                                </article>
                            )}
                        >
                            <IconUser />
                        </Popover>
                    </span>
                </div>
            ),
            width: 168,
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
    const dataTotalSize = 43;
    const data = [];

    for (let i = 0; i < dataTotalSize; i++) {
        let age = 40 + i;
        let name = `Edward King ${i}`;
        data.push({
            key: `${i}`,
            name,
            age,
            address: `London, Park Lane no. ${i} Lake Park`,
            description: `My name is ${name}, I am ${age} years old, living in New York No. ${i + 1} Lake Park.`,
        });
    }

    return <Table columns={columns} dataSource={data} />;
}

export default InTableDemo;
